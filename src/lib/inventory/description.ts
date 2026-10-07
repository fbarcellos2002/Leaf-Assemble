import type { ComponentCategory } from "@/lib/inventory/specs";

type Specs = Record<string, unknown>;

function text(specs: Specs, key: string) {
  const value = specs[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(specs: Specs, key: string, unit: string) {
  const value = specs[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? `${value} ${unit}` : undefined;
}

function list(specs: Specs, key: string) {
  const value = specs[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") && value.length
    ? value.join(", ")
    : undefined;
}

function summary(category: ComponentCategory, specs: Specs) {
  switch (category) {
    case "CPU":
      return [
        [
          typeof specs.cores === "number" && Number.isFinite(specs.cores) ? `${specs.cores}N` : undefined,
          typeof specs.threads === "number" && Number.isFinite(specs.threads) ? `${specs.threads}T` : undefined,
        ].filter(Boolean).join(" ") || undefined,
        text(specs, "generation"),
        text(specs, "socket"),
      ];
    case "MOTHERBOARD":
      return [text(specs, "socket")];
    case "RAM":
      return [number(specs, "capacityGb", "GB"), text(specs, "memoryType"), number(specs, "frequencyMhz", "MHz")];
    case "GPU":
      return [number(specs, "vramGb", "GB VRAM")];
    case "STORAGE":
      return [number(specs, "capacityGb", "GB"), text(specs, "interface")];
    case "PSU":
      return [number(specs, "wattageW", "W"), text(specs, "efficiencyRating")];
    case "CASE":
      return [
        list(specs, "formFactorSupport") ? `Placa-mãe ${list(specs, "formFactorSupport")}` : undefined,
        list(specs, "psuFormFactors") ? `Fonte de alimentação ${list(specs, "psuFormFactors")}` : undefined,
      ];
    case "CPU_COOLER":
      return [list(specs, "supportedSockets")];
  }
}

export function generateComponentDescription(
  category: ComponentCategory,
  manufacturer: string,
  name: string,
  specs: Specs,
) {
  const cleanManufacturer = manufacturer.trim();
  const cleanName = name.trim();
  if (category === "CPU") {
    const cores = typeof specs.cores === "number" && Number.isFinite(specs.cores) ? `${specs.cores} Núcleos` : undefined;
    const threads = typeof specs.threads === "number" && Number.isFinite(specs.threads) ? `${specs.threads} Threads` : undefined;
    const counts = [cores, threads].filter(Boolean).join(" / ");
    return [
      [cleanManufacturer, cleanName].filter(Boolean).join(" "),
      counts,
      text(specs, "socket"),
    ].filter(Boolean).join(" | ");
  }
  if (category === "MOTHERBOARD") {
    return [cleanManufacturer, text(specs, "socket"), text(specs, "formFactor")]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" | ");
  }
  if (category === "RAM") {
    const capacity = number(specs, "capacityGb", "GB");
    const memoryType = text(specs, "memoryType");
    const frequency = typeof specs.frequencyMhz === "number" && Number.isFinite(specs.frequencyMhz) && specs.frequencyMhz >= 0
      ? `${specs.frequencyMhz} Mhz`
      : undefined;
    return [cleanManufacturer, capacity, memoryType, frequency]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" | ");
  }
  if (category === "GPU") {
    return [cleanManufacturer, text(specs, "chipBrand"), cleanName, number(specs, "vramGb", "GB VRAM")]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" | ");
  }
  if (category === "STORAGE") {
    return [cleanManufacturer, text(specs, "interface"), text(specs, "type"), number(specs, "capacityGb", "GB")]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" | ");
  }
  if (category === "PSU") {
    return [cleanManufacturer, number(specs, "wattageW", "W"), text(specs, "efficiencyRating")]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" | ");
  }
  if (category === "CPU_COOLER") {
    const adapters = Array.isArray(specs.adapterSockets) && specs.adapterSockets.every((item) => typeof item === "string")
      ? specs.adapterSockets as string[]
      : [];
    return [cleanManufacturer, text(specs, "coolerType"), text(specs, "socketBase"), ...adapters]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" | ");
  }
  const identity = cleanName.toLocaleLowerCase("pt-BR").startsWith(cleanManufacturer.toLocaleLowerCase("pt-BR"))
    ? cleanName
    : [cleanManufacturer, cleanName].filter(Boolean).join(" ");
  const parts = [identity, ...summary(category, specs)]
    .filter((part): part is string => Boolean(part?.trim()));
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" - ");
}
