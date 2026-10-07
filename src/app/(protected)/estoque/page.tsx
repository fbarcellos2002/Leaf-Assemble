import Link from "next/link";

import { requireActiveProfile } from "@/lib/auth/profile";
import { componentCategorySchema } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ category?: string; q?: string; error?: string; tab?: string }> };
type InventoryComponent = {
  id: string;
  category: string;
  manufacturer: string;
  name: string | null;
  model: string;
  description: string | null;
  component_lots: Array<{
    quantity_total: number;
    reserved_quantity: number;
    used_quantity: number;
  }> | null;
};

const labels: Record<string, string> = {
  CPU: "Processador",
  MOTHERBOARD: "Placa-mãe",
  RAM: "RAM",
  GPU: "GPU",
  STORAGE: "Armazenamento",
  PSU: "Fonte",
  CASE: "Gabinete",
  CPU_COOLER: "Cooler",
};

export default async function InventoryPage({ searchParams }: Props) {
  const profile = await requireActiveProfile();
  const params = await searchParams;
  const category = componentCategorySchema.safeParse(params.category);
  const activeTab = params.tab === "unavailable" ? "unavailable" : "available";
  const query = params.q?.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 120) ?? "";
  const supabase = await createClient();
  let componentQuery = supabase
    .from("components")
    .select("id, category, manufacturer, name, model, description, component_lots(quantity_total, reserved_quantity, used_quantity)")
    .order("category")
    .order("manufacturer");
  if (category.success) componentQuery = componentQuery.eq("category", category.data);
  if (query) componentQuery = componentQuery.or(`name.ilike.%${query}%,manufacturer.ilike.%${query}%,model.ilike.%${query}%,description.ilike.%${query}%`);
  const { data: components, error } = await componentQuery;
  const inventoryItems = ((components ?? []) as InventoryComponent[]).map((component) => {
    const lots = component.component_lots ?? [];
    const available = lots.reduce((sum, lot) => sum + lot.quantity_total - lot.reserved_quantity - lot.used_quantity, 0);
    return { component, available };
  });
  const availableItems = inventoryItems.filter((item) => item.available > 0);
  const unavailableItems = inventoryItems.filter((item) => item.available <= 0);
  const visibleItems = activeTab === "available" ? availableItems : unavailableItems;
  const tabHref = (tab: "available" | "unavailable") => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (category.success) search.set("category", category.data);
    if (tab === "unavailable") search.set("tab", tab);
    const suffix = search.toString();
    return suffix ? `/estoque?${suffix}` : "/estoque";
  };
  const categoryHref = (nextCategory: string) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (nextCategory) search.set("category", nextCategory);
    if (activeTab === "unavailable") search.set("tab", activeTab);
    const suffix = search.toString();
    return suffix ? `/estoque?${suffix}` : "/estoque";
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Inventário</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">Estoque</h1>
          <p className="mt-2 leading-7 text-[#607266]">Peças reais, quantidades disponíveis e rastreabilidade por lote.</p>
        </div>
        {profile.role === "ADMIN" ? <Link href="/estoque/novo" className="flex h-11 w-fit items-center rounded-xl bg-[#153b2a] px-5 font-semibold text-white hover:bg-[#205138]">Cadastrar peça</Link> : null}
      </div>

      <form className="mt-7 rounded-2xl border border-[#dce6d8] bg-white p-4">
        <input type="hidden" name="tab" value={activeTab} />
        {category.success ? <input type="hidden" name="category" value={category.data} /> : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="h-11 min-w-0 flex-1 rounded-xl border border-[#d9e2d8] px-3" name="q" defaultValue={query} placeholder="Buscar peça, fabricante ou modelo do gabinete" />
          <button className="h-11 rounded-xl border border-[#cdddc7] px-5 font-semibold text-[#315b3c] hover:bg-[#f5f7f2]" type="submit">Buscar</button>
        </div>
      </form>

      <nav aria-label="Filtrar por categoria" className="mt-3 flex flex-wrap gap-2">
        {[["", "Todas as peças"], ...Object.entries(labels)].map(([value, label]) => {
          const selected = value ? category.success && category.data === value : !category.success;
          return <Link
            key={value || "all"}
            aria-current={selected ? "page" : undefined}
            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${selected ? "border-[#315b3c] bg-[#eaf1e4] text-[#315b3c]" : "border-[#dce6d8] bg-white text-[#718276] hover:border-[#aac69a] hover:text-[#315b3c]"}`}
            href={categoryHref(value)}
          >{label}</Link>;
        })}
      </nav>

      <nav aria-label="Disponibilidade do estoque" className="mt-6 flex gap-2 border-b border-[#dce6d8]">
        {([
          ["available", "Disponíveis", availableItems.length],
          ["unavailable", "Indisponíveis", unavailableItems.length],
        ] as const).map(([tab, label, count]) => (
          <Link
            key={tab}
            aria-current={activeTab === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? "border-[#4b8a2a] text-[#315b3c]" : "border-transparent text-[#718276] hover:text-[#315b3c]"}`}
            href={tabHref(tab)}
          >
            {label} <span className="ml-1 text-xs">{count}</span>
          </Link>
        ))}
      </nav>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível consultar o estoque.</p> : null}
      {params.error === "invalid-input" ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Confira os dados informados.</p> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map(({ component, available }) => {
          const lots = component.component_lots ?? [];
          const total = lots.reduce((sum, lot) => sum + lot.quantity_total, 0);
          const reserved = lots.reduce((sum, lot) => sum + lot.reserved_quantity, 0);
          const used = lots.reduce((sum, lot) => sum + lot.used_quantity, 0);
          return (
            <Link key={component.id} href={`/estoque/${component.id}`} className="group rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#aac69a] hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-[#eaf1e4] px-3 py-1.5 text-xs font-semibold text-[#315b3c]">{labels[component.category] ?? component.category}</span>
                <span className={`text-sm font-semibold ${available > 0 ? "text-[#315b3c]" : "text-[#8d493f]"}`}>{available > 0 ? `${available} disponíveis` : "Sem unidades disponíveis"}</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[#153b2a] group-hover:text-[#4b8a2a]">{component.description || component.name || `${component.manufacturer} ${component.model}`}</h2>
              <div className="mt-4 flex gap-5 border-t border-[#edf1ea] pt-4 text-sm text-[#718276]">
                <span>Total <strong className="ml-1 text-[#344b3a]">{total}</strong></span>
                <span>Reservado <strong className="ml-1 text-[#344b3a]">{reserved}</strong></span>
                <span>Usado <strong className="ml-1 text-[#344b3a]">{used}</strong></span>
              </div>
            </Link>
          );
        })}
      </section>
      {!error && visibleItems.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[#cdddc7] bg-white/70 px-6 py-14 text-center">
          <p className="text-lg font-semibold text-[#315b3c]">{activeTab === "available" ? "Nenhuma peça disponível" : "Nenhuma peça indisponível"}</p>
          <p className="mt-2 text-sm text-[#718276]">{query || category.success ? "Altere os filtros ou consulte a outra aba." : activeTab === "available" ? "As peças sem unidades disponíveis aparecem na aba Indisponíveis." : "Peças sem estoque disponível aparecerão aqui."}</p>
        </div>
      ) : null}
    </div>
  );
}
