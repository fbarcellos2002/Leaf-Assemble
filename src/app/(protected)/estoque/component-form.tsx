"use client";

import { useEffect, useRef, useState } from "react";
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
  "catalog-unavailable": "O índice local de produtos ainda não está disponível. Confira a configuração do catálogo Open Icecat.",
  "invalid-input": "Confira a categoria, o fabricante e o código/modelo da peça.",
  unauthorized: "Somente administradores podem consultar e importar fichas técnicas.",
};

type LookupProduct = { title: string; brand: string; productCode: string; sourceUrl: string; summary: string };
type CatalogResult = { icecatId: string; supplierName: string; productCode: string; modelName: string; categoryId: number | null; imageUrl: string | null };

export function ComponentForm({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<ComponentCategory>("CPU");
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [sourceData, setSourceData] = useState("");
  const [description, setDescription] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [lookupProduct, setLookupProduct] = useState<LookupProduct | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    const term = searchText.trim();
    if (term.length < 2) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const response = await fetch("/api/component-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: term }),
          signal: controller.signal,
        });
        const result = await response.json() as { error?: string; results?: CatalogResult[] };
        if (!response.ok) {
          setSearchResults([]);
          setSearchError(lookupErrors[result.error ?? ""] ?? "Não foi possível pesquisar no catálogo local.");
          return;
        }
        setSearchResults(result.results ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchResults([]);
        setSearchError("Não foi possível pesquisar no catálogo local.");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchText]);

  async function lookupComponent(selectedIcecatId?: string) {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    const query = new URLSearchParams({ category });
    if (selectedIcecatId) query.set("icecatId", selectedIcecatId);
    else {
      query.set("manufacturer", String(formData.get("manufacturer") ?? "").trim());
      query.set("model", String(formData.get("model") ?? "").trim());
    }
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
      setManufacturer(result.product.brand);
      setModel(result.product.productCode);
      if (result.product.summary && !description.trim()) setDescription(result.product.summary.slice(0, 1000));
    } catch {
      setLookupError(lookupErrors["provider-error"]);
    } finally {
      setIsLookingUp(false);
    }
  }

  function selectCatalogProduct(product: CatalogResult) {
    setSearchResults([]);
    setSearchText("");
    setSpecValues({});
    setSourceData("");
    setManufacturer("");
    setModel("");
    void lookupComponent(product.icecatId);
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
                setSearchText("");
                setSearchResults([]);
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
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="manufacturer" required maxLength={100} value={manufacturer} onChange={(event) => { setManufacturer(event.target.value); setSourceData(""); setLookupProduct(null); setSpecValues({}); }} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Modelo ou código do fabricante (MPN)
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="model" required maxLength={140} value={model} onChange={(event) => { setModel(event.target.value); setSourceData(""); setLookupProduct(null); setSpecValues({}); }} />
          </label>
          <div className="sm:col-span-2">
            <label className="grid gap-2 text-sm font-medium text-[#294333]" htmlFor="icecat-product-search">
              Pesquisar no catálogo Open Icecat
              <input
                id="icecat-product-search"
                className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal"
                type="search"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={searchResults.length > 0}
                aria-controls="icecat-product-results"
                placeholder="Digite marca, modelo, MPN ou GTIN (mínimo 2 caracteres)"
                value={searchText}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchText(value);
                  if (value.trim().length < 2) {
                    setSearchResults([]);
                    setSearchError("");
                    setIsSearching(false);
                  }
                }}
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-[#718276]">A busca usa o índice local sincronizado. O texto digitado não é enviado ao Icecat; a ficha completa é consultada depois que você escolhe um resultado.</p>
            {isSearching ? <p className="mt-2 text-sm text-[#718276]" role="status">Pesquisando no catálogo…</p> : null}
            {searchError ? <p className="mt-2 text-sm text-[#8d3c32]" role="alert">{searchError}</p> : null}
            {searchText.trim().length >= 2 && !isSearching && !searchError && searchResults.length === 0 ? (
              <p className="mt-2 text-sm text-[#718276]" role="status">Nenhum item correspondente no índice local.</p>
            ) : null}
            {searchResults.length > 0 ? (
              <ul id="icecat-product-results" role="listbox" aria-label="Produtos encontrados" className="mt-2 max-h-72 overflow-auto rounded-2xl border border-[#d9e2d8] bg-white shadow-lg">
                {searchResults.map((product) => (
                  <li key={product.icecatId} role="presentation">
                    <button type="button" role="option" aria-selected="false" onClick={() => selectCatalogProduct(product)} className="w-full border-b border-[#edf1ea] px-4 py-3 text-left last:border-0 hover:bg-[#f5f8f2]">
                      <span className="block text-sm font-semibold text-[#153b2a]">{product.modelName}</span>
                      <span className="mt-1 block text-xs text-[#718276]">{product.supplierName} · Código do fabricante: {product.productCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Observações
            <textarea className="min-h-24 rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button className="min-h-11 rounded-xl border border-[#aac69a] bg-[#f5f8f2] px-4 text-sm font-semibold text-[#315b3c] transition hover:bg-[#eaf1e4] disabled:cursor-wait disabled:opacity-60" type="button" onClick={() => void lookupComponent()} disabled={isLookingUp}>
            {isLookingUp ? "Consultando catálogo…" : "Buscar dados técnicos na internet"}
          </button>
          <p className="text-xs leading-5 text-[#718276]">Sem índice local, ainda é possível buscar diretamente por fabricante + modelo/MPN. Confira a ficha antes de cadastrar.</p>
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
