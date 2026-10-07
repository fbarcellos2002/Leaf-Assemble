import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import type { CompatibilityPart } from "@/lib/compatibility/engine";
import { calculateBuildCapacity, type InProgressBuild } from "@/lib/inventory/capacity";
import { loadInventorySnapshot } from "@/lib/inventory/read";
import { componentCategorySchema, type ComponentCategory } from "@/lib/inventory/specs";

const categoryLabels: Record<ComponentCategory, string> = {
  CPU: "Processador",
  MOTHERBOARD: "Placa-mãe",
  RAM: "Memória RAM",
  GPU: "Placa de vídeo",
  STORAGE: "Armazenamento",
  PSU: "Fonte de alimentação",
  CASE: "Gabinete",
  CPU_COOLER: "Cooler do processador",
};

export default async function WhatCanIBuildPage() {
  const [inventory, supabase] = await Promise.all([loadInventorySnapshot(), createClient()]);
  const { data: activeBuildRows, error: activeBuildsError } = await supabase
    .from("builds")
    .select("status, build_components(is_active, components(id, category, manufacturer, name, model, description, specs))")
    .is("removed_at", null)
    .eq("status", "INCOMPLETE");
  const inProgressBuilds: InProgressBuild[] = (activeBuildRows ?? []).map((build) => ({
    parts: (build.build_components ?? []).filter((item) => item.is_active).flatMap((item) => {
      const related = Array.isArray(item.components) ? item.components[0] : item.components;
      if (!related) return [];
      const parsedCategory = componentCategorySchema.safeParse(related.category);
      if (!parsedCategory.success) return [];
      const part = {
        id: related.id,
        category: parsedCategory.data,
        manufacturer: related.manufacturer,
        name: related.name,
        model: related.model,
        description: related.description,
        specs: related.specs && typeof related.specs === "object" && !Array.isArray(related.specs)
          ? related.specs as Record<string, unknown>
          : {},
      } satisfies CompatibilityPart;
      return [part];
    }),
  }));
  const capacity = calculateBuildCapacity(inventory.components, inProgressBuilds);
  const shortages = Object.entries(capacity.onePartAwayByCategory)
    .filter((entry): entry is [ComponentCategory, number] => Boolean(entry[1]))
    .sort((a, b) => b[1] - a[1]);
  const displayedShortages = shortages.slice(0, 4).map(([category, count]) => {
    const candidates = inventory.components
      .filter((part) => part.category === category)
      .map((part) => ({
        label: part.description?.trim() || part.name?.trim() || `${part.manufacturer} ${part.model}`,
        available: part.lots.reduce((sum, lot) => sum + Math.max(0, lot.available), 0),
      }))
      .sort((a, b) => b.available - a.available);
    return { category, count, candidates };
  });

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Planejamento de builds</p>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">O que posso montar?</h1>
          <p className="mt-2 max-w-2xl leading-7 text-[#607266]">Veja quantos computadores completos o estoque permite montar e quais combinações estão a uma peça de ficarem prontas.</p>
        </div>
        <Link href="/estoque/novo" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#153b2a] px-4 text-sm font-semibold text-white hover:bg-[#205138]">Cadastrar componente</Link>
      </div>

      {inventory.error ? <p role="alert" className="mt-6 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível ler o estoque. Confira a conexão e as permissões do Supabase.</p> : null}
      {activeBuildsError ? <p role="alert" className="mt-3 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível considerar os computadores em rascunho nesta contagem.</p> : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#cbdcc4] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-medium text-[#718276]">Computadores completos e compatíveis</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[#153b2a]">{capacity.compatibleBuilds}</p>
          <p className="mt-2 text-sm leading-6 text-[#718276]">Combinações validadas com os dados técnicos cadastrados e sem incompatibilidades.</p>
        </article>
        <article className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-medium text-[#718276]">A uma peça de completar</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[#315b3c]">{capacity.onePartAwayBuilds}</p>
          <p className="mt-2 text-sm leading-6 text-[#718276]">Conjuntos compatíveis que já têm todas as outras peças necessárias.</p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-[#5da52f]">Leitura do estoque</p>
        <h2 className="mt-1 text-xl font-semibold text-[#153b2a]">Gargalo de montagem</h2>
        {capacity.bottleneck ? (
          <p className="mt-3 leading-7 text-[#65766a]">A categoria que mais limita novas montagens neste momento é <strong className="text-[#294333]">{categoryLabels[capacity.bottleneck]}</strong>.</p>
        ) : (
          <p className="mt-3 leading-7 text-[#65766a]">Até o momento, não há um gargalo significativo entre as categorias obrigatórias. As quantidades estão relativamente equilibradas.</p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-[#dce6d8] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[#5da52f]">Peças que mais faltam</p>
            <h2 className="mt-1 text-xl font-semibold text-[#153b2a]">O que falta para completar mais computadores</h2>
          </div>
          <p className="text-sm text-[#718276]">{inventory.availableQuantity} unidades disponíveis no estoque</p>
        </div>
        {displayedShortages.length ? (
          <ol className="mt-5 divide-y divide-[#edf1ea]">
            {displayedShortages.map(({ category, count, candidates }) => (
              <li key={category} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div>
                  <p className="font-semibold text-[#294333]">{categoryLabels[category]} <span className="font-normal text-[#718276]">· falta 1 em {count} montagem(ns)</span></p>
                  {candidates.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-[#718276]">
                      {candidates.slice(0, 3).map((candidate, index) => <li key={`${candidate.label}-${index}`}>{candidate.label} · {candidate.available} disponível(is)</li>)}
                    </ul>
                  ) : <p className="mt-1 text-sm text-[#8d493f]">Nenhuma peça desta categoria está cadastrada no catálogo.</p>}
                </div>
                <span className="w-fit rounded-full bg-[#eef5e9] px-3 py-1 text-sm font-semibold text-[#315b3c]">{count} PC(s)</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 rounded-xl bg-[#f5f7f2] p-4 text-sm leading-6 text-[#65766a]">Não há conjuntos compatíveis a uma peça de completar. Verifique as quantidades disponíveis, os dados técnicos das peças ou cadastre componentes das categorias essenciais.</p>
        )}
        {capacity.missingCatalogCategories.length ? <p className="mt-4 border-t border-[#edf1ea] pt-4 text-sm leading-6 text-[#8d493f]">Categorias essenciais ainda sem peças cadastradas: {capacity.missingCatalogCategories.map((category) => categoryLabels[category]).join(", ")}.</p> : null}
      </section>

      <aside className="mt-6 rounded-2xl border border-[#e7dfc4] bg-[#fffdf5] p-5 text-sm leading-6 text-[#6d613a]">
        <h2 className="font-semibold text-[#514a30]">Como o cálculo funciona</h2>
        <p className="mt-2">Cada unidade física é contada uma única vez. Primeiro, o cálculo separa as peças usadas nos computadores completos; depois, procura conjuntos restantes que precisem de exatamente uma peça essencial. Compatibilidades impossíveis são descartadas. Dados ausentes são tratados como não confirmados e não entram na contagem de computadores completos.</p>
        {capacity.uncertainCombinations > 0 ? <p className="mt-2">{capacity.uncertainCombinations} combinação(ões) candidata(s) completa(s) não puderam ser confirmadas por falta de especificações.</p> : null}
        {capacity.searchLimitReached ? <p className="mt-2">O catálogo ultrapassou o limite de combinações analisadas; os valores podem estar abaixo do máximo real.</p> : null}
        {!capacity.searchExact && !capacity.searchLimitReached ? <p className="mt-2">A busca encontrou combinações viáveis, mas não conseguiu provar que esse é o máximo possível.</p> : null}
      </aside>
    </div>
  );
}
