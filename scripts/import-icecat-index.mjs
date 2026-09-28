import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const args = process.argv.slice(2);
const inputPath = args[0];
const suppliersPath = args[1];
if (!inputPath || !suppliersPath) {
  console.error("Uso: npm run icecat:import -- caminho/para/vertical-index.xml[.gz] caminho/para/SuppliersList.xml[.gz]");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.");
  process.exit(1);
}

let xml = readFileSync(inputPath);
if (inputPath.toLowerCase().endsWith(".gz")) xml = gunzipSync(xml);
const source = xml.toString("utf8");
let supplierXml = readFileSync(suppliersPath);
if (suppliersPath.toLowerCase().endsWith(".gz")) supplierXml = gunzipSync(supplierXml);
const supplierSource = supplierXml.toString("utf8");

function decodeXml(value) {
  return value
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

const products = new Map();
const removedProductIds = new Set();
const suppliers = new Map();
for (const match of supplierSource.matchAll(/<Supplier\b([^>]*)/gi)) {
  const attr = attributes(match[1]);
  const id = positiveInteger(attr.ID);
  const name = attr.Name?.trim();
  if (id && name) suppliers.set(id, name);
}

if (suppliers.size === 0) {
  console.error("Nenhuma marca válida foi encontrada. Confira se o segundo arquivo é SuppliersList.xml do Icecat.");
  process.exit(1);
}

for (const match of source.matchAll(/<file\b([^>]*)>([\s\S]*?)<\/file>/gi)) {
  const attr = attributes(match[1]);
  const id = positiveInteger(attr.Product_ID);
  const supplierId = positiveInteger(attr.Supplier_id);
  const supplierName = supplierId ? suppliers.get(supplierId) : null;
  const productCode = attr.Prod_ID?.trim();
  const modelName = attr.Model_Name?.trim() || productCode;
  const quality = attr.Quality?.trim();
  if (id && quality === "REMOVED") {
    removedProductIds.add(id);
    continue;
  }
  if (!id || !supplierId || !supplierName || !productCode || !modelName || !quality) continue;

  const gtins = [...match[2].matchAll(/<EAN_UPC\b[^>]*\bValue="([^"]+)"/gi)]
    .map((ean) => decodeXml(ean[1]).trim())
    .filter((ean) => /^\d{8,14}$/.test(ean));
  products.set(id, {
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
}

if (products.size === 0 && removedProductIds.size === 0) {
  console.error("Nenhum item válido foi encontrado. Confira se o arquivo é um índice XML do Icecat.");
  process.exit(1);
}

const endpoint = new URL("/rest/v1/icecat_catalog?on_conflict=icecat_id", supabaseUrl);
const rows = [...products.values()];
const batchSize = 500;
for (let offset = 0; offset < rows.length; offset += batchSize) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows.slice(offset, offset + batchSize)),
  });
  if (!response.ok) {
    console.error(`Falha ao importar lote ${Math.floor(offset / batchSize) + 1}: HTTP ${response.status}`);
    process.exit(1);
  }
  console.log(`Importados ${Math.min(offset + batchSize, rows.length)} de ${rows.length} produtos.`);
}

const removedIds = [...removedProductIds];
for (let offset = 0; offset < removedIds.length; offset += batchSize) {
  const ids = removedIds.slice(offset, offset + batchSize);
  const deleteUrl = new URL("/rest/v1/icecat_catalog", supabaseUrl);
  deleteUrl.searchParams.set("icecat_id", `in.(${ids.join(",")})`);
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) {
    console.error(`Falha ao remover fichas retiradas do catálogo: HTTP ${response.status}`);
    process.exit(1);
  }
}

console.log(`Importação concluída: ${rows.length} produtos indexados e ${removedIds.length} produtos removidos.`);
