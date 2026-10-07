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

export const processorGenerationsBySocket = {
  Intel: {
    "LGA 1851": "Core Ultra 200S",
    "LGA 1700": "12ª, 13ª e 14ª geração (varia por placa-mãe)",
    "LGA 2066": "Core X de 7ª a 10ª geração",
    "LGA 2011-v3": "Core X de 4ª e 5ª geração",
    "LGA 2011": "Core X de 2ª e 3ª geração",
    "LGA 1366": "Core de 1ª geração",
    "LGA 1200": "10ª e 11ª geração",
    "LGA 1156": "Core de 1ª geração",
    "LGA 1155": "2ª e 3ª geração",
    "LGA 1151": "6ª e 7ª ou 8ª e 9ª geração (varia por chipset)",
    "LGA 1150": "4ª e 5ª geração",
    "LGA 775": "Core 2, Pentium e Celeron (varia por chipset)",
  },
  AMD: {
    AM5: "Ryzen 7000, 8000 e 9000",
    AM4: "Ryzen 1000 a 5000 (varia por placa-mãe e BIOS)",
    sTR5: "Threadripper 7000 e 9000",
    sTRX4: "Threadripper 3000",
    TR4: "Threadripper 1000 e 2000",
    sWRX8: "Threadripper Pro 3000WX e 5000WX",
    "AM3+": "AMD FX",
    AM3: "Phenom II e Athlon II",
    "AM2+": "Phenom e Athlon 64 (varia por placa-mãe)",
    AM2: "Athlon 64, Athlon X2 e Phenom (varia por placa-mãe)",
    AM1: "Athlon e Sempron (Kabini)",
    "FM2+": "A-Series (Kaveri e Godavari)",
    FM2: "A-Series (Trinity e Richland)",
    FM1: "A-Series (Llano)",
  },
} as const;

