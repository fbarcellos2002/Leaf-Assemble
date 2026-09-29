"use client";

import { useState } from "react";

import { addBuildComponent, releaseBuildComponent } from "../actions";

export type AssemblySlot = { slot: string; category: string; label: string };
export type AssemblyOption = { selection: string; label: string };
export type InstalledPart = {
  buildComponentId: string;
  description: string;
  lot: string;
  quantity: number;
  status: string;
};

type Props = {
  buildId: string;
  slots: AssemblySlot[];
  optionsBySlot: Record<string, AssemblyOption[]>;
  installedBySlot: Record<string, InstalledPart>;
  canEdit: boolean;
};

const positions: Record<string, { left: number; top: number; short: string }> = {
  cpu: { left: 60, top: 28, short: "CPU" },
  motherboard: { left: 42, top: 55, short: "Placa-mãe" },
  "gpu-1": { left: 69, top: 70, short: "GPU 1" },
  "gpu-2": { left: 51, top: 78, short: "GPU 2" },
  "storage-1": { left: 28, top: 33, short: "SSD 1" },
  "storage-2": { left: 28, top: 43, short: "SSD 2" },
  "storage-3": { left: 28, top: 53, short: "SSD 3" },
  psu: { left: 28, top: 82, short: "Fonte" },
  case: { left: 91, top: 83, short: "Gabinete" },
  cpu_cooler: { left: 54, top: 17, short: "Cooler" },
};

const statusLabels: Record<string, string> = {
  compatible: "Compatível",
  warning: "Alerta",
  incompatible: "Incompatível",
  unknown: "Dados insuficientes",
};

function CaseIllustration() {
  return (
    <svg aria-hidden="true" viewBox="0 0 700 540" className="absolute inset-0 h-full w-full" fill="none">
      <defs>
        <linearGradient id="case-metal" x1="96" y1="47" x2="593" y2="475" gradientUnits="userSpaceOnUse">
          <stop stopColor="#263b30" />
          <stop offset="1" stopColor="#101b16" />
        </linearGradient>
        <linearGradient id="glass" x1="130" y1="75" x2="520" y2="440" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dbe9dc" stopOpacity=".12" />
          <stop offset="1" stopColor="#8eb49a" stopOpacity=".025" />
        </linearGradient>
      </defs>
      <path d="M110 55 558 40l38 24v399l-32 30H110l-27-29V82l27-27Z" fill="url(#case-metal)" stroke="#63816c" strokeWidth="3" />
      <path d="m129 78 393-13 22 15v353l-24 22H127l-17-20V98l19-20Z" fill="url(#glass)" stroke="#94ad98" strokeOpacity=".55" strokeWidth="2" />
      <path d="M108 98h31v326h-31M536 79h35v351h-35" stroke="#829887" strokeOpacity=".45" strokeWidth="2" />
      <circle cx="557" cy="121" r="18" stroke="#94ad98" strokeOpacity=".55" strokeWidth="3" />
      <circle cx="557" cy="121" r="5" fill="#78927c" />
      <rect x="216" y="116" width="254" height="243" rx="8" fill="#183126" fillOpacity=".76" stroke="#6c8b73" strokeWidth="3" />
      <path d="M232 133h190v197H232z" fill="#263b30" stroke="#78957c" strokeWidth="2" />
      <path d="M282 152h68v64h-68z" fill="#101a15" stroke="#9cb39e" strokeWidth="2" />
      <path d="M291 161h50v46h-50z" fill="#31483a" stroke="#809b84" />
      <path d="M364 152h13v151h-13m19-151h13v151h-13m19-151h13v151h-13" stroke="#a2bca5" strokeWidth="4" />
      <path d="M251 241h161v23H251zM251 276h161v23H251zM251 311h161v17H251z" fill="#15251c" stroke="#66816c" strokeWidth="2" />
      <path d="M261 249h143m-143 35h143m-143 34h143" stroke="#94ae98" strokeOpacity=".65" strokeWidth="2" />
      <rect x="170" y="156" width="32" height="133" rx="4" fill="#1b2b22" stroke="#607968" strokeWidth="2" />
      <rect x="175" y="165" width="22" height="32" rx="3" fill="#30483a" />
      <rect x="175" y="205" width="22" height="32" rx="3" fill="#30483a" />
      <rect x="175" y="245" width="22" height="32" rx="3" fill="#30483a" />
      <rect x="218" y="387" width="291" height="43" rx="5" fill="#111b16" stroke="#76927a" strokeWidth="2" />
      <path d="M234 397h185v24H234z" fill="#253b2e" stroke="#62806a" />
      <rect x="127" y="365" width="68" height="75" rx="7" fill="#1b2b22" stroke="#78947d" strokeWidth="2" />
      <circle cx="161" cy="402" r="23" stroke="#9bb29e" strokeOpacity=".7" strokeWidth="3" />
      <circle cx="161" cy="402" r="7" fill="#8ba58f" />
      <path d="M151 383v38m19-38v38m-29-29h39m-39 19h39" stroke="#79947d" strokeWidth="2" />
      <path d="M94 464h489" stroke="#6d8772" strokeWidth="3" />
      <path d="M150 480h47m322 0h47" stroke="#879d8a" strokeWidth="7" strokeLinecap="round" />
      <text x="350" y="514" textAnchor="middle" fill="#829588" fontSize="13" letterSpacing="3">GABINETE GENÉRICO · VISÃO LATERAL</text>
    </svg>
  );
}

