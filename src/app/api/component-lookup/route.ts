import { NextRequest, NextResponse } from "next/server";

import { requireAdminProfile } from "@/lib/auth/profile";
import {
  componentCategorySchema,
  specFields,
  type ComponentCategory,
} from "@/lib/inventory/specs";

export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;
type ProductFeature = { group: string; name: string; value: string };

const featureAliases: Record<ComponentCategory, Record<string, string[]>> = {
  CPU: {
    socket: ["processor socket", "socket", "soquete do processador"],
    cores: ["processor cores", "number of cores", "núcleos do processador", "número de núcleos"],
    threads: ["processor threads", "threads", "threads do processador"],
    baseClockMhz: ["processor base frequency", "base clock", "frequência base do processador"],
    boostClockMhz: ["processor boost frequency", "max turbo frequency", "frequência turbo máxima"],
    tdpW: ["thermal design power", "tdp", "potência de design térmico"],
    integratedGraphics: ["on-board graphics adapter", "integrated graphics adapter", "adaptador gráfico integrado"],
    memoryTypes: ["memory types supported by processor", "supported memory types", "tipos de memória suportados"],
  },
  MOTHERBOARD: {
    socket: ["processor socket", "socket", "soquete do processador"],
    chipset: ["motherboard chipset", "chipset da placa-mãe"],
    formFactor: ["motherboard form factor", "form factor", "formato da placa-mãe"],
    memoryType: ["supported memory types", "memory types", "tipos de memória suportados"],
    memorySlots: ["number of memory slots", "memory slots", "número de slots de memória"],
    maxMemoryGb: ["maximum internal memory", "maximum memory", "memória interna máxima", "memória máxima"],
    supportedMemoryFrequenciesMhz: ["supported memory clock speeds", "memory clock speeds", "frequências de memória suportadas"],
    eccSupport: ["ecc", "ecc support", "suporte ecc"],
    storageInterfaces: ["supported storage drive interfaces", "storage drive interfaces", "interfaces de armazenamento"],
    pcieSlots: ["number of pcie slots", "pci express x16 slots", "slots pcie"],
  },
  RAM: {
    memoryType: ["internal memory type", "memory type", "tipo de memória"],
    capacityGb: ["internal memory", "memory capacity", "capacity", "capacidade de memória", "capacidade"],
    frequencyMhz: ["memory clock speed", "memory frequency", "frequência da memória"],
    casLatency: ["cas latency", "latência cas"],
    voltage: ["memory voltage", "voltage", "tensão da memória"],
    moduleCount: ["memory layout", "module count", "número de módulos"],
    formFactor: ["memory form factor", "form factor", "formato da memória"],
    ecc: ["ecc", "error correction code"],
    registered: ["registered", "registered memory"],
  },
  GPU: {
    vramGb: ["discrete graphics adapter memory", "graphics card memory", "dedicated graphics memory", "memória da placa gráfica"],
    interface: ["interface type", "bus type", "pci express", "tipo de interface"],
    lengthMm: ["graphics card length", "card length", "comprimento da placa gráfica"],
    powerConnectors: ["supplementary power connectors", "power connectors", "conectores de alimentação"],
    recommendedPsuW: ["minimum system power supply", "recommended power supply", "fonte de alimentação mínima"],
    tdpW: ["thermal design power", "graphics card power", "tdp", "consumo de energia"],
  },
  STORAGE: {
    type: ["storage drive type", "drive type", "tipo de unidade"],
    capacityGb: ["storage drive capacity", "capacity", "capacidade da unidade"],
    interface: ["storage drive interface", "interface", "interface da unidade"],
    formFactor: ["storage drive form factor", "form factor", "formato da unidade"],
    readSpeedMbS: ["read speed", "sequential read", "velocidade de leitura"],
    writeSpeedMbS: ["write speed", "sequential write", "velocidade de gravação"],
  },
  PSU: {
    wattageW: ["total power", "rated power", "power", "potência total", "potência nominal"],
    efficiencyRating: ["80 plus certification", "80 plus", "efficiency", "certificação 80 plus"],
    formFactor: ["power supply unit form factor", "psu form factor", "form factor", "formato da fonte"],
    connectors: ["power connectors", "cabling type", "conectores de alimentação"],
  },
  CASE: {
    formFactorSupport: ["supported motherboard form factors", "motherboard form factor", "formatos de placa-mãe suportados"],
    gpuMaxLengthMm: ["maximum graphics card length", "maximum gpu length", "comprimento máximo da placa gráfica"],
    cpuCoolerMaxHeightMm: ["maximum cpu cooler height", "altura máxima do cooler de cpu"],
    psuFormFactors: ["supported power supply form factors", "psu form factor", "formatos de fonte suportados"],
    driveBays25: ["number of 2.5 bays", "2.5 bays", "baias de 2.5"],
    driveBays35: ["number of 3.5 bays", "3.5 bays", "baias de 3.5"],
  },
  CPU_COOLER: {
    supportedSockets: ["supported processor sockets", "compatible processor sockets", "soquetes de processador compatíveis"],
    heightMm: ["cooler height", "height", "altura do cooler"],
    tdpRatingW: ["thermal design power", "tdp rating", "capacidade térmica"],
    formFactor: ["cooler type", "cooler form factor", "tipo de cooler"],
  },
};

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function collectFeatures(data: JsonObject): ProductFeature[] {
  const groups = Array.isArray(data.FeaturesGroups) ? data.FeaturesGroups : [];
  const result: ProductFeature[] = [];
  for (const groupValue of groups) {
    const group = asObject(groupValue);
    const featureGroup = asObject(group?.FeatureGroup);
    const groupName = asText(asObject(featureGroup?.Name)?.Value);
    const features = Array.isArray(group?.Features) ? group.Features : [];
    for (const featureValue of features) {
      const feature = asObject(featureValue);
      const name = asText(asObject(asObject(feature?.Feature)?.Name)?.Value);
      const value = asText(feature?.PresentationValue) || asText(feature?.RawValue) || asText(feature?.Value);
      if (name && value) result.push({
        group: groupName.replace(/\s+/g, " ").slice(0, 120),
        name: name.replace(/\s+/g, " ").slice(0, 120),
        value: value.replace(/\s+/g, " ").slice(0, 240),
      });
      if (result.length >= 200) return result;
    }
  }
  return result;
}

