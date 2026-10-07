"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth/profile";
import { generateComponentDescription } from "@/lib/inventory/description";
import {
  componentCategorySchema,
  getProcessorGeneration,
  manufacturerChoices,
  parseComponentSpecs,
  parseSpecFormValue,
  specChoices,
  specFields,
  socketChoicesByManufacturer,
} from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

const componentFieldsSchema = z.object({
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().max(140),
  lotCode: z.string().trim().max(80).optional(),
  lotNoInformation: z.string().optional(),
  quantity: z.preprocess((value) => value === null ? undefined : value, z.coerce.number().int().min(0).max(100000)),
  notes: z.string().trim().max(500).optional(),
});

export type CreateComponentState = { error: "invalid-input" | "invalid-specs" | "save-failed" | null };

export async function createComponent(_state: CreateComponentState, formData: FormData): Promise<CreateComponentState> {
  await requireAdminProfile();
  const category = componentCategorySchema.safeParse(formData.get("category"));
  const fields = componentFieldsSchema.safeParse({
    manufacturer: formData.get("manufacturer") ?? "",
    model: formData.get("model") ?? "",
    lotCode: formData.get("lotCode") ?? "",
    lotNoInformation: formData.get("lotNoInformation") ?? "false",
    quantity: formData.get("quantity"),
    notes: formData.get("notes") ?? "",
  });
  if (!category.success || !fields.success) return { error: "invalid-input" };
  if (category.data !== "MOTHERBOARD" && category.data !== "RAM" && !fields.data.model) return { error: "invalid-input" };
  if (category.data === "RAM" && fields.data.lotNoInformation !== "true" && !fields.data.lotCode) return { error: "invalid-input" };
  const categoryManufacturerChoices = manufacturerChoices[category.data];
  if (categoryManufacturerChoices && !categoryManufacturerChoices.includes(fields.data.manufacturer)) return { error: "invalid-input" };
  const rawSpecs: Record<string, unknown> = {};
  for (const field of specFields[category.data]) {
    const value = parseSpecFormValue(field, formData.get(`spec_${field.key}`));
    if (value !== undefined) rawSpecs[field.key] = value;
  }
  if (category.data === "MOTHERBOARD") {
    const interfaceChoices = specChoices.MOTHERBOARD?.storageInterfaces ?? [];
    const selectedInterfaces = Array.isArray(rawSpecs.storageInterfaces) ? rawSpecs.storageInterfaces : [];
    const counts: Record<string, number> = {};
    for (const interfaceName of selectedInterfaces) {
      if (typeof interfaceName !== "string" || !interfaceChoices.includes(interfaceName)) return { error: "invalid-specs" };
      const index = interfaceChoices.indexOf(interfaceName);
      const rawCount = formData.get(`spec_storageInterfaceCount_${index}`);
      const count = typeof rawCount === "string" ? Number(rawCount) : NaN;
      const maximum = interfaceName.startsWith("M.2") || interfaceName.startsWith("PCIe") ? 7 : 12;
      if (!Number.isInteger(count) || count < 1 || count > maximum) return { error: "invalid-specs" };
      counts[interfaceName] = count;
    }
    rawSpecs.storageInterfaceCounts = counts;
    if (
      !selectedInterfaces.length
      || typeof rawSpecs.socket !== "string"
      || !["ATX", "m-ATX", "Mini-ITX", "E-ATX", "Mini-DTX", "XL-ATX"].includes(String(rawSpecs.formFactor))
      || !["DDR2", "DDR3", "DDR3L", "DDR4", "DDR5"].includes(String(rawSpecs.memoryType))
      || ![2, 4, 8].includes(Number(rawSpecs.memorySlots))
      || typeof rawSpecs.maxMemoryGb !== "number" || !Number.isInteger(rawSpecs.maxMemoryGb) || rawSpecs.maxMemoryGb < 1
      || !Array.isArray(rawSpecs.supportedMemoryFrequenciesMhz) || rawSpecs.supportedMemoryFrequenciesMhz.length !== 1
      || typeof rawSpecs.pcieSlots !== "number" || !Number.isInteger(rawSpecs.pcieSlots) || rawSpecs.pcieSlots < 1 || rawSpecs.pcieSlots > 7
    ) return { error: "invalid-specs" };
  }
  if (category.data === "CPU") {
    const processorSockets: readonly string[] = fields.data.manufacturer === "Intel"
      ? socketChoicesByManufacturer.Intel
      : fields.data.manufacturer === "AMD" ? socketChoicesByManufacturer.AMD : [];
    const generation = typeof rawSpecs.socket === "string"
      ? getProcessorGeneration(fields.data.manufacturer, rawSpecs.socket)
      : undefined;
    if (
      !generation
      || rawSpecs.generation !== generation
      || !processorSockets.includes(rawSpecs.socket as string)
      || typeof rawSpecs.cores !== "number" || !Number.isInteger(rawSpecs.cores) || rawSpecs.cores < 1
      || typeof rawSpecs.threads !== "number" || !Number.isInteger(rawSpecs.threads) || rawSpecs.threads < 1
      || typeof rawSpecs.integratedGraphics !== "boolean"
      || !Array.isArray(rawSpecs.memoryTypes) || rawSpecs.memoryTypes.length === 0
    ) return { error: "invalid-specs" };
  }
  if (category.data === "RAM") {
    const memoryTypes = specChoices.RAM?.memoryType ?? [];
    const frequencies = specChoices.RAM?.frequencyMhz ?? [];
    const formFactors = specChoices.RAM?.formFactor ?? [];
    if (
      typeof rawSpecs.memoryType !== "string" || !memoryTypes.includes(rawSpecs.memoryType)
      || typeof rawSpecs.capacityGb !== "number" || !Number.isFinite(rawSpecs.capacityGb) || rawSpecs.capacityGb < 1
      || typeof rawSpecs.frequencyMhz !== "number" || !frequencies.includes(String(rawSpecs.frequencyMhz))
      || typeof rawSpecs.formFactor !== "string" || !formFactors.includes(rawSpecs.formFactor)
      || (rawSpecs.ecc !== undefined && typeof rawSpecs.ecc !== "boolean")
    ) return { error: "invalid-specs" };
  }
  if (category.data === "MOTHERBOARD") {
    if (typeof rawSpecs.socket !== "string") return { error: "invalid-specs" };
  }
  if (category.data === "CPU_COOLER") {
    const sockets = rawSpecs.supportedSockets;
    if (!Array.isArray(sockets) || sockets.length === 0 || sockets.some((socket) => typeof socket !== "string")) return { error: "invalid-specs" };
    if (sockets.length > 1 && rawSpecs.socketAdapter !== true) return { error: "invalid-specs" };
  }
  const specs = parseComponentSpecs(category.data, rawSpecs);
  if (!specs.success) return { error: "invalid-specs" };
  const description = generateComponentDescription(
    category.data,
    fields.data.manufacturer,
    fields.data.model,
    specs.data as Record<string, unknown>,
  );
  const effectiveModel = fields.data.model || fields.data.manufacturer;
  const storedName = effectiveModel.toLocaleLowerCase("pt-BR").startsWith(fields.data.manufacturer.toLocaleLowerCase("pt-BR"))
    ? effectiveModel
    : `${fields.data.manufacturer} ${effectiveModel}`;

  const supabase = await createClient();
  const { data: componentId, error } = await supabase.rpc("admin_create_component", {
    p_category: category.data,
    p_manufacturer: fields.data.manufacturer,
    p_name: storedName,
    p_model: effectiveModel,
    p_description: description,
    p_specs: specs.data,
    p_lot_code: category.data === "RAM"
      ? fields.data.lotNoInformation === "true" ? "Sem Informação" : fields.data.lotCode
      : fields.data.lotCode || null,
    p_quantity: fields.data.quantity,
    p_purchase_date: null,
    p_notes: fields.data.notes ?? "",
  });

  if (error || !componentId) return { error: "save-failed" };
  revalidatePath("/estoque");
  redirect("/estoque/novo?created=1");
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
