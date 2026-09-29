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

export default async function BuildsPage({ searchParams }: Props) {
  const [{ notice, error: queryError }, supabase] = await Promise.all([searchParams, createClient()]);
  const { data: builds, error } = await supabase
    .from("builds")
    .select("id, name, status, created_at, updated_at, build_components(id, is_active)")
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
          <article key={build.id} className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/builds/${build.id}`} className="font-semibold text-[#153b2a] hover:underline">{build.name}</Link>
              <span className="shrink-0 rounded-full bg-[#eaf1e4] px-3 py-1.5 text-xs font-semibold text-[#315b3c]">{statusLabels[build.status] ?? build.status}</span>
            </div>
            <p className="mt-3 text-sm text-[#718276]">{build.build_components?.filter((item) => item.is_active).length ?? 0} componentes selecionados</p>
            <p className="mt-4 border-t border-[#edf1ea] pt-3 text-xs text-[#89958d]">Atualizado {new Date(build.updated_at).toLocaleDateString("pt-BR")}</p>
            <div className="mt-4 flex items-center gap-4">
              <Link href={`/builds/${build.id}`} className="text-sm font-semibold text-[#315b3c] hover:underline">Editar computador</Link>
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#8d493f] hover:underline">Remover</summary>
                <form action={removeBuild} className="mt-3 space-y-2 rounded-xl border border-[#f0deda] bg-[#fffaf9] p-3">
                  <input type="hidden" name="buildId" value={build.id} />
                  <label className="grid gap-1 text-xs font-semibold text-[#70453f]">
                    Motivo da remoção <span className="font-normal">(obrigatório)</span>
                    <textarea className="min-h-20 rounded-lg border border-[#e7cbc5] bg-white p-2 text-sm font-normal text-[#294333]" name="reason" minLength={3} maxLength={500} required placeholder="Informe por que este computador está sendo removido" />
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
