import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { requireActiveProfile } from "@/lib/auth/profile";
import { componentCategorySchema, specFields } from "@/lib/inventory/specs";
import { createClient } from "@/lib/supabase/server";

import { receiveStock, removeStock } from "../actions";
import { RemoveStockForm } from "../remove-stock-form";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
};

const categoryLabels: Record<string, string> = {
  CPU: "Processador",
  MOTHERBOARD: "Placa-mãe",
  RAM: "Memória RAM",
  GPU: "Placa de vídeo (GPU)",
  STORAGE: "Armazenamento",
  PSU: "Fonte de alimentação",
  CASE: "Gabinete",
  CPU_COOLER: "Cooler do processador",
};

const processorReference = (manufacturer: string) => {
  if (manufacturer === "Intel") return { label: "Intel ARK", href: "https://www.intel.com/content/www/us/en/ark.html" };
  if (manufacturer === "AMD") return { label: "Catálogo de processadores AMD", href: "https://www.amd.com/en/products/specifications/processors.html" };
  return null;
};

function formatSpec(value: unknown) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default async function ComponentDetailPage({ params, searchParams }: Props) {
  const profile = await requireActiveProfile();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: component, error } = await supabase
    .from("components")
    .select("id, category, manufacturer, name, model, description, specs, created_at, component_lots(id, lot_code, quantity_total, available_quantity, reserved_quantity, used_quantity, notes)")
    .eq("id", id)
    .maybeSingle();
  if (error || !component) notFound();

  const lots = [...(component.component_lots ?? [])].sort((a, b) => (a.lot_code ?? "").localeCompare(b.lot_code ?? ""));
  const total = lots.reduce((sum, lot) => sum + lot.available_quantity + lot.reserved_quantity, 0);
  const available = lots.reduce((sum, lot) => sum + lot.available_quantity, 0);
  const reserved = lots.reduce((sum, lot) => sum + lot.reserved_quantity, 0);
  const used = lots.reduce((sum, lot) => sum + lot.used_quantity, 0);
  const specs = component.specs && typeof component.specs === "object" && !Array.isArray(component.specs)
    ? component.specs as Record<string, unknown>
    : {};
  const categoryResult = componentCategorySchema.safeParse(component.category);
  if (!categoryResult.success) notFound();
  const category = categoryResult.data;
  const activeFields = specFields[category];
  const activeSpecKeys = new Set(activeFields.map((field) => field.key));
  const visibleSpecs = Object.entries(specs).filter(([key]) => activeSpecKeys.has(key));
  return (
    <div>
      <Link href="/estoque" className="text-sm font-medium text-[#4b7b3b] hover:underline">← Voltar ao estoque</Link>
      <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <span className="rounded-full bg-[#eaf1e4] px-3 py-1.5 text-xs font-semibold text-[#315b3c]">{categoryLabels[component.category] ?? component.category}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">{component.description || component.name || `${component.manufacturer} ${component.model}`}</h1>
        </div>
      </div>

      {category === "CPU" && processorReference(component.manufacturer) ? (
        <p className="mt-3 text-sm">
          <a className="font-medium text-[#4b7b3b] hover:underline" href={processorReference(component.manufacturer)!.href} target="_blank" rel="noreferrer">
            Consultar {processorReference(component.manufacturer)!.label} ↗
          </a>
        </p>
      ) : null}

      {query.error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível alterar o estoque. Confira a quantidade e as unidades disponíveis.</p> : null}
      {query.notice === "created" ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">Componente cadastrado.</p> : null}
      {query.notice === "stock-received" ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">Entrada de estoque registrada.</p> : null}
      {query.notice === "stock-removed" ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">Quantidade removida do estoque.</p> : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Em estoque", total],
          ["Disponível", available],
          ["Reservado", reserved],
          ["Alocado/Usado", used],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#dce6d8] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#718276]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[#153b2a]">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-[#153b2a]">Especificações</h2>
        {visibleSpecs.length ? (
          <dl className="mt-5 grid grid-cols-1 gap-y-4">
            {visibleSpecs.map(([key, value]) => (
              <div key={key} className="border-b border-[#edf1ea] pb-3">
                <dt className="text-xs font-semibold tracking-wide text-[#718276] uppercase">{activeFields.find((field) => field.key === key)?.label ?? key}{activeFields.find((field) => field.key === key)?.unit ? ` (${activeFields.find((field) => field.key === key)?.unit})` : ""}</dt>
                <dd className="mt-1 text-sm font-medium text-[#294333]">{formatSpec(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#718276]">Nenhuma especificação técnica foi registrada.</p>
        )}
      </section>

      <section className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#153b2a]">Lotes</h2>
            <p className="mt-1 text-sm text-[#718276]">Unidades de compra e disponibilidade de cada lote.</p>
          </div>
        </div>
        {lots.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs tracking-wide text-[#718276] uppercase">
                <tr><th className="pb-3 pr-4">Lote</th><th className="pb-3 pr-4">Em estoque</th><th className="pb-3 pr-4">Disponível</th><th className="pb-3 pr-4">Reservado</th><th className="pb-3 pr-4">Usado</th>{profile.role === "ADMIN" ? <th className="pb-3">Remover</th> : null}</tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ea]">
                {lots.map((lot) => <tr key={lot.id}>
                  <td className="py-3 pr-4 font-medium text-[#294333]">{lot.lot_code || "Sem identificação"}{lot.notes ? <p className="mt-1 max-w-56 whitespace-normal text-xs font-normal text-[#718276]">{lot.notes}</p> : null}</td>
                  <td className="py-3 pr-4 text-[#607266]">{lot.available_quantity + lot.reserved_quantity}</td>
                  <td className="py-3 pr-4 text-[#315b3c]">{lot.available_quantity}</td>
                  <td className="py-3 pr-4 text-[#607266]">{lot.reserved_quantity}</td>
                  <td className="py-3 text-[#607266]">{lot.used_quantity}</td>
                  {profile.role === "ADMIN" ? <td className="py-2 pl-2">
                    {lot.available_quantity > 0 ? (
                      <RemoveStockForm
                        action={removeStock}
                        componentId={component.id}
                        lotId={lot.id}
                        lotLabel={lot.lot_code || "sem identificação"}
                        availableQuantity={lot.available_quantity}
                      />
                    ) : <span className="text-xs text-[#89958d]">—</span>}
                  </td> : null}
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-4 text-sm text-[#718276]">Nenhum lote registrado.</p>}

        {profile.role === "ADMIN" ? (
          <form action={receiveStock} className="mt-7 grid grid-cols-1 gap-3 border-t border-[#e7ede4] pt-6">
            <input type="hidden" name="componentId" value={component.id} />
            <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">Quantidade recebida<input className="h-11 rounded-xl border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal" name="quantity" type="number" min="1" max="100000" required /></label>
            <input className="peer size-4 self-end accent-[#315b3c]" id="receive-stock-details" type="checkbox" />
            <label className="self-end pb-2 text-sm font-medium text-[#294333]" htmlFor="receive-stock-details">Informar lote ou observações</label>
            <div className="hidden grid-cols-1 gap-3 peer-checked:grid">
              <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">Código do lote (opcional)<input className="h-11 rounded-xl border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal" name="lotCode" maxLength={80} /></label>
              <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">Observações (opcional)<input className="h-11 w-full rounded-xl border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal" name="notes" maxLength={500} /></label>
            </div>
            <button className="mt-auto h-11 rounded-xl bg-[#153b2a] px-4 font-semibold text-white hover:bg-[#205138]" type="submit">Adicionar quantidade</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
