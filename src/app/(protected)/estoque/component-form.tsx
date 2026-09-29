"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  componentCategories,
  type ComponentCategory,
  specChoices,
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
  const lookupController = useRef<AbortController | null>(null);
  const [category, setCategory] = useState<ComponentCategory>("CPU");
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [sourceData, setSourceData] = useState("");
  const [description, setDescription] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeSearchField, setActiveSearchField] = useState<"manufacturer" | "model" | null>(null);
  const [searchResults, setSearchResults] = useState<CatalogResult[]>([]);
  const [needsMoreSearchInput, setNeedsMoreSearchInput] = useState(false);
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
        const result = await response.json() as { error?: string; results?: CatalogResult[]; needsMoreInput?: boolean };
        if (!response.ok) {
          setSearchResults([]);
          setSearchError(lookupErrors[result.error ?? ""] ?? "Não foi possível pesquisar no catálogo local.");
          return;
        }
        setSearchResults(result.results ?? []);
        setNeedsMoreSearchInput(result.needsMoreInput ?? false);
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

  async function lookupComponent(product: CatalogResult) {
    lookupController.current?.abort();
    const controller = new AbortController();
    lookupController.current = controller;
    const query = new URLSearchParams({ category });
    query.set("icecatId", product.icecatId);
    setIsLookingUp(true);
    setLookupError("");
    setLookupProduct(null);
    try {
      const response = await fetch(`/api/component-lookup?${query.toString()}`, { signal: controller.signal });
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
      setManufacturer(result.product.brand.slice(0, 100));
      setModel((product.modelName || result.product.productCode).slice(0, 140));
      if (result.product.summary && !description.trim()) setDescription(result.product.summary.slice(0, 1000));
    } catch {
      if (controller.signal.aborted) return;
      setLookupError(lookupErrors["provider-error"]);
    } finally {
      if (lookupController.current === controller) {
        lookupController.current = null;
        setIsLookingUp(false);
      }
    }
  }

  function selectCatalogProduct(product: CatalogResult) {
    setSearchResults([]);
    setNeedsMoreSearchInput(false);
    setSearchText("");
    setSearchError("");
    setIsSearching(false);
    setActiveSearchField(null);
    setSpecValues({});
    setSourceData("");
    setManufacturer(product.supplierName);
    setModel((product.modelName || product.productCode).slice(0, 140));
    void lookupComponent(product);
  }

  function updateCatalogSearch(field: "manufacturer" | "model", value: string) {
    if (field === "manufacturer") {
      setManufacturer(value);
    } else {
      setModel(value);
    }
    setActiveSearchField(field);
    setSearchText(value);
    setSearchResults([]);
    setNeedsMoreSearchInput(false);
    setSearchError("");
    setIsSearching(value.trim().length >= 2);
    setSourceData("");
    setLookupProduct(null);
    setSpecValues({});
    lookupController.current?.abort();
    setIsLookingUp(false);
  }

  function focusCatalogSearch(field: "manufacturer" | "model", value: string) {
    setActiveSearchField(field);
    if (searchText !== value) {
      setSearchText(value);
      setSearchResults([]);
      setNeedsMoreSearchInput(false);
      setSearchError("");
      setIsSearching(value.trim().length >= 2);
    }
  }

  function renderCatalogSuggestions(field: "manufacturer" | "model") {
    const isOpen = activeSearchField === field;
    const listId = `icecat-${field}-results`;
    if (!isOpen) return null;

    return (
      <>
        {isSearching ? <p className="mt-2 text-sm text-[#718276]" role="status">Buscando no índice Icecat…</p> : null}
        {searchError ? <p className="mt-2 text-sm text-[#8d3c32]" role="alert">{searchError}</p> : null}
        {searchText.trim().length >= 2 && !isSearching && !searchError && searchResults.length === 0 ? (
          <p className="mt-2 text-sm text-[#718276]" role="status">{needsMoreSearchInput ? "Continue digitando para filtrar o catálogo." : "Nenhum item correspondente no índice. Você ainda pode preencher os dados manualmente."}</p>
        ) : null}
        {searchResults.length > 0 ? (
          <ul id={listId} aria-label="Sugestões de produtos Icecat" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-[#d9e2d8] bg-white shadow-lg">
            {searchResults.map((product, index) => (
              <li key={product.icecatId}>
                <button
                  type="button"
                  onClick={() => selectCatalogProduct(product)}
                  className="w-full border-b border-[#edf1ea] px-4 py-3 text-left last:border-0 hover:bg-[#f5f8f2] focus:bg-[#f5f8f2] focus:outline-none"
                >
                  <span className="block text-sm font-semibold text-[#153b2a]">{product.modelName}</span>
                  <span className="mt-1 block text-xs text-[#718276]">{product.supplierName} · Código: {product.productCode}{index === 0 ? " · Mais próximo" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }

  function updateSpecValue(key: string, value: string) {
    setSpecValues((current) => ({ ...current, [key]: value }));
  }

  function renderSpecField(field: (typeof specFields)[ComponentCategory][number]) {
    const value = specValues[field.key] ?? "";
    const options = specChoices[category]?.[field.key];

    if (options && (field.type === "text" || field.type === "number")) {
      const selectedValue = value && !options.includes(value) ? "__other__" : value;
      const isCustom = selectedValue === "__other__";
      return (
        <>
          <select
            className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal"
            aria-label={field.label}
            value={selectedValue}
            onChange={(event) => updateSpecValue(field.key, event.target.value === "__other__" ? (options.includes(value) ? "__other__" : value || "__other__") : event.target.value)}
          >
            <option value="">Selecione uma opção</option>
            {options.map((option) => <option key={option} value={option}>{option}{field.type === "number" ? ` ${field.unit ?? ""}` : ""}</option>)}
            <option value="__other__">Outro valor…</option>
          </select>
          <input type="hidden" name={`spec_${field.key}`} value={value === "__other__" ? "" : value} />
          {isCustom ? (
            <input
              className="h-11 rounded-xl border border-[#d9e2d8] px-3 font-normal"
              type={field.type === "number" ? "number" : "text"}
              aria-label={`${field.label}, outro valor`}
              inputMode={field.type === "number" ? "decimal" : "text"}
              placeholder="Digite outro valor"
              value={value === "__other__" ? "" : value}
              onChange={(event) => updateSpecValue(field.key, event.target.value)}
            />
          ) : null}
        </>
      );
    }

    if (options && (field.type === "text-list" || field.type === "number-list")) {
      const values = value.split(",").map((item) => item.trim()).filter(Boolean);
      const selected = options.filter((option) => values.includes(option));
      const custom = values.filter((item) => !options.includes(item));
      return (
        <>
          <input type="hidden" name={`spec_${field.key}`} value={[...selected, ...custom].join(", ")} />
          <div role="group" aria-label={field.label} className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-[#d9e2d8] p-3 sm:grid-cols-3">
            {options.map((option) => (
              <label key={option} className="flex min-w-0 items-center gap-2 text-sm font-normal text-[#44594b]">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[#315b3c]"
                  checked={selected.includes(option)}
                  onChange={(event) => {
                    const nextSelected = event.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                    updateSpecValue(field.key, [...nextSelected, ...custom].join(", "));
                  }}
                />
                <span>{option}{field.type === "number-list" ? ` ${field.unit ?? ""}` : ""}</span>
              </label>
            ))}
          </div>
          <input
            className="h-10 rounded-lg border border-[#d9e2d8] px-3 text-sm font-normal"
            aria-label={`${field.label}, outras opções`}
            type="text"
            inputMode={field.type === "number-list" ? "decimal" : "text"}
            placeholder={field.type === "number-list" ? "Outras frequências, separadas por vírgula" : "Outras opções, separadas por vírgula"}
            value={custom.join(", ")}
            onChange={(event) => updateSpecValue(field.key, [...selected, event.target.value].filter(Boolean).join(", "))}
          />
        </>
      );
    }

    if (field.type === "boolean") {
      return (
        <select className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal" name={`spec_${field.key}`} aria-label={field.label} value={value} onChange={(event) => updateSpecValue(field.key, event.target.value)}>
          <option value="">Não informado</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      );
    }

    return (
      <input
        className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal"
        name={`spec_${field.key}`}
        aria-label={field.label}
        type={field.type === "number" ? "number" : "text"}
        inputMode={field.type === "number" || field.type === "number-list" ? "decimal" : "text"}
        placeholder={field.hint}
        value={value}
        onChange={(event) => updateSpecValue(field.key, event.target.value)}
      />
    );
  }

  return (
    <form action={action} className="space-y-8">
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
                lookupController.current?.abort();
                setIsLookingUp(false);
                setSearchText("");
                setSearchResults([]);
                setNeedsMoreSearchInput(false);
                setSearchError("");
                setIsSearching(false);
                setActiveSearchField(null);
              }}
              value={category}
            >
              {componentCategories.map((item) => (
                <option key={item} value={item}>{categoryLabels[item]}</option>
              ))}
            </select>
          </label>
          <div className="relative grid gap-2 text-sm font-medium text-[#294333]" onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node && event.currentTarget.contains(nextTarget))) setActiveSearchField(null);
          }}>
            <label htmlFor="component-manufacturer">Fabricante</label>
            <input
              id="component-manufacturer"
              className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal"
              name="manufacturer"
              required
              maxLength={100}
              autoComplete="off"
              placeholder="Comece a digitar uma marca"
              value={manufacturer}
              onFocus={() => focusCatalogSearch("manufacturer", manufacturer)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults.length > 0) {
                  event.preventDefault();
                  selectCatalogProduct(searchResults[0]);
                }
              }}
              onChange={(event) => updateCatalogSearch("manufacturer", event.target.value)}
            />
            {renderCatalogSuggestions("manufacturer")}
          </div>
          <div className="relative grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2" onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node && event.currentTarget.contains(nextTarget))) setActiveSearchField(null);
          }}>
            <label htmlFor="component-model">Modelo ou código do fabricante (MPN)</label>
            <input
              id="component-model"
              className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal"
              name="model"
              required
              maxLength={140}
              autoComplete="off"
              placeholder="Ex.: Core i5-2500; as opções aparecem enquanto digita"
              value={model}
              onFocus={() => focusCatalogSearch("model", model)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults.length > 0) {
                  event.preventDefault();
                  selectCatalogProduct(searchResults[0]);
                }
              }}
              onChange={(event) => updateCatalogSearch("model", event.target.value)}
            />
            {renderCatalogSuggestions("model")}
            <p className="text-xs font-normal leading-5 text-[#718276]">Busque por marca, modelo ou MPN enquanto digita. Em modelos curtos, continue até haver 3 caracteres úteis, como “i5 250”.</p>
          </div>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Observações
            <textarea className="min-h-24 rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
        {isLookingUp ? <p className="mt-4 text-sm text-[#718276]" role="status">Consultando a ficha selecionada no Icecat e preenchendo os dados…</p> : null}
        <p className="mt-4 text-xs leading-5 text-[#718276]">A busca usa o índice Icecat sincronizado no Supabase; a ficha técnica só é consultada depois que você escolhe uma sugestão.</p>
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
            Preencha o que souber ou escolha um resultado Icecat para completar os dados. Dimensões e dados de energia não aparecem no formulário; quando encontrados na ficha, são preservados para as verificações de compatibilidade.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {specFields[category].filter((field) => hiddenSpecKeys.has(field.key)).map((field) => (
            <input key={field.key} type="hidden" name={`spec_${field.key}`} value={specValues[field.key] ?? ""} />
          ))}
          {specFields[category].filter((field) => !hiddenSpecKeys.has(field.key)).map((field) => (
            <div key={field.key} className="grid gap-2 text-sm font-medium text-[#294333]">
              <p>{field.label}{field.unit ? ` (${field.unit})` : ""}</p>
              {renderSpecField(field)}
              {field.hint && field.type === "boolean" ? <span className="text-xs font-normal text-[#7b897f]">{field.hint}</span> : null}
            </div>
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
        <button className="h-12 rounded-xl bg-[#153b2a] px-6 font-semibold text-white hover:bg-[#205138] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={isLookingUp}>{isLookingUp ? "Aguarde a ficha Icecat…" : "Cadastrar componente"}</button>
        <Link className="flex h-12 items-center rounded-xl border border-[#d9e2d8] px-5 font-medium text-[#315b3c] hover:bg-[#f5f7f2]" href="/estoque">Cancelar</Link>
      </div>
    </form>
  );
}
