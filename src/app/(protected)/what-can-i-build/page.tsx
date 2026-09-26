import Link from "next/link";

import { calculateBuildCapacity } from "@/lib/inventory/capacity";
import { loadInventorySnapshot } from "@/lib/inventory/read";
import { componentCategories, type ComponentCategory } from "@/lib/inventory/specs";

const categoryLabels: Record<ComponentCategory, string> = {
  CPU: "Processadores (CPU)",
  MOTHERBOARD: "Placas-mãe",
  RAM: "Memórias RAM",
  GPU: "Placas de vídeo",
  STORAGE: "Armazenamentos",
  PSU: "Fontes",
  CASE: "Gabinetes",
  CPU_COOLER: "Coolers de CPU",
};

const requiredCategories: ComponentCategory[] = ["CPU", "MOTHERBOARD", "RAM", "STORAGE", "PSU", "CASE"];

export default async function WhatCanIBuildPage() {
  const inventory = await loadInventorySnapshot();
  const capacity = calculateBuildCapacity(inventory.components);
  const presentCategories = new Set(inventory.components.map((component) => component.category));
  const missingCategories = requiredCategories.filter((category) => !presentCategories.has(category));
  const purchaseEntries = componentCategories
    .filter((category) => (capacity.purchasesByCategory[category] ?? 0) > 0)
    .map((category) => ({ category, quantity: capacity.purchasesByCategory[category] ?? 0 }));

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Planejamento de builds</p>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">O que posso montar?</h1>
          <p className="mt-2 max-w-2xl leading-7 text-[#607266]">
            O cálculo usa as unidades disponíveis, considera cada lote separadamente e descarta combinações incompatíveis.
          </p>
        </div>
        <Link href="/estoque/novo" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5da52f] px-4 text-sm font-semibold text-white hover:bg-[#4b8d26]">
          Cadastrar componente
        </Link>
      </div>

      {inventory.error ? (
        <p role="alert" className="mt-6 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">
          Não foi possível ler o estoque. Confira a conexão e as permissões do Supabase.
        </p>
      ) : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          ["Builds compatíveis agora", capacity.compatibleBuilds, "Somente combinações validadas sem ressalvas."],
          ["Incluindo avisos", capacity.buildsNow, "Combinações montáveis; inclui avisos de compatibilidade."],
          ["Após comprar faltantes", capacity.buildsWithPurchases ?? "Indisponível", capacity.buildsWithPurchases === null ? "Cadastre ao menos uma opção de cada categoria essencial." : `Até ${capacity.additionalWithPurchases ?? 0} build(s) além do estoque atual.`],
        ].map(([label, value, hint]) => (
          <article key={String(label)} className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#718276]">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">{value}</p>
            <p className="mt-2 text-sm leading-6 text-[#718276]">{hint}</p>
          </article>
        ))}
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-[#5da52f]">Estoque atual</p>
          <h2 className="mt-2 text-xl font-semibold text-[#153b2a]">Limite e gargalo</h2>
          <p className="mt-3 leading-7 text-[#65766a]">
            {capacity.bottleneck
              ? `A categoria que mais limita as combinações atuais é ${categoryLabels[capacity.bottleneck].toLocaleLowerCase("pt-BR")}. O cálculo reserva cada unidade no máximo uma vez por build.`
              : "Ainda não há componentes suficientes para apontar um gargalo. Cadastre componentes e seus lotes disponíveis."}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[#f5f7f2] p-4"><dt className="text-[#718276]">Componentes cadastrados</dt><dd className="mt-1 text-lg font-semibold text-[#153b2a]">{inventory.components.length}</dd></div>
            <div className="rounded-xl bg-[#f5f7f2] p-4"><dt className="text-[#718276]">Unidades disponíveis</dt><dd className="mt-1 text-lg font-semibold text-[#153b2a]">{inventory.availableQuantity}</dd></div>
          </dl>
        </section>

        <section className="rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-[#5da52f]">Cenário de compra</p>
          <h2 className="mt-2 text-xl font-semibold text-[#153b2a]">O que comprar para ampliar?</h2>
          {missingCategories.length ? (
            <>
              <p className="mt-3 leading-7 text-[#65766a]">Ainda faltam categorias essenciais no catálogo; por isso não é possível estimar o cenário de compra.</p>
              <ul className="mt-4 space-y-2 text-sm text-[#53675a]">
                {missingCategories.map((category) => <li key={category}>• {categoryLabels[category]}</li>)}
              </ul>
            </>
          ) : purchaseEntries.length ? (
            <>
              <p className="mt-3 leading-7 text-[#65766a]">Para alcançar a estimativa de builds, o plano encontrou estas quantidades de compra:</p>
              <ul className="mt-4 space-y-2 text-sm text-[#53675a]">
                {purchaseEntries.map(({ category, quantity }) => <li key={category} className="flex justify-between gap-4"><span>{categoryLabels[category]}</span><strong className="text-[#153b2a]">{quantity} un.</strong></li>)}
              </ul>
            </>
          ) : (
            <p className="mt-3 leading-7 text-[#65766a]">{capacity.buildsWithPurchases === null
              ? "Cadastre uma opção de cada categoria essencial e mantenha ao menos uma unidade disponível para calcular um cenário de compra."
              : "As especificações das opções cadastradas não formaram uma combinação validada para este cenário."}</p>
          )}
        </section>
      </div>

      <aside className="mt-6 rounded-2xl border border-[#e7dfc4] bg-[#fffdf5] p-5 text-sm leading-6 text-[#6d613a]">
        <h2 className="font-semibold text-[#514a30]">Como interpretar a estimativa</h2>
        <p className="mt-2">O cenário de compra reutiliza as opções de componentes já cadastradas e calcula quantidades adicionais para elas. Não considera preço, disponibilidade de fornecedores nem preferências de desempenho. Resultados com dados técnicos incompletos são tratados como incertos e não entram nas combinações confirmadas.</p>
        {capacity.uncertainCombinations > 0 ? <p className="mt-2">{capacity.uncertainCombinations} combinação(ões) candidata(s) ficou(aram) sem validação por falta de especificações.</p> : null}
        {capacity.searchLimitReached ? <p className="mt-2">A busca atingiu o limite de combinações analisadas; os números são uma estimativa e podem estar abaixo do máximo real.</p> : null}
        {!capacity.searchExact && !capacity.searchLimitReached ? <p className="mt-2">O cálculo encontrou uma solução viável, mas não conseguiu provar que ela é o máximo possível.</p> : null}
        <p className="mt-2">{capacity.searchExact ? "Busca concluída sem atingir os limites computacionais." : "A estimativa pode mudar conforme o catálogo e as especificações forem atualizados."}</p>
      </aside>
    </div>
  );
}
