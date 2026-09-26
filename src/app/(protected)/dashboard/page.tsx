import Link from "next/link";

import { calculateBuildCapacity } from "@/lib/inventory/capacity";
import { loadInventorySnapshot } from "@/lib/inventory/read";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/profile";

const categoryLabels: Record<string, string> = {
  CPU: "CPU",
  MOTHERBOARD: "Placa-mãe",
  RAM: "RAM",
  GPU: "GPU",
  STORAGE: "Armazenamento",
  PSU: "Fonte",
  CASE: "Gabinete",
  CPU_COOLER: "Cooler",
};

export default async function DashboardPage() {
  const profile = await requireActiveProfile();
  const [inventory, supabase] = await Promise.all([loadInventorySnapshot(), createClient()]);
  const { data: builds, error: buildsError } = await supabase.from("builds").select("id, status");
  const capacity = calculateBuildCapacity(inventory.components);
  const completeBuilds = (builds ?? []).filter((build) => build.status === "COMPLETED").length;
  const incompleteBuilds = (builds ?? []).filter((build) => build.status === "INCOMPLETE").length;
  const activeBuilds = (builds ?? []).filter((build) => ["DRAFT", "INCOMPLETE", "READY"].includes(build.status)).length;

  const metrics = [
    ["Componentes cadastrados", inventory.components.length],
    ["Unidades disponíveis", inventory.availableQuantity],
    ["Unidades reservadas", inventory.reservedQuantity],
    ["Builds completos", completeBuilds],
    ["Builds incompletos", incompleteBuilds],
    ["Builds em andamento", activeBuilds],
    ["PCs montáveis agora", capacity.buildsNow],
    ["Com compra de faltantes", capacity.buildsWithPurchases ?? "—"],
  ];

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Visão geral</p>
      <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">Olá, {profile.name}</h1>
          <p className="mt-2 max-w-2xl leading-7 text-[#607266]">
            Indicadores calculados a partir do estoque real e dos builds salvos.
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#e7efdf] px-3.5 py-2 text-sm font-medium text-[#315b3c]">
          {profile.role === "ADMIN" ? "Administrador" : "Visitante"}
        </span>
      </div>

      {inventory.error || buildsError ? <p role="alert" className="mt-6 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Alguns dados do painel não puderam ser carregados.</p> : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#718276]">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">{value}</p>
          </article>
        ))}
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#5da52f]">Planejamento</p>
              <h2 className="mt-2 text-xl font-semibold text-[#153b2a]">O que posso montar?</h2>
              <p className="mt-2 max-w-lg leading-7 text-[#65766a]">
                {capacity.bottleneck
                  ? `Gargalo estimado: ${categoryLabels[capacity.bottleneck] ?? capacity.bottleneck}. O cálculo confere compatibilidade, lotes e saldo disponível.`
                  : "Cadastre componentes e lotes reais para identificar combinações e gargalos."}
              </p>
            </div>
            <span className="hidden size-11 items-center justify-center rounded-2xl bg-[#eaf1e4] text-xl text-[#4b7b3b] sm:flex" aria-hidden="true">↗</span>
          </div>
          <Link href="/what-can-i-build" className="mt-5 inline-flex h-10 items-center rounded-xl border border-[#cdddc7] px-4 text-sm font-semibold text-[#315b3c] hover:bg-[#f5f7f2]">Ver combinações</Link>
        </section>

        <section className="rounded-3xl bg-[#153b2a] p-6 text-white shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-[#a7d77e]">Acesso rápido</p>
          <h2 className="mt-2 text-xl font-semibold">Continue o trabalho</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/estoque" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#153b2a] hover:bg-[#eef5e9]">Ver estoque</Link>
            <Link href="/builds/new" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Novo build</Link>
          </div>
          <p className="mt-6 border-t border-white/15 pt-4 text-sm text-white/65">{inventory.totalQuantity} unidades registradas · {inventory.usedQuantity} já utilizadas</p>
        </section>
      </div>
    </div>
  );
}
