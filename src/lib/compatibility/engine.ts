import type { ComponentCategory } from "@/lib/inventory/specs";

export type CompatibilityStatus = "compatible" | "warning" | "incompatible" | "unknown";

export type CompatibilityResult = {
  status: CompatibilityStatus;
  reason: string;
  details?: string;
  components: string[];
};

export type CompatibilityPart = {
  id: string;
  lotId?: string;
  category: ComponentCategory;
  manufacturer: string;
  name?: string | null;
  model: string;
  description?: string | null;
  specs: Record<string, unknown>;
};

const partName = (part: CompatibilityPart) => part.description?.trim() || part.name?.trim() || `${part.manufacturer} ${part.model}`;
const textValue = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const stringsValue = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value as string[]
    : undefined;
const normalized = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

function result(
  status: CompatibilityStatus,
  reason: string,
  parts: CompatibilityPart[],
  details?: string,
): CompatibilityResult {
  return { status, reason, details, components: parts.map(partName) };
}

function compareExactText(
  left: CompatibilityPart,
  leftKey: string,
  right: CompatibilityPart,
  rightKey: string,
  label: string,
): CompatibilityResult {
  const leftValue = textValue(left.specs[leftKey]);
  const rightValue = textValue(right.specs[rightKey]);
  if (!leftValue || !rightValue) {
    return result("unknown", `Não há dados suficientes para conferir ${label}.`, [left, right]);
  }
  if (normalized(leftValue) !== normalized(rightValue)) {
    return result("incompatible", `${label} incompatível.`, [left, right], `${leftValue} × ${rightValue}`);
  }
  return result("compatible", `${label} compatível.`, [left, right], leftValue);
}

function cpuMotherboard(cpu: CompatibilityPart, board: CompatibilityPart) {
  const socketCheck = compareExactText(cpu, "socket", board, "socket", "Socket da CPU e da placa-mãe");
  const cpuMemoryTypes = stringsValue(cpu.specs.memoryTypes);
  const boardMemoryType = textValue(board.specs.memoryType);
  if (!cpuMemoryTypes || !boardMemoryType) {
    return [socketCheck, result("unknown", "Tipos de memória suportados pela CPU ou placa-mãe não informados.", [cpu, board])];
  }
  const memoryCheck = cpuMemoryTypes.some((type) => normalized(type) === normalized(boardMemoryType))
    ? result("compatible", "A CPU suporta o tipo de memória da placa-mãe.", [cpu, board], boardMemoryType)
    : result("incompatible", "A CPU não suporta o tipo de memória da placa-mãe.", [cpu, board], `${cpuMemoryTypes.join(", ")} × ${boardMemoryType}`);
  return [socketCheck, memoryCheck];
}

function ramMotherboard(rams: CompatibilityPart[], board: CompatibilityPart) {
  const type = textValue(board.specs.memoryType);
  const slots = numberValue(board.specs.memorySlots);
  const maxGb = numberValue(board.specs.maxMemoryGb);
  const frequencies = Array.isArray(board.specs.supportedMemoryFrequenciesMhz)
    ? (board.specs.supportedMemoryFrequenciesMhz as unknown[]).filter((value): value is number => typeof value === "number")
    : undefined;

  if (!rams.length) return [];
  const modules = rams.reduce((sum, ram) => sum + (numberValue(ram.specs.moduleCount) ?? 1), 0);
  if (slots !== undefined && modules > slots) {
    return [result("incompatible", "A quantidade de módulos excede os slots da placa-mãe.", [...rams, board], `${modules} módulos para ${slots} slots`)];
  }

  const capacities = rams.map((ram) => numberValue(ram.specs.capacityGb));
  const totalCapacity = capacities.every((value): value is number => value !== undefined)
    ? capacities.reduce((sum, value) => sum + value, 0)
    : undefined;
  if (totalCapacity !== undefined && maxGb !== undefined && totalCapacity > maxGb) {
    return [result("incompatible", "A capacidade de memória excede o limite da placa-mãe.", [...rams, board], `${totalCapacity} GB para máximo de ${maxGb} GB`)];
  }

  const results: CompatibilityResult[] = [];
  for (const ram of rams) {
    const ramType = textValue(ram.specs.memoryType);
    if (!type || !ramType) {
      results.push(result("unknown", "Tipo de memória não informado para CPU/RAM ou placa-mãe.", [ram, board]));
    } else if (normalized(type) !== normalized(ramType)) {
      results.push(result("incompatible", "Tipo de memória incompatível.", [ram, board], `${ramType} × ${type}`));
    }

    const frequency = numberValue(ram.specs.frequencyMhz);
    if (frequency !== undefined && frequencies) {
      const maxFrequency = frequencies.length ? Math.max(...frequencies) : undefined;
      if (maxFrequency !== undefined && frequency > maxFrequency) {
        results.push(result("warning", "A memória pode operar em frequência reduzida.", [ram, board], `${frequency} MHz; placa-mãe suporta até ${maxFrequency} MHz`));
      } else if (maxFrequency === undefined) {
        results.push(result("unknown", "A placa-mãe não informa frequências de memória suportadas.", [ram, board]));
      }
    } else {
      results.push(result("unknown", "Frequência da RAM ou suporte da placa-mãe não informado.", [ram, board]));
    }

    const ecc = ram.specs.ecc;
    const eccSupport = board.specs.eccSupport;
    if (typeof ecc === "boolean" && typeof eccSupport === "boolean") {
      if (ecc && !eccSupport) results.push(result("incompatible", "RAM ECC não é suportada pela placa-mãe.", [ram, board]));
    } else {
      results.push(result("unknown", "Suporte ECC não informado em um dos componentes.", [ram, board]));
    }
    if (ram.specs.registered === true && eccSupport !== true) {
      results.push(result("incompatible", "Memória registered exige suporte compatível da placa-mãe.", [ram, board]));
    }
  }

  if (slots === undefined || maxGb === undefined) {
    results.push(result("unknown", "Slots ou capacidade máxima de memória não informados.", [...rams, board]));
  }
  return results;
}

