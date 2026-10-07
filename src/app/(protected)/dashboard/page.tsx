import Link from "next/link";

import { loadInventorySnapshot } from "@/lib/inventory/read";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/profile";

export default async function DashboardPage() {
  const profile = await requireActiveProfile();
  const [inventory, supabase] = await Promise.all([loadInventorySnapshot(), createClient()]);
  const { data: builds, error: buildsError } = await supabase
    .from("builds")
    .select("id, status")
    .is("removed_at", null);
  const completeBuilds = (builds ?? []).filter((build) => build.status === "COMPLETED").length;
  const incompleteBuilds = (builds ?? []).filter((build) => build.status === "INCOMPLETE").length;
  const inventoryMetrics = [
    ["Componentes cadastrados", inventory.components.length],
    ["Componentes totais", inventory.totalQuantity],
    ["Componentes disponíveis", inventory.availableQuantity],
    ["Componentes reservados", inventory.reservedQuantity],
  ];
  const buildMetrics = [
    ["Builds completas", completeBuilds],
    ["Builds incompletas", incompleteBuilds],
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

      <section aria-labelledby="inventory-summary-heading" className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <h2 id="inventory-summary-heading" className="text-xl font-semibold text-[#153b2a]">Resumo do estoque</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#e4ebe0]">
          <table className="w-full text-left">
            <tbody>
              {inventoryMetrics.map(([label, value]) => (
                <tr key={label} className="border-b border-[#e8eee5] last:border-b-0">
                  <th scope="row" className="px-4 py-4 text-sm font-medium text-[#607266] sm:px-5">{label}</th>
                  <td className="px-4 py-4 text-right text-lg font-semibold tabular-nums text-[#153b2a] sm:px-5">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Resumo das montagens" className="mt-5 grid gap-4 sm:grid-cols-2">
        {buildMetrics.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#718276]">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-[#153b2a]">{value}</p>
          </article>
        ))}
      </section>

      <div className="mt-5">
        <section className="rounded-3xl bg-[#153b2a] p-6 text-white shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-[#a7d77e]">Acesso rápido</p>
          <h2 className="mt-2 text-xl font-semibold">Continue o trabalho</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/estoque" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#153b2a] hover:bg-[#eef5e9]">Ver estoque</Link>
            <Link href="/builds/new" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Novo build</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
