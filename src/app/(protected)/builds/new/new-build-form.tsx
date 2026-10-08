"use client";

import { useState } from "react";

import { createBuild, updateBuild } from "../actions";

type Props = { buildId?: string; initialName?: string; initialNotes?: string };

export function WorkstationForm({ buildId, initialName = "", initialNotes = "" }: Props) {
  const isEditing = Boolean(buildId);
  const [hasObservations, setHasObservations] = useState(Boolean(initialNotes));

  return (
    <form action={isEditing ? updateBuild : createBuild} className={isEditing ? "space-y-5" : "mt-7 space-y-5 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8"}>
      {buildId ? <input type="hidden" name="buildId" value={buildId} /> : null}
      <div className="flex flex-col gap-2 text-sm font-medium text-[#294333] sm:flex-row sm:items-center sm:gap-4">
        <label htmlFor="workstation-name" className="shrink-0">Nomeie sua workstation:</label>
        <input id="workstation-name" className="h-12 min-w-0 flex-1 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="name" maxLength={100} required placeholder="Ex.: PC pronto Intel" defaultValue={initialName} />
      </div>
      <div className="space-y-3">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-[#294333]">
          <input
            className="size-4 accent-[#315b3c]"
            type="checkbox"
            name="hasObservations"
            checked={hasObservations}
            onChange={(event) => setHasObservations(event.target.checked)}
          />
          Observações?
        </label>
        {hasObservations ? (
          <label htmlFor="workstation-notes" className="grid gap-2 text-sm font-medium text-[#294333]">
            Descrição das observações
            <textarea id="workstation-notes" rows={3} className="w-full rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="notes" maxLength={1000} required defaultValue={initialNotes} />
          </label>
        ) : null}
      </div>
      <button className={`${isEditing ? "h-10 px-4" : "h-12 px-6"} rounded-xl bg-[#153b2a] font-semibold text-white hover:bg-[#205138]`} type="submit">{isEditing ? "Salvar cadastro" : "Iniciar Nova Montagem"}</button>
    </form>
  );
}