function cpuRamFrequency(cpu: CompatibilityPart, ram: CompatibilityPart) {
  const maxFrequency = numberValue(cpu.specs.maxMemoryFrequencyMhz);
  const frequency = numberValue(ram.specs.frequencyMhz);
  if (maxFrequency === undefined || frequency === undefined || frequency <= maxFrequency) return [];
  return [result(
    "warning",
    "A frequência da RAM excede a frequência máxima informada para a CPU.",
    [cpu, ram],
    `${frequency} MHz na memória; CPU até ${maxFrequency} MHz`,
  )];
}

function coolerSocket(cooler: CompatibilityPart, target: CompatibilityPart) {
  const supported = stringsValue(cooler.specs.supportedSockets);
  const socket = textValue(target.specs.socket);
  if (!supported || !socket) {
    return result("unknown", "Socket compatível do cooler ou socket do componente não informado.", [cooler, target]);
  }
  if (!supported.some((item) => normalized(item) === normalized(socket))) {
    return result("incompatible", "O cooler não informa suporte a este socket.", [cooler, target], `Cooler: ${supported.join(", ")}; socket: ${socket}`);
  }
  return result("compatible", "O cooler suporta o socket selecionado.", [cooler, target], socket);
}

function coolerThermal(cooler: CompatibilityPart, cpu: CompatibilityPart) {
  const coolerRating = numberValue(cooler.specs.tdpRatingW);
  const cpuTdp = numberValue(cpu.specs.tdpW);
  if (coolerRating === undefined || cpuTdp === undefined) {
    return result("unknown", "TDP do processador ou capacidade do cooler não informado.", [cooler, cpu]);
  }
  if (coolerRating < cpuTdp) {
    return result("warning", "O cooler tem capacidade térmica inferior ao TDP nominal da CPU.", [cooler, cpu], `${coolerRating} W para CPU de ${cpuTdp} W`);
  }
  return result("compatible", "A capacidade térmica do cooler atende ao TDP nominal da CPU.", [cooler, cpu]);
}

function gpuMotherboard(gpu: CompatibilityPart, board: CompatibilityPart) {
  const gpuInterface = textValue(gpu.specs.interface);
  const slots = numberValue(board.specs.pcieSlots);
  if (!gpuInterface || slots === undefined) {
    return result("unknown", "Interface da GPU ou slots PCIe não informados.", [gpu, board]);
  }
  if (!/pcie|pci express/i.test(gpuInterface) || slots < 1) {
    return result("incompatible", "A placa-mãe não informa um slot compatível com a GPU.", [gpu, board], `${gpuInterface}; ${slots} slots PCIe`);
  }
  return result("compatible", "A GPU usa interface PCIe e a placa-mãe tem slot disponível.", [gpu, board]);
}

function gpuSlotCount(gpus: CompatibilityPart[], board: CompatibilityPart) {
  const slots = numberValue(board.specs.pcieSlots);
  if (slots === undefined) return result("unknown", "Quantidade de slots PCIe da placa-mãe não informada.", [...gpus, board]);
  if (gpus.length > slots) {
    return result("incompatible", "A quantidade de GPUs excede os slots PCIe informados.", [...gpus, board], `${gpus.length} GPUs para ${slots} slots`);
  }
  return result("compatible", "A quantidade de GPUs cabe nos slots PCIe informados.", [...gpus, board]);
}