export function BuildAssembly({ buildId, slots, optionsBySlot, installedBySlot, canEdit }: Props) {
  const [selectedSlot, setSelectedSlot] = useState(slots[0]?.slot ?? "cpu");
  const activeSlot = slots.find((slot) => slot.slot === selectedSlot) ?? slots[0];
  const activePart = activeSlot ? installedBySlot[activeSlot.slot] : undefined;
  const options = activeSlot ? optionsBySlot[activeSlot.slot] ?? [] : [];
  const memorySlots = slots.filter((slot) => slot.slot.startsWith("ram-"));

  return (
    <section className="mt-7 overflow-hidden rounded-3xl border border-[#dce6d8] bg-white shadow-sm">
      <div className="border-b border-[#e7ede4] px-5 py-5 sm:px-7">
        <h2 className="text-xl font-semibold text-[#153b2a]">Montagem interativa</h2>
        <p className="mt-1 text-sm leading-6 text-[#718276]">Clique em um ponto do gabinete para escolher o componente daquele encaixe.</p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.8fr)]">
        <div className="min-h-[440px] border-b border-[#e7ede4] bg-[#111a15] p-3 sm:p-5 lg:border-r lg:border-b-0">
          <div className="relative mx-auto aspect-[700/540] max-w-[780px] overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_52%_48%,#26382d_0%,#141d17_62%,#0e1511_100%)]">
            <CaseIllustration />
            {slots.filter((slot) => !slot.slot.startsWith("ram-")).map((slot) => {
              const position = positions[slot.slot] ?? { left: 50, top: 50, short: slot.label };
              const active = selectedSlot === slot.slot;
              const installed = installedBySlot[slot.slot];
              return (
                <button
                  key={slot.slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot.slot)}
                  aria-label={`${slot.label}${installed ? `: ${installed.description}` : ": vazio"}`}
                  aria-pressed={active}
                  title={installed?.description ?? slot.label}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  className={`absolute z-10 flex max-w-[155px] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-lg transition sm:px-2.5 sm:text-xs ${active ? "border-[#d0f3a9] bg-[#8fcf58] text-[#122318] ring-4 ring-[#8fcf58]/25" : installed ? "border-[#b6d995] bg-[#315b3c] text-white" : "border-white/30 bg-[#1c2b21]/90 text-[#d5e1d6] hover:border-[#a8d77e] hover:bg-[#294333]"}`}
                >
                  <span className={`size-1.5 shrink-0 rounded-full ${installed ? "bg-[#b8e68e]" : active ? "bg-[#294333]" : "bg-[#a5b5a7]"}`} />
                  <span className="truncate">{position.short}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#a6b4a8]">
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#8fcf58]" />encaixe selecionado</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#b8e68e]" />peça instalada</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#a5b5a7]" />encaixe vazio</span>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {memorySlots.length ? <div className="mb-5 border-b border-[#e7ede4] pb-5">
            <h3 className="text-xs font-semibold tracking-[.14em] text-[#718276] uppercase">Memórias</h3>
            <div className="mt-3 space-y-2">
              {memorySlots.map((slot) => {
                const installed = installedBySlot[slot.slot];
                return <button key={slot.slot} type="button" onClick={() => setSelectedSlot(slot.slot)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selectedSlot === slot.slot ? "border-[#8ab875] bg-[#f0f7eb]" : "border-[#e5ece1] bg-[#fbfcfa] hover:border-[#b7cdaa]"}`}>
                  <span className="flex items-center gap-3">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${installed ? "bg-[#315b3c] text-white" : "bg-[#eaf1e4] text-[#315b3c]"}`}>{slot.slot.slice(-1)}</span>
                    <span>
                      <span className="block text-sm font-semibold text-[#294333]">{slot.label}</span>
                      <span className="block max-w-52 truncate text-xs font-normal text-[#718276]">{installed?.description ?? "Slot livre"}</span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-[#5b7562]">{installed ? "Instalada" : "Selecionar"}</span>
                </button>;
              })}
            </div>
          </div> : null}
          {activeSlot ? <>
            <p className="text-xs font-semibold tracking-[.14em] text-[#5da52f] uppercase">Encaixe selecionado</p>
            <h3 className="mt-2 text-xl font-semibold text-[#153b2a]">{activeSlot.label}</h3>
            {activePart ? (
              <div className="mt-4 rounded-xl border border-[#dce6d8] bg-[#f7f9f5] p-4">
                <p className="text-xs font-semibold tracking-wide text-[#718276] uppercase">Peça instalada</p>
                <p className="mt-2 font-semibold text-[#294333]">{activePart.description}</p>
                <p className="mt-1 text-xs text-[#718276]">Lote {activePart.lot || "sem identificação"} · {activePart.quantity} unidade reservada</p>
                <span className="mt-3 inline-flex rounded-full bg-[#e8f3e2] px-2.5 py-1 text-xs font-semibold text-[#315b3c]">{statusLabels[activePart.status] ?? statusLabels.unknown}</span>
                {canEdit ? <form action={releaseBuildComponent} className="mt-3">
                  <input type="hidden" name="buildId" value={buildId} />
                  <input type="hidden" name="buildComponentId" value={activePart.buildComponentId} />
                  <button type="submit" className="text-sm font-semibold text-[#8d493f] hover:underline">Remover peça deste encaixe</button>
                </form> : null}
              </div>
            ) : <p className="mt-2 text-sm leading-6 text-[#718276]">Nenhuma peça reservada neste encaixe.</p>}

            {canEdit && !activePart ? <form action={addBuildComponent} className="mt-5 space-y-4">
              <input type="hidden" name="buildId" value={buildId} />
              <input type="hidden" name="slotKey" value={activeSlot.slot} />
              <label className="grid gap-2 text-sm font-semibold text-[#294333]">
                Peças disponíveis
                <select className="min-h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 text-sm font-normal" name="selection" required defaultValue="">
                  <option value="" disabled>{options.length ? "Selecione peça e lote" : "Nenhuma unidade disponível"}</option>
                  {options.map((option) => <option key={option.selection} value={option.selection}>{option.label}</option>)}
                </select>
              </label>
              <label className="flex items-start gap-2 text-xs leading-5 text-[#718276]">
                <input className="mt-0.5" type="checkbox" name="acknowledge" value="yes" />
                Confirmo que posso continuar mesmo com alerta ou informação insuficiente de compatibilidade.
              </label>
              <button className="h-11 w-full rounded-xl bg-[#153b2a] px-4 font-semibold text-white hover:bg-[#205138] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!options.length}>Reservar componente</button>
            </form> : null}

            {activePart && !canEdit ? <p className="mt-4 text-xs text-[#718276]">A montagem está encerrada e não pode mais ser alterada.</p> : null}
          </> : <p className="text-sm text-[#718276]">Selecione um encaixe no desenho.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#e7ede4] bg-[#fbfcfa] px-5 py-4 sm:px-7">
        {slots.filter((slot) => !slot.slot.startsWith("ram-")).map((slot) => {
          const installed = installedBySlot[slot.slot];
          return <button key={slot.slot} type="button" onClick={() => setSelectedSlot(slot.slot)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedSlot === slot.slot ? "border-[#315b3c] bg-[#eaf1e4] text-[#315b3c]" : "border-[#dce6d8] bg-white text-[#718276]"}`}>
            {slot.label}{installed ? " ✓" : ""}
          </button>;
        })}
      </div>
    </section>
  );
}
