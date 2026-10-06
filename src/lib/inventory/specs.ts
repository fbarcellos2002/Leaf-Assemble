import { z } from "zod";

export const componentCategories = [
  "CPU",
  "MOTHERBOARD",
  "RAM",
  "GPU",
  "STORAGE",
  "PSU",
  "CASE",
  "CPU_COOLER",
] as const;

export const manufacturerChoices: Partial<Record<ComponentCategory, readonly string[]>> = {
  CPU: ["Intel", "AMD"],
};

export const socketChoicesByManufacturer = {
  Intel: [
    "LGA 1851", "LGA 1700", "LGA 2066", "LGA 2011-v3", "LGA 2011",
    "LGA 1366", "LGA 1200", "LGA 1156", "LGA 1155", "LGA 1151",
    "LGA 1150", "LGA 775",
  ],
  AMD: [
    "AM5", "AM4", "sTR5", "sTRX4", "TR4", "sWRX8",
    "AM3+", "AM3", "AM2+", "AM2", "AM1", "FM2+", "FM2", "FM1",
  ],
} as const;

export const allSocketChoices = [
  ...socketChoicesByManufacturer.Intel,
  ...socketChoicesByManufacturer.AMD,
] as const;

export const componentCategorySchema = z.enum(componentCategories);
export type ComponentCategory = z.infer<typeof componentCategorySchema>;

const optionalText = z.string().trim().min(1).optional();
const optionalNonnegativeNumber = z.number().nonnegative().optional();
const optionalNonnegativeInteger = z.number().int().nonnegative().optional();
const optionalTextList = z.array(z.string().trim().min(1)).optional();
const optionalNumberList = z.array(z.number().nonnegative()).optional();
const optionalBoolean = z.boolean().optional();

const specSchemas = {
  CPU: z.object({
    generation: optionalText,
    socket: optionalText,
    cores: optionalNonnegativeInteger,
    threads: optionalNonnegativeInteger,
    baseClockMhz: optionalNonnegativeNumber,
    boostClockMhz: optionalNonnegativeNumber,
    tdpW: optionalNonnegativeNumber,
    integratedGraphics: optionalBoolean,
    memoryTypes: optionalTextList,
    maxMemoryFrequencyMhz: optionalNonnegativeNumber,
    maxMemoryCapacityGb: optionalNonnegativeNumber,
  }),
  MOTHERBOARD: z.object({
    socket: optionalText,
    pcieVersion: optionalText,
    chipset: optionalText,
    formFactor: optionalText,
    memoryType: optionalText,
    memorySlots: optionalNonnegativeInteger,
    maxMemoryGb: optionalNonnegativeNumber,
    supportedMemoryFrequenciesMhz: optionalNumberList,
    storageInterfaces: optionalTextList,
    pcieSlots: optionalNonnegativeInteger,
  }),
  RAM: z.object({
    memoryType: optionalText,
    capacityGb: optionalNonnegativeNumber,
    frequencyMhz: optionalNonnegativeNumber,
    formFactor: optionalText,
    ecc: optionalBoolean,
  }),
  GPU: z.object({
    vramGb: optionalNonnegativeNumber,
    recommendedPsuW: optionalNonnegativeNumber,
  }),
  STORAGE: z.object({
    type: optionalText,
    capacityGb: optionalNonnegativeNumber,
    interface: optionalText,
    readSpeedMbS: optionalNonnegativeNumber,
    writeSpeedMbS: optionalNonnegativeNumber,
  }),
  PSU: z.object({
    wattageW: optionalNonnegativeNumber,
    efficiencyRating: optionalText,
    formFactor: optionalText,
  }),
  CASE: z.object({
    formFactorSupport: optionalTextList,
    gpuMaxLengthMm: optionalNonnegativeNumber,
    cpuCoolerMaxHeightMm: optionalNonnegativeNumber,
    psuFormFactors: optionalTextList,
  }),
  CPU_COOLER: z.object({
    supportedSockets: optionalTextList,
    socketAdapter: optionalBoolean,
    formFactor: optionalText,
  }),
} satisfies Record<ComponentCategory, z.ZodType>;

