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

type Point = { x: number; y: number; width?: number };

const statusLabels: Record<string, string> = {
  compatible: "Compatível",
  warning: "Alerta",
  incompatible: "Incompatível",
  unknown: "Dados insuficientes",
};

const boardDimensions: Record<string, { width: number; height: number }> = {
  "XL-ATX": { width: 390, height: 414 },
  "E-ATX": { width: 370, height: 400 },
  ATX: { width: 350, height: 380 },
  "m-ATX": { width: 310, height: 340 },
  "Mini-DTX": { width: 280, height: 315 },
  "Mini-ITX": { width: 258, height: 290 },
};

function getBoardGeometry(formFactor?: string) {
  const size = boardDimensions[formFactor ?? "ATX"] ?? boardDimensions.ATX;
  return { ...size, x: 457 - size.width / 2, y: 115 + (380 - size.height) * 0.28 };
}

function getSlotPoint(slot: AssemblySlot, slots: AssemblySlot[], formFactor?: string): Point {
  const board = getBoardGeometry(formFactor);
  const slotIndex = Number(slot.slot.match(/-(\d+)$/)?.[1] ?? 1) - 1;
  if (slot.slot === "motherboard") return { x: board.x + 6, y: board.y + 8, width: 150 };
  if (slot.slot === "cpu") return { x: board.x + board.width * 0.28, y: board.y + board.height * 0.22, width: 95 };
  if (slot.slot === "cpu_cooler") return { x: board.x + board.width * 0.28, y: board.y + board.height * 0.32, width: 108 };
  if (slot.slot.startsWith("ram-")) return { x: board.x + board.width * 0.69 + slotIndex * 18, y: board.y + board.height * 0.18, width: 78 };
  if (slot.slot.startsWith("gpu-")) return { x: board.x + board.width * 0.2, y: board.y + board.height * 0.69 + slotIndex * 20, width: 100 };
  if (slot.category === "STORAGE") {
    const sata = (slot.interface ?? "").toLocaleLowerCase("pt-BR").includes("sata");
    const similarSlots = slots.filter((candidate) => candidate.category === "STORAGE" && ((candidate.interface ?? "").toLocaleLowerCase("pt-BR").includes("sata") === sata));
    const index = Math.max(0, similarSlots.findIndex((candidate) => candidate.slot === slot.slot));
    return sata
      ? { x: board.x + board.width * 0.75, y: board.y + board.height * 0.57 + index * 19, width: 80 }
      : { x: board.x + board.width * 0.37, y: board.y + board.height * 0.43 + index * 23, width: 96 };
  }
  if (slot.slot === "psu") return { x: 128, y: 491, width: 116 };
  if (slot.slot === "case") return { x: 753, y: 554, width: 112 };
  return { x: 756, y: 96, width: 110 };
}

function ReserveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="h-11 w-full rounded-xl bg-[#ed6a32] px-4 font-semibold text-white shadow-sm transition hover:bg-[#d95a26] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={disabled || pending}>
      {pending ? "Reservando…" : "Reservar componente"}
    </button>
  );
}

function Fan({ x, y, radius, active = false }: { x: number; y: number; radius: number; active?: boolean }) {
  const blade = active ? "#8de0e8" : "#61758b";
  return (
    <g>
      <circle cx={x} cy={y} r={radius} fill="#111925" stroke={active ? "#62d4df" : "#718196"} strokeWidth="4" />
      <circle cx={x} cy={y} r={radius - 7} fill="#182435" stroke="#35465a" strokeWidth="2" />
      {Array.from({ length: 7 }, (_, index) => <path key={index} d={`M${x} ${y - 4} C${x + radius * .48} ${y - radius * .56}, ${x + radius * .72} ${y - radius * .12}, ${x + radius * .48} ${y + 1} Q${x + 10} ${y + 5} ${x} ${y - 4}`} fill={blade} opacity={index % 2 ? ".68" : ".42"} transform={`rotate(${index * 51.4} ${x} ${y})`} />)}
      <circle cx={x} cy={y} r="7" fill="#bac8d8" />
      <circle cx={x} cy={y} r="3" fill="#ed6a32" />
    </g>
  );
}

