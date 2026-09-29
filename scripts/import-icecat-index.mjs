import { createReadStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { createGunzip, gunzipSync } from "node:zlib";

const args = process.argv.slice(2);
const inputPath = args[0];
const suppliersPath = args[1];
if (!inputPath || !suppliersPath) {
  console.error("Uso: npm run icecat:import -- caminho/para/vertical-index.xml[.gz] caminho/para/SuppliersList.xml[.gz]");
  process.exit(1);
}

if (!existsSync(inputPath)) {
  console.error(`Arquivo de índice não encontrado: ${resolve(inputPath)}`);
  process.exit(1);
}
if (!existsSync(suppliersPath)) {
  console.error(`Arquivo de marcas não encontrado: ${resolve(suppliersPath)}. O nome oficial costuma ser SuppliersList.xml.gz.`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.");
  process.exit(1);
}

function decodeXml(value) {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attributes(value) {
  const result = {};
  for (const match of value.matchAll(/([\w-]+)="([^"]*)"/g)) result[match[1]] = decodeXml(match[2]);
  return result;
}

function positiveInteger(value) {
  return /^\d+$/.test(value ?? "") && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : null;
}

let supplierXml = readFileSync(suppliersPath);
if (suppliersPath.toLowerCase().endsWith(".gz")) supplierXml = gunzipSync(supplierXml);
const supplierSource = supplierXml.toString("utf8");
const suppliers = new Map();
for (const match of supplierSource.matchAll(/<Supplier\b([^>]*)/gi)) {
  const attr = attributes(match[1]);
  const id = positiveInteger(attr.ID);
  const name = attr.Name?.trim();
  if (id && name) suppliers.set(id, name);
}

if (suppliers.size === 0) {
  console.error("Nenhuma marca válida foi encontrada. Confira se o segundo arquivo é SuppliersList.xml.gz do Icecat.");
  process.exit(1);
}

const endpoint = new URL("/rest/v1/icecat_catalog?on_conflict=icecat_id", supabaseUrl);
const batchSize = 500;
const maxRecordLength = 32 * 1024 * 1024;
const productBatch = [];
const removedBatch = [];
let indexedCount = 0;
let removedCount = 0;

async function uploadRows(rows) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 4000) || response.statusText;
    if ((response.status >= 500 || response.status === 413) && rows.length > 1) {
      const middle = Math.ceil(rows.length / 2);
      console.warn(`Lote de ${rows.length} produtos falhou com HTTP ${response.status}; tentando em partes menores.`);
      await uploadRows(rows.slice(0, middle));
      await uploadRows(rows.slice(middle));
      return;
    }
    const record = rows[0];
    throw new Error(
      `Falha ao importar lote de produtos: HTTP ${response.status}. ` +
      `Icecat ID ${record?.icecat_id ?? "desconhecido"}, produto ${record?.supplier_name ?? ""} ${record?.model_name ?? ""}. ` +
      `Resposta do Supabase: ${detail}`,
    );
  }
  indexedCount += rows.length;
  console.log(`Importados ${indexedCount} produtos.`);
}

async function uploadProducts() {
  if (productBatch.length === 0) return;
  const rows = productBatch.splice(0, productBatch.length);
  await uploadRows(rows);
}

async function removeProducts() {
  if (removedBatch.length === 0) return;
  const ids = removedBatch.splice(0, removedBatch.length);
  const deleteUrl = new URL("/rest/v1/icecat_catalog", supabaseUrl);
  deleteUrl.searchParams.set("icecat_id", `in.(${ids.join(",")})`);
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) throw new Error(`Falha ao remover produtos retirados do catálogo: HTTP ${response.status}`);
  removedCount += ids.length;
}

async function processRecord(attributeText, body) {
  const attr = attributes(attributeText);
  const id = positiveInteger(attr.Product_ID);
  const quality = attr.Quality?.trim();
  if (id && quality === "REMOVED") {
    removedBatch.push(id);
    if (removedBatch.length >= batchSize) await removeProducts();
    return;
  }

  const supplierId = positiveInteger(attr.Supplier_id);
  const supplierName = supplierId ? suppliers.get(supplierId) : null;
  const productCode = attr.Prod_ID?.trim();
  const modelName = attr.Model_Name?.trim() || productCode;
  if (!id || !supplierId || !supplierName || !productCode || !modelName || !quality) return;

  const gtins = [...body.matchAll(/<EAN_UPC\b[^>]*\bValue="([^"]+)"/gi)]
    .map((ean) => decodeXml(ean[1]).trim())
    .filter((ean) => /^\d{8,14}$/.test(ean));
  productBatch.push({
    icecat_id: id,
    supplier_id: supplierId,
    supplier_name: supplierName,
    product_code: productCode,
    model_name: modelName,
    category_id: positiveInteger(attr.Catid),
    quality,
    gtins: [...new Set(gtins)],
    image_url: attr.HighPic?.startsWith("https://") ? attr.HighPic : null,
    updated_at: /^\d{14}$/.test(attr.Updated ?? "")
      ? `${attr.Updated.slice(0, 4)}-${attr.Updated.slice(4, 6)}-${attr.Updated.slice(6, 8)}T${attr.Updated.slice(8, 10)}:${attr.Updated.slice(10, 12)}:${attr.Updated.slice(12, 14)}Z`
      : null,
  });
  if (productBatch.length >= batchSize) await uploadProducts();
}

const indexFile = createReadStream(inputPath);
const xmlStream = inputPath.toLowerCase().endsWith(".gz") ? indexFile.pipe(createGunzip()) : indexFile;
const decoder = new StringDecoder("utf8");
const recordPattern = /<file\b([^>]*?)(?:\/>|>([\s\S]*?)<\/file\s*>)/i;
let pending = "";

async function consume(chunk) {
  pending += chunk;
  while (true) {
    const start = pending.search(/<file\b/i);
    if (start < 0) {
      pending = pending.slice(-5);
      return;
    }
    if (start > 0) pending = pending.slice(start);

    const match = recordPattern.exec(pending);
    if (!match) {
      if (pending.length > maxRecordLength) throw new Error("Um registro do índice excedeu o limite esperado; confira se o arquivo é um índice XML Icecat válido.");
      return;
    }

    await processRecord(match[1], match[2] ?? "");
    pending = pending.slice(match[0].length);
  }
}

console.log("Lendo o índice Icecat e enviando produtos em lotes ao Supabase...");
for await (const chunk of xmlStream) await consume(decoder.write(chunk));
await consume(decoder.end());
await uploadProducts();
await removeProducts();

if (indexedCount === 0 && removedCount === 0) {
  console.error("Nenhum produto válido foi encontrado. Confira se o primeiro arquivo é o índice XML vertical do Icecat.");
  process.exit(1);
}

console.log(`Importação concluída: ${indexedCount} produtos indexados e ${removedCount} produtos removidos.`);
