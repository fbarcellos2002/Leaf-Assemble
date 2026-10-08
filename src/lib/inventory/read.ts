import "server-only";

import { cache } from "react";

import { componentCategorySchema } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

export const loadInventorySnapshot = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("components")
    .select("id, category, manufacturer, name, model, description, specs, component_lots(id, lot_code, quantity_total, available_quantity, reserved_quantity, used_quantity)")
    .order("manufacturer");

  const components = (data ?? []).flatMap((component) => {
    const category = componentCategorySchema.safeParse(component.category);
    if (!category.success) return [];
    return [{
      id: component.id,
      category: category.data,
      manufacturer: component.manufacturer,
      name: component.name,
      model: component.model,
      description: component.description,
      specs: component.specs,
      lots: (component.component_lots ?? []).map((lot) => ({
        id: lot.id,
        lotCode: lot.lot_code ?? null,
        available: lot.available_quantity,
        reserved: lot.reserved_quantity,
        used: lot.used_quantity,
        total: lot.available_quantity + lot.reserved_quantity,
      })),
    }];
  });

  const totalQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.total, 0), 0);
  const availableQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.available, 0), 0);
  const reservedQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.reserved, 0), 0);
  const usedQuantity = components.reduce((sum, component) => sum + component.lots.reduce((lots, lot) => lots + lot.used, 0), 0);

  return { components, error, totalQuantity, availableQuantity, reservedQuantity, usedQuantity };
});
