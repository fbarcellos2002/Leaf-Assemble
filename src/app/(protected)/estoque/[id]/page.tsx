import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { requireActiveProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import { receiveStock } from "../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
};

const categoryLabels: Record<string, string> = {
  CPU: "Processador (CPU)",
  MOTHERBOARD: "Placa-mãe",
  RAM: "Memória RAM",
  GPU: "Placa de vídeo (GPU)",
  STORAGE: "Armazenamento",
  PSU: "Fonte de alimentação",
  CASE: "Gabinete",
  CPU_COOLER: "Cooler do processador",
};

const specLabels: Record<string, string> = {
  socket: "Socket",
  cores: "Núcleos",
  threads: "Threads",
  baseClockMhz: "Clock base (MHz)",
  boostClockMhz: "Clock boost (MHz)",
  tdpW: "TDP (W)",
  integratedGraphics: "Gráficos integrados",
  memoryTypes: "Tipos de memória",
  chipset: "Chipset",
  formFactor: "Formato",
  memoryType: "Tipo de memória",
  memorySlots: "Slots de memória",
  maxMemoryGb: "Memória máxima (GB)",
  supportedMemoryFrequenciesMhz: "Frequências suportadas (MHz)",
  eccSupport: "Suporte ECC",
  storageInterfaces: "Interfaces de armazenamento",
  pcieSlots: "Slots PCIe",
  capacityGb: "Capacidade (GB)",
  frequencyMhz: "Frequência (MHz)",
  casLatency: "Latência CAS",
  voltage: "Tensão (V)",
  moduleCount: "Módulos por kit",
  ecc: "ECC",
  registered: "Registered",
  vramGb: "VRAM (GB)",
  interface: "Interface",
  lengthMm: "Comprimento (mm)",
  powerConnectors: "Conectores de energia",
  recommendedPsuW: "Fonte recomendada (W)",
  type: "Tipo",
  readSpeedMbS: "Leitura (MB/s)",
  writeSpeedMbS: "Gravação (MB/s)",
  wattageW: "Potência (W)",
  efficiencyRating: "Certificação",
  connectors: "Conectores",
  formFactorSupport: "Formatos de placa-mãe",
  gpuMaxLengthMm: "Comprimento máximo da GPU (mm)",
  cpuCoolerMaxHeightMm: "Altura máxima do cooler (mm)",
  psuFormFactors: "Formatos de fonte",
  driveBays25: "Baias de 2,5\"",
  driveBays35: "Baias de 3,5\"",
  supportedSockets: "Sockets compatíveis",
  heightMm: "Altura (mm)",
  tdpRatingW: "TDP suportado (W)",
};

const hiddenSpecKeys = new Set([
  "lengthMm", "heightMm", "gpuMaxLengthMm", "cpuCoolerMaxHeightMm",
  "tdpW", "tdpRatingW", "recommendedPsuW", "wattageW", "powerConnectors", "connectors", "voltage",
]);