function gpuCase(gpu: CompatibilityPart, pcCase: CompatibilityPart) {
  const length = numberValue(gpu.specs.lengthMm);
  const limit = numberValue(pcCase.specs.gpuMaxLengthMm);
  if (length === undefined || limit === undefined) {
    return result("unknown", "Comprimento da GPU ou limite do gabinete não informado.", [gpu, pcCase]);
  }
  if (length > limit) {
    return result("incompatible", "A GPU é maior que o espaço disponível no gabinete.", [gpu, pcCase], `${length} mm para limite de ${limit} mm`);
  }
  return result("compatible", "A GPU cabe no gabinete.", [gpu, pcCase], `${length} mm de ${limit} mm`);
}

function coolerCase(cooler: CompatibilityPart, pcCase: CompatibilityPart) {
  const height = numberValue(cooler.specs.heightMm);
  const limit = numberValue(pcCase.specs.cpuCoolerMaxHeightMm);
  if (height === undefined || limit === undefined) {
    return result("unknown", "Altura do cooler ou limite do gabinete não informado.", [cooler, pcCase]);
  }
  if (height > limit) {
    return result("incompatible", "O cooler é mais alto que o limite do gabinete.", [cooler, pcCase], `${height} mm para limite de ${limit} mm`);
  }
  return result("compatible", "O cooler cabe no gabinete.", [cooler, pcCase], `${height} mm de ${limit} mm`);
}

function motherboardCase(board: CompatibilityPart, pcCase: CompatibilityPart) {
  const formFactor = textValue(board.specs.formFactor);
  const supported = stringsValue(pcCase.specs.formFactorSupport);
  if (!formFactor || !supported) {
    return result("unknown", "Formato da placa-mãe ou formatos suportados pelo gabinete não informado.", [board, pcCase]);
  }
  if (!supported.some((item) => normalized(item) === normalized(formFactor))) {
    return result("incompatible", "O formato da placa-mãe não é suportado pelo gabinete.", [board, pcCase], `${formFactor}; suporta ${supported.join(", ")}`);
  }
  return result("compatible", "O gabinete suporta o formato da placa-mãe.", [board, pcCase], formFactor);
}

function psuCase(psu: CompatibilityPart, pcCase: CompatibilityPart) {
  const psuFormat = textValue(psu.specs.formFactor);
  const supported = stringsValue(pcCase.specs.psuFormFactors);
  if (!psuFormat || !supported) {
    return result("unknown", "Formato da fonte ou formatos aceitos pelo gabinete não informado.", [psu, pcCase]);
  }
  if (!supported.some((item) => normalized(item) === normalized(psuFormat))) {
    return result("incompatible", "O gabinete não informa suporte ao formato da fonte.", [psu, pcCase], `${psuFormat}; suporta ${supported.join(", ")}`);
  }
  return result("compatible", "O gabinete suporta o formato da fonte.", [psu, pcCase], psuFormat);
}

function storageMotherboard(storage: CompatibilityPart, board: CompatibilityPart) {
  const storageInterface = textValue(storage.specs.interface);
  const supported = stringsValue(board.specs.storageInterfaces);
  if (!storageInterface || !supported) {
    return result("unknown", "Interface do armazenamento ou interfaces da placa-mãe não informadas.", [storage, board]);
  }
  if (!supported.some((item) => normalized(item) === normalized(storageInterface))) {
    return result("incompatible", "A placa-mãe não informa suporte à interface do armazenamento.", [storage, board], `${storageInterface}; suporta ${supported.join(", ")}`);
  }
  return result("compatible", "A interface do armazenamento é suportada.", [storage, board], storageInterface);
}

function connectorType(value: string) {
  const lower = normalized(value).replace(/\s/g, "");
  if (/12v-?2x6|12v2x6/.test(lower)) return "12v-2x6";
  if (/12vhpwr|12\+4/.test(lower)) return "12vhpwr";
  if (/6\+2-?pin|8-?pin/.test(lower)) return "8pin";
  if (/6-?pin/.test(lower)) return "6pin";
  return undefined;
}

function connectorCount(items: string[], type: string) {
  return items.reduce((sum, item) => {
    if (connectorType(item) !== type) return sum;
    const count = item.match(/(?:^|\s)(\d+)\s*[x×]/i);
    return sum + (count ? Number(count[1]) : 1);
  }, 0);
}

