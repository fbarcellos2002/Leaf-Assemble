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

export const componentCategorySchema = z.enum(componentCategories);
export type ComponentCategory = z.infer<typeof componentCategorySchema>;

const optionalText = z.string().trim().min(1).optional();
const optionalPositiveNumber = z.number().positive().optional();
const optionalPositiveInteger = z.number().int().positive().optional();
const optionalTextList = z.array(z.string().trim().min(1)).optional();
const optionalNumberList = z.array(z.number().positive()).optional();
const optionalBoolean = z.boolean().optional();

const specSchemas = {
  CPU: z.object({
    socket: optionalText,
    microarchitecture: optionalText,
    generation: optionalText,
    cores: optionalPositiveInteger,
    threads: optionalPositiveInteger,
    baseClockMhz: optionalPositiveNumber,
    boostClockMhz: optionalPositiveNumber,
    tdpW: optionalPositiveNumber,
    integratedGraphics: optionalBoolean,
    integratedGraphicsModel: optionalText,
    memoryTypes: optionalTextList,
    maxMemoryFrequencyMhz: optionalPositiveNumber,
    maxMemoryCapacityGb: optionalPositiveNumber,
    memoryChannels: optionalPositiveInteger,
    cacheL2Mb: optionalPositiveNumber,
    cacheL3Mb: optionalPositiveNumber,
    pcieVersion: optionalText,
    pcieLanes: optionalPositiveInteger,
    instructionSets: optionalTextList,
    virtualization: optionalTextList,
  }),
  MOTHERBOARD: z.object({
    socket: optionalText,
    chipset: optionalText,
    formFactor: optionalText,
    memoryType: optionalText,
    memorySlots: optionalPositiveInteger,
    maxMemoryGb: optionalPositiveNumber,
    supportedMemoryFrequenciesMhz: optionalNumberList,
    eccSupport: optionalBoolean,
    storageInterfaces: optionalTextList,
    pcieSlots: optionalPositiveInteger,
  }),
  RAM: z.object({
    memoryType: optionalText,
    capacityGb: optionalPositiveNumber,
    frequencyMhz: optionalPositiveNumber,
    casLatency: optionalPositiveInteger,
    voltage: optionalPositiveNumber,
    moduleCount: optionalPositiveInteger,
    formFactor: optionalText,
    ecc: optionalBoolean,
    registered: optionalBoolean,
  }),
  GPU: z.object({
    vramGb: optionalPositiveNumber,
    interface: optionalText,
    lengthMm: optionalPositiveNumber,
    powerConnectors: optionalTextList,
    recommendedPsuW: optionalPositiveNumber,
    tdpW: optionalPositiveNumber,
  }),
  STORAGE: z.object({
    type: optionalText,
    capacityGb: optionalPositiveNumber,
    interface: optionalText,
    formFactor: optionalText,
    readSpeedMbS: optionalPositiveNumber,
    writeSpeedMbS: optionalPositiveNumber,
  }),
  PSU: z.object({
    wattageW: optionalPositiveNumber,
    efficiencyRating: optionalText,
    formFactor: optionalText,
    connectors: optionalTextList,
  }),
  CASE: z.object({
    formFactorSupport: optionalTextList,
    gpuMaxLengthMm: optionalPositiveNumber,
    cpuCoolerMaxHeightMm: optionalPositiveNumber,
    psuFormFactors: optionalTextList,
    driveBays25: z.number().int().nonnegative().optional(),
    driveBays35: z.number().int().nonnegative().optional(),
  }),
  CPU_COOLER: z.object({
    supportedSockets: optionalTextList,
    heightMm: optionalPositiveNumber,
    tdpRatingW: optionalPositiveNumber,
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
    { key: "socket", label: "Socket", type: "text", hint: "Ex.: AM5, LGA1700" },
    { key: "microarchitecture", label: "Microarquitetura", type: "text", hint: "Ex.: Zen 3, Raptor Lake" },
    { key: "generation", label: "Geração", type: "text", hint: "Ex.: 3ª geração Intel Core" },
    { key: "cores", label: "Núcleos", type: "number" },
    { key: "threads", label: "Threads", type: "number" },
    { key: "baseClockMhz", label: "Clock base", type: "number", unit: "MHz" },
    { key: "boostClockMhz", label: "Clock boost", type: "number", unit: "MHz" },
    { key: "tdpW", label: "TDP", type: "number", unit: "W" },
    { key: "integratedGraphics", label: "Gráficos integrados", type: "boolean" },
    { key: "integratedGraphicsModel", label: "Modelo dos gráficos integrados", type: "text" },
    { key: "memoryTypes", label: "Tipos de memória", type: "text-list", hint: "Separe por vírgula: DDR4, DDR5" },
    { key: "maxMemoryFrequencyMhz", label: "Frequência máxima de memória", type: "number", unit: "MHz" },
    { key: "maxMemoryCapacityGb", label: "Memória máxima", type: "number", unit: "GB" },
    { key: "memoryChannels", label: "Canais de memória", type: "number" },
    { key: "cacheL2Mb", label: "Cache L2", type: "number", unit: "MB" },
    { key: "cacheL3Mb", label: "Cache L3", type: "number", unit: "MB" },
    { key: "pcieVersion", label: "Versão PCI Express", type: "text", hint: "Ex.: PCIe 4.0" },
    { key: "pcieLanes", label: "Pistas PCIe", type: "number" },
    { key: "instructionSets", label: "Conjuntos de instruções", type: "text-list", hint: "Separe por vírgula: SSE4.2, AVX2" },
    { key: "virtualization", label: "Tecnologias de virtualização", type: "text-list", hint: "Separe por vírgula: Intel VT-x, AMD-V" },
  ],
  MOTHERBOARD: [
    { key: "socket", label: "Socket", type: "text" },
    { key: "chipset", label: "Chipset", type: "text" },
    { key: "formFactor", label: "Formato", type: "text", hint: "Ex.: ATX, Micro-ATX" },
    { key: "memoryType", label: "Tipo de memória", type: "text" },
    { key: "memorySlots", label: "Slots de memória", type: "number" },
    { key: "maxMemoryGb", label: "Memória máxima", type: "number", unit: "GB" },
    { key: "supportedMemoryFrequenciesMhz", label: "Frequências suportadas", type: "number-list", unit: "MHz", hint: "Separe por vírgula" },
    { key: "eccSupport", label: "Suporte ECC", type: "boolean" },
    { key: "storageInterfaces", label: "Interfaces de armazenamento", type: "text-list", hint: "Ex.: NVMe, SATA" },
    { key: "pcieSlots", label: "Slots PCIe", type: "number" },
  ],
  RAM: [
    { key: "memoryType", label: "Tipo", type: "text", hint: "Ex.: DDR4, DDR5" },
    { key: "capacityGb", label: "Capacidade do kit", type: "number", unit: "GB" },
    { key: "frequencyMhz", label: "Frequência", type: "number", unit: "MHz" },
    { key: "casLatency", label: "Latência CAS", type: "number" },
    { key: "voltage", label: "Tensão", type: "number", unit: "V" },
    { key: "moduleCount", label: "Módulos por kit", type: "number" },
    { key: "formFactor", label: "Formato", type: "text", hint: "Ex.: DIMM, SO-DIMM" },
    { key: "ecc", label: "ECC", type: "boolean" },
    { key: "registered", label: "Registered", type: "boolean" },
  ],
  GPU: [
    { key: "vramGb", label: "VRAM", type: "number", unit: "GB" },
    { key: "interface", label: "Interface", type: "text", hint: "Ex.: PCIe 4.0 x16" },
    { key: "lengthMm", label: "Comprimento", type: "number", unit: "mm" },
    { key: "powerConnectors", label: "Conectores de energia", type: "text-list", hint: "Ex.: 2x 8-pin" },
    { key: "recommendedPsuW", label: "Fonte recomendada", type: "number", unit: "W" },
    { key: "tdpW", label: "TDP", type: "number", unit: "W" },
  ],
  STORAGE: [
    { key: "type", label: "Tipo", type: "text", hint: "Ex.: SSD, HDD" },
    { key: "capacityGb", label: "Capacidade", type: "number", unit: "GB" },
    { key: "interface", label: "Interface", type: "text", hint: "Ex.: NVMe, SATA" },
    { key: "formFactor", label: "Formato", type: "text", hint: "Ex.: M.2 2280, 2.5\"" },
    { key: "readSpeedMbS", label: "Leitura", type: "number", unit: "MB/s" },
    { key: "writeSpeedMbS", label: "Gravação", type: "number", unit: "MB/s" },
  ],
  PSU: [
    { key: "wattageW", label: "Potência", type: "number", unit: "W" },
    { key: "efficiencyRating", label: "Certificação", type: "text", hint: "Ex.: 80 Plus Gold" },
    { key: "formFactor", label: "Formato", type: "text", hint: "Ex.: ATX, SFX" },
    { key: "connectors", label: "Conectores", type: "text-list", hint: "Separe por vírgula" },
  ],
  CASE: [
    { key: "formFactorSupport", label: "Placas-mãe compatíveis", type: "text-list", hint: "Ex.: ATX, Micro-ATX" },
    { key: "gpuMaxLengthMm", label: "Comprimento máximo da GPU", type: "number", unit: "mm" },
    { key: "cpuCoolerMaxHeightMm", label: "Altura máxima do cooler", type: "number", unit: "mm" },
    { key: "psuFormFactors", label: "Formatos de fonte", type: "text-list", hint: "Ex.: ATX, SFX" },
    { key: "driveBays25", label: "Baias de 2,5\"", type: "number" },
    { key: "driveBays35", label: "Baias de 3,5\"", type: "number" },
  ],
  CPU_COOLER: [
    { key: "supportedSockets", label: "Sockets compatíveis", type: "text-list", hint: "Separe por vírgula" },
    { key: "heightMm", label: "Altura", type: "number", unit: "mm" },
    { key: "tdpRatingW", label: "TDP suportado", type: "number", unit: "W" },
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
    interface: ["PCI Express 3.0 x16", "PCI Express 4.0 x16", "PCI Express 5.0 x16", "PCI Express 4.0 x8"],
    powerConnectors: ["6-pin", "8-pin", "2 x 8-pin", "3 x 8-pin", "12VHPWR", "12V-2x6"],
  },
  STORAGE: {
    type: ["SSD", "HDD", "SSHD", "NVMe SSD", "SATA SSD"],
    interface: ["SATA", "SATA II", "SATA III", "NVMe", "PCIe 3.0 x4", "PCIe 4.0 x4", "PCIe 5.0 x4", "USB"],
    formFactor: ["M.2 2230", "M.2 2242", "M.2 2260", "M.2 2280", "M.2 22110", "2,5\"", "3,5\""],
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
