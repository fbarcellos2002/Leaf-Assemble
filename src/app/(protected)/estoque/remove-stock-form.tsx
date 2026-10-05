"use client";

import type { FormEvent } from "react";

type Props = {
  action: (formData: FormData) => Promise<void>;
  componentId: string;
  lotId: string;
  lotLabel: string;
  availableQuantity: number;
};

export function RemoveStockForm({ action, componentId, lotId, lotLabel, availableQuantity }: Props) {
  function confirmFullRemoval(event: FormEvent<HTMLFormElement>) {
    const quantity = Number(new FormData(event.currentTarget).get("quantity"));
    if (quantity !== availableQuantity) return;

    const confirmed = window.confirm(
      `Tem certeza de que quer remover todas as ${availableQuantity} unidades disponíveis do lote ${lotLabel}? Depois da remoção, esta peça ficará na aba Indisponíveis.`,
    );
    if (!confirmed) event.preventDefault();
  }

  return (
    <form action={action} className="flex items-center gap-2" onSubmit={confirmFullRemoval}>
      <input type="hidden" name="componentId" value={componentId} />
      <input type="hidden" name="lotId" value={lotId} />
      <input className="h-9 w-20 rounded-lg border border-[#d9e2d8] px-2 text-sm" type="number" name="quantity" min="1" max={availableQuantity} required aria-label={`Quantidade a remover de ${lotLabel}`} />
      <button className="h-9 rounded-lg border border-[#d9d0cc] px-3 text-sm font-semibold text-[#8d493f] hover:bg-[#fff5f3]" type="submit">Remover</button>
    </form>
  );
}
