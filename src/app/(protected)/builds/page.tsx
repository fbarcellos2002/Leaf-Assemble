import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  INCOMPLETE: "Incompleto",
  READY: "Pronto",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export default async function BuildsPage() {
  const supabase = await createClient();
  const { data: builds, error } = await supabase
    .from("builds")
    .select("id, name, status, created_at, updated_at, build_components(id, is_active)")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Montagens</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">Builds</h1>
          <p className="mt-2 leading-7 text-[#607266]">Planeje montagens com peças disponíveis e reservas rastreáveis.</p>
        </div>
        <Link href="/builds/new" className="flex h-11 w-fit items-center rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]">Novo build</Link>
      </div>

      {error ? <p role="alert" className="mt-6 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível consultar os builds.</p> : null}
      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(builds ?? []).map((build) => (
          <Link key={build.id} href={`/builds/${build.id}`} className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#aac69a] hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-[#153b2a]">{build.name}</h2>
              <span className="rounded-full bg-[#eaf1e4] px-3 py-1.5 text-xs font-semibold text-[#315b3c]">{statusLabels[build.status] ?? build.status}</span>
            </div>
            <p className="mt-3 text-sm text-[#718276]">{build.build_components?.filter((item) => item.is_active).length ?? 0} slots preenchidos</p>
            <p className="mt-4 border-t border-[#edf1ea] pt-3 text-xs text-[#89958d]">Atualizado {new Date(build.updated_at).toLocaleDateString("pt-BR")}</p>
          </Link>
        ))}
      </section>
      {!error && builds?.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[#cdddc7] bg-white/70 px-6 py-14 text-center">
          <p className="text-lg font-semibold text-[#315b3c]">Nenhum build salvo</p>
          <p className="mt-2 text-sm text-[#718276]">Comece um rascunho e adicione componentes reais do estoque.</p>
          <Link href="/builds/new" className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]">Criar primeiro build</Link>
        </div>
      ) : null}
    </div>
  );
}
