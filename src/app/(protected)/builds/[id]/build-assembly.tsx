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
  motherboardHasM2: boolean;
};

const calloutPositions: Record<string, { anchorX: number; anchorY: number; labelY: number; side: "left" | "right" }> = {
  cpu: { anchorX: 425, anchorY: 190, labelY: 42, side: "right" },
  motherboard: { anchorX: 265, anchorY: 310, labelY: 270, side: "left" },
  "gpu-1": { anchorX: 480, anchorY: 414, labelY: 445, side: "right" },
  "gpu-2": { anchorX: 480, anchorY: 478, labelY: 520, side: "right" },
  "storage-1": { anchorX: 182, anchorY: 226, labelY: 178, side: "left" },
  "storage-2": { anchorX: 182, anchorY: 302, labelY: 330, side: "left" },
  "storage-3": { anchorX: 182, anchorY: 378, labelY: 390, side: "left" },
  "storage-4": { anchorX: 435, anchorY: 328, labelY: 246, side: "right" },
  psu: { anchorX: 230, anchorY: 520, labelY: 570, side: "left" },
  case: { anchorX: 681, anchorY: 550, labelY: 590, side: "right" },
  cpu_cooler: { anchorX: 425, anchorY: 151, labelY: 115, side: "right" },
};

const statusLabels: Record<string, string> = {
  compatible: "Compatível",
  warning: "Alerta",
  incompatible: "Incompatível",
  unknown: "Dados insuficientes",
};

function CaseIllustration({
  slots,
  selectedSlot,
  motherboardHasM2,
}: Pick<Props, "slots"> & { selectedSlot: string; motherboardHasM2: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 900 640" className="absolute inset-0 h-full w-full" fill="none">
      <defs>
        <linearGradient id="case-metal" x1="112" y1="45" x2="694" y2="604" gradientUnits="userSpaceOnUse">
          <stop stopColor="#304a38" />
          <stop offset="1" stopColor="#101b16" />
        </linearGradient>
        <linearGradient id="glass" x1="164" y1="74" x2="650" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dbe9dc" stopOpacity=".1" />
          <stop offset="1" stopColor="#8eb49a" stopOpacity=".02" />
        </linearGradient>
      </defs>
      <path d="m145 54 510-16 39 28v520l-30 26H145l-26-28V82l26-28Z" fill="url(#case-metal)" stroke="#75937a" strokeWidth="4" />
      <path d="m166 78 461-15 26 18v480l-24 22H160l-18-21V99l24-21Z" fill="url(#glass)" stroke="#a0b7a2" strokeOpacity=".6" strokeWidth="3" />
      <path d="M142 102h22v452h-22m489-471h25v467h-25" stroke="#849b88" strokeOpacity=".55" strokeWidth="3" />
      <circle cx="649" cy="130" r="27" stroke="#9ab39c" strokeOpacity=".7" strokeWidth="4" /><circle cx="649" cy="130" r="7" fill="#849f87" />
      <rect x="250" y="91" width="349" height="453" rx="8" fill="#1d3427" fillOpacity=".92" stroke="#86a18a" strokeWidth="4" />
      <path d="M270 111h309v412H270z" fill="#293f30" stroke="#6f8b74" strokeWidth="2" />
      <circle cx="284" cy="126" r="5" fill="#9bb29e" /><circle cx="565" cy="126" r="5" fill="#9bb29e" /><circle cx="284" cy="509" r="5" fill="#9bb29e" /><circle cx="565" cy="509" r="5" fill="#9bb29e" />
      <rect x="365" y="142" width="119" height="112" rx="7" fill="#14241a" stroke="#b2c7b3" strokeWidth="3" />
      <rect x="378" y="155" width="93" height="86" rx="4" fill="#46604a" stroke="#8ba38e" strokeWidth="2" />
      <path d="M388 165h73v66h-73z" stroke="#b1c4b2" strokeOpacity=".55" strokeWidth="2" />
      <text x="424" y="203" textAnchor="middle" fill="#d7e5d7" fontSize="15" fontWeight="700">CPU</text>
      <circle cx="424" cy="197" r="69" stroke="#718c76" strokeOpacity=".8" strokeWidth="5" strokeDasharray="7 6" />
      <path d="M510 132h20v114h-20zM540 132h20v114h-20zM570 132h12v114h-12z" fill="#91aa94" stroke="#d0e0d0" strokeWidth="2" />
      <path d="M519 144v88m30-88v88m27-88v88" stroke="#273d2d" strokeWidth="3" />
      <text x="545" y="267" textAnchor="middle" fill="#a9bcaa" fontSize="12">DIMM</text>
      <path d="M308 286h236v16H308z" fill="#17271d" stroke="#7d987f" strokeWidth="2" />
      {motherboardHasM2 ? <g><rect x="357" y="311" width="158" height="27" rx="4" fill="#18291e" stroke="#9ab39c" strokeWidth="2" /><rect x="369" y="316" width="123" height="17" rx="2" fill="#56745a" /><circle cx="507" cy="324" r="3" fill="#d3e1d3" /><text x="427" y="330" textAnchor="middle" fill="#d9e7d9" fontSize="10" fontWeight="700">M.2 / NVMe</text></g> : null}
      <path d="M290 384h290v38H290z" fill="#101c15" stroke="#93ae96" strokeWidth="3" />
      <path d="M306 392h260v23H306z" fill="#3d5942" stroke="#78947c" strokeWidth="2" />
      <path d="M322 400h210" stroke="#adc2ae" strokeOpacity=".6" strokeWidth="3" />
      <path d="M290 447h290v38H290z" fill="#101c15" stroke="#93ae96" strokeWidth="3" />
      <path d="M306 455h260v23H306z" fill="#3d5942" stroke="#78947c" strokeWidth="2" />
      <path d="M322 463h210" stroke="#adc2ae" strokeOpacity=".6" strokeWidth="3" />
      <path d="M310 358h270m-270 96h270" stroke="#b3c6b4" strokeOpacity=".52" strokeWidth="3" />
      <rect x="160" y="197" width="72" height="61" rx="5" fill="#17271d" stroke="#78947c" strokeWidth="3" /><rect x="168" y="205" width="56" height="45" rx="3" fill="#344c38" stroke="#a5bba7" />
      <rect x="160" y="273" width="72" height="61" rx="5" fill="#17271d" stroke="#78947c" strokeWidth="3" /><rect x="168" y="281" width="56" height="45" rx="3" fill="#344c38" stroke="#a5bba7" />
      <rect x="160" y="349" width="72" height="61" rx="5" fill="#17271d" stroke="#78947c" strokeWidth="3" /><rect x="168" y="357" width="56" height="45" rx="3" fill="#344c38" stroke="#a5bba7" />
      <rect x="165" y="463" width="112" height="89" rx="8" fill="#18291e" stroke="#819b85" strokeWidth="3" />
      <circle cx="221" cy="507" r="31" stroke="#a0b6a2" strokeWidth="3" /><circle cx="221" cy="507" r="7" fill="#8da890" />
      <path d="M221 480v54m-27-27h54m-46-19 38 38m0-38-38 38" stroke="#728c76" strokeWidth="2" />
      <path d="M120 605h585" stroke="#829886" strokeWidth="4" /><path d="M208 618h54m320 0h54" stroke="#a0b39f" strokeWidth="8" strokeLinecap="round" />
      <text x="425" y="633" textAnchor="middle" fill="#91a493" fontSize="12" letterSpacing="3">PLACA-MÃE ATX · VISÃO LATERAL</text>
      {slots.filter((slot) => !slot.slot.startsWith("ram-")).map((slot) => {
        const point = calloutPositions[slot.slot];
        if (!point) return null;
        const endX = point.side === "left" ? 190 : 720;
        const bendX = point.side === "left" ? 205 : 700;
        const active = selectedSlot === slot.slot;
        return <g key={slot.slot}>
          <path d={`M ${point.anchorX} ${point.anchorY} H ${bendX} V ${point.labelY} H ${endX}`} stroke={active ? "#b3ef81" : "#8aaa8d"} strokeWidth={active ? 3 : 2} strokeOpacity={active ? ".98" : ".78"} />
          <circle cx={point.anchorX} cy={point.anchorY} r={active ? 7 : 5} fill={active ? "#b3ef81" : "#a1c4a4"} stroke="#15241a" strokeWidth="2" />
          <circle cx={endX} cy={point.labelY} r="3.5" fill={active ? "#b3ef81" : "#a1c4a4"} />
        </g>;
      })}
    </svg>
  );
}

