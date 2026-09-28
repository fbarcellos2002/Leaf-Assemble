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
    cores: optionalPositiveInteger,
    threads: optionalPositiveInteger,
    baseClockMhz: optionalPositiveNumber,
    boostClockMhz: optionalPositiveNumber,
    tdpW: optionalPositiveNumber,
    integratedGraphics: optionalBoolean,
    memoryTypes: optionalTextList,
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

const sourceDataSchema = z.record(z.string(), z.unknown());

export type ComponentSpecs = {
  [Category in ComponentCategory]: z.infer<(typeof specSchemas)[Category]> & {
    category: Category;
    sourceData?: z.infer<typeof sourceDataSchema>;
  };
}[ComponentCategory];

export function parseComponentSpecs(category: ComponentCategory, input: unknown) {
  const parsed = specSchemas[category].safeParse(input);
  if (!parsed.success) return parsed;
  if (!input || typeof input !== "object" || Array.isArray(input)) return parsed;

  const sourceData = (input as Record<string, unknown>).sourceData;
  if (sourceData === undefined) return parsed;
  const validatedSourceData = sourceDataSchema.safeParse(sourceData);
  if (!validatedSourceData.success) return { success: false as const, error: validatedSourceData.error };

  return {
    success: true as const,
    data: { ...parsed.data, sourceData: validatedSourceData.data },
  };
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
    { key: "cores", label: "Núcleos", type: "number" },
    { key: "threads", label: "Threads", type: "number" },
    { key: "baseClockMhz", label: "Clock base", type: "number", unit: "MHz" },
    { key: "boostClockMhz", label: "Clock boost", type: "number", unit: "MHz" },
    { key: "tdpW", label: "TDP", type: "number", unit: "W" },
    { key: "integratedGraphics", label: "Gráficos integrados", type: "boolean" },
    { key: "memoryTypes", label: "Tipos de memória", type: "text-list", hint: "Separe por vírgula: DDR4, DDR5" },
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