export function getProcessorGeneration(manufacturer: string, socket: string) {
  if (manufacturer !== "Intel" && manufacturer !== "AMD") return undefined;
  return processorGenerationsBySocket[manufacturer][socket as keyof (typeof processorGenerationsBySocket)[typeof manufacturer]];
}

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
    integratedGraphics: z.boolean(),
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
    storageInterfaceCounts: z.record(z.string(), z.number().int().positive()).optional(),
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
    chipBrand: optionalText,
    vramGb: optionalNonnegativeNumber,
    recommendedPsuW: optionalNonnegativeNumber,
    pcieVersion: optionalText,
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
    activePfc: z.boolean(),
  }),
  CASE: z.object({
    formFactorSupport: optionalTextList,
    gpuMaxLengthMm: optionalNonnegativeNumber,
    cpuCoolerMaxHeightMm: optionalNonnegativeNumber,
    psuFormFactors: optionalTextList,
  }),
  CPU_COOLER: z.object({
    socketBase: optionalText,
    adapterSockets: optionalTextList,
    coolerType: optionalText,
    socketAdapter: optionalBoolean,
    formFactor: optionalText,
    supportedSockets: optionalTextList,
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
  required?: boolean;
  min?: number;
};

export const specFields: Record<ComponentCategory, SpecField[]> = {
  CPU: [
    { key: "socket", label: "Socket", type: "text", required: true },
    { key: "generation", label: "Geração de processador", type: "text", required: true, hint: "Preenchida automaticamente pelo socket selecionado" },
    { key: "cores", label: "Núcleos", type: "number", required: true, min: 1 },
    { key: "threads", label: "Threads", type: "number", required: true, min: 1 },
    { key: "baseClockMhz", label: "Clock Base", type: "number", unit: "MHz" },
    { key: "boostClockMhz", label: "Clock boost", type: "number", unit: "MHz" },
    { key: "tdpW", label: "TDP", type: "number", unit: "W" },
    { key: "integratedGraphics", label: "Gráficos integrados", type: "boolean", required: true },
    { key: "memoryTypes", label: "Tipos de memória", type: "text-list", required: true, hint: "Selecione os tipos de memória suportados" },
    { key: "maxMemoryFrequencyMhz", label: "Frequência máxima de memória", type: "number", unit: "MHz" },
    { key: "maxMemoryCapacityGb", label: "Memória máxima", type: "number", unit: "GB" },
  ],
  MOTHERBOARD: [
    { key: "socket", label: "Socket", type: "text", required: true },
    { key: "formFactor", label: "Formato", type: "text", required: true },
    { key: "memoryType", label: "Tipo de memória", type: "text", required: true },
    { key: "memorySlots", label: "Slots de memória", type: "number", required: true, min: 1 },
    { key: "maxMemoryGb", label: "Memória máxima", type: "number", unit: "GB", required: true, min: 1 },
    { key: "supportedMemoryFrequenciesMhz", label: "Frequência Máxima", type: "number-list", unit: "MHz", required: true },
    { key: "storageInterfaces", label: "Interfaces de armazenamento", type: "text-list", required: true },
    { key: "pcieSlots", label: "Slots PCIe", type: "number", required: true, min: 1 },
    { key: "pcieVersion", label: "Versão do PCIe", type: "text" },
    { key: "chipset", label: "Chipset", type: "text" },
  ],
  RAM: [
    { key: "memoryType", label: "Slot", type: "text", required: true },
    { key: "capacityGb", label: "Capacidade (GB)", type: "number", required: true, min: 1 },
    { key: "frequencyMhz", label: "Frequência", type: "number", unit: "MHz", required: true, min: 1 },
    { key: "formFactor", label: "Formato", type: "text", required: true },
    { key: "ecc", label: "ECC", type: "boolean" },
  ],
  GPU: [
    { key: "chipBrand", label: "Marca do Chip", type: "text", required: true },
    { key: "vramGb", label: "VRAM (GB)", type: "number", unit: "GB", required: true, min: 1 },
    { key: "recommendedPsuW", label: "Fonte recomendada", type: "number", unit: "W", required: true, min: 1 },
    { key: "pcieVersion", label: "Versão PCIe", type: "text" },
  ],
  STORAGE: [
    { key: "interface", label: "Interface", type: "text", required: true },
    { key: "type", label: "Tipo", type: "text", required: true },
    { key: "capacityGb", label: "Capacidade", type: "number", unit: "GB", required: true, min: 1 },
    { key: "readSpeedMbS", label: "Leitura", type: "number", unit: "MB/s" },
    { key: "writeSpeedMbS", label: "Gravação", type: "number", unit: "MB/s" },
  ],
  PSU: [
    { key: "wattageW", label: "Potência", type: "number", unit: "W", required: true, min: 1 },
    { key: "efficiencyRating", label: "Certificação", type: "text", required: true },
    { key: "formFactor", label: "Formato", type: "text", required: true },
    { key: "activePfc", label: "PFC Ativo", type: "boolean", required: true },
  ],
  CASE: [
    { key: "formFactorSupport", label: "Placas-mãe compatíveis", type: "text-list", required: true, hint: "Selecione todos os formatos compatíveis" },
    { key: "psuFormFactors", label: "Formatos de fonte", type: "text-list", required: true, hint: "Selecione todos os formatos compatíveis" },
  ],
  CPU_COOLER: [
    { key: "socketBase", label: "Socket Base", type: "text", required: true },
    { key: "socketAdapter", label: "Adaptador", type: "boolean", required: true },
    { key: "adapterSockets", label: "Sockets adaptáveis", type: "text-list", required: true },
    { key: "coolerType", label: "Tipo", type: "text", required: true },
  ],
};

export const specChoices: Partial<Record<ComponentCategory, Record<string, readonly string[]>>> = {
  CPU: {
    memoryTypes: ["DDR3", "DDR3L", "DDR4", "DDR5", "LPDDR4", "LPDDR4X", "LPDDR5", "LPDDR5X"],
    maxMemoryFrequencyMhz: ["800", "1066", "1333", "1600", "1866", "2133", "2400", "2666", "2933", "3000", "3200", "3600", "4000", "4266", "4800", "5200", "5600", "6000", "6400", "7200", "7600", "8000", "8400"],
  },
  MOTHERBOARD: {
    formFactor: ["ATX", "m-ATX", "Mini-ITX", "E-ATX", "Mini-DTX", "XL-ATX"],
    memoryType: ["DDR2", "DDR3", "DDR3L", "DDR4", "DDR5"],
    supportedMemoryFrequenciesMhz: ["800", "1066", "1333", "1600", "1866", "2133", "2400", "2666", "2933", "3000", "3200", "3600", "4000", "4266", "4800", "5200", "5600", "6000", "6400", "7200", "7600", "8000", "8400"],
    memorySlots: ["2", "4", "8"],
    pcieSlots: ["1", "2", "3", "4", "5", "6", "7"],
    pcieVersion: ["PCIe 1.0", "PCIe 2.0", "PCIe 3.0", "PCIe 4.0", "PCIe 5.0", "PCIe 6.0"],
    storageInterfaces: ["SATA", "SATA III", "M.2 SATA", "M.2 NVMe", "PCIe 3.0 x4", "PCIe 4.0 x4", "PCIe 5.0 x4"],
  },
  RAM: {
    memoryType: ["DDR2", "DDR3", "DDR3L", "DDR4", "DDR5", "LPDDR4", "LPDDR4X", "LPDDR5", "LPDDR5X"],
    frequencyMhz: ["800", "1066", "1333", "1600", "1866", "2133", "2400", "2666", "2933", "3000", "3200", "3600", "4000", "4266", "4800", "5200", "5600", "6000", "6400", "7200", "7600", "8000", "8400"],
    formFactor: ["DIMM", "SO-DIMM", "CAMM2"],
  },
  GPU: {
    chipBrand: ["Intel", "NVIDIA", "AMD"],
    vramGb: ["1", "2", "3", "4", "6", "8", "10", "11", "12", "16", "20", "24", "32", "48", "64", "96"],
    pcieVersion: ["PCIe 1.0", "PCIe 2.0", "PCIe 3.0", "PCIe 4.0", "PCIe 5.0"],
    recommendedPsuW: ["300", "350", "400", "450", "500", "550", "600", "650", "700", "750", "800", "850", "900", "1000", "1200", "1300", "1500", "1600"],
  },
  STORAGE: {
    interface: ["SATA", "SATA II", "SATA III", "M.2 SATA", "M.2 NVMe", "NVMe", "PCIe 3.0 x4", "PCIe 4.0 x4", "PCIe 5.0 x4", "USB"],
    type: ["HD", "SSD", "SSHD"],
    capacityGb: ["120", "128", "240", "250", "256", "320", "480", "500", "512", "750", "800", "960", "1000", "1024", "1500", "2000", "2048", "3000", "4000", "4096", "6000", "8000", "8192", "12000", "16000", "20000", "24000"],
  },
  PSU: {
    wattageW: ["300", "350", "400", "450", "500", "550", "600", "650", "700", "750", "800", "850", "900", "1000", "1050", "1100", "1200", "1300", "1500", "1600", "1800", "2000"],
    efficiencyRating: ["80 Plus", "80 Plus White", "80 Plus Bronze", "80 Plus Silver", "80 Plus Gold", "80 Plus Platinum", "80 Plus Titanium"],
    formFactor: ["ATX", "SFX", "SFX-L", "TFX"],
  },
  CASE: {
    formFactorSupport: ["XL-ATX", "E-ATX", "ATX", "Micro-ATX", "Mini-ITX", "Mini-DTX"],
    psuFormFactors: ["ATX", "SFX", "SFX-L", "TFX"],
  },
  CPU_COOLER: {
    coolerType: ["Air cooler", "AIO liquid cooler", "Custom liquid cooling"],
  },
};

export function storageInterfaceRequiresSsd(interfaceName: string) {
  return interfaceName.startsWith("M.2") || interfaceName === "NVMe" || interfaceName.startsWith("PCIe");
}

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