export function BuildAssembly({ buildId, slots, optionsBySlot, installedBySlot, canEdit, motherboardHasM2 }: Props) {
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
          <div className="relative mx-auto aspect-[900/640] max-w-[900px] overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_52%_48%,#26382d_0%,#141d17_62%,#0e1511_100%)]">
            <CaseIllustration slots={slots} selectedSlot={selectedSlot} motherboardHasM2={motherboardHasM2 || slots.some((slot) => slot.slot === "storage-4")} />
            {slots.filter((slot) => !slot.slot.startsWith("ram-") && calloutPositions[slot.slot]).map((slot) => {
              const position = calloutPositions[slot.slot];
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
                  style={{ left: position.side === "left" ? "1%" : "82%", top: `${(position.labelY / 640) * 100}%`, width: position.side === "left" ? "21%" : "17%" }}
                  className={`absolute z-10 -translate-y-1/2 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-[9px] font-semibold leading-tight shadow-lg transition sm:px-2.5 sm:py-2 sm:text-xs ${active ? "border-[#b3ef81] bg-[#315b3c] text-white ring-2 ring-[#8fcf58]/30" : installed ? "border-[#9cbe91] bg-[#1e3828]/95 text-[#edf6e9] hover:border-[#b3ef81]" : "border-white/30 bg-[#18251d]/95 text-[#d5e1d6] hover:border-[#a8d77e] hover:bg-[#294333]"}`}
                >
                  <span className="block truncate">{installed?.description ?? slot.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#a6b4a8]">
            <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-[#b3ef81]" />fio-guia do encaixe selecionado</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#b8e68e]" />peça instalada</span>
            {motherboardHasM2 ? <span>Slot M.2 disponível conforme a placa-mãe selecionada</span> : null}
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