function powerSupply(psu: CompatibilityPart, cpu?: CompatibilityPart, gpus: CompatibilityPart[] = []) {
  const wattage = numberValue(psu.specs.wattageW);
  const components = [psu, ...(cpu ? [cpu] : []), ...gpus];
  if (wattage === undefined) {
    return result("unknown", "Potência da fonte não informada.", components);
  }

  const cpuTdp = cpu ? numberValue(cpu.specs.tdpW) : undefined;
  const gpuTdps = gpus.map((gpu) => numberValue(gpu.specs.tdpW));
  const gpuRecommendations = gpus.map((gpu) => numberValue(gpu.specs.recommendedPsuW));
  const hasUnknownPower = (cpu && cpuTdp === undefined) || gpuTdps.some((tdp) => tdp === undefined);
  const estimated = cpuTdp !== undefined && gpuTdps.every((tdp): tdp is number => tdp !== undefined)
    ? cpuTdp + gpuTdps.reduce((sum, tdp) => sum + tdp, 0) + 100
    : undefined;
  const maxRecommended = gpuRecommendations.length && gpuRecommendations.every((value): value is number => value !== undefined)
    ? Math.max(...gpuRecommendations)
    : undefined;
  const required = Math.max(estimated ?? 0, maxRecommended ?? 0);

  const connectorSpecs = stringsValue(psu.specs.connectors);
  const connectorNeeds = gpus.flatMap((gpu) => stringsValue(gpu.specs.powerConnectors) ?? []);
  const connectorsUnknown = connectorNeeds.length > 0 && connectorSpecs === undefined;
  const missingConnector = connectorSpecs && connectorNeeds.find((need) => {
    const type = connectorType(need);
    return !type || connectorCount(connectorSpecs, type) < (Number(need.match(/^(\d+)\s*[x×]/i)?.[1]) || 1);
  });
  if (missingConnector) {
    return result("incompatible", "A fonte não informa os conectores necessários para a GPU.", components, missingConnector);
  }
  if (required > 0 && wattage < required) {
    return result("incompatible", "A potência da fonte é inferior ao requisito estimado.", components, `${wattage} W disponíveis; pelo menos ${Math.ceil(required)} W necessários`);
  }
  if (connectorsUnknown || hasUnknownPower || estimated === undefined || maxRecommended === undefined && gpus.length > 0) {
    return result("unknown", "Faltam dados de potência ou conectores para validar a fonte com segurança.", components);
  }
  if (required > 0 && wattage < required * 1.2) {
    return result("warning", "A fonte está próxima do limite estimado do sistema.", components, `${wattage} W para requisito de ${Math.ceil(required)} W`);
  }
  return result("compatible", "Potência e conectores da fonte atendem aos componentes informados.", components, `${wattage} W`);
}

function ramCombination(rams: CompatibilityPart[]) {
  if (rams.length < 2) return [];
  const lotIds = rams.map((ram) => ram.lotId ?? ram.id);
  if (new Set(lotIds).size > 1) {
    return [result("warning", "Módulos de RAM de itens/lotes diferentes podem não operar como um kit pareado.", rams)];
  }
  return [];
}

const statusPriority: Record<CompatibilityStatus, number> = {
  compatible: 0,
  warning: 1,
  unknown: 2,
  incompatible: 3,
};

export function evaluateCompatibility(parts: CompatibilityPart[]) {
  const byCategory = (category: ComponentCategory) => parts.filter((part) => part.category === category);
  const cpus = byCategory("CPU");
  const boards = byCategory("MOTHERBOARD");
  const rams = byCategory("RAM");
  const gpus = byCategory("GPU");
  const storages = byCategory("STORAGE");
  const psus = byCategory("PSU");
  const cases = byCategory("CASE");
  const coolers = byCategory("CPU_COOLER");
  const checks: CompatibilityResult[] = [];

  for (const cpu of cpus) for (const board of boards) checks.push(...cpuMotherboard(cpu, board));
  for (const cpu of cpus) for (const ram of rams) checks.push(...cpuRamFrequency(cpu, ram));
  for (const board of boards) checks.push(...ramMotherboard(rams, board));
  checks.push(...ramCombination(rams));
  for (const cooler of coolers) {
    for (const cpu of cpus) {
      checks.push(coolerSocket(cooler, cpu));
      checks.push(coolerThermal(cooler, cpu));
    }
    for (const board of boards) checks.push(coolerSocket(cooler, board));
  }
  for (const gpu of gpus) {
    for (const board of boards) checks.push(gpuMotherboard(gpu, board));
    for (const pcCase of cases) checks.push(gpuCase(gpu, pcCase));
  }
  for (const board of boards) if (gpus.length) checks.push(gpuSlotCount(gpus, board));
  for (const board of boards) for (const pcCase of cases) checks.push(motherboardCase(board, pcCase));
  for (const cooler of coolers) for (const pcCase of cases) checks.push(coolerCase(cooler, pcCase));
  for (const psu of psus) for (const pcCase of cases) checks.push(psuCase(psu, pcCase));
  for (const storage of storages) for (const board of boards) checks.push(storageMotherboard(storage, board));
  for (const psu of psus) checks.push(powerSupply(psu, cpus[0], gpus));

  const overall = [...checks].sort((a, b) => statusPriority[b.status] - statusPriority[a.status])[0]?.status ?? "unknown";
  return { status: overall, checks };
}