function isHiddenExternalFeature(name: string, group: string) {
  const normalized = `${name} ${group}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /height|width|length|dimension|altura|largura|comprimento|dimens|power|energy|tdp|watt|voltage|current|energia|potencia|consumo|tensao/i.test(normalized);
}

function safeIcecatUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "icecat.biz" || url.hostname.endsWith(".icecat.biz"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

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
    .select("id, category, manufacturer, model, description, specs, created_at, component_lots(id, lot_code, quantity_total, available_quantity, reserved_quantity, used_quantity, purchase_date, notes)")
    .eq("id", id)
    .maybeSingle();
  if (error || !component) notFound();

  const lots = [...(component.component_lots ?? [])].sort((a, b) => a.lot_code.localeCompare(b.lot_code));
  const total = lots.reduce((sum, lot) => sum + lot.quantity_total, 0);
  const available = lots.reduce((sum, lot) => sum + lot.available_quantity, 0);
  const reserved = lots.reduce((sum, lot) => sum + lot.reserved_quantity, 0);
  const used = lots.reduce((sum, lot) => sum + lot.used_quantity, 0);
  const specs = component.specs && typeof component.specs === "object" && !Array.isArray(component.specs)
    ? component.specs as Record<string, unknown>
    : {};
  const sourceData = specs.sourceData && typeof specs.sourceData === "object" && !Array.isArray(specs.sourceData)
    ? specs.sourceData as Record<string, unknown>
    : null;
  const sourceFeatures = Array.isArray(sourceData?.features)
    ? sourceData.features.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const feature = item as { group?: unknown; name?: unknown; value?: unknown };
      const name = typeof feature.name === "string" ? feature.name : "";
      const group = typeof feature.group === "string" ? feature.group : "";
      const value = typeof feature.value === "string" ? feature.value : "";
      return name && value && !isHiddenExternalFeature(name, group) ? [{ name, group, value }] : [];
    })
    : [];
  const sourceUrl = safeIcecatUrl(sourceData?.sourceUrl);

  return (
    <div>
      <Link href="/estoque" className="text-sm font-medium text-[#4b7b3b] hover:underline">← Voltar ao estoque</Link>
      <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <span className="rounded-full bg-[#eaf1e4] px-3 py-1.5 text-xs font-semibold text-[#315b3c]">{categoryLabels[component.category] ?? component.category}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">{component.manufacturer} {component.model}</h1>
          {component.description ? <p className="mt-3 max-w-2xl leading-7 text-[#607266]">{component.description}</p> : null}
        </div>
      </div>

      {query.error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível alterar o estoque. Confira o código do lote e a quantidade.</p> : null}
      {query.notice === "created" ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">Componente cadastrado.</p> : null}
      {query.notice === "stock-received" ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">Entrada de estoque registrada.</p> : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", total],
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
        {Object.keys(specs).length ? (
          <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(specs).filter(([key]) => key !== "sourceData" && !hiddenSpecKeys.has(key)).map(([key, value]) => (
              <div key={key} className="border-b border-[#edf1ea] pb-3">
                <dt className="text-xs font-semibold tracking-wide text-[#718276] uppercase">{specLabels[key] ?? key}</dt>
                <dd className="mt-1 text-sm font-medium text-[#294333]">{formatSpec(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#718276]">Nenhuma especificação técnica foi registrada.</p>
        )}
      </section>

      {sourceData ? (
        <section className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-xl font-semibold text-[#153b2a]">Dados técnicos consultados online</h2>
              <p className="mt-1 text-sm text-[#718276]">{typeof sourceData.title === "string" ? sourceData.title : "Ficha do fabricante"} · {typeof sourceData.provider === "string" ? sourceData.provider : ""}</p>
            </div>
            {sourceUrl ? <a className="text-sm font-semibold text-[#315b3c] underline" href={sourceUrl} target="_blank" rel="noreferrer">Abrir ficha de origem</a> : null}
          </div>
          {typeof sourceData.summary === "string" && sourceData.summary ? <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-6 text-[#607266]">{sourceData.summary}</p> : null}
          {sourceFeatures.length ? (
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {sourceFeatures.map((feature, index) => (
                <div key={`${feature.name}-${index}`} className="border-b border-[#edf1ea] pb-3">
                  {feature.group ? <dt className="text-[10px] font-semibold tracking-wide text-[#89958d] uppercase">{feature.group}</dt> : null}
                  <dt className="mt-1 text-xs font-semibold tracking-wide text-[#718276]">{feature.name}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#294333]">{feature.value}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="mt-4 text-sm text-[#718276]">A ficha consultada não trouxe outros detalhes técnicos disponíveis para exibição.</p>}
          <p className="mt-5 text-xs text-[#89958d]">A ficha pode não cobrir todos os produtos ou campos. Dimensões e informações de energia ficam ocultas nesta tela.</p>
        </section>
      ) : null}

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
                <tr><th className="pb-3 pr-4">Lote</th><th className="pb-3 pr-4">Compra</th><th className="pb-3 pr-4">Total</th><th className="pb-3 pr-4">Disponível</th><th className="pb-3 pr-4">Reservado</th><th className="pb-3">Usado</th></tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ea]">
                {lots.map((lot) => <tr key={lot.id}>
                  <td className="py-3 pr-4 font-medium text-[#294333]">{lot.lot_code}</td>
                  <td className="py-3 pr-4 text-[#607266]">{lot.purchase_date ?? "—"}</td>
                  <td className="py-3 pr-4 text-[#607266]">{lot.quantity_total}</td>
                  <td className="py-3 pr-4 text-[#315b3c]">{lot.available_quantity}</td>
                  <td className="py-3 pr-4 text-[#607266]">{lot.reserved_quantity}</td>
                  <td className="py-3 text-[#607266]">{lot.used_quantity}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-4 text-sm text-[#718276]">Nenhum lote registrado.</p>}

        {profile.role === "ADMIN" ? (
          <form action={receiveStock} className="mt-7 grid gap-3 border-t border-[#e7ede4] pt-6 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="componentId" value={component.id} />
            <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">Novo lote<input className="h-11 rounded-xl border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal" name="lotCode" required maxLength={80} /></label>
            <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">Quantidade recebida<input className="h-11 rounded-xl border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal" name="quantity" type="number" min="1" max="100000" required /></label>
            <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">Data da compra<input className="h-11 rounded-xl border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal" name="purchaseDate" type="date" /></label>
            <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">Observações<input className="h-11 rounded-xl border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal" name="notes" maxLength={500} /></label>
            <button className="mt-auto h-11 rounded-xl bg-[#153b2a] px-4 font-semibold text-white hover:bg-[#205138]" type="submit">Registrar entrada</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
