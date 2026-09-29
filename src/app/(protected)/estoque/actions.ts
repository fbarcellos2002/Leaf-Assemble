"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth/profile";
import { generateComponentDescription } from "@/lib/inventory/description";
import {
  componentCategorySchema,
  parseComponentSpecs,
  parseSpecFormValue,
  specFields,
} from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

const componentFieldsSchema = z.object({
  manufacturer: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(140),
  caseModel: z.string().trim().max(140).optional(),
  lotCode: z.string().trim().max(80).optional(),
  quantity: z.preprocess((value) => value === null ? undefined : value, z.coerce.number().int().min(0).max(100000)),
  notes: z.string().trim().max(500).optional(),
});

export type CreateComponentState = { error: "invalid-input" | "invalid-specs" | "save-failed" | null };

export async function createComponent(_state: CreateComponentState, formData: FormData): Promise<CreateComponentState> {
  await requireAdminProfile();
  const category = componentCategorySchema.safeParse(formData.get("category"));
  const fields = componentFieldsSchema.safeParse({
    manufacturer: formData.get("manufacturer") ?? "",
    name: formData.get("name") ?? "",
    caseModel: formData.get("caseModel") ?? "",
    lotCode: formData.get("lotCode") ?? "",
    quantity: formData.get("quantity"),
    notes: formData.get("notes") ?? "",
  });
  if (!category.success || !fields.success) return { error: "invalid-input" };

  const rawSpecs: Record<string, unknown> = {};
  for (const field of specFields[category.data]) {
    const value = parseSpecFormValue(field, formData.get(`spec_${field.key}`));
    if (value !== undefined) rawSpecs[field.key] = value;
  }
  const specs = parseComponentSpecs(category.data, rawSpecs);
  if (!specs.success) return { error: "invalid-specs" };
  const description = generateComponentDescription(
    category.data,
    fields.data.manufacturer,
    fields.data.name,
    specs.data as Record<string, unknown>,
    fields.data.caseModel ?? "",
  );
  const model = category.data === "CASE" ? fields.data.caseModel || fields.data.name : fields.data.name;

  const supabase = await createClient();
  const { data: componentId, error } = await supabase.rpc("admin_create_component", {
    p_category: category.data,
    p_manufacturer: fields.data.manufacturer,
    p_name: fields.data.name,
    p_model: model,
    p_description: description,
    p_specs: specs.data,
    p_lot_code: fields.data.lotCode || null,
    p_quantity: fields.data.quantity,
    p_purchase_date: null,
    p_notes: fields.data.notes ?? "",
  });

  if (error || !componentId) return { error: "save-failed" };
  revalidatePath("/estoque");
  redirect(`/estoque/${componentId}?notice=created`);
}

const receiveStockSchema = z.object({
  componentId: z.uuid(),
  lotCode: z.string().trim().max(80).optional(),
  quantity: z.preprocess((value) => value === null ? undefined : value, z.coerce.number().int().positive().max(100000)),
  notes: z.string().trim().max(500).optional(),
});

export async function receiveStock(formData: FormData) {
  await requireAdminProfile();
  const parsed = receiveStockSchema.safeParse({
    componentId: formData.get("componentId"),
    lotCode: formData.get("lotCode") ?? "",
    quantity: formData.get("quantity"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) redirect("/estoque?error=invalid-input");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_receive_stock", {
    p_component_id: parsed.data.componentId,
    p_lot_code: parsed.data.lotCode || null,
    p_quantity: parsed.data.quantity,
    p_purchase_date: null,
    p_notes: parsed.data.notes ?? "",
  });
  if (error) redirect(`/estoque/${parsed.data.componentId}?error=stock-failed`);

  revalidatePath("/estoque");
  revalidatePath(`/estoque/${parsed.data.componentId}`);
  redirect(`/estoque/${parsed.data.componentId}?notice=stock-received`);
}

const removeStockSchema = z.object({
  componentId: z.uuid(),
  lotId: z.uuid(),
  quantity: z.preprocess((value) => value === null ? undefined : value, z.coerce.number().int().positive().max(100000)),
});

export async function removeStock(formData: FormData) {
  await requireAdminProfile();
  const parsed = removeStockSchema.safeParse({
    componentId: formData.get("componentId"),
    lotId: formData.get("lotId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) redirect("/estoque?error=invalid-input");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_stock", {
    p_lot_id: parsed.data.lotId,
    p_quantity: parsed.data.quantity,
  });
  if (error) redirect(`/estoque/${parsed.data.componentId}?error=stock-failed`);

  revalidatePath("/estoque");
  revalidatePath(`/estoque/${parsed.data.componentId}`);
  redirect(`/estoque/${parsed.data.componentId}?notice=stock-removed`);
}
