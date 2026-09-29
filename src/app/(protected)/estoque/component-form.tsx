"use client";

import { useState } from "react";
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

export function ComponentForm({ action }: Props) {
  const [category, setCategory] = useState<ComponentCategory>("CPU");
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");

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
              }}
              value={category}
            >
              {componentCategories.map((item) => (
                <option key={item} value={item}>{categoryLabels[item]}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 text-sm font-medium text-[#294333]">
            <label htmlFor="component-manufacturer">Fabricante</label>
            <input
              id="component-manufacturer"
              className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal"
              name="manufacturer"
              required
              maxLength={100}
              autoComplete="off"
              placeholder="Fabricante"
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
            />
          </div>
          <div className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            <label htmlFor="component-model">Modelo ou código do fabricante (MPN)</label>
            <input
              id="component-model"
              className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal"
              name="model"
              required
              maxLength={140}
              autoComplete="off"
              placeholder="Ex.: Core i5-2500"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Observações
            <textarea className="min-h-24 rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
      </section>

      <section>
        <div>
          <h2 className="text-lg font-semibold text-[#153b2a]">Especificações técnicas</h2>
          <p className="mt-1 text-sm leading-6 text-[#718276]">
            Preencha manualmente o que souber. Use as opções padronizadas ou informe um valor personalizado quando necessário.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
