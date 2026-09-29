import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { evaluateCompatibility, type CompatibilityPart, type CompatibilityStatus } from "@/lib/compatibility/engine";
import { componentCategorySchema } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

import { addBuildComponent, cancelBuild, completeBuild, releaseBuildComponent, updateBuild } from "../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> };

const categories = [
  { slot: "cpu", category: "CPU", label: "Processador" },
  { slot: "motherboard", category: "MOTHERBOARD", label: "Placa-mãe" },
  ...Array.from({ length: 4 }, (_, index) => ({ slot: `ram-${index + 1}`, category: "RAM", label: `Memória ${index + 1}` })),
  ...Array.from({ length: 2 }, (_, index) => ({ slot: `gpu-${index + 1}`, category: "GPU", label: `Placa de vídeo ${index + 1}` })),
  ...Array.from({ length: 3 }, (_, index) => ({ slot: `storage-${index + 1}`, category: "STORAGE", label: `Armazenamento ${index + 1}` })),
  { slot: "psu", category: "PSU", label: "Fonte" },
  { slot: "case", category: "CASE", label: "Gabinete" },
  { slot: "cpu_cooler", category: "CPU_COOLER", label: "Cooler do processador" },
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
  "confirmation-required": "Há alertas ou informações insuficientes. Marque a confirmação para continuar.",
  "slot-filled": "Esse slot foi preenchido em outra atualização. Recarregue o build.",
  "reserve-failed": "Não foi possível reservar a peça. Confira o estoque disponível.",
  "release-failed": "Não foi possível liberar essa reserva.",
  "cancel-failed": "Não foi possível cancelar o build.",
  "complete-failed": "O build ainda está incompleto, incompatível ou sem confirmação.",
  "update-failed": "Não foi possível salvar o nome e as observações do computador.",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default async function BuildDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: build }, { data: buildItems, error: itemsError }, { data: inventory }] = await Promise.all([
    supabase.from("builds").select("id, name, status, notes, created_at, updated_at, removed_at").eq("id", id).maybeSingle(),
    supabase.from("build_components").select("id, component_id, lot_id, slot_key, quantity, is_active, compatibility_status, compatibility_confirmed, created_at, components(id, category, manufacturer, model, specs)").eq("build_id", id).order("created_at", { ascending: false }),
    supabase.from("components").select("id, category, manufacturer, model, specs, component_lots(id, lot_code, available_quantity)").order("manufacturer"),
  ]);
  if (!build || build.removed_at) notFound();

  const allBuildItems = buildItems ?? [];
  const activeBuildItems = allBuildItems.filter((item) => item.is_active);
  const lotIds = allBuildItems.map((item) => item.lot_id);
  const { data: selectedLots } = lotIds.length
    ? await supabase.from("component_lots").select("id, lot_code").in("id", lotIds)
    : { data: [] };
  const lotById = new Map((selectedLots ?? []).map((lot) => [lot.id, lot.lot_code]));
  const itemsBySlot = new Map(activeBuildItems.map((item) => [item.slot_key, item]));
  const releasedBySlot = new Map<string, (typeof allBuildItems)[number]>();
  for (const item of allBuildItems) {
    if (!item.is_active && !releasedBySlot.has(item.slot_key)) releasedBySlot.set(item.slot_key, item);
  }
  const selectedParts = activeBuildItems.flatMap((item) => {
    const component = item.components as unknown as {
      id: string;
      category: string;
      manufacturer: string;
      model: string;
      specs: unknown;
    } | null;
    if (!component || Array.isArray(component)) return [];
    return [{
      id: component.id,
      lotId: item.lot_id,
      category: componentCategorySchema.parse(component.category),
      manufacturer: component.manufacturer,
      model: component.model,
      specs: asRecord(component.specs),
    } satisfies CompatibilityPart];
  });
  const compatibility = evaluateCompatibility(selectedParts);
  const cpuPart = selectedParts.find((part) => part.category === "CPU");
  const gpuRequired = Boolean(cpuPart && cpuPart.specs.integratedGraphics !== true);
  const canEdit = build.status !== "COMPLETED" && build.status !== "CANCELLED";
  const completeReady = build.status === "READY";
  const requiredFilled = [
    itemsBySlot.has("cpu"),
    itemsBySlot.has("motherboard"),
    [...itemsBySlot.keys()].some((slot) => slot.startsWith("ram-")),
    [...itemsBySlot.keys()].some((slot) => slot.startsWith("storage-")),
    itemsBySlot.has("psu"),
    itemsBySlot.has("case"),
    !gpuRequired || [...itemsBySlot.keys()].some((slot) => slot.startsWith("gpu-")),
  ].filter(Boolean).length;
  const requiredSlotCount = 6 + (gpuRequired ? 1 : 0);
  const statusLabel = build.status === "DRAFT" ? "Rascunho" : build.status === "INCOMPLETE" ? "Incompleto" : build.status === "READY" ? "Pronto" : build.status === "COMPLETED" ? "Concluído" : "Cancelado";

  return (
    <div>
      <Link href="/builds" className="text-sm font-medium text-[#4b7b3b] hover:underline">← Voltar para Montar</Link>
      <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Montagem</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">{build.name}</h1>
          {build.notes ? <p className="mt-2 max-w-2xl leading-7 text-[#607266]">{build.notes}</p> : null}
        </div>
        <span className="w-fit rounded-full bg-[#eaf1e4] px-3.5 py-2 text-sm font-semibold text-[#315b3c]">{statusLabel}</span>
      </div>

      {query.error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">{errorMessages[query.error] ?? "Não foi possível atualizar o build."}</p> : null}
      {query.notice ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">{query.notice === "reserved" ? "Peça reservada no estoque." : query.notice === "released" ? "Reserva liberada." : query.notice === "cancelled" ? "Build cancelado e reservas liberadas." : query.notice === "completed" ? "Build concluído; peças marcadas como usadas." : query.notice === "updated" ? "Cadastro do computador atualizado." : "Atualizado."}</p> : null}
      {itemsError ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível carregar os componentes do build.</p> : null}

      <details className="mt-6 rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-semibold text-[#315b3c]">Editar nome e observações</summary>
        <form action={updateBuild} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="buildId" value={id} />
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Nome do computador
            <input className="h-11 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="name" maxLength={100} required defaultValue={build.name} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Observações
            <textarea className="min-h-20 rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="notes" maxLength={1000} defaultValue={build.notes ?? ""} />
          </label>
          <button className="h-10 w-fit rounded-xl bg-[#153b2a] px-4 font-semibold text-white hover:bg-[#205138] sm:col-span-2" type="submit">Salvar cadastro</button>
        </form>
      </details>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Slots preenchidos", activeBuildItems.length],
          ["Status geral", statusLabel],
          ["Slots obrigatórios", `${requiredFilled}/${requiredSlotCount}`],
          ["Compatibilidade", statusLabels[compatibility.status]],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm"><p className="text-sm text-[#718276]">{label}</p><p className="mt-2 text-xl font-semibold text-[#153b2a]">{value}</p></div>)}
      </section>

      <section className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-semibold text-[#153b2a]">Componentes</h2>
            <p className="mt-1 text-sm leading-6 text-[#718276]">CPU, placa-mãe, RAM, armazenamento, fonte e gabinete são necessários. GPU também é necessária se o processador não tiver gráficos integrados; cooler é opcional.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map(({ slot, category, label }) => {
            const item = itemsBySlot.get(slot);
            const releasedItem = releasedBySlot.get(slot);
            const component = item?.components as unknown as {
              id: string;
              category: string;
              manufacturer: string;
              model: string;
              specs: unknown;
            } | null | undefined;
            const previousComponent = releasedItem?.components as unknown as {
              id: string;
              category: string;
              manufacturer: string;
              model: string;
              specs: unknown;
            } | null | undefined;
            const options = (inventory ?? []).filter((part) => part.category === category).flatMap((part) => {
              const lots = Array.isArray(part.component_lots) ? part.component_lots : [];
              return lots.filter((lot) => lot.available_quantity > 0).map((lot) => ({
                selection: `${part.id}~${lot.id}`,
                label: `${part.manufacturer} ${part.model} · lote ${lot.lot_code || "sem identificação"} · ${lot.available_quantity} disponíveis`,
              }));
            });

            return (
              <article key={slot} className="rounded-2xl border border-[#e5ece1] bg-[#fbfcfa] p-4">
                <p className="text-xs font-semibold tracking-wide text-[#718276] uppercase">{label}</p>
                {item && component && !Array.isArray(component) ? (
                  <div className="mt-3">
                    <p className="font-semibold text-[#294333]">{component.manufacturer} {component.model}</p>
                    <p className="mt-1 text-xs text-[#718276]">Lote {lotById.get(item.lot_id) || "Sem identificação"} · {item.quantity} unidade reservada</p>
                    {category === "CPU" && typeof asRecord(component.specs).integratedGraphics === "boolean" ? (
                      <p className="mt-1 text-xs text-[#718276]">Gráficos integrados: {asRecord(component.specs).integratedGraphics ? "Sim" : "Não"}</p>
                    ) : null}
                    <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[item.compatibility_status as CompatibilityStatus] ?? statusClasses.unknown}`}>
                      {statusLabels[item.compatibility_status as CompatibilityStatus] ?? statusLabels.unknown}
                    </span>
                    {canEdit ? <form action={releaseBuildComponent} className="mt-3"><input type="hidden" name="buildId" value={id} /><input type="hidden" name="buildComponentId" value={item.id} /><button className="text-sm font-medium text-[#8d493f] hover:underline" type="submit">Liberar reserva</button></form> : null}
                  </div>
                ) : canEdit ? (
                  <>
                    {releasedItem && previousComponent && !Array.isArray(previousComponent) ? <p className="mt-2 text-xs text-[#89958d]">Reserva liberada anteriormente: {previousComponent.manufacturer} {previousComponent.model} · lote {lotById.get(releasedItem.lot_id) ?? "—"}</p> : null}
                  <form action={addBuildComponent} className="mt-3 space-y-3">
                    <input type="hidden" name="buildId" value={id} />
                    <input type="hidden" name="slotKey" value={slot} />
                    <select className="h-10 w-full rounded-lg border border-[#d9e2d8] bg-white px-2 text-sm" name="selection" required defaultValue="">
                      <option value="" disabled>{options.length ? "Selecione uma peça e um lote" : "Sem peças disponíveis"}</option>
                      {options.map((option) => <option key={option.selection} value={option.selection}>{option.label}</option>)}
                    </select>
                    <label className="flex items-start gap-2 text-xs leading-5 text-[#718276]">
                      <input className="mt-0.5" type="checkbox" name="acknowledge" value="yes" />
                      Confirmo que posso continuar com alerta ou informação insuficiente.
                    </label>
                    <button className="h-9 rounded-lg border border-[#cdddc7] px-3 text-sm font-semibold text-[#315b3c] hover:bg-[#f1f5ed] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!options.length}>Reservar neste slot</button>
                  </form>
                  </>
                ) : releasedItem && previousComponent && !Array.isArray(previousComponent) ? <p className="mt-3 text-sm text-[#718276]">{previousComponent.manufacturer} {previousComponent.model} · lote {lotById.get(releasedItem.lot_id) ?? "—"} · reserva liberada</p> : <p className="mt-3 text-sm text-[#9aa79c]">Não selecionado</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-[#153b2a]">Verificação de compatibilidade</h2>
        {compatibility.checks.length ? (
          <div className="mt-4 space-y-3">
            {compatibility.checks.map((check, index) => <div key={`${check.reason}-${index}`} className={`rounded-xl px-4 py-3 ${statusClasses[check.status]}`}><p className="text-sm font-semibold">{statusLabels[check.status]} · {check.reason}</p>{check.details ? <p className="mt-1 text-sm opacity-80">{check.details}</p> : null}</div>)}
          </div>
        ) : <p className="mt-2 text-sm leading-6 text-[#718276]">Adicione peças relacionadas para verificar a compatibilidade. Dados ausentes não serão tratados como compatíveis.</p>}
      </section>

      {canEdit ? (
        <div className="mt-7 flex flex-wrap gap-3">
          {completeReady ? <form action={completeBuild}><input type="hidden" name="buildId" value={id} /><button className="h-11 rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]" type="submit">Concluir build</button></form> : null}
          <form action={cancelBuild}><input type="hidden" name="buildId" value={id} /><button className="h-11 rounded-xl border border-[#e4c8c2] px-5 font-semibold text-[#8d493f] hover:bg-[#fff5f3]" type="submit">Cancelar build</button></form>
        </div>
      ) : null}
    </div>
  );
}
