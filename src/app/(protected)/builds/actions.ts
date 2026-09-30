"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveProfile } from "@/lib/auth/profile";
import { evaluateCompatibility, storageInterfaceSupported, type CompatibilityPart } from "@/lib/compatibility/engine";
import { componentCategorySchema } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

const createBuildSchema = z.object({
  name: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(1000).optional(),
});

export async function createBuild(formData: FormData) {
  await requireActiveProfile();
  const parsed = createBuildSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) redirect("/builds/new?error=invalid-input");

  const supabase = await createClient();
  const { data: buildId, error } = await supabase.rpc("create_build", {
    p_name: parsed.data.name,
    p_notes: parsed.data.notes ?? "",
  });
  if (error || !buildId) redirect("/builds/new?error=create-failed");
  revalidatePath("/builds");
  redirect(`/builds/${buildId}`);
}

const updateBuildSchema = z.object({
  buildId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(1000),
});

export async function updateBuild(formData: FormData) {
  await requireActiveProfile();
  const parsed = updateBuildSchema.safeParse({
    buildId: formData.get("buildId"),
    name: formData.get("name"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) redirect("/builds?error=invalid-input");

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_build", {
    p_build_id: parsed.data.buildId,
    p_name: parsed.data.name,
    p_notes: parsed.data.notes,
  });
  if (error) redirect(`/builds/${parsed.data.buildId}?error=update-failed`);
  revalidatePath("/builds");
  revalidatePath(`/builds/${parsed.data.buildId}`);
  redirect(`/builds/${parsed.data.buildId}?notice=updated`);
}

const removeBuildSchema = z.object({
  buildId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
});

export async function removeBuild(formData: FormData) {
  await requireActiveProfile();
  const parsed = removeBuildSchema.safeParse({
    buildId: formData.get("buildId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/builds?error=remove-failed");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_build", {
    p_build_id: parsed.data.buildId,
    p_reason: parsed.data.reason,
  });
  if (error) redirect("/builds?error=remove-failed");
  revalidatePath("/estoque");
  revalidatePath("/builds");
  revalidatePath(`/builds/${parsed.data.buildId}`);
  redirect("/builds?notice=removed");
}

