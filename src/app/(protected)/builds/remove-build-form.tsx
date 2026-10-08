"use client";

import { removeBuild } from "./actions";

export function RemoveBuildForm({ buildId, buildName, isCompleted = false }: { buildId: string; buildName: string; isCompleted?: boolean }) {
  return (
    <form
      action={removeBuild}
      onSubmit={(event) => {
        if (!window.confirm(`Confirma a remoção de “${buildName}”? As peças reservadas serão devolvidas ao estoque.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="buildId" value={buildId} />
      {isCompleted ? <input type="hidden" name="tab" value="completed" /> : null}
      <button className="text-sm font-semibold text-[#8d493f] hover:underline" type="submit">Remover</button>
    </form>
  );
}
