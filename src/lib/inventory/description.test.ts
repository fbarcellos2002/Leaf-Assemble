import { describe, expect, it } from "vitest";

import { generateComponentDescription } from "@/lib/inventory/description";

describe("generateComponentDescription", () => {
  it("uses the requested RAM description format without a model", () => {
    expect(generateComponentDescription("RAM", "Bluecase", "", {
      capacityGb: 8,
      memoryType: "DDR4",
      frequencyMhz: 2400,
    })).toBe("Bluecase | 8 GB | DDR4 | 2400 Mhz");
  });

  it("uses manufacturer, chip brand, GPU model, and VRAM in order", () => {
    expect(generateComponentDescription("GPU", "MSI", "RTX 5050", {
      chipBrand: "NVIDIA",
      vramGb: 6,
    })).toBe("MSI | NVIDIA | RTX 5050 | 6 GB VRAM");
  });

  it("uses the requested storage description format without a model", () => {
    expect(generateComponentDescription("STORAGE", "Sandisk", "", {
      interface: "SATA",
      type: "HD",
      capacityGb: 500,
    })).toBe("Sandisk | SATA | HD | 500 GB");
  });

  it("uses the requested PSU description format without a model", () => {
    expect(generateComponentDescription("PSU", "Redragon", "", {
      wattageW: 500,
      efficiencyRating: "80 Plus Bronze",
      formFactor: "ATX",
      activePfc: true,
    })).toBe("Redragon | 500 W | 80 Plus Bronze");
  });

  it("lists the cooler base socket and every selected adapter socket", () => {
    expect(generateComponentDescription("CPU_COOLER", "Bluecase", "", {
      coolerType: "Air cooler",
      socketBase: "LGA 1155",
      socketAdapter: true,
      adapterSockets: ["LGA 1150", "AM4"],
    })).toBe("Bluecase | Air cooler | LGA 1155 | LGA 1150 | AM4");
  });
});