function firstNumeric(value: string) {
  const match = value.replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function mapFeatureValue(category: ComponentCategory, key: string, value: string) {
  const field = specFields[category].find((item) => item.key === key);
  if (!field) return undefined;
  if (field.type === "number") return firstNumeric(value)?.toString();
  if (field.type === "number-list") {
    const numbers = value.replace(/,/g, ".").match(/\d+(?:\.\d+)?/g);
    return numbers?.join(", ");
  }
  if (field.type === "boolean") {
    const valueNormalized = normalized(value);
    if (/^(yes|supported|true|sim|suportado|integrated|on board)$/.test(valueNormalized)) return "true";
    if (/^(no|not supported|false|nao|unsupported|none)$/.test(valueNormalized)) return "false";
    return undefined;
  }
  return value.replace(/[\r\n]+/g, ", ").trim();
}

function mappedSpecs(category: ComponentCategory, features: ProductFeature[]) {
  const mapped: Record<string, string> = {};
  for (const feature of features) {
    const label = normalized(feature.name);
    for (const [key, aliases] of Object.entries(featureAliases[category])) {
      if (mapped[key]) continue;
      if (!aliases.some((alias) => label === normalized(alias) || label.startsWith(`${normalized(alias)} `))) continue;
      const value = mapFeatureValue(category, key, feature.value);
      if (value !== undefined && value !== "") mapped[key] = value;
    }
  }
  return mapped;
}

function safeIcecatProductUrl(value: string, productCode: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && (url.hostname === "icecat.biz" || url.hostname.endsWith(".icecat.biz"))) {
      return url.toString();
    }
  } catch {
    // Use the provider's own search page when a product record has no safe ficha URL.
  }
  return `https://icecat.biz/en/search?keyword=${encodeURIComponent(productCode)}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminProfile();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const categoryResult = componentCategorySchema.safeParse(params.get("category"));
  const brand = params.get("manufacturer")?.trim() ?? "";
  const productCode = params.get("model")?.trim() ?? "";
  const icecatId = params.get("icecatId")?.trim() ?? "";
  const hasIcecatId = /^\d{1,15}$/.test(icecatId) && Number(icecatId) > 0;
  const hasBrandAndCode = brand.length >= 1 && brand.length <= 100 && productCode.length >= 1 && productCode.length <= 140;
  if (!categoryResult.success || (!hasIcecatId && !hasBrandAndCode)) {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  }

  const username = process.env.ICECAT_USERNAME;
  const apiToken = process.env.ICECAT_API_TOKEN;
  if (!username || !apiToken) {
    return NextResponse.json({ error: "not-configured" }, { status: 503 });
  }

  const icecatUrl = new URL("https://live.icecat.biz/api/");
  icecatUrl.searchParams.set("shopname", username);
  icecatUrl.searchParams.set("lang", "BR");
  icecatUrl.searchParams.set("content", "");
  if (hasIcecatId) {
    icecatUrl.searchParams.set("icecat_id", icecatId);
  } else {
    icecatUrl.searchParams.set("Brand", brand);
    icecatUrl.searchParams.set("ProductCode", productCode.toUpperCase());
  }

  try {
    const response = await fetch(icecatUrl, {
      headers: { "api-token": apiToken, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 404) return NextResponse.json({ error: "not-found" }, { status: 404 });
    if (!response.ok) return NextResponse.json({ error: "provider-error" }, { status: 502 });

    const body = asObject(await response.json());
    const data = asObject(body?.data);
    const generalInfo = asObject(data?.GeneralInfo);
    if (!data || !generalInfo) return NextResponse.json({ error: "not-found" }, { status: 404 });

    const features = collectFeatures(data);
    const description = asObject(generalInfo.Description);
    const summary = asObject(generalInfo.SummaryDescription);
    const resolvedProductCode = asText(generalInfo.BrandPartCode) || productCode || icecatId;
    const title = asText(generalInfo.Title) || asText(generalInfo.ProductName) || resolvedProductCode;
    const providerSourceUrl = asText(description?.URL);
    const sourceUrl = safeIcecatProductUrl(providerSourceUrl, resolvedProductCode);
    const image = asObject(data.Image);
    const sourceData = {
      provider: "Icecat Open Catalog",
      productCode: resolvedProductCode,
      brand: asText(asObject(generalInfo.BrandInfo)?.BrandName) || asText(generalInfo.Brand) || brand,
      title,
      icecatId: generalInfo.IcecatId ?? null,
      sourceUrl,
      imageUrl: asText(image?.Pic500x500) || asText(image?.HighPic) || null,
      summary: asText(summary?.ShortSummaryDescription) || asText(description?.LongProductName) || "",
      features,
    };

    return NextResponse.json({
      product: { brand: sourceData.brand, title, productCode: sourceData.productCode, sourceUrl, summary: sourceData.summary },
      specs: mappedSpecs(categoryResult.data, features),
      sourceData,
    });
  } catch {
    return NextResponse.json({ error: "provider-error" }, { status: 502 });
  }
}
