import "server-only";

import { cache } from "react";

import { componentCategorySchema } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

export const loadInventorySnapshot = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("components")
    .select("id, category, manufacturer, model, specs, component_lots(id, lot_code, quantity_total, available_quantity, reserved_quantity, used_quantity)")
    .order("manufacturer");

  const components = (data ?? []).map((component) => ({
    id: component.id,
    category: componentCategorySchema.parse(component.category),
    manufacturer: component.manufacturer,
    model: component.model,
    specs: component.specs,
    lots: (component.component_lots ?? []).map((lot) => ({
      id: lot.id,
      lotCode: lot.lot_code ?? null,
      available: lot.available_quantity,
      total: lot.quantity_total,
      reserved: lot.reserved_quantity,
      used: lot.used_quantity,
    })),
  }));

  const totalQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.total, 0), 0);
  const availableQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.available, 0), 0);
  const reservedQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.reserved, 0), 0);
  const usedQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.used, 0), 0);

  return { components, error, totalQuantity, availableQuantity, reservedQuantity, usedQuantity };
});