function CaseIllustration({
  slots,
  selectedSlot,
  motherboardFormFactor,
  motherboardMemoryType,
  installedBySlot,
  onSelect,
}: Pick<Props, "slots" | "motherboardFormFactor" | "motherboardMemoryType"> & {
  selectedSlot: string;
  installedBySlot: Record<string, InstalledPart>;
  onSelect: (slot: string) => void;
}) {
  const board = getBoardGeometry(motherboardFormFactor);
  const memorySlots = slots.filter((slot) => slot.slot.startsWith("ram-"));
  const pcieSlots = slots.filter((slot) => slot.slot.startsWith("gpu-"));
  const storageSlots = slots.filter((slot) => slot.category === "STORAGE");
  const m2Slots = storageSlots.filter((slot) => !((slot.interface ?? "").toLocaleLowerCase("pt-BR").includes("sata")));
  const sataSlots = storageSlots.filter((slot) => (slot.interface ?? "").toLocaleLowerCase("pt-BR").includes("sata"));
  const installedCase = installedBySlot.case;
  const installedPsu = installedBySlot.psu;
  const installedCooler = installedBySlot.cpu_cooler;
  const installedGpu = Object.entries(installedBySlot).some(([key, part]) => key.startsWith("gpu-") && part.category === "GPU");
  const installedRamCount = memorySlots.filter((slot) => installedBySlot[slot.slot]).length;
  const caseBoardFormats = Array.isArray(installedCase?.specs.formFactorSupport) ? installedCase.specs.formFactorSupport.join(" · ") : "Gabinete não selecionado";
  const casePsuFormats = Array.isArray(installedCase?.specs.psuFormFactors) ? installedCase.specs.psuFormFactors.join(" · ") : "—";
  const overlaySlots: AssemblySlot[] = slots.filter((slot) => slot.selectable || installedBySlot[slot.slot]);
  const isInstalled = (slot: AssemblySlot) => Boolean(installedBySlot[slot.slot]);
  const labelFor = (slot: AssemblySlot) => {
    if (slot.slot.startsWith("gpu-")) return `PCIe ${slot.slot.split("-")[1]}`;
    if (slot.category === "STORAGE") {
      const index = Number(slot.slot.split("-")[1]);
      const family = (slot.interface ?? "").toLocaleLowerCase("pt-BR").includes("sata") ? "SATA" : "M.2";
      return `${family} ${index}`;
    }
    if (slot.slot.startsWith("ram-")) return `RAM ${slot.slot.split("-")[1]}`;
    return slot.slot === "cpu_cooler" ? "Cooler" : slot.label;
  };

  return (
    <div className="relative aspect-[900/640] w-full overflow-hidden rounded-[1.5rem] border border-[#435065] bg-[radial-gradient(ellipse_at_48%_44%,#314157_0%,#1b2534_58%,#111822_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_24px_50px_rgba(3,8,18,.38)]">
      <svg aria-hidden="true" viewBox="0 0 900 640" className="absolute inset-0 h-full w-full" fill="none">
        <defs>
          <linearGradient id="chassis" x1="97" y1="44" x2="790" y2="605" gradientUnits="userSpaceOnUse"><stop stopColor="#8997a8" /><stop offset=".18" stopColor="#364457" /><stop offset="1" stopColor="#151d28" /></linearGradient>
          <linearGradient id="tempered-glass" x1="160" y1="58" x2="720" y2="548" gradientUnits="userSpaceOnUse"><stop stopColor="#b9e8ef" stopOpacity=".2" /><stop offset=".42" stopColor="#59748d" stopOpacity=".12" /><stop offset="1" stopColor="#0e1723" stopOpacity=".54" /></linearGradient>
          <linearGradient id="motherboard-pcb" x1={board.x} y1={board.y} x2={board.x + board.width} y2={board.y + board.height} gradientUnits="userSpaceOnUse"><stop stopColor="#35475b" /><stop offset="1" stopColor="#1d2938" /></linearGradient>
          <linearGradient id="gpu-metal" x1="300" y1="400" x2="680" y2="510" gradientUnits="userSpaceOnUse"><stop stopColor="#a8b4c2" /><stop offset=".5" stopColor="#55677b" /><stop offset="1" stopColor="#2a3544" /></linearGradient>
          <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="13" floodColor="#030811" floodOpacity=".55" /></filter>
        </defs>

        {/* Case shell, tinted glass, front intake and lower PSU chamber */}
        <path d="M112 43 740 35 807 83v470l-50 53H123l-44-43V88l33-45Z" fill="url(#chassis)" stroke="#bbc6d3" strokeOpacity=".72" strokeWidth="5" filter="url(#soft-shadow)" />
        <path d="m138 70 584-7 38 27v414l-39 45H143l-33-35V102l28-32Z" fill="url(#tempered-glass)" stroke="#d0dae4" strokeOpacity=".66" strokeWidth="3" />
        <path d="M113 502h642v45l-45 42H125l-40-39v-48Z" fill="#121923" fillOpacity=".9" stroke="#647388" strokeWidth="3" />
        <path d="M82 88h28v411H82m679-408h46v414h-46" stroke="#aebac8" strokeOpacity=".48" strokeWidth="5" />
        <path d="M163 601h90m392 0h90" stroke="#9aa9ba" strokeWidth="12" strokeLinecap="round" />
        <path d="M130 75h580" stroke="#edf5fb" strokeOpacity=".55" strokeWidth="3" />
        <circle cx="766" cy="91" r="5" fill="#e5edf4" /><circle cx="766" cy="117" r="5" fill="#ed6a32" />
        <text x="784" y="99" fill="#e6edf5" fontSize="11" fontWeight="700" letterSpacing="1.4">AIRFLOW</text>

        {/* Front fans and rear fan */}
        <Fan x={785} y={203} radius={45} active />
        <Fan x={785} y={316} radius={45} active />
        <Fan x={785} y={429} radius={45} active />
        <Fan x={159} y={139} radius={34} />

        {/* Motherboard, with dimensions driven by selected form factor */}
        <rect x={board.x - 12} y={board.y - 12} width={board.width + 24} height={board.height + 24} rx="13" fill="#182330" stroke={selectedSlot === "motherboard" ? "#f39a58" : "#8797a9"} strokeWidth={selectedSlot === "motherboard" ? "5" : "3"} />
        <rect x={board.x} y={board.y} width={board.width} height={board.height} rx="9" fill="url(#motherboard-pcb)" stroke="#8397ad" strokeWidth="2" />
        <path d={`M${board.x + 16} ${board.y + 22}h${board.width - 32}v${board.height - 44}h-${board.width - 32}z`} stroke="#9bacbf" strokeOpacity=".24" strokeWidth="2" />
        {[[board.x + 13, board.y + 13], [board.x + board.width - 13, board.y + 13], [board.x + 13, board.y + board.height - 13], [board.x + board.width - 13, board.y + board.height - 13]].map(([x, y], index) => <circle key={index} cx={x} cy={y} r="5" fill="#d0d9e3" stroke="#4b5c70" strokeWidth="2" />)}

        {/* Rear I/O and VRM heatsinks */}
        <rect x={board.x - 2} y={board.y + 28} width="31" height={board.height * .33} rx="4" fill="#18212c" stroke="#8a9caf" strokeWidth="2" />
        {Array.from({ length: 5 }, (_, index) => <path key={index} d={`M${board.x + 4} ${board.y + 42 + index * 18}h18`} stroke="#d5a36e" strokeWidth="4" strokeLinecap="round" />)}
        <rect x={board.x + board.width * .23} y={board.y + 26} width={board.width * .42} height="27" rx="5" fill="#526477" stroke="#9babbc" strokeWidth="2" />
        <path d={`M${board.x + board.width * .25} ${board.y + 34}h${board.width * .38}`} stroke="#d5a36e" strokeOpacity=".75" strokeWidth="3" strokeDasharray="6 5" />

        {/* CPU socket and cooler */}
        <rect x={board.x + board.width * .25} y={board.y + board.height * .18} width={board.width * .32} height={board.height * .26} rx="9" fill="#131c27" stroke="#a6b6c6" strokeWidth="3" />
        <rect x={board.x + board.width * .25 + 12} y={board.y + board.height * .18 + 12} width={board.width * .32 - 24} height={board.height * .26 - 24} rx="5" fill="#64778c" stroke="#d0dae3" strokeWidth="2" />
        <text x={board.x + board.width * .41} y={board.y + board.height * .325} textAnchor="middle" fill="#f1f5f9" fontSize="13" fontWeight="800" letterSpacing="2">CPU</text>
        {installedCooler ? <g>
          <circle cx={board.x + board.width * .41} cy={board.y + board.height * .31} r={Math.min(board.width, board.height) * .14} fill="#1c2938" stroke="#61d2df" strokeWidth="6" />
          <circle cx={board.x + board.width * .41} cy={board.y + board.height * .31} r={Math.min(board.width, board.height) * .105} fill="#283c50" stroke="#97aabd" strokeWidth="2" />
          <circle cx={board.x + board.width * .41} cy={board.y + board.height * .31} r="8" fill="#ed6a32" />
          <text x={board.x + board.width * .41} y={board.y + board.height * .31 + 4} textAnchor="middle" fill="#10202e" fontSize="5" fontWeight="900">FAN</text>
        </g> : <rect x={board.x + board.width * .25} y={board.y + board.height * .18} width={board.width * .32} height={board.height * .26} rx="9" fill="none" stroke="#f39a58" strokeWidth="3" strokeDasharray="9 7" />}

        {/* DIMM sockets and installed memory sticks */}
        {memorySlots.map((slot, index) => {
          const x = board.x + board.width * .69 + index * 17;
          const y = board.y + board.height * .18;
          const height = board.height * .48;
          const installed = Boolean(installedBySlot[slot.slot]);
          return <g key={slot.slot}>
            <rect x={x} y={y} width="12" height={height} rx="3" fill={installed ? "#47c5d3" : "#101823"} stroke={selectedSlot === slot.slot ? "#f39a58" : "#a5b3c1"} strokeWidth={selectedSlot === slot.slot ? "3" : "2"} />
            <path d={`M${x + 3} ${y + 12}v${height - 24}`} stroke={installed ? "#baf9f7" : "#43556a"} strokeWidth="3" />
            {installed ? <path d={`M${x + 3} ${y + 8}h6`} stroke="#f5c169" strokeWidth="3" /> : null}
          </g>;
        })}

        {/* M.2 / NVMe sockets in the center of the board */}
        {m2Slots.map((slot, index) => {
          const x = board.x + board.width * .35;
          const y = board.y + board.height * .48 + index * 22;
          const installed = Boolean(installedBySlot[slot.slot]);
          return <g key={slot.slot}>
            <rect x={x} y={y} width={board.width * .36} height="13" rx="4" fill={installed ? "#d5a36e" : "#121b26"} stroke={selectedSlot === slot.slot ? "#f39a58" : "#94a5b8"} strokeWidth={selectedSlot === slot.slot ? "3" : "2"} />
            <circle cx={x + board.width * .36 - 8} cy={y + 6.5} r="3" fill="#d8e0e9" />
            <text x={x + board.width * .18} y={y + 9} textAnchor="middle" fill={installed ? "#14202c" : "#dce6ef"} fontSize="7" fontWeight="800">M.2 · NVMe</text>
          </g>;
        })}

        {/* SATA ports along the lower-right edge of the board */}
        {sataSlots.map((slot, index) => {
          const x = board.x + board.width * .8;
          const y = board.y + board.height * .55 + index * 19;
          const installed = Boolean(installedBySlot[slot.slot]);
          return <g key={slot.slot}>
            <path d={`M${x} ${y}h22v12h-22z`} fill={installed ? "#f2a64a" : "#5e748a"} stroke={selectedSlot === slot.slot ? "#f39a58" : "#cad4df"} strokeWidth={selectedSlot === slot.slot ? "3" : "1.5"} />
            <path d={`M${x + 5} ${y + 4}h12v4H${x + 5}`} stroke="#172332" strokeWidth="2" />
          </g>;
        })}

        {/* PCIe slots and installed graphics card */}
        {pcieSlots.map((slot, index) => {
          const x = board.x + board.width * .1;
          const y = board.y + board.height * .7 + index * 19;
          const installed = Boolean(installedBySlot[slot.slot]);
          return <g key={slot.slot}>
            <rect x={x} y={y} width={board.width * .72} height="13" rx="3" fill={installed ? "url(#gpu-metal)" : "#111a26"} stroke={selectedSlot === slot.slot ? "#f39a58" : "#a7b5c3"} strokeWidth={selectedSlot === slot.slot ? "3" : "1.5"} />
            <path d={`M${x + 14} ${y + 5}h${board.width * .62}`} stroke={installed ? "#dce5ef" : "#53677c"} strokeWidth="2" />
            {installed ? <><circle cx={x + board.width * .33} cy={y + 6.5} r="4" fill="#61d2df" /><circle cx={x + board.width * .55} cy={y + 6.5} r="4" fill="#61d2df" /></> : null}
          </g>;
        })}
        {installedGpu ? <g>
          <rect x={board.x + 25} y={board.y + board.height * .71 - 4} width={board.width * .7} height="56" rx="8" fill="url(#gpu-metal)" stroke="#dbe4ec" strokeWidth="3" />
          <rect x={board.x + 43} y={board.y + board.height * .71 + 7} width={board.width * .7 - 36} height="34" rx="5" fill="#283748" stroke="#8193a7" strokeWidth="1.5" />
          <circle cx={board.x + board.width * .36} cy={board.y + board.height * .71 + 24} r="12" fill="#182434" stroke="#61d2df" strokeWidth="3" />
          <circle cx={board.x + board.width * .58} cy={board.y + board.height * .71 + 24} r="12" fill="#182434" stroke="#61d2df" strokeWidth="3" />
          <text x={board.x + board.width * .48} y={board.y + board.height * .71 + 28} textAnchor="middle" fill="#f1f5f9" fontSize="7" fontWeight="800">GRAPHICS CARD</text>
        </g> : null}

        {/* Drive cage, power supply, case detail and board labels */}
        <rect x="140" y="279" width="81" height="133" rx="7" fill="#1c2938" stroke="#8798aa" strokeWidth="2" />
        <text x="180" y="297" textAnchor="middle" fill="#c7d2de" fontSize="8" fontWeight="800" letterSpacing="1">DRIVE CAGE</text>
        {[0, 1].map((index) => <g key={index}><rect x="151" y={309 + index * 45} width="58" height="34" rx="4" fill="#2a394b" stroke="#8192a5" /><path d={`M159 ${326 + index * 45}h42`} stroke="#d5a36e" strokeWidth="2" /><circle cx="199" cy={316 + index * 45} r="2" fill="#dfe7ef" /></g>)}
        <rect x="132" y="514" width="148" height="56" rx="9" fill={installedPsu ? "#33495f" : "#202c3a"} stroke={selectedSlot === "psu" ? "#f39a58" : "#8595a6"} strokeWidth="3" />
        <circle cx="166" cy="542" r="20" fill="#172230" stroke="#71859a" strokeWidth="2" /><circle cx="166" cy="542" r="5" fill="#ed6a32" />
        <text x="215" y="538" textAnchor="middle" fill="#edf2f7" fontSize="9" fontWeight="800">{installedPsu ? `${String(installedPsu.specs.wattageW ?? "?")} W PSU` : "PSU BAY"}</text>
        <text x="215" y="554" textAnchor="middle" fill="#b2c0ce" fontSize="7">{installedPsu ? String(installedPsu.specs.formFactor ?? "") : casePsuFormats}</text>
        <text x="470" y="569" textAnchor="middle" fill="#e3ebf3" fontSize="12" fontWeight="800" letterSpacing="2">{motherboardFormFactor ?? "MOTHERBOARD SLOT"}</text>
        <text x="470" y="586" textAnchor="middle" fill="#aebdcb" fontSize="9">{motherboardMemoryType ? `${motherboardMemoryType} · ${installedRamCount}/${memorySlots.length} DIMMs · ${pcieSlots.length} PCIe` : "A placa define tamanho e encaixes"}</text>
        <text x="470" y="621" textAnchor="middle" fill="#b7c4d1" fontSize="9">{installedCase ? installedCase.description : "CASE SLOT"} · {caseBoardFormats}</text>
        <text x="470" y="638" textAnchor="middle" fill="#d5a36e" fontSize="8">{installedCooler ? "AIR / LIQUID COOLER INSTALLED" : "CPU COOLER POSITION"} · {storageSlots.length} STORAGE BAYS</text>
      </svg>

      {/* Click targets sit directly over each physical slot; every available slot gets one */}
      {overlaySlots.map((slot) => {
        const point = getSlotPoint(slot, slots, motherboardFormFactor);
        const installed = isInstalled(slot);
        const selected = selectedSlot === slot.slot;
        const label = labelFor(slot);
        return <button
          key={slot.slot}
          type="button"
          onClick={() => onSelect(slot.slot)}
          disabled={!slot.selectable && !installed}
          aria-label={`${slot.label}${installed ? `: ${installedBySlot[slot.slot].description}` : ": vazio"}`}
          aria-pressed={selected}
          title={installedBySlot[slot.slot]?.description ?? slot.label}
          style={{ left: `${point.x / 900 * 100}%`, top: `${point.y / 640 * 100}%`, width: `${(point.width ?? 90) / 900 * 100}%` }}
          className={`absolute z-10 -translate-y-1/2 truncate rounded-md border px-1.5 py-1 text-center text-[7px] font-extrabold leading-none shadow-lg transition sm:px-2 sm:py-1.5 sm:text-[10px] ${selected ? "border-white bg-[#ed6a32] text-white ring-2 ring-[#f9c18b]/70" : installed ? "border-[#8fe0e7] bg-[#137b8a]/95 text-white hover:bg-[#1593a1]" : "border-[#b7c6d6] bg-[#202c3d]/95 text-[#f1f5f9] hover:border-[#f4a16b] hover:bg-[#36485e]"} disabled:cursor-not-allowed disabled:opacity-45`}
        >
          {installed ? `✓ ${label}` : `+ ${label}`}
        </button>;
      })}
      <div className="absolute left-[3%] top-[4%] rounded-full border border-white/20 bg-[#101722]/75 px-2.5 py-1 text-[8px] font-bold tracking-[.14em] text-white/90 backdrop-blur sm:text-[10px]">
        GLASS SIDE VIEW
      </div>
      <div className="absolute right-[3%] top-[4%] rounded-full border border-[#61d2df]/50 bg-[#101722]/80 px-2.5 py-1 text-[8px] font-bold text-[#a8f2f5] backdrop-blur sm:text-[10px]">
        {slots.filter((slot) => slot.selectable).length} SLOTS ACTIVE
      </div>
    </div>
  );
}

