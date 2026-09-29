import { describe, expect, it } from "vitest";

import { evaluateCompatibility } from "@/lib/compatibility/engine";
import { calculateBuildCapacity, type InventoryPool } from "@/lib/inventory/capacity";

describe("processadores e memória", () => {
  it("avisa quando a frequência da RAM excede o limite informado da CPU", () => {
    const result = evaluateCompatibility([
      {
        id: "cpu",
        category: "CPU",
        manufacturer: "Intel",
        model: "Processador de teste",
        specs: { maxMemoryFrequencyMhz: 3200 },
      },
      {
        id: "ram",
        category: "RAM",
        manufacturer: "Marca de teste",
        model: "Memória de teste",
        specs: { frequencyMhz: 3600 },
      },
    ]);

    expect(result.status).toBe("warning");
    expect(result.checks[0]?.details).toContain("CPU até 3200 MHz");
  });

  it("mantém o campo de gráficos integrados no cálculo da composição sem GPU discreta", () => {
    const inventory: InventoryPool[] = [
      {
        id: "cpu",
        category: "CPU",
        manufacturer: "Intel",
        model: "Processador com iGPU",
        specs: { socket: "LGA1700", memoryTypes: ["DDR4"], integratedGraphics: true, tdpW: 65 },
        lots: [{ id: "cpu-lot", lotCode: null, available: 1 }],
      },
      {
        id: "board",
        category: "MOTHERBOARD",
        manufacturer: "Marca de teste",
        model: "Placa-mãe",
        specs: { socket: "LGA1700", memoryType: "DDR4", memorySlots: 4, maxMemoryGb: 64, supportedMemoryFrequenciesMhz: [3200], eccSupport: false, storageInterfaces: ["NVMe"], pcieSlots: 1, formFactor: "ATX" },
        lots: [{ id: "board-lot", lotCode: "B-1", available: 1 }],
      },
      {
        id: "ram",
        category: "RAM",
        manufacturer: "Marca de teste",
        model: "Memória RAM",
        specs: { memoryType: "DDR4", capacityGb: 16, frequencyMhz: 3200, moduleCount: 2, ecc: false, registered: false },
        lots: [{ id: "ram-lot", lotCode: "R-1", available: 1 }],
      },
      {
        id: "storage",
        category: "STORAGE",
        manufacturer: "Marca de teste",
        model: "SSD",
        specs: { interface: "NVMe" },
        lots: [{ id: "storage-lot", lotCode: "S-1", available: 1 }],
      },
      {
        id: "psu",
        category: "PSU",
        manufacturer: "Marca de teste",
        model: "Fonte",
        specs: { wattageW: 550, formFactor: "ATX" },
        lots: [{ id: "psu-lot", lotCode: "P-1", available: 1 }],
      },
      {
        id: "case",
        category: "CASE",
        manufacturer: "Marca de teste",
        model: "Gabinete",
        specs: { formFactorSupport: ["ATX"], psuFormFactors: ["ATX"] },
        lots: [{ id: "case-lot", lotCode: null, available: 1 }],
      },
    ];

    expect(calculateBuildCapacity(inventory).buildsNow).toBe(1);
  });
});
