"use client";

import { useState } from "react";
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

export function ComponentForm({ action }: Props) {
  const [category, setCategory] = useState<ComponentCategory>("CPU");

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
              onChange={(event) => setCategory(event.target.value as ComponentCategory)}
              value={category}
            >
              {componentCategories.map((item) => (
                <option key={item} value={item}>{categoryLabels[item]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Fabricante
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="manufacturer" required maxLength={100} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Modelo
            <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="model" required maxLength={140} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333] sm:col-span-2">
            Observações
            <textarea className="min-h-24 rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="description" maxLength={1000} />
          </label>
        </div>
      </section>

      <section>
        <div>
          <h2 className="text-lg font-semibold text-[#153b2a]">Especificações técnicas</h2>
          <p className="mt-1 text-sm leading-6 text-[#718276]">
            Preencha o que souber. Campos vazios serão tratados como informação insuficiente nas verificações de compatibilidade.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {specFields[category].map((field) => (
            <label key={field.key} className="grid gap-2 text-sm font-medium text-[#294333]">
              {field.label}{field.unit ? ` (${field.unit})` : ""}
              {field.type === "boolean" ? (
                <select className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal" name={`spec_${field.key}`} defaultValue="">
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
