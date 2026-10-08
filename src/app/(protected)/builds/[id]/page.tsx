import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { evaluateCompatibility, storageInterfaceSupported, type CompatibilityPart, type CompatibilityStatus } from "@/lib/compatibility/engine";
import { requireActiveProfile } from "@/lib/auth/profile";
import { componentCategorySchema, type ComponentCategory } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

import { BuildAssembly, type AssemblyOption, type InstalledPart } from "./build-assembly";
import { WorkstationForm } from "../new/new-build-form";
import { cancelBuild, completeBuild, saveBuildDraft } from "../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string; missing?: string; slot?: string }> };

const categories = [
  { slot: "motherboard", category: "MOTHERBOARD", label: "Placa-mãe" },
  { slot: "cpu", category: "CPU", label: "Processador" },
  { slot: "cpu_cooler", category: "CPU_COOLER", label: "Cooler do processador" },
  { slot: "psu", category: "PSU", label: "Fonte" },
  { slot: "case", category: "CASE", label: "Gabinete" },
];

const statusLabels: Record<CompatibilityStatus, string> = {
  compatible: "Compatível",
  warning: "Compatível com alerta",
  incompatible: "Incompatível",
  unknown: "Informação insuficiente",
};
const statusClasses: Record<CompatibilityStatus, string> = {
  compatible: "bg-[#e8f3e2] text-[#315b3c]",
  warning: "bg-[#fff1d6] text-[#856020]",
  incompatible: "bg-[#fde6e1] text-[#913e32]",
  unknown: "bg-[#edf0f2] text-[#56636b]",
};
const errorMessages: Record<string, string> = {
  "invalid-input": "Confira a peça, o lote e o slot selecionados.",
  "selection-unavailable": "A peça ou o lote não está mais disponível. Atualize a página.",
  incompatible: "A combinação informa uma incompatibilidade. O componente não foi reservado.",
  "slot-filled": "Esse slot foi preenchido em outra atualização. Recarregue o build.",
  "reserve-failed": "Não foi possível reservar a peça. Confira o estoque disponível.",
  "release-failed": "Não foi possível liberar essa reserva.",
  "cancel-failed": "Não foi possível cancelar o build.",
  "complete-failed": "O build ainda está incompleto, incompatível ou sem confirmação.",
  "missing-prerequisite": "Escolha primeiro uma placa-mãe compatível e, para RAM ou cooler, um processador compatível.",
  "missing-components": "Não foi possível concluir. Confira as categorias obrigatórias que ainda faltam.",
  "draft-save-failed": "Não foi possível salvar o rascunho.",
  "update-failed": "Não foi possível salvar o nome e as observações do computador.",
  "name-taken": "Já existe uma montagem com esse nome. Escolha outro nome.",
  "motherboard-first": "Selecione a placa-mãe antes de adicionar outras peças.",
  "ram-limit": "A quantidade de memória excede o limite da placa-mãe ou do processador.",
  "slot-limit": "A placa-mãe não possui esse encaixe disponível.",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default async function BuildDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  await requireActiveProfile();
  const supabase = await createClient();
  const [{ data: build }, { data: buildItems, error: itemsError }, { data: inventory }, { data: directory }] = await Promise.all([
    supabase.from("builds").select("id, name, status, notes, created_by, created_at, updated_at, removed_at").eq("id", id).maybeSingle(),
    supabase.from("build_components").select("id, component_id, lot_id, slot_key, quantity, is_active, compatibility_status, compatibility_confirmed, created_at, components(id, category, manufacturer, name, model, description, specs)").eq("build_id", id).order("created_at", { ascending: false }),
    supabase.from("components").select("id, category, manufacturer, name, model, description, specs, component_lots(id, lot_code, available_quantity)").order("manufacturer"),
    supabase.rpc("user_directory"),
  ]);
  if (!build || build.removed_at) notFound();
  const builderName = directory?.find((person) => person.id === build.created_by)?.name ?? "Usuário";

  const allBuildItems = buildItems ?? [];
  const activeBuildItems = allBuildItems.filter((item) => item.is_active);
  const lotIds = allBuildItems.map((item) => item.lot_id);
  const { data: selectedLots } = lotIds.length
    ? await supabase.from("component_lots").select("id, lot_code").in("id", lotIds)
    : { data: [] };
  const lotById = new Map((selectedLots ?? []).map((lot) => [lot.id, lot.lot_code]));
  const itemsBySlot = new Map(activeBuildItems.map((item) => [item.slot_key, item]));
  const selectedParts = activeBuildItems.flatMap((item) => {
    const component = item.components as unknown as {
      id: string;
      category: string;
      manufacturer: string;
      name: string;
      model: string;
      description: string | null;
      specs: unknown;
    } | null;
    if (!component || Array.isArray(component)) return [];
    const componentCategory = componentCategorySchema.safeParse(component.category);
    if (!componentCategory.success) return [];
    return [{
      id: component.id,
      lotId: item.lot_id,
      category: componentCategory.data,
      manufacturer: component.manufacturer,
      name: component.name,
      model: component.model,
      description: component.description,
      specs: asRecord(component.specs),
    } satisfies CompatibilityPart];
  });
  const compatibility = evaluateCompatibility(selectedParts);
  const cpuPart = selectedParts.find((part) => part.category === "CPU");
  const motherboardPart = selectedParts.find((part) => part.category === "MOTHERBOARD");
  const platformReady = Boolean(cpuPart && motherboardPart)
    && evaluateCompatibility([cpuPart!, motherboardPart!]).status !== "incompatible";
  const boardSpecs = asRecord(motherboardPart?.specs);
  const boardStorageInterfaces = Array.isArray(boardSpecs.storageInterfaces)
    ? boardSpecs.storageInterfaces.filter((value): value is string => typeof value === "string")
    : [];
  const boardStorageCounts = asRecord(boardSpecs.storageInterfaceCounts);
  const motherboardHasM2 = boardStorageInterfaces.some((item) => item.toLocaleLowerCase("pt-BR").includes("m.2"));
  const memorySlotCount = typeof boardSpecs.memorySlots === "number" ? boardSpecs.memorySlots : 0;
  const pcieSlotCount = typeof boardSpecs.pcieSlots === "number" ? boardSpecs.pcieSlots : 0;
  const storageSlots: Array<{ slot: string; category: string; label: string; interface: string; selectable: boolean }> = [];
  let storageSlotIndex = 1;
  if (motherboardPart) {
    for (const storageInterface of boardStorageInterfaces) {
      const quantity = typeof boardStorageCounts[storageInterface] === "number" ? boardStorageCounts[storageInterface] as number : 0;
      for (let index = 1; index <= quantity; index += 1) {
        storageSlots.push({
          slot: `storage-${storageSlotIndex}`,
          category: "STORAGE",
          label: `${storageInterface} · slot ${index}`,
          interface: storageInterface,
          selectable: true,
        });
        storageSlotIndex += 1;
      }
    }
  }
  const gpuRequired = Boolean(cpuPart && cpuPart.specs.integratedGraphics !== true);
  const gpuCount = selectedParts.filter((part) => part.category === "GPU").length;
  const caseSelected = selectedParts.some((part) => part.category === "CASE");
  const boardMaxMemory = typeof boardSpecs.maxMemoryGb === "number" ? boardSpecs.maxMemoryGb : undefined;
  const cpuMaxMemory = typeof cpuPart?.specs.maxMemoryCapacityGb === "number" ? cpuPart.specs.maxMemoryCapacityGb : undefined;
  const ramLimitMessage = boardMaxMemory !== undefined || cpuMaxMemory !== undefined
    ? boardMaxMemory === undefined || cpuMaxMemory !== undefined && cpuMaxMemory < boardMaxMemory
      ? `O processador suporta até ${cpuMaxMemory} GB de RAM.`
      : `A placa-mãe suporta até ${boardMaxMemory} GB de RAM.`
    : null;
  const buildSlots: Array<{ slot: string; category: string; label: string; interface?: string; selectable: boolean }> = [
    { ...categories[0], selectable: true },
  ];
  if (motherboardPart) {
    buildSlots.push({ ...categories[1], selectable: true });
    buildSlots.push(...Array.from({ length: memorySlotCount }, (_, index) => ({
      slot: `ram-${index + 1}`, category: "RAM", label: `Memória ${index + 1} · ${String(boardSpecs.memoryType ?? "RAM")}`, selectable: platformReady,
    })));
    buildSlots.push(...storageSlots);
    buildSlots.push(...Array.from({ length: pcieSlotCount }, (_, index) => ({
      slot: `gpu-${index + 1}`, category: "GPU", label: `PCIe ${index + 1}${gpuRequired ? " · GPU obrigatória" : " · GPU opcional"}`, selectable: true,
    })));
    if (platformReady) buildSlots.push({ slot: categories[2].slot, category: categories[2].category, label: categories[2].label, selectable: true });
    buildSlots.push({ slot: categories[4].slot, category: categories[4].category, label: categories[4].label, selectable: true });
    if (cpuPart && caseSelected && (!gpuRequired || gpuCount > 0)) {
      buildSlots.push({ slot: categories[3].slot, category: categories[3].category, label: categories[3].label, selectable: true });
    }
  }
  for (const item of activeBuildItems) {
    if (buildSlots.some((slot) => slot.slot === item.slot_key)) continue;
    const component = item.components as unknown as { category: string } | null;
    if (!component || Array.isArray(component)) continue;
    buildSlots.push({ slot: item.slot_key, category: component.category, label: item.slot_key, selectable: false });
  }
  const canEdit = build.status !== "COMPLETED" && build.status !== "CANCELLED";
  const requiredCategoryLabels: Array<[ComponentCategory, string]> = [
    ["MOTHERBOARD", "placa-mãe"],
    ["CPU", "processador"],
    ["CPU_COOLER", "cooler do processador"],
    ["RAM", "memória RAM"],
    ["STORAGE", "armazenamento"],
    ["PSU", "fonte de alimentação"],
    ["CASE", "gabinete"],
    ...(gpuRequired ? [["GPU", "placa de vídeo"] as [ComponentCategory, string]] : []),
  ];
  const presentCategories = new Set(selectedParts.map((part) => part.category));
  const missingRequiredLabels = requiredCategoryLabels
    .filter(([category]) => !presentCategories.has(category))
    .map(([, label]) => label);
  const requiredSlotCount = requiredCategoryLabels.length;
  const requiredFilled = requiredSlotCount - missingRequiredLabels.length;
  const hasUnconfirmedOrIncompatiblePart = activeBuildItems.some(
    (item) => item.compatibility_status === "incompatible" || !item.compatibility_confirmed,
  );
  const completeReady = missingRequiredLabels.length === 0 && !hasUnconfirmedOrIncompatiblePart;
  const statusLabel = build.status === "INCOMPLETE" ? "Incompleto" : build.status === "COMPLETED" ? "Concluído" : "Cancelado";
  const optionsBySlot: Record<string, AssemblyOption[]> = Object.fromEntries(buildSlots.map((slotConfig) => [
    slotConfig.slot,
    (inventory ?? []).filter((part) => part.category === slotConfig.category).flatMap((part) => {
      const partCategory = componentCategorySchema.safeParse(part.category);
      if (!partCategory.success) return [];
      const specs = asRecord(part.specs);
      if (slotConfig.category === "STORAGE") {
        const storageInterface = typeof specs.interface === "string" ? specs.interface.toLocaleLowerCase("pt-BR") : "";
        const requiredInterface = slotConfig.interface ?? "";
        if (!storageInterfaceSupported(storageInterface, [requiredInterface])) return [];
      }
      const candidate = {
        id: part.id,
        category: partCategory.data,
        manufacturer: part.manufacturer,
        name: part.name,
        model: part.model,
        description: part.description,
        specs,
      } satisfies CompatibilityPart;
      if (slotConfig.slot === "cpu" && motherboardPart
        && evaluateCompatibility([candidate, motherboardPart]).status === "incompatible") return [];
      if (evaluateCompatibility([...selectedParts, candidate]).status === "incompatible") return [];
      const lots = Array.isArray(part.component_lots) ? part.component_lots : [];
      return lots.filter((lot) => lot.available_quantity > 0).map((lot) => ({
        selection: `${part.id}~${lot.id}`,
        label: `${part.description || part.name || `${part.manufacturer} ${part.model}`} · lote ${lot.lot_code || "sem identificação"} · ${lot.available_quantity} disponíveis`,
      }));
    }),
  ]));
  const installedBySlot: Record<string, InstalledPart> = {};
  for (const item of activeBuildItems) {
    const component = item.components as unknown as {
      category: string;
      manufacturer: string;
      name: string;
      model: string;
      description: string | null;
      specs: unknown;
    } | null;
    if (!component || Array.isArray(component)) continue;
    installedBySlot[item.slot_key] = {
      buildComponentId: item.id,
      description: component.description || component.name || `${component.manufacturer} ${component.model}`,
      lot: lotById.get(item.lot_id) ?? "",
      quantity: item.quantity,
      status: item.compatibility_status,
      category: component.category,
      specs: asRecord(component.specs),
    };
  }

  return (
    <div>
      <Link href="/builds" className="text-sm font-medium text-[#4b7b3b] hover:underline">← Voltar para Montar</Link>
      <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Montagem</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">{build.name} - {builderName}</h1>
          <p className="mt-2 text-sm text-[#718276]">Responsável pela montagem: {builderName}</p>
          {build.notes ? <p className="mt-2 max-w-2xl leading-7 text-[#607266]">{build.notes}</p> : null}
        </div>
        <span className="w-fit rounded-full bg-[#eaf1e4] px-3.5 py-2 text-sm font-semibold text-[#315b3c]">{statusLabel}</span>
      </div>

      {query.error ? <div role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#8d3c32]"><p>{errorMessages[query.error] ?? "Não foi possível atualizar o build."}</p>{query.error === "missing-components" && query.missing ? <p className="mt-1"><strong>Faltam:</strong> {query.missing}.</p> : null}</div> : null}
      {query.notice ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">{query.notice === "reserved" ? "Peça reservada no estoque." : query.notice === "released" ? "Reserva liberada." : query.notice === "dependencies-released" ? "Peça e componentes dependentes removidos; todas as reservas foram liberadas." : query.notice === "cancelled" ? "Build cancelado e reservas liberadas." : query.notice === "completed" ? "Build concluído; peças marcadas como usadas." : query.notice === "updated" ? "Cadastro do computador atualizado." : query.notice === "draft-saved" ? "Alterações salvas. A build continua incompleta até você concluí-la." : "Atualizado."}</p> : null}
      {itemsError ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível carregar os componentes do build.</p> : null}

      {canEdit ? <details className="mt-6 rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-semibold text-[#315b3c]">Editar nome e observações</summary>
        <div className="mt-4"><WorkstationForm buildId={id} initialName={build.name} initialNotes={build.notes ?? ""} /></div>
      </details>
        : <p className="mt-6 rounded-xl bg-[#f2f8ee] px-4 py-3 text-sm text-[#315b3c]">Esta montagem está somente para visualização.</p>}

      <BuildAssembly buildId={id} slots={buildSlots} optionsBySlot={optionsBySlot} installedBySlot={installedBySlot} canEdit={canEdit} motherboardHasM2={motherboardHasM2} motherboardFormFactor={motherboardPart ? String(boardSpecs.formFactor ?? "") : undefined} motherboardMemoryType={motherboardPart ? String(boardSpecs.memoryType ?? "") : undefined} initialSlot={query.slot} />

      {canEdit ? (
        <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-[#dce6d8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 rounded-xl bg-[#f2f8ee] px-4 py-3 text-sm text-[#315b3c]">
            <span className="rounded-full bg-[#dcebd4] px-3 py-1 font-semibold">Incompleto</span>
            <span>{completeReady ? "Todas as peças estão prontas. Salve a build para continuar depois ou conclua para finalizar." : `${requiredFilled}/${requiredSlotCount} categorias obrigatórias preenchidas. A build permanece salva enquanto você escolhe as peças.`}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {completeReady ? <form action={completeBuild}><input type="hidden" name="buildId" value={id} /><button className="h-11 rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]" type="submit">Concluir build</button></form> : null}
            <form action={saveBuildDraft}>
              <input type="hidden" name="buildId" value={id} />
              <input type="hidden" name="name" value={build.name} />
              <input type="hidden" name="notes" value={build.notes ?? ""} />
              <button className="h-11 rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]" type="submit">Salvar rascunho</button>
            </form>
          </div>
          <form action={cancelBuild}><input type="hidden" name="buildId" value={id} /><button className="h-11 shrink-0 rounded-xl border border-[#e4c8c2] px-5 font-semibold text-[#8d493f] hover:bg-[#fff5f3]" type="submit">Cancelar build</button></form>
        </div>
      ) : null}

      <section className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-[#153b2a]">Verificação de compatibilidade</h2>
        {compatibility.checks.length ? (
          <div className="mt-4 space-y-3">
            {compatibility.checks.map((check, index) => <div key={`${check.reason}-${index}`} className={`rounded-xl px-4 py-3 ${statusClasses[check.status]}`}><p className="text-sm font-semibold">{statusLabels[check.status]} · {check.reason}</p>{check.details ? <p className="mt-1 text-sm opacity-80">{check.details}</p> : null}</div>)}
          </div>
        ) : <p className="mt-2 text-sm leading-6 text-[#718276]">Adicione peças relacionadas para verificar a compatibilidade. Dados ausentes não serão tratados como compatíveis.</p>}
        {ramLimitMessage ? <p className="mt-4 rounded-xl bg-[#f2f8ee] px-4 py-3 text-sm text-[#315b3c]">{ramLimitMessage} Vale o menor limite entre processador e placa-mãe.</p> : null}
        {missingRequiredLabels.length ? <p role="status" className="mt-4 rounded-xl border border-[#e7dfc4] bg-[#fffdf5] px-4 py-3 text-sm leading-6 text-[#6d613a]"><strong>Para concluir, ainda faltam:</strong> {missingRequiredLabels.join(", ")}.</p> : completeReady ? <p role="status" className="mt-4 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm leading-6 text-[#315b3c]">Todos os componentes obrigatórios estão instalados e compatíveis.</p> : null}
      </section>

      <section aria-label="Resumo da montagem" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          ["Peças instaladas", activeBuildItems.length],
          ["Status geral", statusLabel],
          ["Categorias obrigatórias", `${requiredFilled}/${requiredSlotCount}`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#dce6d8] bg-white px-3 py-2.5 shadow-sm"><p className="text-xs text-[#718276]">{label}</p><p className="mt-1 text-lg font-semibold text-[#153b2a]">{value}</p></div>)}
      </section>

    </div>
  );
}