const addComponentSchema = z.object({
  buildId: z.uuid(),
  slotKey: z.string().regex(/^(cpu|motherboard|ram-[1-9][0-9]*|gpu-[1-9][0-9]*|storage-[1-9][0-9]*|psu|case|cpu_cooler)$/),
  selection: z.string().regex(/^[0-9a-f-]{36}~[0-9a-f-]{36}$/i),
  acknowledge: z.enum(["yes", "no"]).optional(),
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function addBuildComponent(formData: FormData) {
  await requireActiveProfile();
  const parsed = addComponentSchema.safeParse({
    buildId: formData.get("buildId"),
    slotKey: formData.get("slotKey"),
    selection: formData.get("selection"),
    acknowledge: formData.get("acknowledge"),
  });
  if (!parsed.success) redirect("/builds?error=invalid-input");
  const [componentId, lotId] = parsed.data.selection.split("~");
  const supabase = await createClient();

  const [{ data: build }, { data: selected, error: selectedError }, { data: candidate }, { data: lot }] = await Promise.all([
    supabase.from("builds").select("id, status").eq("id", parsed.data.buildId).maybeSingle(),
    supabase.from("build_components").select("component_id, lot_id, components(id, category, manufacturer, name, model, description, specs)").eq("build_id", parsed.data.buildId).eq("is_active", true),
    supabase.from("components").select("id, category, manufacturer, name, model, description, specs").eq("id", componentId).maybeSingle(),
    supabase.from("component_lots").select("id, component_id, available_quantity").eq("id", lotId).eq("component_id", componentId).maybeSingle(),
  ]);

  if (!build || selectedError || !candidate || !lot || lot.available_quantity < 1) {
    redirect(`/builds/${parsed.data.buildId}?error=selection-unavailable`);
  }

  const selectedParts = (selected ?? []).flatMap((item) => {
    const part = item.components as unknown as {
      id: string;
      category: string;
      manufacturer: string;
      name: string;
      model: string;
      description: string | null;
      specs: unknown;
    } | null;
    if (!part || Array.isArray(part)) return [];
    return [{
      id: part.id,
      lotId: item.lot_id,
      category: componentCategorySchema.parse(part.category),
      manufacturer: part.manufacturer,
      name: part.name,
      model: part.model,
      description: part.description,
      specs: asRecord(part.specs),
    } satisfies CompatibilityPart];
  });
  const candidatePart: CompatibilityPart = {
    id: candidate.id,
    lotId,
    category: componentCategorySchema.parse(candidate.category),
    manufacturer: candidate.manufacturer,
    name: candidate.name,
    model: candidate.model,
    description: candidate.description,
    specs: asRecord(candidate.specs),
  };
  const selectedCpu = selectedParts.find((part) => part.category === "CPU");
  const selectedBoard = selectedParts.find((part) => part.category === "MOTHERBOARD");
  const requiresPlatform = candidatePart.category === "CPU"
    || candidatePart.category === "RAM"
    || candidatePart.category === "CPU_COOLER"
    || candidatePart.category === "GPU"
    || candidatePart.category === "STORAGE";
  if (requiresPlatform && !selectedBoard) redirect(`/builds/${parsed.data.buildId}?error=missing-prerequisite`);
  if ((candidatePart.category === "RAM" || candidatePart.category === "CPU_COOLER") && !selectedCpu) {
    redirect(`/builds/${parsed.data.buildId}?error=missing-prerequisite`);
  }
  if (candidatePart.category === "CPU" && selectedBoard
    && evaluateCompatibility([candidatePart, selectedBoard]).status !== "compatible") {
    redirect(`/builds/${parsed.data.buildId}?error=missing-prerequisite`);
  }
  if ((candidatePart.category === "RAM" || candidatePart.category === "CPU_COOLER") && selectedCpu && selectedBoard
    && evaluateCompatibility([selectedCpu, selectedBoard]).status !== "compatible") {
    redirect(`/builds/${parsed.data.buildId}?error=missing-prerequisite`);
  }
  if (parsed.data.slotKey === "storage-4") {
    const interfaces = selectedBoard?.specs.storageInterfaces;
    const supported = Array.isArray(interfaces) ? interfaces.filter((item): item is string => typeof item === "string") : [];
    const interfaceValue = typeof candidatePart.specs.interface === "string" ? candidatePart.specs.interface : "";
    const formFactor = typeof candidatePart.specs.formFactor === "string" ? candidatePart.specs.formFactor.toLocaleLowerCase("pt-BR") : "";
    if (!formFactor.startsWith("m.2") || !storageInterfaceSupported(interfaceValue, supported)) {
      redirect(`/builds/${parsed.data.buildId}?error=incompatible`);
    }
  }
  const compatibility = evaluateCompatibility([...selectedParts, candidatePart]);
  if (compatibility.status === "incompatible") {
    redirect(`/builds/${parsed.data.buildId}?error=incompatible`);
  }
  if ((compatibility.status === "warning" || compatibility.status === "unknown") && parsed.data.acknowledge !== "yes") {
    redirect(`/builds/${parsed.data.buildId}?error=confirmation-required`);
  }

  const { error } = await supabase.rpc("reserve_build_component", {
    p_build_id: parsed.data.buildId,
    p_component_id: componentId,
    p_lot_id: lotId,
    p_slot_key: parsed.data.slotKey,
    p_quantity: 1,
    p_compatibility_status: compatibility.status,
    p_compatibility_confirmed: true,
  });
  if (error) {
    const code = error.code === "23514" ? "incompatible" : error.code === "23505" ? "slot-filled" : "reserve-failed";
    redirect(`/builds/${parsed.data.buildId}?error=${code}`);
  }

  revalidatePath("/estoque");
  revalidatePath("/builds");
  revalidatePath(`/builds/${parsed.data.buildId}`);
  redirect(`/builds/${parsed.data.buildId}?notice=reserved`);
}

export async function releaseBuildComponent(formData: FormData) {
  await requireActiveProfile();
  const buildId = z.uuid().parse(formData.get("buildId"));
  const buildComponentId = z.uuid().parse(formData.get("buildComponentId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("release_build_component", {
    p_build_component_id: buildComponentId,
  });
  if (error) redirect(`/builds/${buildId}?error=release-failed`);
  revalidatePath("/estoque");
  revalidatePath(`/builds/${buildId}`);
  redirect(`/builds/${buildId}?notice=released`);
}

export async function cancelBuild(formData: FormData) {
  await requireActiveProfile();
  const buildId = z.uuid().parse(formData.get("buildId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_build", { p_build_id: buildId });
  if (error) redirect(`/builds/${buildId}?error=cancel-failed`);
  revalidatePath("/estoque");
  revalidatePath("/builds");
  redirect(`/builds/${buildId}?notice=cancelled`);
}

export async function completeBuild(formData: FormData) {
  await requireActiveProfile();
  const buildId = z.uuid().parse(formData.get("buildId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_build", { p_build_id: buildId });
  if (error) redirect(`/builds/${buildId}?error=complete-failed`);
  revalidatePath("/estoque");
  revalidatePath("/builds");
  redirect(`/builds/${buildId}?notice=completed`);
}