export type ComponentSpecs = {
  [Category in ComponentCategory]: z.infer<(typeof specSchemas)[Category]> & {
    category: Category;
  };
}[ComponentCategory];

export function parseComponentSpecs(category: ComponentCategory, input: unknown) {
  return specSchemas[category].safeParse(input);
}

export type SpecField = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "text-list" | "number-list";
  unit?: string;
  hint?: string;
};

export const specFields: Record<ComponentCategory, SpecField[]> = {
  CPU: [
    { key: "generation", label: "Geração do processador", type: "text", hint: "Ex.: 13ª geração, Ryzen 5000" },
    { key: "socket", label: "Socket", type: "text", hint: "Informe apenas o número do socket" },
    { key: "cores", label: "Núcleos", type: "number" },
    { key: "threads", label: "Threads", type: "number" },
    { key: "baseClockMhz", label: "Clock base", type: "number", unit: "MHz" },
    { key: "boostClockMhz", label: "Clock boost", type: "number", unit: "MHz" },
    { key: "tdpW", label: "TDP", type: "number", unit: "W" },
    { key: "integratedGraphics", label: "Gráficos integrados", type: "boolean" },
    { key: "memoryTypes", label: "Tipos de memória", type: "text-list", hint: "Separe por vírgula: DDR4, DDR5" },
    { key: "maxMemoryFrequencyMhz", label: "Frequência máxima de memória", type: "number", unit: "MHz" },
    { key: "maxMemoryCapacityGb", label: "Memória máxima", type: "number", unit: "GB" },
  ],
  MOTHERBOARD: [
    { key: "socket", label: "Socket", type: "text", hint: "Informe apenas o número do socket" },
    { key: "pcieVersion", label: "Versão PCI Express", type: "text", hint: "Ex.: PCIe 4.0" },
    { key: "chipset", label: "Chipset", type: "text" },
    { key: "formFactor", label: "Formato", type: "text", hint: "Ex.: ATX, Micro-ATX" },
    { key: "memoryType", label: "Tipo de memória", type: "text" },
    { key: "memorySlots", label: "Slots de memória", type: "number" },
    { key: "maxMemoryGb", label: "Memória máxima", type: "number", unit: "GB" },
    { key: "supportedMemoryFrequenciesMhz", label: "Frequências suportadas", type: "number-list", unit: "MHz", hint: "Separe por vírgula" },
    { key: "storageInterfaces", label: "Interfaces de armazenamento", type: "text-list", hint: "Ex.: NVMe, SATA" },
    { key: "pcieSlots", label: "Slots PCIe", type: "number" },
  ],
  RAM: [
    { key: "memoryType", label: "Tipo", type: "text", hint: "Ex.: DDR4, DDR5" },
    { key: "capacityGb", label: "Capacidade por módulo", type: "number", unit: "GB" },
    { key: "frequencyMhz", label: "Frequência", type: "number", unit: "MHz" },
    { key: "formFactor", label: "Formato", type: "text", hint: "Ex.: DIMM, SO-DIMM" },
    { key: "ecc", label: "ECC", type: "boolean" },
  ],
  GPU: [
    { key: "vramGb", label: "VRAM", type: "number", unit: "GB" },
    { key: "recommendedPsuW", label: "Fonte recomendada", type: "number", unit: "W" },
  ],
  STORAGE: [
    { key: "type", label: "Tipo", type: "text", hint: "Ex.: SSD, HDD" },
    { key: "capacityGb", label: "Capacidade", type: "number", unit: "GB" },
    { key: "interface", label: "Interface", type: "text", hint: "Ex.: NVMe, SATA" },
    { key: "readSpeedMbS", label: "Leitura", type: "number", unit: "MB/s" },
    { key: "writeSpeedMbS", label: "Gravação", type: "number", unit: "MB/s" },
  ],
  PSU: [
    { key: "wattageW", label: "Potência", type: "number", unit: "W" },
    { key: "efficiencyRating", label: "Certificação", type: "text", hint: "Ex.: 80 Plus Gold" },
    { key: "formFactor", label: "Formato", type: "text", hint: "Ex.: ATX, SFX" },
  ],
  CASE: [
    { key: "formFactorSupport", label: "Placas-mãe compatíveis", type: "text-list", hint: "Ex.: ATX, Micro-ATX" },
    { key: "gpuMaxLengthMm", label: "Comprimento máximo da GPU", type: "number", unit: "mm" },
    { key: "cpuCoolerMaxHeightMm", label: "Altura máxima do cooler", type: "number", unit: "mm" },
    { key: "psuFormFactors", label: "Formatos de fonte", type: "text-list", hint: "Ex.: ATX, SFX" },
  ],
  CPU_COOLER: [
    { key: "supportedSockets", label: "Sockets compatíveis", type: "text-list", hint: "Separe por vírgula" },
    { key: "socketAdapter", label: "Adaptador", type: "boolean" },
    { key: "formFactor", label: "Formato", type: "text" },
  ],
};

