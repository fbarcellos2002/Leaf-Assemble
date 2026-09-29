import Link from "next/link";

import { removeBuild } from "./actions";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ notice?: string; error?: string }> };

const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  INCOMPLETE: "Incompleto",
  READY: "Pronto para montar",
  COMPLETED: "Montado",
  CANCELLED: "Cancelado",
};

type BuildPart = {
  category: string;
  manufacturer: string;
  name?: string;
  model: string;
  description?: string | null;
  specs: unknown;
};

function partFromRelation(value: unknown): BuildPart | null {
  const part = Array.isArray(value) ? value[0] : value;
  return part && typeof part === "object" && "category" in part
    ? part as BuildPart
    : null;
}

function buildHighlights(items: Array<{ is_active: boolean; quantity?: number; components: unknown }>) {
  const active = items.filter((item) => item.is_active);
  const byCategory = (category: string) => active.find((item) => partFromRelation(item.components)?.category === category);
  const allByCategory = (category: string) => active.filter((item) => partFromRelation(item.components)?.category === category);
  const cpu = byCategory("CPU");
  const ramItems = allByCategory("RAM");
  const storageItems = allByCategory("STORAGE");
  const formatCapacity = (capacity: number) => capacity >= 1000
    ? `${Number((capacity / 1000).toFixed(1))} TB`
    : `${capacity} GB`;
  const formatRam = () => {
    if (!ramItems.length) return "Memória pendente";
    const rows = ramItems.map((item) => {
      const part = partFromRelation(item.components);
      const specs = part?.specs && typeof part.specs === "object" ? part.specs as Record<string, unknown> : {};
      return typeof specs.capacityGb === "number" ? specs.capacityGb * (item.quantity ?? 1) : null;
    });
    return rows.every((capacity): capacity is number => capacity !== null)
      ? `${formatCapacity(rows.reduce((sum, capacity) => sum + capacity, 0))} RAM`
      : ramItems.map((item) => {
        const part = partFromRelation(item.components);
        return part ? part.description || part.name || `${part.manufacturer} ${part.model}` : null;
      }).filter(Boolean).join(" + ");
  };
  const formatStorage = () => {
    if (!storageItems.length) return "Armazenamento pendente";
    return storageItems.map((item) => {
      const part = partFromRelation(item.components);
      if (!part) return null;
      const specs = part.specs && typeof part.specs === "object" ? part.specs as Record<string, unknown> : {};
      const capacity = typeof specs.capacityGb === "number" ? specs.capacityGb * (item.quantity ?? 1) : null;
      const kind = typeof specs.type === "string" ? specs.type : "unidade";
      return capacity ? `${formatCapacity(capacity)} ${kind}` : part.description || part.name || `${part.manufacturer} ${part.model}`;
    }).filter(Boolean).join(" + ");
  };
  const cpuPart = cpu ? partFromRelation(cpu.components) : null;
  return [
    { type: "cpu" as const, text: cpuPart ? cpuPart.description || cpuPart.name || `${cpuPart.manufacturer} ${cpuPart.model}` : "Processador pendente" },
    { type: "ram" as const, text: formatRam() },
    { type: "storage" as const, text: formatStorage() },
  ];
}

function HardwareIcon({ type }: { type: "cpu" | "ram" | "storage" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "cpu") return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" {...common}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M10 10h4v4h-4z" /></svg>;
  if (type === "ram") return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" {...common}><rect x="3" y="7" width="18" height="10" rx="1.5" /><path d="M7 10h2m3 0h2m3 0h1m-11 7v3m4-3v3m4-3v3m4-3v3" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 8h8v8H8zM10 10h4v4h-4z" /></svg>;
}

export default async function BuildsPage({ searchParams }: Props) {
  const [{ notice, error: queryError }, supabase] = await Promise.all([searchParams, createClient()]);
  const { data: builds, error } = await supabase
    .from("builds")
    .select("id, name, status, created_at, updated_at, build_components(id, is_active, quantity, components(category, manufacturer, name, model, description, specs))")
    .is("removed_at", null)
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Computadores</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">Montar</h1>
          <p className="mt-2 leading-7 text-[#607266]">Consulte os computadores cadastrados, continue uma montagem ou comece outra.</p>
        </div>
        <Link href="/builds/new" className="flex h-11 w-fit items-center rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]">Criar computador</Link>
      </div>

      {notice === "removed" ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">Computador removido. O motivo foi registrado para controle.</p> : null}
      {queryError === "remove-failed" ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível remover o computador. Atualize a página e tente novamente.</p> : null}
      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível consultar os computadores.</p> : null}
      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(builds ?? []).map((build) => (
          <article key={build.id} className="rounded-2xl border border-[#dce6d8] bg-white p-5 text-center shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <Link href={`/builds/${build.id}`} className="text-base font-semibold text-[#153b2a] hover:underline">{build.name}</Link>
              <span className="shrink-0 rounded-full bg-[#eaf1e4] px-3 py-1.5 text-xs font-semibold text-[#315b3c]">{statusLabels[build.status] ?? build.status}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#718276]">
              {buildHighlights(build.build_components ?? []).map((item) => (
                <p key={item.type} className="flex items-center justify-center gap-2">
                  <span className="text-[#5b7562]"><HardwareIcon type={item.type} /></span>
                  <span>{item.text}</span>
                </p>
              ))}
            </div>
            <p className="mt-4 border-t border-[#edf1ea] pt-3 text-xs text-[#89958d]">{build.build_components?.filter((item) => item.is_active).length ?? 0} componentes · atualizado {new Date(build.updated_at).toLocaleDateString("pt-BR")}</p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <Link href={`/builds/${build.id}`} className="text-sm font-semibold text-[#315b3c] hover:underline">Editar computador</Link>
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#8d493f] hover:underline">Remover</summary>
                <form action={removeBuild} className="mt-3 space-y-2 rounded-xl border border-[#f0deda] bg-[#fffaf9] p-3">
                  <input type="hidden" name="buildId" value={build.id} />
                  <label className="grid gap-1 text-xs font-semibold text-[#70453f]">
                    Motivo da remoção <span className="font-normal">(obrigatório)</span>
                    <textarea rows={1} className="w-full rounded-lg border border-[#e7cbc5] bg-white px-3 py-2 text-sm font-normal text-[#294333]" name="reason" minLength={3} maxLength={500} required placeholder="Informe por que este computador está sendo removido" />
                  </label>
                  <button className="h-9 rounded-lg bg-[#8d493f] px-3 text-sm font-semibold text-white hover:bg-[#71382f]" type="submit">Confirmar remoção</button>
                </form>
              </details>
            </div>
          </article>
        ))}
      </section>
      {!error && builds?.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[#cdddc7] bg-white/70 px-6 py-14 text-center">
          <p className="text-lg font-semibold text-[#315b3c]">Nenhum computador cadastrado</p>
          <p className="mt-2 text-sm text-[#718276]">Crie um computador para começar a selecionar componentes reais do estoque.</p>
          <Link href="/builds/new" className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]">Criar computador</Link>
        </div>
      ) : null}
    </div>
  );
}
