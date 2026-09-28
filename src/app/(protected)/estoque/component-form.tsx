"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import {
  componentCategories,
  type ComponentCategory,
  specFields,
} from "@/lib/inventory/specs";

type Props = { action: (formData: FormData) => void | Promise<void> };

const categoryLabels: Record<ComponentCategory, string> = {
  CPU: "Processador (CPU)",
  MOTHERBOARD: "Placa-mãe",
  RAM: "Memória RAM",
  GPU: "Placa de vídeo (GPU)",
  STORAGE: "Armazenamento",
  PSU: "Fonte de alimentação",
  CASE: "Gabinete",
  CPU_COOLER: "Cooler do processador",
};

const hiddenSpecKeys = new Set([
  "lengthMm", "heightMm", "gpuMaxLengthMm", "cpuCoolerMaxHeightMm",
  "tdpW", "tdpRatingW", "recommendedPsuW", "wattageW", "powerConnectors", "connectors", "voltage",
]);

const lookupErrors: Record<string, string> = {
  "not-configured": "Configure ICECAT_USERNAME e ICECAT_API_TOKEN como variáveis privadas no ambiente da aplicação.",
  "not-found": "Nenhuma ficha técnica foi encontrada. Confira o fabricante e o código exato (MPN).",
  "provider-error": "O catálogo não respondeu agora. Tente novamente em instantes.",
  "invalid-input": "Informe a categoria, o fabricante e o código/modelo da peça.",
  unauthorized: "Somente administradores podem consultar e importar fichas técnicas.",
};

type LookupProduct = { title: string; brand: string; productCode: string; sourceUrl: string; summary: string };

export function ComponentForm({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<ComponentCategory>("CPU");
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [sourceData, setSourceData] = useState("");
  const [description, setDescription] = useState("");
  const [lookupProduct, setLookupProduct] = useState<LookupProduct | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  async function lookupComponent() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    const query = new URLSearchParams({
      category,
      manufacturer: String(formData.get("manufacturer") ?? "").trim(),
      model: String(formData.get("model") ?? "").trim(),
    });
    setIsLookingUp(true);
    setLookupError("");
    setLookupProduct(null);
    try {
      const response = await fetch(`/api/component-lookup?${query.toString()}`);
      const result = await response.json() as {
        error?: string;
        product?: LookupProduct;
        specs?: Record<string, string>;
        sourceData?: Record<string, unknown>;
      };
      if (!response.ok || !result.product || !result.specs || !result.sourceData) {
        setLookupError(lookupErrors[result.error ?? ""] ?? "Não foi possível buscar essa peça.");
        return;
      }
      setSpecValues((current) => ({ ...current, ...result.specs }));
      setSourceData(JSON.stringify(result.sourceData));
      setLookupProduct(result.product);
      if (result.product.summary && !description.trim()) setDescription(result.product.summary.slice(0, 1000));
    } catch {
      setLookupError(lookupErrors["provider-error"]);
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-8">
      <input type="hidden" name="sourceData" value={sourceData} />
      <section>
        <h2 className="text-lg font-semibold text-[#153b2a]">Identificação</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Categoria
            <select
              className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3"
              name="category"
              onChange={(event) => {
                setCategory(event.target.value as ComponentCategory);
                setSpecValues({});
                setSourceData("");
                setLookupProduct(null);
                setLookupError("");
              }}
              value={category}
            >
              {componentCategories.map((item) => (
                <option key={item} value={item}>{categoryLabels[item]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Fabricante
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="manufacturer" required maxLength={100} onChange={() => { setSourceData(""); setLookupProduct(null); setSpecValues({}); }} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Modelo ou código do fabricante (MPN)
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="model" required maxLength={140} onChange={() => { setSourceData(""); setLookupProduct(null); setSpecValues({}); }} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Observações
            <textarea className="min-h-24 rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button className="min-h-11 rounded-xl border border-[#aac69a] bg-[#f5f8f2] px-4 text-sm font-semibold text-[#315b3c] transition hover:bg-[#eaf1e4] disabled:cursor-wait disabled:opacity-60" type="button" onClick={lookupComponent} disabled={isLookingUp}>
            {isLookingUp ? "Consultando catálogo…" : "Buscar dados técnicos na internet"}
          </button>
          <p className="text-xs leading-5 text-[#718276]">Busca exata por fabricante + modelo/MPN. Confira a ficha encontrada antes de cadastrar.</p>
        </div>
        {lookupError ? <p role="alert" className="mt-3 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#8d3c32]">{lookupError}</p> : null}
        {lookupProduct ? (
          <div role="status" className="mt-3 rounded-xl border border-[#dce6d8] bg-[#f8faf6] p-4 text-sm text-[#44594b]">
            <p className="font-semibold text-[#153b2a]">Ficha localizada: {lookupProduct.title}</p>
            <p className="mt-1">Fabricante: {lookupProduct.brand} · Código: {lookupProduct.productCode}</p>
            <a className="mt-2 inline-block font-medium text-[#315b3c] underline" href={lookupProduct.sourceUrl} target="_blank" rel="noreferrer">Conferir ficha no Icecat</a>
          </div>
        ) : null}
      </section>

      <section>
        <div>
          <h2 className="text-lg font-semibold text-[#153b2a]">Especificações técnicas</h2>
          <p className="mt-1 text-sm leading-6 text-[#718276]">
            Preencha o que souber ou use a busca online. Dimensões e dados de energia não aparecem no formulário; quando encontrados na ficha, são preservados para as verificações de compatibilidade.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {specFields[category].filter((field) => hiddenSpecKeys.has(field.key)).map((field) => (
            <input key={field.key} type="hidden" name={`spec_${field.key}`} value={specValues[field.key] ?? ""} />
          ))}
          {specFields[category].filter((field) => !hiddenSpecKeys.has(field.key)).map((field) => (
            <label key={field.key} className="grid gap-2 text-sm font-medium text-[#294333]">
              {field.label}{field.unit ? ` (${field.unit})` : ""}
              {field.type === "boolean" ? (
                <select className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal" name={`spec_${field.key}`} value={specValues[field.key] ?? ""} onChange={(event) => setSpecValues((current) => ({ ...current, [field.key]: event.target.value }))}>
                  <option value="">Não informado</option>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              ) : (
                <input
                  className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal"
                  name={`spec_${field.key}`}
                  type={field.type === "number" ? "number" : "text"}
                  inputMode={field.type === "number" || field.type === "number-list" ? "decimal" : "text"}
                  placeholder={field.hint}
                  value={specValues[field.key] ?? ""}
                  onChange={(event) => setSpecValues((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              )}
              {field.hint && field.type === "boolean" ? <span className="text-xs font-normal text-[#7b897f]">{field.hint}</span> : null}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#153b2a]">Lote inicial</h2>
        <p className="mt-1 text-sm leading-6 text-[#718276]">A quantidade cadastrada entra no estoque por um lote identificável.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Quantidade
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="quantity" type="number" min="0" max="100000" defaultValue="0" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Código do lote
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="lotCode" maxLength={80} placeholder="Necessário se informar quantidade" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Data da compra
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="purchaseDate" type="date" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Observações do lote
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="notes" maxLength={500} />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-[#e7ede4] pt-6">
        <button className="h-12 rounded-xl bg-[#153b2a] px-6 font-semibold text-white hover:bg-[#205138]" type="submit">Cadastrar componente</button>
        <Link className="flex h-12 items-center rounded-xl border border-[#d9e2d8] px-5 font-medium text-[#315b3c] hover:bg-[#f5f7f2]" href="/estoque">Cancelar</Link>
      </div>
    </form>
  );
}
