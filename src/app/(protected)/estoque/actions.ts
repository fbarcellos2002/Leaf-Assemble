"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth/profile";
import {
  componentCategorySchema,
  parseComponentSpecs,
  parseSpecFormValue,
  specFields,
} from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

const componentFieldsSchema = z.object({
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).optional(),
  lotCode: z.string().trim().max(80).optional(),
  quantity: z.coerce.number().int().min(0).max(100000),
  purchaseDate: z.union([z.literal(""), z.iso.date()]).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function createComponent(formData: FormData) {
  await requireAdminProfile();
  const category = componentCategorySchema.safeParse(formData.get("category"));
  const fields = componentFieldsSchema.safeParse({
    manufacturer: formData.get("manufacturer"),
    model: formData.get("model"),
    description: formData.get("description"),
    lotCode: formData.get("lotCode"),
    quantity: formData.get("quantity"),
    purchaseDate: formData.get("purchaseDate"),
    notes: formData.get("notes"),
  });
  if (!category.success || !fields.success) redirect("/estoque/novo?error=invalid-input");
  if (fields.data.quantity > 0 && !fields.data.lotCode) {
    redirect("/estoque/novo?error=lot-required");
  }

  const rawSpecs: Record<string, unknown> = {};
  for (const field of specFields[category.data]) {
    const value = parseSpecFormValue(field, formData.get(`spec_${field.key}`));
    if (value !== undefined) rawSpecs[field.key] = value;
  }
  const sourceDataValue = formData.get("sourceData");
  if (typeof sourceDataValue === "string" && sourceDataValue) {
    if (sourceDataValue.length > 150_000) redirect("/estoque/novo?error=invalid-specs");
    try {
      const sourceData = z.record(z.string(), z.unknown()).safeParse(JSON.parse(sourceDataValue));
      if (!sourceData.success) redirect("/estoque/novo?error=invalid-specs");
      rawSpecs.sourceData = sourceData.data;
    } catch {
      redirect("/estoque/novo?error=invalid-specs");
    }
  }
  const specs = parseComponentSpecs(category.data, rawSpecs);
  if (!specs.success) redirect("/estoque/novo?error=invalid-specs");

  const supabase = await createClient();
  const { data: componentId, error } = await supabase.rpc("admin_create_component", {
    p_category: category.data,
    p_manufacturer: fields.data.manufacturer,
    p_model: fields.data.model,
    p_description: fields.data.description ?? "",
    p_specs: specs.data,
    p_lot_code: fields.data.lotCode ?? "",
    p_quantity: fields.data.quantity,
    p_purchase_date: fields.data.purchaseDate || null,
    p_notes: fields.data.notes ?? "",
  });

  if (error || !componentId) redirect("/estoque/novo?error=save-failed");
  revalidatePath("/estoque");
  redirect(`/estoque/${componentId}?notice=created`);
}

const receiveStockSchema = z.object({
  componentId: z.uuid(),
  lotCode: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().positive().max(100000),
  purchaseDate: z.union([z.literal(""), z.iso.date()]).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function receiveStock(formData: FormData) {
  await requireAdminProfile();
  const parsed = receiveStockSchema.safeParse({
    componentId: formData.get("componentId"),
    lotCode: formData.get("lotCode"),
    quantity: formData.get("quantity"),
    purchaseDate: formData.get("purchaseDate"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect("/estoque?error=invalid-input");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_receive_stock", {
    p_component_id: parsed.data.componentId,
    p_lot_code: parsed.data.lotCode,
    p_quantity: parsed.data.quantity,
    p_purchase_date: parsed.data.purchaseDate || null,
    p_notes: parsed.data.notes ?? "",
  });
  if (error) redirect(`/estoque/${parsed.data.componentId}?error=stock-failed`);

  revalidatePath("/estoque");
  revalidatePath(`/estoque/${parsed.data.componentId}`);
  redirect(`/estoque/${parsed.data.componentId}?notice=stock-received`);
}
