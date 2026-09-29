"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  componentCategories,
  type ComponentCategory,
  manufacturerChoices,
  specChoices,
  specFields,
} from "@/lib/inventory/specs";
import { generateComponentDescription } from "@/lib/inventory/description";

type FormState = { error: "invalid-input" | "invalid-specs" | "save-failed" | null };
type Props = { action: (state: FormState, formData: FormData) => Promise<FormState> };

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

export function ComponentForm({ action }: Props) {
  const [formState, formAction, isPending] = useActionState(action, { error: null });
  const [category, setCategory] = useState<ComponentCategory>("CPU");
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [manufacturer, setManufacturer] = useState("");
  const [name, setName] = useState("");
  const [caseModel, setCaseModel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [lotNotes, setLotNotes] = useState("");
  const [showLotDetails, setShowLotDetails] = useState(false);

  function updateSpecValue(key: string, value: string) {
    setSpecValues((current) => ({ ...current, [key]: value }));
  }

  const previewSpecs: Record<string, unknown> = {};
  for (const field of specFields[category]) {
    const value = specValues[field.key]?.trim();
    if (!value || value === "__other__") continue;
    if (field.type === "boolean") previewSpecs[field.key] = value === "true";
    else if (field.type === "number") {
      if (Number.isFinite(Number(value))) previewSpecs[field.key] = Number(value);
    } else if (field.type === "text-list") previewSpecs[field.key] = value.split(",").map((item) => item.trim()).filter(Boolean);
    else if (field.type === "number-list") previewSpecs[field.key] = value.split(",").map(Number).filter(Number.isFinite);
    else previewSpecs[field.key] = value;
  }
  const generatedDescription = generateComponentDescription(category, manufacturer, name, previewSpecs);

  function renderSpecField(field: (typeof specFields)[ComponentCategory][number]) {
    const value = specValues[field.key] ?? "";
    const options = specChoices[category]?.[field.key];
    const placeholder = category === "CPU" && field.key === "socket"
      ? manufacturer === "Intel" ? "Ex.: LGA 1155" : manufacturer === "AMD" ? "Ex.: AM4" : field.hint
      : field.hint;
    if (field.type === "boolean") {
      return (
        <select className="h-12 w-full rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal" name={`spec_${field.key}`} aria-label={field.label} value={value} onChange={(event) => updateSpecValue(field.key, event.target.value)}>
          <option value="">Não informado</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      );
    }

    const listField = field.type === "text-list" || field.type === "number-list";
    const datalistId = `options-${category}-${field.key}`;
    return (
      <>
        <input
          className="h-12 w-full rounded-xl border border-[#d9e2d8] px-3 font-normal"
          name={`spec_${field.key}`}
          aria-label={field.label}
          type={field.type === "number" ? "number" : "text"}
          min={field.type === "number" ? "0" : undefined}
          step={field.type === "number" ? "any" : undefined}
          inputMode={field.type === "number" || field.type === "number-list" ? "decimal" : "text"}
          list={options?.length ? datalistId : undefined}
          placeholder={placeholder ?? (listField ? "Separe os valores por vírgula" : undefined)}
          value={value}
          onWheel={field.type === "number" ? (event) => event.currentTarget.blur() : undefined}
          onChange={(event) => updateSpecValue(field.key, event.target.value)}
        />
        {options?.length ? <datalist id={datalistId}>{options.map((option) => <option key={option} value={option} />)}</datalist> : null}
      </>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {formState.error ? (
        <p role="alert" className="rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">
          {formState.error === "invalid-input"
            ? "Confira o nome, o fabricante e a quantidade. Os dados preenchidos foram mantidos."
            : formState.error === "invalid-specs"
              ? "Revise as especificações técnicas. Os dados preenchidos foram mantidos."
              : "Não foi possível cadastrar a peça. Os dados preenchidos foram mantidos; tente novamente."}
        </p>
      ) : null}
      <section>
        <h2 className="text-lg font-semibold text-[#153b2a]">Identificação</h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Categoria
            <select
              className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3"
              name="category"
              onChange={(event) => {
                setCategory(event.target.value as ComponentCategory);
                setSpecValues({});
                setManufacturer("");
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
            {manufacturerChoices[category] ? (
              <select className="h-12 w-full rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal" name="manufacturer" required value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}>
                <option value="">Selecione o fabricante</option>
                {manufacturerChoices[category]?.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            ) : <input
              id="component-manufacturer"
              className="h-12 w-full rounded-xl border border-[#d9e2d8] px-3 font-normal"
              name="manufacturer"
              required
              maxLength={100}
              autoComplete="off"
              placeholder="Fabricante"
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
            />}
          </label>
          {category === "CPU" || category === "GPU" ? <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Nome da peça <span className="text-xs font-normal text-[#718276]">Obrigatório; informe a identificação comercial.</span>
            <input
              className="h-12 w-full rounded-xl border border-[#d9e2d8] px-3 font-normal"
              name="name"
              required
              maxLength={140}
              autoComplete="off"
              placeholder={category === "CPU" ? "Ex.: Core i5-2500" : "Ex.: GeForce RTX 4060"}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {category === "CPU" ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-[#4b7b3b]">
                <span className="w-full font-normal text-[#718276]">Consulte a ficha técnica do processador pelo nome.</span>
                <a href={`https://www.intel.com/content/www/us/en/ark/search.html?q=${encodeURIComponent(name || "processor")}`} target="_blank" rel="noreferrer">Pesquisar no Intel ARK ↗</a>
                <a href="https://www.amd.com/en/products/specifications/processors.html" target="_blank" rel="noreferrer">Pesquisar no catálogo AMD ↗</a>
              </div>
            ) : null}
          </label> : null}
          {category === "CASE" ? (
            <label className="grid gap-2 text-sm font-medium text-[#294333]">
              Modelo do gabinete (opcional)
              <input className="h-12 w-full rounded-xl border border-[#d9e2d8] px-3 font-normal" name="caseModel" maxLength={140} autoComplete="off" placeholder="Modelo do gabinete, se conhecido" value={caseModel} onChange={(event) => setCaseModel(event.target.value)} />
            </label>
          ) : null}
        </div>
      </section>

      <section>
        <div>
          <h2 className="text-lg font-semibold text-[#153b2a]">Especificações técnicas</h2>
          <p className="mt-1 text-sm leading-6 text-[#718276]">
            Preencha manualmente o que souber. Use as opções padronizadas ou informe um valor personalizado quando necessário.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {specFields[category].map((field) => (
            <div key={field.key} className="grid gap-2 text-sm font-medium text-[#294333]">
              <p>{field.label}{field.unit ? ` (${field.unit})` : ""}</p>
              {renderSpecField(field)}
              {field.hint && field.type === "boolean" ? <span className="text-xs font-normal text-[#7b897f]">{field.hint}</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#153b2a]">Descrição automática</h2>
        <p className="mt-1 text-sm leading-6 text-[#718276]">A descrição combina o nome da peça com fabricante e especificações técnicas importantes para a montagem.</p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-[#dce6d8] bg-[#f7f9f5] p-4">
            <p className="text-xs font-semibold tracking-wide text-[#718276] uppercase">Descrição gerada</p>
            <p className="mt-2 font-medium text-[#294333]">{generatedDescription === manufacturer.trim() ? "Preencha as especificações principais para montar a descrição." : generatedDescription}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#153b2a]">Quantidade inicial</h2>
        <p className="mt-1 text-sm leading-6 text-[#718276]">Informe quantas unidades existem. O código de lote é opcional.</p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Quantidade
            <input className="h-12 w-full rounded-xl border border-[#d9e2d8] px-3 font-normal" name="quantity" type="number" min="0" max="100000" step="1" value={quantity} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => setQuantity(event.target.value)} required />
          </label>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[#294333]">
              <input type="checkbox" className="size-4 accent-[#315b3c]" checked={showLotDetails} onChange={(event) => setShowLotDetails(event.target.checked)} />
              Informar lote ou observações
            </label>
            {showLotDetails ? (
              <div className="mt-3 grid grid-cols-1 gap-4">
                <label className="grid gap-2 text-sm font-medium text-[#294333]">
                  Código do lote (opcional)
                  <input className="h-12 w-full rounded-xl border border-[#d9e2d8] px-3 font-normal" name="lotCode" maxLength={80} value={lotCode} onChange={(event) => setLotCode(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#294333]">
                  Observações do lote (opcional)
                  <input className="h-12 w-full rounded-xl border border-[#d9e2d8] px-3 font-normal" name="notes" maxLength={500} value={lotNotes} onChange={(event) => setLotNotes(event.target.value)} />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-[#e7ede4] pt-6">
        <button className="h-12 rounded-xl bg-[#153b2a] px-6 font-semibold text-white hover:bg-[#205138] disabled:opacity-60" type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Cadastrar componente"}</button>
        <Link className="flex h-12 items-center rounded-xl border border-[#d9e2d8] px-5 font-medium text-[#315b3c] hover:bg-[#f5f7f2]" href="/estoque">Cancelar</Link>
      </div>
    </form>
  );
}
