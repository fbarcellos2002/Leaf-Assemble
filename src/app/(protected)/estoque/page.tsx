import Link from "next/link";

import { requireActiveProfile } from "@/lib/auth/profile";
import { componentCategorySchema } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ category?: string; q?: string; error?: string }> };

const labels: Record<string, string> = {
  CPU: "CPU",
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

      <form className="mt-7 flex flex-col gap-3 rounded-2xl border border-[#dce6d8] bg-white p-4 sm:flex-row">
        <input className="h-11 min-w-0 flex-1 rounded-xl border border-[#d9e2d8] px-3" name="q" defaultValue={query} placeholder="Buscar peça, fabricante ou modelo do gabinete" />
        <select className="h-11 rounded-xl border border-[#d9e2d8] bg-white px-3" name="category" defaultValue={category.success ? category.data : ""}>
          <option value="">Todas as categorias</option>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="h-11 rounded-xl border border-[#cdddc7] px-5 font-semibold text-[#315b3c] hover:bg-[#f5f7f2]" type="submit">Filtrar</button>
      </form>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível consultar o estoque.</p> : null}
      {params.error === "invalid-input" ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Confira os dados informados.</p> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(components ?? []).map((component) => {
          const lots = component.component_lots ?? [];
          const total = lots.reduce((sum, lot) => sum + lot.quantity_total, 0);
          const reserved = lots.reduce((sum, lot) => sum + lot.reserved_quantity, 0);
          const used = lots.reduce((sum, lot) => sum + lot.used_quantity, 0);
          return (
            <Link key={component.id} href={`/estoque/${component.id}`} className="group rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#aac69a] hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-[#eaf1e4] px-3 py-1.5 text-xs font-semibold text-[#315b3c]">{labels[component.category] ?? component.category}</span>
                <span className="text-sm font-semibold text-[#315b3c]">{total - reserved - used} disponíveis</span>
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
      {!error && components?.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[#cdddc7] bg-white/70 px-6 py-14 text-center">
          <p className="text-lg font-semibold text-[#315b3c]">Nenhuma peça encontrada</p>
          <p className="mt-2 text-sm text-[#718276]">{query || category.success ? "Altere os filtros para ampliar a busca." : "Cadastre o estoque real para começar."}</p>
        </div>
      ) : null}
    </div>
  );
}
