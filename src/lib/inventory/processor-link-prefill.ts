import "server-only";

export type ProcessorPrefill = {
  manufacturer: "Intel" | "AMD";
  name: string;
  specs: Record<string, string>;
};

const MAX_HTML_BYTES = 2_500_000;
const labels: Record<string, string[]> = {
  socket: ["socket", "socket type", "cpu socket"],
  cores: ["total cores", "cpu cores", "# of cpu cores", "number of cpu cores", "cores"],
  threads: ["total threads", "threads", "# of threads"],
  baseClockMhz: ["base frequency", "base clock", "processor base frequency"],
  boostClockMhz: ["max turbo frequency", "max boost clock", "maximum turbo frequency", "max. boost clock"],
  tdpW: ["default tdp", "tdp", "processor base power", "thermal design power"],
  integratedGraphics: ["processor graphics", "graphics model", "integrated graphics"],
  memoryTypes: ["system memory type", "memory type", "system memory specification"],
  maxMemoryFrequencyMhz: ["max memory speed", "memory speed", "system memory specification"],
  maxMemoryCapacityGb: ["max memory size", "maximum memory capacity", "max memory capacity"],
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&copy;/gi, "©")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function normalizeLabel(value: string) {
  return plainText(value).replace(/\s*[:：]\s*$/, "").toLocaleLowerCase("en-US");
}