export const specChoices: Partial<Record<ComponentCategory, Record<string, readonly string[]>>> = {
  CPU: {
    memoryTypes: ["DDR3", "DDR3L", "DDR4", "DDR5", "LPDDR4", "LPDDR4X", "LPDDR5", "LPDDR5X"],
    maxMemoryFrequencyMhz: ["800", "1066", "1333", "1600", "1866", "2133", "2400", "2666", "2933", "3000", "3200", "3600", "4000", "4266", "4800", "5200", "5600", "6000", "6400", "7200", "7600", "8000", "8400"],
  },
  MOTHERBOARD: {
    formFactor: ["ATX", "Micro-ATX", "Mini-ITX", "E-ATX", "Mini-DTX"],
    memoryType: ["DDR2", "DDR3", "DDR3L", "DDR4", "DDR5"],
    supportedMemoryFrequenciesMhz: ["800", "1066", "1333", "1600", "1866", "2133", "2400", "2666", "2933", "3000", "3200", "3600", "4000", "4266", "4800", "5200", "5600", "6000", "6400", "7200", "7600", "8000", "8400"],
    storageInterfaces: ["SATA", "SATA III", "M.2 SATA", "M.2 NVMe", "PCIe 3.0 x4", "PCIe 4.0 x4", "PCIe 5.0 x4"],
  },
  RAM: {
    memoryType: ["DDR2", "DDR3", "DDR3L", "DDR4", "DDR5", "LPDDR4", "LPDDR4X", "LPDDR5", "LPDDR5X"],
    frequencyMhz: ["800", "1066", "1333", "1600", "1866", "2133", "2400", "2666", "2933", "3000", "3200", "3600", "4000", "4266", "4800", "5200", "5600", "6000", "6400", "7200", "7600", "8000", "8400"],
    formFactor: ["DIMM", "SO-DIMM", "CAMM2"],
  },
  GPU: {
  },
  STORAGE: {
    type: ["SSD", "HDD", "SSHD", "NVMe SSD", "SATA SSD"],
    interface: ["SATA", "SATA II", "SATA III", "M.2 SATA", "NVMe", "M.2 NVMe", "PCIe 3.0 x4", "PCIe 4.0 x4", "PCIe 5.0 x4", "USB"],
  },
  PSU: {
    efficiencyRating: ["80 Plus", "80 Plus White", "80 Plus Bronze", "80 Plus Silver", "80 Plus Gold", "80 Plus Platinum", "80 Plus Titanium"],
    formFactor: ["ATX", "SFX", "SFX-L", "TFX"],
  },
  CASE: {
    formFactorSupport: ["E-ATX", "ATX", "Micro-ATX", "Mini-ITX", "Mini-DTX"],
    psuFormFactors: ["ATX", "SFX", "SFX-L", "TFX"],
  },
  CPU_COOLER: {
    formFactor: ["Air cooler", "AIO liquid cooler", "Custom liquid cooling"],
  },
};

export function parseSpecFormValue(field: SpecField, value: FormDataEntryValue | null) {
  if (field.type === "boolean") {
    if (value !== "true" && value !== "false") return undefined;
    return value === "true";
  }

  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  if (field.type === "number") return Number(text);
  if (field.type === "text-list") return text.split(",").map((item) => item.trim()).filter(Boolean);
  if (field.type === "number-list") return text.split(",").map((item) => Number(item.trim()));
  return text;
}