export function BuildAssembly({ buildId, slots, optionsBySlot, installedBySlot, canEdit, motherboardHasM2, motherboardFormFactor, motherboardMemoryType, initialSlot }: Props) {
  const firstOpenSlot = slots.find((slot) => slot.selectable && !installedBySlot[slot.slot])?.slot;
  const [selectedSlot, setSelectedSlot] = useState(initialSlot && slots.some((slot) => slot.slot === initialSlot) ? initialSlot : firstOpenSlot ?? slots[0]?.slot ?? "motherboard");
  const [selectedOption, setSelectedOption] = useState("");
  const activeSlot = slots.find((slot) => slot.slot === selectedSlot) ?? slots[0];
  const activePart = activeSlot ? installedBySlot[activeSlot.slot] : undefined;
  const options = activeSlot ? optionsBySlot[activeSlot.slot] ?? [] : [];
  const selectedComponents = slots.filter((slot) => !slot.slot.startsWith("ram-"));
  const memorySlots = slots.filter((slot) => slot.slot.startsWith("ram-"));
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

  const groupedSlots = [
    { title: "Placa e processador", slots: slots.filter((slot) => ["motherboard", "cpu", "cpu_cooler"].includes(slot.slot)) },
    { title: "Memória", slots: memorySlots },
    { title: "Armazenamento", slots: slots.filter((slot) => slot.category === "STORAGE") },
    { title: "Expansão PCIe", slots: slots.filter((slot) => slot.slot.startsWith("gpu-")) },
    { title: "Gabinete e energia", slots: slots.filter((slot) => ["case", "psu"].includes(slot.slot)) },
  ].filter((group) => group.slots.length > 0);

  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#d5dce5] bg-white shadow-[0_16px_42px_rgba(22,34,51,.12)]">
      <div className="flex flex-col justify-between gap-4 border-b border-[#e5eaf0] bg-[linear-gradient(110deg,#f7f9fc,#edf2f7)] px-5 py-5 sm:flex-row sm:items-center sm:px-7">
        <div>
          <p className="text-[11px] font-extrabold tracking-[.18em] text-[#d65c2b] uppercase">Workbench · interactive</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[#192638] sm:text-2xl">Montagem interativa</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#657286]">A vista lateral mostra o gabinete e os encaixes reais liberados pela placa-mãe. Clique em um marcador para escolher a peça.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-[#dff7f8] px-3 py-1.5 text-[#0e6672]">● Instalado</span>
          <span className="rounded-full bg-[#fff0e7] px-3 py-1.5 text-[#a94720]">＋ Livre</span>
          <span className="rounded-full bg-[#eef2f6] px-3 py-1.5 text-[#647286]">Cinza: bloqueado</span>
        </div>
      </div>

      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,.72fr)]">
        <div className="min-w-0 border-b border-[#e5eaf0] bg-[#172130] p-3 sm:p-6 xl:border-r xl:border-b-0">
          <CaseIllustration
            slots={slots}
            selectedSlot={selectedSlot}
            motherboardFormFactor={motherboardFormFactor}
            motherboardMemoryType={motherboardMemoryType}
            installedBySlot={installedBySlot}
            onSelect={selectSlot}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#b9c5d2]">
            <span>{motherboardFormFactor ? `Placa ${motherboardFormFactor} · ${motherboardMemoryType ?? "memória não informada"}` : "Selecione a placa-mãe para exibir os encaixes"}</span>
            <span>{motherboardHasM2 ? "M.2 habilitado" : "Encaixes definidos pelo inventário"}</span>
          </div>
        </div>

        <div className="min-w-0 p-5 sm:p-7">
          <h3 className="text-sm font-extrabold tracking-[.12em] text-[#667489] uppercase">Slots do sistema</h3>
          <div className="mt-3 space-y-4">
            {groupedSlots.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-bold text-[#435166]">{group.title}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {group.slots.map((slot) => {
                    const installed = installedBySlot[slot.slot];
                    const selected = selectedSlot === slot.slot;
                    return <button
                      key={slot.slot}
                      type="button"
                      disabled={!slot.selectable && !installed}
                      onClick={() => selectSlot(slot.slot)}
                      className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-[#e87742] bg-[#fff3eb] ring-2 ring-[#f8b48f]/45" : installed ? "border-[#92dce2] bg-[#eefbfc] hover:border-[#52bdc7]" : "border-[#dbe2ea] bg-[#fbfcfe] hover:border-[#a4b4c6]"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-[#263448]">{slot.label}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${installed ? "bg-[#d8f4f5] text-[#116976]" : slot.selectable ? "bg-[#fff0e7] text-[#a94720]" : "bg-[#e7ebef] text-[#758194]"}`}>
                          {installed ? "INSTALADO" : slot.selectable ? "LIVRE" : "BLOQUEADO"}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[#778396]">{installed?.description ?? (slot.selectable ? "Clique para selecionar peça e lote" : "Aguardando placa-mãe / plataforma")}</span>
                    </button>;
                  })}
                </div>
              </div>
            ))}
          </div>

          {activeSlot ? <div className="mt-5 rounded-2xl border border-[#dbe2ea] bg-[#f7f9fc] p-4 sm:p-5">
            <p className="text-[10px] font-extrabold tracking-[.16em] text-[#d65c2b] uppercase">Encaixe selecionado</p>
            <h3 className="mt-1 break-words text-lg font-bold text-[#192638]">{activeSlot.label}</h3>
            {activePart ? (
              <div className="mt-3 rounded-xl border border-[#c8e9eb] bg-white p-3">
                <p className="text-[10px] font-extrabold tracking-wide text-[#708095] uppercase">Peça instalada</p>
                <p className="mt-1 break-words text-sm font-bold text-[#263448] [overflow-wrap:anywhere]">{activePart.description}</p>
                <p className="mt-1 text-[10px] text-[#778396]">Lote {activePart.lot || "sem identificação"} · {activePart.quantity} unidade reservada</p>
                <span className="mt-2 inline-flex rounded-full bg-[#e7f5f6] px-2.5 py-1 text-[10px] font-bold text-[#116976]">{statusLabels[activePart.status] ?? statusLabels.unknown}</span>
                {canEdit ? <form action={releaseBuildComponent} className="mt-3">
                  <input type="hidden" name="buildId" value={buildId} />
                  <input type="hidden" name="buildComponentId" value={activePart.buildComponentId} />
                  <button type="submit" className="text-xs font-bold text-[#b84732] hover:underline">Remover peça deste encaixe</button>
                </form> : <p className="mt-3 text-[10px] text-[#778396]">Montagem encerrada · somente visualização</p>}
              </div>
            ) : <>
              {!activeSlot.selectable ? <p role="status" className="mt-2 text-xs leading-5 text-[#7a8799]">Selecione primeiro uma placa-mãe e os componentes necessários para liberar este encaixe.</p> : null}
              {canEdit && activeSlot.selectable ? <form action={addBuildComponent} className="mt-3 space-y-3">
                <input type="hidden" name="buildId" value={buildId} />
                <input type="hidden" name="slotKey" value={activeSlot.slot} />
                <input type="hidden" name="nextSlot" value={nextSlot} />
                <label className="grid gap-1.5 text-xs font-bold text-[#3e4c61]">
                  Peças disponíveis
                  <select className="min-h-11 min-w-0 rounded-xl border border-[#ccd5e0] bg-white px-3 text-xs font-normal" name="selection" required value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)}>
                    <option value="" disabled>{options.length ? "Selecione peça e lote" : "Nenhuma unidade disponível"}</option>
                    {options.map((option) => <option key={option.selection} value={option.selection}>{option.label}</option>)}
                  </select>
                </label>
                <ReserveButton disabled={!selectedOption} />
              </form> : null}
            </>}
          </div> : <p className="mt-5 rounded-xl bg-[#f4f6f9] p-4 text-xs text-[#718096]">Selecione um slot no desenho ou na lista.</p>}
        </div>
      </div>

      {selectedComponents.length ? <div className="border-t border-[#e5eaf0] bg-[#f7f9fc] px-4 py-3 sm:px-6">
        <p className="mb-2 text-[10px] font-extrabold tracking-[.14em] text-[#667489] uppercase">Todos os slots · toque para selecionar</p>
        <div className="flex flex-wrap gap-2">
          {selectedComponents.map((slot) => {
            const installed = installedBySlot[slot.slot];
            const selected = selectedSlot === slot.slot;
            return <button key={slot.slot} type="button" disabled={!slot.selectable && !installed} onClick={() => selectSlot(slot.slot)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-[#ed6a32] bg-[#ed6a32] text-white" : installed ? "border-[#83d7de] bg-[#e6f9fa] text-[#116976]" : "border-[#d4dce6] bg-white text-[#657286] hover:border-[#9baabd]"}`}>
              {installed ? "✓ " : "＋ "}{slot.label}
            </button>;
          })}
        </div>
      </div> : null}
    </section>
  );
}