function specificationRows(html: string) {
  const rows = new Map<string, string>();
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => plainText(match[1]));
    for (let index = 0; index < cells.length - 1; index += 1) {
      const key = normalizeLabel(cells[index]);
      if (key && cells[index + 1]) rows.set(key, cells[index + 1]);
    }
  }
  for (const [, block] of html.matchAll(/<(?:dt|[^>]*class=["'][^"']*(?:label|name)[^"']*["'][^>]*)>([\s\S]*?)<\/(?:dt|[^>]+)>/gi)) {
    const key = normalizeLabel(block);
    const next = html.slice((html.indexOf(block) || 0) + block.length, (html.indexOf(block) || 0) + block.length + 800);
    const value = next.match(/<(?:dd|[^>]*class=["'][^"']*(?:value|spec)[^"']*["'][^>]*)>([\s\S]*?)<\/(?:dd|[^>]+)>/i)?.[1];
    if (key && value) rows.set(key, plainText(value));
  }
  return rows;
}

function extractMeta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta\\b(?=[^>]*(?:property|name)=["']${escaped}["'])[^>]*content=["']([^"']+)["'][^>]*>`, "i"))
    ?? html.match(new RegExp(`<meta\\b(?=[^>]*content=["']([^"']+)["'])[^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i"));
  return match?.[1] ? plainText(match[1]) : undefined;
}

function productName(html: string) {
  const title = extractMeta(html, "og:title")
    || plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")
    || plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (!title || /^(?:(?:intel|amd)\s*)?(?:processor specifications|product specifications|intel ark|amd specifications)$/i.test(title)) return undefined;
  return title
    .replace(/\s*[|–-]\s*(?:Intel|AMD).*$/i, "")
    .replace(/\s+(?:Desktop|Mobile|Server)?\s*Processor\s*$/i, "")
    .replace(/\s*[®™]+/g, "")
    .replace(/^(?:Intel|AMD)\s+/i, "")
    .trim();
}

function valueFor(rows: Map<string, string>, field: keyof typeof labels) {
  for (const label of labels[field]) {
    const exact = rows.get(label);
    if (exact) return exact;
    for (const [key, value] of rows) if (key.startsWith(`${label} `) || key === `${label} (s)` ) return value;
  }
  return undefined;
}

function numberFrom(value: string | undefined, unit: "MHz" | "W" | "GB" | "count") {
  if (!value) return undefined;
  if (unit === "MHz") {
    const clock = value.match(/([\d,.]+)\s*(GHz|MHz)\b/i);
    if (clock) {
      const parsedClock = Number(clock[1].replace(",", "."));
      return /ghz/i.test(clock[2]) ? parsedClock * 1000 : parsedClock;
    }
    const ddrSpeed = value.match(/DDR\d\s*[- ]\s*(\d{3,5})/i);
    if (ddrSpeed) return Number(ddrSpeed[1]);
  }
  const match = unit === "count"
    ? value.match(/\d+/)
    : value.match(/([\d,.]+)\s*(GHz|MHz|W|GB|TB)?/i);
  if (!match) return undefined;
  const parsed = Number(match[1].replace(",", "."));
  if (!Number.isFinite(parsed)) return undefined;
  if (unit === "MHz") return /ghz/i.test(match[2] ?? "") ? parsed * 1000 : parsed;
  if (unit === "W") return parsed;
  if (unit === "GB") return /tb/i.test(match[2] ?? "") ? parsed * 1000 : parsed;
  return parsed;
}

export function parseProcessorPage(html: string, manufacturer: ProcessorPrefill["manufacturer"]): ProcessorPrefill {
  const rows = specificationRows(html);
  const specs: Record<string, string> = {};
  const name = productName(html);
  const socket = valueFor(rows, "socket");
  if (socket) specs.socket = socket;

  const cores = numberFrom(valueFor(rows, "cores"), "count");
  if (cores !== undefined) specs.cores = String(cores);
  const threads = numberFrom(valueFor(rows, "threads"), "count");
  if (threads !== undefined) specs.threads = String(threads);
  const baseClock = numberFrom(valueFor(rows, "baseClockMhz"), "MHz");
  if (baseClock !== undefined) specs.baseClockMhz = String(baseClock);
  const boostClock = numberFrom(valueFor(rows, "boostClockMhz"), "MHz");
  if (boostClock !== undefined) specs.boostClockMhz = String(boostClock);
  const tdp = numberFrom(valueFor(rows, "tdpW"), "W");
  if (tdp !== undefined) specs.tdpW = String(tdp);
  const memory = valueFor(rows, "memoryTypes");
  if (memory) {
    const types = [...new Set(memory.match(/\b(?:DDR[3-6]|LPDDR[3-6](?:X|T)?)\b/gi) ?? [])];
    if (types.length) specs.memoryTypes = types.join(", ");
  }
  const memorySpeed = valueFor(rows, "maxMemoryFrequencyMhz");
  const maxMemoryFrequency = numberFrom(memorySpeed, "MHz");
  if (maxMemoryFrequency !== undefined) specs.maxMemoryFrequencyMhz = String(maxMemoryFrequency);
  const memoryCapacity = numberFrom(valueFor(rows, "maxMemoryCapacityGb"), "GB");
  if (memoryCapacity !== undefined) specs.maxMemoryCapacityGb = String(memoryCapacity);

  const graphics = valueFor(rows, "integratedGraphics");
  if (graphics) {
    if (/^(?:no|none|not available|not applicable|n\/a|sem gráficos)$/i.test(graphics.trim())) specs.integratedGraphics = "false";
    else if (/^(?:yes|sim)$/i.test(graphics.trim()) || /(?:uhd|iris|radeon|vega|graphics|graphics model)/i.test(graphics)) specs.integratedGraphics = "true";
  }

  if (!name && !Object.keys(specs).length) throw new Error("Não encontrei especificações de processador nessa página.");
  return { manufacturer, name: name ?? "", specs };
}

export async function readProcessorLink(rawUrl: string): Promise<ProcessorPrefill> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(rawUrl);
  } catch {
    throw new Error("Informe um link válido de produto.");
  }
  if (currentUrl.protocol !== "https:" || currentUrl.username || currentUrl.password || (currentUrl.port && currentUrl.port !== "443")) {
    throw new Error("Só aceito links HTTPS oficiais do Intel ARK ou da AMD.");
  }

  let manufacturer: ProcessorPrefill["manufacturer"];
  if (["intel.com", "www.intel.com", "ark.intel.com"].includes(currentUrl.hostname)) manufacturer = "Intel";
  else if (["amd.com", "www.amd.com"].includes(currentUrl.hostname)) manufacturer = "AMD";
  else throw new Error("Use um link oficial do Intel ARK ou do site da AMD.");
  if (manufacturer === "Intel" && !/\/ark\/products\/\d+\//i.test(currentUrl.pathname)) {
    throw new Error("Cole a página específica do processador no Intel ARK, não uma busca ou página de catálogo.");
  }
  if (manufacturer === "AMD" && (!/\/products\/processors\//i.test(currentUrl.pathname) || !/\.html?$/i.test(currentUrl.pathname))) {
    throw new Error("Cole a página específica do processador na AMD, não a lista geral de especificações.");
  }

  let html = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const hostAllowed = manufacturer === "Intel"
      ? ["intel.com", "www.intel.com", "ark.intel.com"].includes(currentUrl.hostname)
      : ["amd.com", "www.amd.com"].includes(currentUrl.hostname);
    if (!hostAllowed) throw new Error("A página oficial redirecionou para um domínio não permitido.");
    if (currentUrl.protocol !== "https:" || currentUrl.username || currentUrl.password || (currentUrl.port && currentUrl.port !== "443")) {
      throw new Error("O redirecionamento saiu do endereço HTTPS oficial.");
    }

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        headers: { accept: "text/html", "user-agent": "Leaf-Assemble processor specification prefill" },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error("Não foi possível acessar a página oficial. Tente novamente mais tarde.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("A página oficial retornou um redirecionamento inválido.");
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    if (!response.ok) throw new Error(`O site oficial respondeu com status ${response.status}.`);
    if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("O link não retornou uma página de produto HTML.");
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) throw new Error("A página do produto é grande demais para ler com segurança.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("A página do produto veio vazia.");
    let length = 0;
    const decoder = new TextDecoder();
    html = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("A página do produto é grande demais para ler com segurança.");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    break;
  }
  if (!html) throw new Error("A página oficial redirecionou muitas vezes.");
  return parseProcessorPage(html, manufacturer);
}

