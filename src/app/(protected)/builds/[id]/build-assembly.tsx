"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { addBuildComponent, releaseBuildComponent } from "../actions";

export type AssemblySlot = { slot: string; category: string; label: string; interface?: string; selectable: boolean };
export type AssemblyOption = { selection: string; label: string };
export type InstalledPart = {
  buildComponentId: string;
  description: string;
  lot: string;
  quantity: number;
  status: string;
  category: string;
  specs: Record<string, unknown>;
};

type Props = {
  buildId: string;
  slots: AssemblySlot[];
  optionsBySlot: Record<string, AssemblyOption[]>;
  installedBySlot: Record<string, InstalledPart>;
  canEdit: boolean;
  motherboardHasM2: boolean;
  motherboardFormFactor?: string;
  motherboardMemoryType?: string;
  initialSlot?: string;
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

function ReserveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="h-11 w-full rounded-xl bg-[#153b2a] px-4 font-semibold text-white hover:bg-[#205138] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={disabled || pending}>
      {pending ? "Reservando…" : "Reservar componente"}
    </button>
  );
}

function CaseIllustration({
  slots,
  selectedSlot,
  motherboardFormFactor,
  motherboardMemoryType,
  installedBySlot,
}: Pick<Props, "slots" | "motherboardFormFactor" | "motherboardMemoryType"> & {
  selectedSlot: string;
  installedBySlot: Record<string, InstalledPart>;
}) {
  const boardSizes: Record<string, { width: number; height: number }> = {
    "XL-ATX": { width: 362, height: 405 },
    "E-ATX": { width: 342, height: 390 },
    ATX: { width: 320, height: 372 },
    "m-ATX": { width: 280, height: 326 },
    "Mini-DTX": { width: 252, height: 296 },
    "Mini-ITX": { width: 224, height: 262 },
  };
  const boardSize = boardSizes[motherboardFormFactor ?? "ATX"] ?? boardSizes.ATX;
  const boardX = 430 - boardSize.width / 2;
  const boardY = 292 - boardSize.height / 2;
  const memorySlots = slots.filter((slot) => slot.slot.startsWith("ram-"));
  const pcieSlots = slots.filter((slot) => slot.slot.startsWith("gpu-"));
  const storageSlots = slots.filter((slot) => slot.category === "STORAGE");
  const installedCase = installedBySlot.case;
  const installedPsu = installedBySlot.psu;
  const installedCooler = installedBySlot.cpu_cooler;
  const installedCpu = installedBySlot.cpu;
  const installedGpu = Object.entries(installedBySlot).find(([slot, part]) => slot.startsWith("gpu-") && part.category === "GPU")?.[1];
  const caseBoardFormats = Array.isArray(installedCase?.specs.formFactorSupport) ? installedCase.specs.formFactorSupport.join(", ") : "—";
  const casePsuFormats = Array.isArray(installedCase?.specs.psuFormFactors) ? installedCase.specs.psuFormFactors.join(", ") : "—";
  const cpuPowerTarget = typeof installedCpu?.specs.tdpW === "number" ? installedCpu.specs.tdpW + 100 : 0;
  const gpuPowerTarget = typeof installedGpu?.specs.recommendedPsuW === "number" ? installedGpu.specs.recommendedPsuW : 0;
  const requiredPower = Math.max(cpuPowerTarget, gpuPowerTarget);
  const graphicsDescription = installedCpu
    ? installedCpu.specs.integratedGraphics === true ? "Gráfico integrado" : "GPU dedicada obrigatória"
    : "Gráficos definidos pelo processador";
  const psuDescription = installedPsu
    ? `${String(installedPsu.specs.formFactor ?? "fonte")} · ${String(installedPsu.specs.wattageW ?? "?")} W${requiredPower ? ` (recomendado ${Math.ceil(requiredPower)} W)` : ""}`
    : `Formatos de fonte: ${casePsuFormats}`;
  return (
    <svg aria-hidden="true" viewBox="0 0 900 640" className="absolute inset-0 h-full w-full" fill="none">
      <defs>
        <linearGradient id="case-metal" x1="100" y1="42" x2="710" y2="612" gradientUnits="userSpaceOnUse">
          <stop stopColor="#354f3e" />
          <stop offset="1" stopColor="#0e1711" />
        </linearGradient>
        <linearGradient id="glass" x1="164" y1="74" x2="650" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dbe9dc" stopOpacity=".14" />
          <stop offset="1" stopColor="#8eb49a" stopOpacity=".04" />
        </linearGradient>
        <linearGradient id="board" x1="250" y1="100" x2="610" y2="535" gradientUnits="userSpaceOnUse"><stop stopColor="#355f40" /><stop offset="1" stopColor="#183321" /></linearGradient>
      </defs>
      <path d="m129 40 535-13 43 34v526l-35 30H128l-29-31V70l30-30Z" fill="url(#case-metal)" stroke="#75937a" strokeWidth="5" />
      <path d="m150 68 486-13 29 21v482l-28 25H143l-20-25V94l27-26Z" fill="url(#glass)" stroke="#a0b7a2" strokeOpacity=".7" strokeWidth="3" />
      <path d="M127 104h23v452h-23m516-474h27v475h-27" stroke="#849b88" strokeOpacity=".65" strokeWidth="4" />
      <path d="M118 576h585" stroke="#829886" strokeWidth="4" /><path d="M207 614h62m305 0h62" stroke="#a0b39f" strokeWidth="9" strokeLinecap="round" />
      <circle cx="660" cy="116" r="27" stroke="#9ab39c" strokeOpacity=".7" strokeWidth="4" /><circle cx="660" cy="116" r="7" fill="#a8d77e" />
      <rect x="145" y="149" width="74" height="62" rx="7" fill="#14241a" stroke="#78947c" strokeWidth="3" /><circle cx="182" cy="180" r="23" stroke="#a0b6a2" strokeWidth="2" /><circle cx="182" cy="180" r="5" fill="#8da890" />
      <rect x="145" y="226" width="74" height="62" rx="7" fill="#14241a" stroke="#78947c" strokeWidth="3" /><circle cx="182" cy="257" r="23" stroke="#a0b6a2" strokeWidth="2" /><circle cx="182" cy="257" r="5" fill="#8da890" />
      <rect x="145" y="303" width="74" height="62" rx="7" fill="#14241a" stroke="#78947c" strokeWidth="3" /><circle cx="182" cy="334" r="23" stroke="#a0b6a2" strokeWidth="2" /><circle cx="182" cy="334" r="5" fill="#8da890" />
      <rect x="155" y="405" width="98" height="133" rx="8" fill="#18291e" stroke="#819b85" strokeWidth="3" />
      <text x="204" y="428" textAnchor="middle" fill="#b9cbb9" fontSize="10" fontWeight="700">FONTE</text>
      <rect x="164" y="440" width="80" height="86" rx="4" fill={installedPsu ? "#395a3d" : "#101a13"} stroke="#78947c" strokeWidth="2" />
      <circle cx="204" cy="483" r="29" stroke="#a0b6a2" strokeWidth="2" /><circle cx="204" cy="483" r="5" fill="#8da890" />
      <text x="204" y="516" textAnchor="middle" fill="#d9e7d9" fontSize="9">{installedPsu ? "INSTALADA" : "SLOT ATX / SFX"}</text>
      <rect x={boardX - 11} y={boardY - 11} width={boardSize.width + 22} height={boardSize.height + 22} rx="10" fill="#15271a" stroke={selectedSlot === "motherboard" ? "#b3ef81" : "#819b85"} strokeWidth="4" />
      <rect x={boardX} y={boardY} width={boardSize.width} height={boardSize.height} rx="7" fill="url(#board)" stroke="#a1c19d" strokeWidth="2" />
      <path d={`M${boardX + 15} ${boardY + 20}h${boardSize.width - 30}v${boardSize.height - 40}h-${boardSize.width - 30}z`} stroke="#8cab8e" strokeOpacity=".42" strokeWidth="2" />
      <circle cx={boardX + 12} cy={boardY + 12} r="4" fill="#c6d7c6" /><circle cx={boardX + boardSize.width - 12} cy={boardY + 12} r="4" fill="#c6d7c6" /><circle cx={boardX + 12} cy={boardY + boardSize.height - 12} r="4" fill="#c6d7c6" /><circle cx={boardX + boardSize.width - 12} cy={boardY + boardSize.height - 12} r="4" fill="#c6d7c6" />
      <rect x={boardX + boardSize.width * .28} y={boardY + boardSize.height * .17} width="84" height="76" rx="7" fill="#14241a" stroke="#b2c7b3" strokeWidth="3" />
      <rect x={boardX + boardSize.width * .28 + 10} y={boardY + boardSize.height * .17 + 10} width="64" height="56" rx="4" fill="#46604a" stroke="#8ba38e" strokeWidth="2" />
      <text x={boardX + boardSize.width * .28 + 42} y={boardY + boardSize.height * .17 + 43} textAnchor="middle" fill="#d7e5d7" fontSize="13" fontWeight="700">CPU</text>
      <circle cx={boardX + boardSize.width * .28 + 42} cy={boardY + boardSize.height * .17 + 38} r="48" stroke={installedCooler ? "#b3ef81" : "#8ca58f"} strokeOpacity=".78" strokeWidth="4" strokeDasharray={installedCooler ? undefined : "6 5"} />
      {installedCooler ? <text x={boardX + boardSize.width * .28 + 42} y={boardY + boardSize.height * .17 + 7} textAnchor="middle" fill="#d9e7d9" fontSize="7" fontWeight="700">COOLER</text> : null}
      {memorySlots.map((slot, index) => {
        const x = boardX + boardSize.width * .72 + index * 12;
        const top = boardY + boardSize.height * .13;
        const height = Math.min(170, boardSize.height * .47);
        const isInstalled = Boolean(installedBySlot[slot.slot]);
        return <g key={slot.slot}><rect x={x} y={top} width="8" height={height} rx="2" fill={isInstalled ? "#a8d77e" : "#8ca58f"} stroke="#d0e0d0" strokeWidth="1" /><path d={`M${x + 2} ${top + 12}v${height - 24}`} stroke="#273d2d" strokeWidth="2" /><circle cx={x + 4} cy={top + height + 7} r={selectedSlot === slot.slot ? 4 : 2} fill={selectedSlot === slot.slot ? "#b3ef81" : "#d0e0d0"} /></g>;
      })}
      {storageSlots.map((slot, index) => {
        const x = boardX + 28 + (index % 2) * (boardSize.width * .39);
        const y = boardY + boardSize.height * .39 + Math.floor(index / 2) * 17;
        const installed = Boolean(installedBySlot[slot.slot]);
        return <g key={slot.slot}><rect x={x} y={y} width={boardSize.width * .34} height="9" rx="3" fill={installed ? "#b3ef81" : "#16291c"} stroke={selectedSlot === slot.slot ? "#e2f8ca" : "#90ad93"} strokeWidth="1.5" /><text x={x + boardSize.width * .17} y={y + 7} textAnchor="middle" fill={installed ? "#16351d" : "#c5d7c6"} fontSize="6" fontWeight="700">{slot.interface?.toUpperCase()}</text></g>;
      })}
      {pcieSlots.map((slot, index) => {
        const x = boardX + 24;
        const y = boardY + boardSize.height * .63 + index * Math.min(21, boardSize.height * .055);
        const installed = Boolean(installedBySlot[slot.slot]);
        return <g key={slot.slot}><rect x={x} y={y} width={boardSize.width * .78} height="13" rx="3" fill={installed ? "#84c36b" : "#101c15"} stroke={selectedSlot === slot.slot ? "#e2f8ca" : "#93ae96"} strokeWidth="2" /><path d={`M${x + 12} ${y + 5}h${boardSize.width * .68}`} stroke={installed ? "#e5f8d5" : "#58755d"} strokeWidth="2" /><text x={x + boardSize.width * .42} y={y + 10} textAnchor="middle" fill={installed ? "#17351e" : "#d9e7d9"} fontSize="7" fontWeight="700">{installed ? "GPU INSTALADA" : `PCIe ${index + 1}`}</text></g>;
      })}
      {Array.from({ length: 4 }, (_, index) => <rect key={index} x={boardX + boardSize.width - 14} y={boardY + 70 + index * 17} width="12" height="7" rx="1" fill="#a4b8a5" />)}
      <text x="430" y="562" textAnchor="middle" fill="#d9e7d9" fontSize="14" fontWeight="700" letterSpacing="2">{motherboardFormFactor ?? "Selecione a placa-mãe"}</text>
      <text x="430" y="582" textAnchor="middle" fill="#a9bcaa" fontSize="10">{motherboardMemoryType ? `${motherboardMemoryType} · ${memorySlots.length} slots de memória · ${pcieSlots.length} slots PCIe` : "A placa-mãe define o tamanho e os encaixes visíveis"}</text>
      {installedCase ? <text x="430" y="601" textAnchor="middle" fill="#a8d77e" fontSize="9">GABINETE · {installedCase.description}</text> : null}
      {motherboardFormFactor ? <text x="430" y="617" textAnchor="middle" fill="#a9bcaa" fontSize="8">Placas aceitas: {caseBoardFormats} · {psuDescription}</text> : null}
      {installedCpu ? <text x="430" y="630" textAnchor="middle" fill="#b9cbb9" fontSize="8">{graphicsDescription}{installedGpu ? ` · GPU: ${installedGpu.description}` : ""}</text> : null}
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

export function BuildAssembly({ buildId, slots, optionsBySlot, installedBySlot, canEdit, motherboardHasM2, motherboardFormFactor, motherboardMemoryType, initialSlot }: Props) {
  const firstOpenSlot = slots.find((slot) => slot.selectable && !installedBySlot[slot.slot])?.slot;
  const [selectedSlot, setSelectedSlot] = useState(initialSlot && slots.some((slot) => slot.slot === initialSlot) ? initialSlot : firstOpenSlot ?? slots[0]?.slot ?? "motherboard");
  const activeSlot = slots.find((slot) => slot.slot === selectedSlot) ?? slots[0];
  const activePart = activeSlot ? installedBySlot[activeSlot.slot] : undefined;
  const options = activeSlot ? optionsBySlot[activeSlot.slot] ?? [] : [];
  const memorySlots = slots.filter((slot) => slot.slot.startsWith("ram-"));
  const [selectedOption, setSelectedOption] = useState("");
  const nextSlot = activeSlot
    ? (() => {
        const activeIndex = slots.findIndex((slot) => slot.slot === activeSlot.slot);
        const upcoming = [...slots.slice(activeIndex + 1), ...slots.slice(0, activeIndex)];
        return upcoming.find((slot) => slot.selectable && !installedBySlot[slot.slot])?.slot ?? activeSlot.slot;
      })()
    : "";
  const selectSlot = (slot: string) => {
    const target = slots.find((item) => item.slot === slot);
    if (!target || (!target.selectable && !installedBySlot[slot])) return;
    setSelectedSlot(slot);
    setSelectedOption("");
  };

  return (
    <section className="mt-7 overflow-hidden rounded-3xl border border-[#dce6d8] bg-white shadow-sm">
      <div className="border-b border-[#e7ede4] px-5 py-5 sm:px-7">
        <h2 className="text-xl font-semibold text-[#153b2a]">Montagem interativa</h2>
        <p className="mt-1 text-sm leading-6 text-[#718276]">Comece pela placa-mãe. Ela define o formato do gabinete e quantos encaixes de memória, armazenamento e PCIe aparecem.</p>
      </div>
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,.8fr)]">
        <div className="min-h-[540px] border-b border-[#e7ede4] bg-[#111a15] p-3 sm:p-6 lg:border-r lg:border-b-0">
          <div className="relative mx-auto aspect-[900/640] max-w-[1080px] overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_52%_48%,#26382d_0%,#141d17_62%,#0e1511_100%)]">
            <CaseIllustration slots={slots} selectedSlot={selectedSlot} motherboardFormFactor={motherboardFormFactor} motherboardMemoryType={motherboardMemoryType} installedBySlot={installedBySlot} />
            {slots.filter((slot) => ["motherboard", "cpu", "case", "psu", "cpu_cooler"].includes(slot.slot) && calloutPositions[slot.slot]).map((slot) => {
              const position = calloutPositions[slot.slot];
              const active = selectedSlot === slot.slot;
              const installed = installedBySlot[slot.slot];
              return (
                <button
                  key={slot.slot}
                  type="button"
                  onClick={() => selectSlot(slot.slot)}
                  disabled={!slot.selectable && !installed}
                  aria-label={`${slot.label}${installed ? `: ${installed.description}` : ": vazio"}`}
                  aria-pressed={active}
                  title={installed?.description ?? slot.label}
                  style={{ left: position.side === "left" ? "1%" : "82%", top: `${(position.labelY / 640) * 100}%`, width: position.side === "left" ? "21%" : "17%" }}
                  className={`absolute z-10 -translate-y-1/2 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-[9px] font-semibold leading-tight shadow-lg transition sm:px-2.5 sm:py-2 sm:text-xs disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-[#b3ef81] bg-[#315b3c] text-white ring-2 ring-[#8fcf58]/30" : installed ? "border-[#9cbe91] bg-[#1e3828]/95 text-[#edf6e9] hover:border-[#b3ef81]" : "border-white/30 bg-[#18251d]/95 text-[#d5e1d6] hover:border-[#a8d77e] hover:bg-[#294333]"}`}
                >
                  <span className="block truncate">{installed?.description ?? slot.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#a6b4a8]">
            <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-[#b3ef81]" />fio-guia do encaixe selecionado</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#b8e68e]" />peça instalada</span>
            {motherboardHasM2 ? <span>Slots M.2 desenhados conforme a placa-mãe selecionada</span> : null}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden p-5 sm:p-7">
          {memorySlots.length ? <div className="mb-5 border-b border-[#e7ede4] pb-5">
            <h3 className="text-xs font-semibold tracking-[.14em] text-[#718276] uppercase">Memórias</h3>
            <div className="mt-3 space-y-2">
              {memorySlots.map((slot) => {
                const installed = installedBySlot[slot.slot];
                return <button key={slot.slot} type="button" disabled={!slot.selectable && !installed} onClick={() => selectSlot(slot.slot)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${selectedSlot === slot.slot ? "border-[#8ab875] bg-[#f0f7eb]" : "border-[#e5ece1] bg-[#fbfcfa] hover:border-[#b7cdaa]"}`}>
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
              <div className="mt-4 min-w-0 overflow-hidden rounded-xl border border-[#dce6d8] bg-[#f7f9f5] p-4">
                <p className="text-xs font-semibold tracking-wide text-[#718276] uppercase">Peça instalada</p>
                <p className="mt-2 min-w-0 break-words font-semibold text-[#294333] [overflow-wrap:anywhere]">{activePart.description}</p>
                <p className="mt-1 text-xs text-[#718276]">Lote {activePart.lot || "sem identificação"} · {activePart.quantity} unidade reservada</p>
                <span className="mt-3 inline-flex rounded-full bg-[#e8f3e2] px-2.5 py-1 text-xs font-semibold text-[#315b3c]">{statusLabels[activePart.status] ?? statusLabels.unknown}</span>
                {canEdit ? <form action={releaseBuildComponent} className="mt-3">
                  <input type="hidden" name="buildId" value={buildId} />
                  <input type="hidden" name="buildComponentId" value={activePart.buildComponentId} />
                  <button type="submit" className="text-sm font-semibold text-[#8d493f] hover:underline">Remover peça deste encaixe</button>
                </form> : null}
              </div>
            ) : <p className="mt-2 text-sm leading-6 text-[#718276]">Nenhuma peça reservada neste encaixe.</p>}

            {canEdit && !activePart && !activeSlot.selectable ? <p role="status" className="mt-4 rounded-xl bg-[#f2f8ee] px-3 py-2 text-sm text-[#315b3c]">Selecione primeiro uma placa-mãe para liberar este encaixe.</p> : null}

            {canEdit && !activePart ? <form action={addBuildComponent} className="mt-5 space-y-4">
              <input type="hidden" name="buildId" value={buildId} />
              <input type="hidden" name="slotKey" value={activeSlot.slot} />
              <input type="hidden" name="nextSlot" value={nextSlot} />
              <label className="grid gap-2 text-sm font-semibold text-[#294333]">
                Peças disponíveis
                <select className="min-h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 text-sm font-normal" name="selection" required value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)}>
                  <option value="" disabled>{options.length ? "Selecione peça e lote" : "Nenhuma unidade disponível"}</option>
                  {options.map((option) => <option key={option.selection} value={option.selection}>{option.label}</option>)}
                </select>
              </label>
              <ReserveButton disabled={!selectedOption} />
            </form> : null}

            {activePart && !canEdit ? <p className="mt-4 text-xs text-[#718276]">A montagem está encerrada e não pode mais ser alterada.</p> : null}
          </> : <p className="text-sm text-[#718276]">Selecione um encaixe no desenho.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#e7ede4] bg-[#fbfcfa] px-5 py-4 sm:px-7">
        {slots.filter((slot) => !slot.slot.startsWith("ram-")).map((slot) => {
          const installed = installedBySlot[slot.slot];
          return <button key={slot.slot} type="button" disabled={!slot.selectable && !installed} onClick={() => selectSlot(slot.slot)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${selectedSlot === slot.slot ? "border-[#315b3c] bg-[#eaf1e4] text-[#315b3c]" : "border-[#dce6d8] bg-white text-[#718276]"}`}>
            {slot.label}{installed ? " ✓" : ""}
          </button>;
        })}
      </div>
    </section>
  );
}
