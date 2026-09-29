import type { ComponentCategory } from "@/lib/inventory/specs";

type Specs = Record<string, unknown>;

function text(specs: Specs, key: string) {
  const value = specs[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(specs: Specs, key: string, unit: string) {
  const value = specs[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? `${value} ${unit}` : undefined;
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
      return [number(specs, "cores", "núcleos"), number(specs, "threads", "threads"), text(specs, "socket")];
    case "MOTHERBOARD":
      return [text(specs, "memoryType"), text(specs, "socket"), text(specs, "chipset"), text(specs, "formFactor")];
    case "RAM":
      return [number(specs, "capacityGb", "GB"), text(specs, "memoryType"), number(specs, "frequencyMhz", "MHz")];
    case "GPU":
      return [number(specs, "vramGb", "GB VRAM"), text(specs, "interface")];
    case "STORAGE":
      return [text(specs, "type"), number(specs, "capacityGb", "GB"), text(specs, "interface"), text(specs, "formFactor")];
    case "PSU":
      return [number(specs, "wattageW", "W"), text(specs, "efficiencyRating"), text(specs, "formFactor")];
    case "CASE":
      return [list(specs, "formFactorSupport"), number(specs, "gpuMaxLengthMm", "mm GPU")];
    case "CPU_COOLER":
      return [list(specs, "supportedSockets"), number(specs, "tdpRatingW", "W"), text(specs, "formFactor")];
  }
}

export function generateComponentDescription(
  category: ComponentCategory,
  manufacturer: string,
  name: string,
  specs: Specs,
  caseModel = "",
) {
  const cleanManufacturer = manufacturer.trim();
  const cleanName = name.trim();
  const identity = cleanName.toLocaleLowerCase("pt-BR").startsWith(cleanManufacturer.toLocaleLowerCase("pt-BR"))
    ? cleanName
    : [cleanManufacturer, cleanName].filter(Boolean).join(" ");
  const parts = [identity, category === "CASE" ? caseModel.trim() : "", ...summary(category, specs)]
    .filter((part): part is string => Boolean(part?.trim()));
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" - ");
}
