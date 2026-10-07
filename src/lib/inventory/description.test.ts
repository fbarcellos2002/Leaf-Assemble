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
});
