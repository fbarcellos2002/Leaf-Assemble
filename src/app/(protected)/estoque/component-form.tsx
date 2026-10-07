"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";

import {
  socketChoicesByManufacturer as defaultSocketChoices,
  componentCategories,
  type ComponentCategory,
  getProcessorGeneration,
  manufacturerChoices,
  specChoices,
  specFields,
  storageInterfaceRequiresSsd,
} from "@/lib/inventory/specs";
import { generateComponentDescription } from "@/lib/inventory/description";

type FormState = { error: "invalid-input" | "invalid-specs" | "save-failed" | null };
type SocketOptions = { Intel: readonly string[]; AMD: readonly string[] };
type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  socketChoicesByManufacturer?: SocketOptions;
};

const categoryLabels: Record<ComponentCategory, string> = {
  CPU: "Processador",
  MOTHERBOARD: "Placa-mãe",
  RAM: "Memória RAM",
  GPU: "Placa de vídeo (GPU)",
  STORAGE: "Armazenamento",
  PSU: "Fonte de alimentação",
  CASE: "Gabinete",
  CPU_COOLER: "Cooler do processador",
};

export function ComponentForm({ action, socketChoicesByManufacturer = defaultSocketChoices }: Props) {
  const [formState, formAction, isPending] = useActionState(action, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<ComponentCategory>("CPU");
  const [specValues, setSpecValues] = useState<Record<string, string>>({ integratedGraphics: "false", activePfc: "false" });
  const [manufacturer, setManufacturer] = useState("");
  const [socketPlatform, setSocketPlatform] = useState<"Intel" | "AMD" | "">("");
  const [model, setModel] = useState("");
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [lotNoInformation, setLotNoInformation] = useState(false);
  const [lotNotes, setLotNotes] = useState("");
  const [showLotDetails, setShowLotDetails] = useState(false);

  function updateSpecValue(key: string, value: string) {
    setSpecValues((current) => ({ ...current, [key]: value }));
    setInvalidFields((current) => {
      const next = new Set(current);
      next.delete(`spec_${key}`);
      return next;
    });
  }

  function updateManufacturer(value: string) {
    setManufacturer(value);
    setInvalidFields((current) => {
      const next = new Set(current);
      next.delete("manufacturer");
      return next;
    });
    if (category === "CPU") {
      setSpecValues((current) => ({ ...current, socket: "", generation: "" }));
    }
  }

  function missingRequiredFields() {
    const requiredNames = [
      "manufacturer",
      ...(category === "PSU" || category === "CASE" || category === "CPU_COOLER" ? [] : ["model"]),
      "quantity",
      ...(category === "RAM" && !lotNoInformation ? ["lotCode"] : []),
      ...specFields[category].filter((field) => isSpecFieldRequired(field)).map((field) => `spec_${field.key}`),
    ];
    return requiredNames.filter((name) => {
      if (name === "manufacturer") return !manufacturer.trim();
      if (name === "model") return category !== "MOTHERBOARD" && category !== "RAM" && category !== "STORAGE" && category !== "PSU" && category !== "CASE" && category !== "CPU_COOLER" && !model.trim();
      if (name === "quantity") return quantity.trim() === "" || !Number.isInteger(Number(quantity)) || Number(quantity) < 0;
      if (name === "lotCode") return !lotCode.trim();
      const field = specFields[category].find((item) => `spec_${item.key}` === name);
      const value = specValues[field?.key ?? ""]?.trim() ?? "";
      if (field?.type === "boolean") return value !== "true" && value !== "false";
      if (field?.type === "text-list") return value.split(",").map((item) => item.trim()).filter(Boolean).length === 0;
      if (field?.type === "number") return !value || !Number.isFinite(Number(value)) || Number(value) < (field.min ?? 0) || (field.key === "maxMemoryGb" && !Number.isInteger(Number(value)));
      if (field?.type === "number-list") return value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0).length === 0;
      return !value;
    });
  }

  function isSpecFieldRequired(field: (typeof specFields)[ComponentCategory][number]) {
    if (category !== "CPU_COOLER") return Boolean(field.required);
    if (field.key === "socketBase") return true;
    if (field.key === "socketAdapter") return specValues.socketBase !== "Genérico";
    if (field.key === "adapterSockets") return specValues.socketBase !== "Genérico" && specValues.socketAdapter === "true";
    return Boolean(field.required);
  }

  function storageInterfaceMax(option: string) {
    return option.startsWith("M.2") ? 7 : option.startsWith("PCIe") ? 7 : 12;
  }

  function showRequiredError(name: string) {
    return invalidFields.has(name) ? <span className="text-xs font-semibold text-[#b42318]">Item obrigatório</span> : null;
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
  const generatedDescription = generateComponentDescription(category, manufacturer, model, previewSpecs);
  const allSocketChoices = [...socketChoicesByManufacturer.Intel, ...socketChoicesByManufacturer.AMD];

  function renderSpecField(field: (typeof specFields)[ComponentCategory][number]) {
    const value = specValues[field.key] ?? "";
    const options = specChoices[category]?.[field.key];
    const listField = field.type === "text-list" || field.type === "number-list";
    const placeholder = field.hint;
    const invalid = isSpecFieldRequired(field) && invalidFields.has(`spec_${field.key}`);
    const inputClass = `h-12 w-full rounded-xl border bg-white px-3 font-normal ${invalid ? "border-[#b42318] ring-1 ring-[#b42318]" : "border-[#d9e2d8]"}`;
    if (category === "STORAGE" && field.key === "interface") {
      return (
        <select className={inputClass} name="spec_interface" aria-label={field.label} value={value} required onChange={(event) => {
          updateSpecValue("interface", event.target.value);
          if (storageInterfaceRequiresSsd(event.target.value)) updateSpecValue("type", "SSD");
        }}>
          <option value="">Selecione a interface</option>
          {(specChoices.STORAGE?.interface ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }
    if (category === "STORAGE" && field.key === "type") {
      const lockedToSsd = storageInterfaceRequiresSsd(specValues.interface ?? "");
      return (
        <>
          {lockedToSsd ? <input type="hidden" name="spec_type" value="SSD" /> : null}
          <select
            className={inputClass}
            name={lockedToSsd ? undefined : "spec_type"}
            aria-label={field.label}
            value={lockedToSsd ? "SSD" : value}
            required
            disabled={lockedToSsd}
            onChange={(event) => updateSpecValue("type", event.target.value)}
          >
            <option value="">Selecione o tipo</option>
            {(specChoices.STORAGE?.type ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </>
      );
    }
    if (category === "STORAGE" && field.key === "capacityGb") {
      return (
        <select className={inputClass} name="spec_capacityGb" aria-label={field.label} value={value} required onChange={(event) => updateSpecValue("capacityGb", event.target.value)}>
          <option value="">Selecione a capacidade</option>
          {(specChoices.STORAGE?.capacityGb ?? []).map((option) => <option key={option} value={option}>{option} GB</option>)}
        </select>
      );
    }
    if ((category === "CPU" && field.key === "integratedGraphics") || (category === "PSU" && field.key === "activePfc")) {
      const checked = value === "true";
      return (
        <>
          <input type="hidden" name={`spec_${field.key}`} value={checked ? "true" : value === "false" ? "false" : ""} />
          <label className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 font-normal ${invalid ? "border-[#b42318] ring-1 ring-[#b42318]" : "border-[#d9e2d8]"}`}>
            <input
              type="checkbox"
              className="size-4 accent-[#315b3c]"
              checked={checked}
              onChange={(event) => updateSpecValue(field.key, event.target.checked ? "true" : "false")}
            />
            <span>{category === "CPU" ? "Possui gráficos integrados" : "Possui PFC ativo"}</span>
          </label>
        </>
      );
    }
    if (category === "RAM" && field.key === "ecc") {
      const checked = value === "true";
      return (
        <>
          <input type="hidden" name="spec_ecc" value={checked ? "true" : "false"} />
          <label className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 font-normal ${invalid ? "border-[#b42318] ring-1 ring-[#b42318]" : "border-[#d9e2d8]"}`}>
            <input
              type="checkbox"
              className="size-4 accent-[#315b3c]"
              checked={checked}
              onChange={(event) => updateSpecValue(field.key, event.target.checked ? "true" : "false")}
            />
            <span>Possui ECC</span>
          </label>
        </>
      );
    }
    if (field.type === "boolean") {
      return (
        <select className={inputClass} name={`spec_${field.key}`} aria-label={field.label} value={value} onChange={(event) => updateSpecValue(field.key, event.target.value)}>
          <option value="">Não informado</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      );
    }

    if (category === "CPU" && field.key === "socket") {
      const options = manufacturer === "Intel"
        ? socketChoicesByManufacturer.Intel
        : manufacturer === "AMD" ? socketChoicesByManufacturer.AMD : [];
      return (
        <select className={inputClass} name={`spec_${field.key}`} aria-label={field.label} value={value} disabled={!options.length} required={field.required} onChange={(event) => {
          updateSpecValue(field.key, event.target.value);
          if (category === "CPU") updateSpecValue("generation", getProcessorGeneration(manufacturer, event.target.value) ?? "");
        }}>
          <option value="">{options.length ? "Selecione o socket" : "Selecione Intel ou AMD primeiro"}</option>
          {options.map((socket) => <option key={socket} value={socket}>{socket}</option>)}
        </select>
      );
    }

    if (category === "MOTHERBOARD" && field.key === "socket") {
      const sockets = socketPlatform ? socketChoicesByManufacturer[socketPlatform] : [];
      return (
        <div className="grid grid-cols-1 gap-2">
          <select
            className={`h-12 w-full rounded-xl border bg-white px-3 font-normal ${invalid ? "border-[#b42318] ring-1 ring-[#b42318]" : "border-[#d9e2d8]"}`}
            aria-label="Plataforma do socket"
            value={socketPlatform}
            onChange={(event) => {
              const nextPlatform = event.target.value as "Intel" | "AMD" | "";
              setSocketPlatform(nextPlatform);
              updateSpecValue("socket", "");
            }}
          >
            <option value="">Selecione Intel ou AMD</option>
            <option value="Intel">Intel (LGA)</option>
            <option value="AMD">AMD (AM)</option>
          </select>
          <select className={inputClass} name="spec_socket" aria-label="Socket da placa-mãe" value={value} disabled={!sockets.length} required={field.required} onChange={(event) => updateSpecValue("socket", event.target.value)}>
            <option value="">{sockets.length ? "Selecione o socket" : "Selecione Intel ou AMD primeiro"}</option>
            {sockets.map((socket) => <option key={socket} value={socket}>{socket}</option>)}
          </select>
        </div>
      );
    }

    if (category === "MOTHERBOARD" && field.key === "storageInterfaces") {
      const selected = value.split(",").map((item) => item.trim()).filter(Boolean);
      const interfaces = specChoices.MOTHERBOARD?.storageInterfaces ?? [];
      return (
        <>
          <input type="hidden" name="spec_storageInterfaces" value={selected.join(", ")} />
          <div role="group" aria-label={field.label} className={`grid gap-2 rounded-xl border p-3 ${invalid ? "border-[#b42318] ring-1 ring-[#b42318]" : "border-[#d9e2d8]"}`}>
            {interfaces.map((option) => {
              const checked = selected.includes(option);
              const countKey = `storageInterfaceCount:${option}`;
              return (
                <div key={option} className="flex min-h-10 items-center gap-3 text-sm font-normal text-[#44594b]">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-[#315b3c]"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                        updateSpecValue(field.key, next.join(", "));
                        if (!event.target.checked) updateSpecValue(countKey, "");
                        else if (!specValues[countKey]) updateSpecValue(countKey, "1");
                      }}
                    />
                    <span>{option}</span>
                  </label>
                  {checked ? (
                    <>
                      <span className="text-xs text-[#718276]">Quantidade</span>
                      <select
                        className="h-9 w-20 rounded-lg border border-[#d9e2d8] bg-white px-2"
                        aria-label={`Quantidade de ${option}`}
                        name={`spec_storageInterfaceCount_${interfaces.indexOf(option)}`}
                        value={specValues[countKey] ?? "1"}
                        required
                        onChange={(event) => updateSpecValue(countKey, event.target.value)}
                      >
                        {Array.from({ length: storageInterfaceMax(option) }, (_, index) => String(index + 1)).map((count) => <option key={count} value={count}>{count}</option>)}
                      </select>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      );
    }

    if (category === "CPU_COOLER" && field.key === "socketBase") {
      return (
        <select className={inputClass} name="spec_socketBase" aria-label={field.label} value={value} required onChange={(event) => {
          const nextBase = event.target.value;
          updateSpecValue("socketBase", nextBase);
          if (nextBase === "Genérico") {
            updateSpecValue("socketAdapter", "");
            updateSpecValue("adapterSockets", "");
          } else if (specValues.socketBase === "Genérico") {
            updateSpecValue("socketAdapter", "");
          }
          if (nextBase && nextBase !== "Genérico") {
            const adapterSockets = specValues.adapterSockets?.split(",").map((socket) => socket.trim()).filter((socket) => socket && socket !== nextBase) ?? [];
            updateSpecValue("adapterSockets", adapterSockets.join(", "));
          }
        }}>
          <option value="">Selecione o socket base</option>
          <option value="Genérico">Genérico</option>
          {allSocketChoices.map((socket) => <option key={socket} value={socket}>{socket}</option>)}
        </select>
      );
    }

    if (category === "CPU_COOLER" && field.key === "socketAdapter") {
      const generic = specValues.socketBase === "Genérico";
      return (
        <select className={inputClass} name={generic ? undefined : "spec_socketAdapter"} aria-label={field.label} value={generic ? "" : value} disabled={generic} required={!generic} onChange={(event) => {
          updateSpecValue("socketAdapter", event.target.value);
          if (event.target.value !== "true") updateSpecValue("adapterSockets", "");
        }}>
          <option value="">{generic ? "Não se aplica a cooler genérico" : "Selecione sim ou não"}</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      );
    }

    if (category === "CPU_COOLER" && field.key === "adapterSockets") {
      const selected = value.split(",").map((item) => item.trim()).filter(Boolean);
      const base = specValues.socketBase;
      return (
        <>
          <input type="hidden" name="spec_adapterSockets" value={selected.join(", ")} />
          <div role="group" aria-label={field.label} className={`grid grid-cols-1 gap-2 rounded-xl border p-3 ${invalid ? "border-[#b42318] ring-1 ring-[#b42318]" : "border-[#d9e2d8]"}`}>
            {allSocketChoices.filter((socket) => socket !== base).map((socket) => (
              <label key={socket} className="flex items-center gap-2 text-sm font-normal text-[#44594b]">
                <input type="checkbox" className="size-4 shrink-0 accent-[#315b3c]" checked={selected.includes(socket)} onChange={(event) => {
                  const next = event.target.checked ? [...selected, socket] : selected.filter((item) => item !== socket);
                  updateSpecValue("adapterSockets", next.join(", "));
                }} />
                <span>{socket}</span>
              </label>
            ))}
          </div>
        </>
      );
    }

    if (category === "CPU_COOLER" && field.key === "coolerType") {
      return (
        <select className={inputClass} name="spec_coolerType" aria-label={field.label} value={value} required onChange={(event) => updateSpecValue(field.key, event.target.value)}>
          <option value="">Selecione o tipo</option>
          {(options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }

    if (category === "MOTHERBOARD" && field.key === "supportedMemoryFrequenciesMhz") {
      const selectedValue = value.split(",").map((item) => item.trim()).filter(Boolean)[0] ?? "";
      return (
        <>
          <input type="hidden" name={`spec_${field.key}`} value={selectedValue} />
          <select className={inputClass} aria-label={field.label} value={selectedValue} required={field.required} onChange={(event) => updateSpecValue(field.key, event.target.value)}>
            <option value="">Selecione uma frequência</option>
            {(options ?? []).map((option) => <option key={option} value={option}>{option} {field.unit}</option>)}
          </select>
        </>
      );
    }

    if (options?.length && listField) {
      const selected = value.split(",").map((item) => item.trim()).filter(Boolean);
      return (
        <>
          <input type="hidden" name={`spec_${field.key}`} value={selected.join(", ")} />
          <div role="group" aria-label={field.label} className={`grid grid-cols-1 gap-2 rounded-xl border p-3 ${invalid ? "border-[#b42318] ring-1 ring-[#b42318]" : "border-[#d9e2d8]"}`}>
            {options.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm font-normal text-[#44594b]">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[#315b3c]"
                  checked={selected.includes(option)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selected, option]
                      : selected.filter((item) => item !== option);
                    updateSpecValue(field.key, next.join(", "));
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </>
      );
    }

    if (options?.length && category === "MOTHERBOARD") {
      return (
        <select className={inputClass} name={`spec_${field.key}`} aria-label={field.label} value={value} required={field.required} onChange={(event) => updateSpecValue(field.key, event.target.value)}>
          <option value="">Selecione uma opção</option>
          {options.map((option) => <option key={option} value={option}>{option}{field.unit ? ` ${field.unit}` : ""}</option>)}
        </select>
      );
    }

    if (options?.length && category === "RAM") {
      return (
        <select className={inputClass} name={`spec_${field.key}`} aria-label={field.label} value={value} required={field.required} onChange={(event) => updateSpecValue(field.key, event.target.value)}>
          <option value="">Selecione uma opção</option>
          {options.map((option) => <option key={option} value={option}>{option}{field.unit ? ` ${field.unit}` : ""}</option>)}
        </select>
      );
    }

    if (options?.length && (category === "GPU" || category === "PSU")) {
      return (
        <select className={inputClass} name={`spec_${field.key}`} aria-label={field.label} value={value} required={field.required} onChange={(event) => updateSpecValue(field.key, event.target.value)}>
          <option value="">Selecione uma opção</option>
          {options.map((option) => <option key={option} value={option}>{option}{field.unit ? ` ${field.unit}` : field.key === "vramGb" ? " GB" : ""}</option>)}
        </select>
      );
    }

    const datalistId = `options-${category}-${field.key}`;
    return (
      <>
        <input
          className={inputClass}
          name={`spec_${field.key}`}
          aria-label={field.label}
          type={field.type === "number" ? "number" : "text"}
          min={field.type === "number" ? String(field.min ?? 0) : undefined}
          step={field.type === "number" ? field.key === "maxMemoryGb" ? "1" : "any" : undefined}
          required={field.required}
          readOnly={category === "CPU" && field.key === "generation"}
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
    <form
      ref={formRef}
      action={formAction}
      className="mt-7 space-y-5"
      noValidate
      onSubmit={(event) => {
        const missing = missingRequiredFields();
        if (!missing.length) {
          setInvalidFields(new Set());
          return;
        }
        event.preventDefault();
        setInvalidFields(new Set(missing));
        window.requestAnimationFrame(() => {
          const firstInvalid = [...(formRef.current?.querySelectorAll<HTMLElement>("[data-required-field]") ?? [])]
            .find((element) => element.dataset.requiredField === missing[0]);
          firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
          firstInvalid?.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea, button")?.focus({ preventScroll: true });
        });
      }}
    >
      {formState.error ? (
        <p role="alert" className="rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">
          {formState.error === "invalid-input"
            ? "Confira os campos obrigatórios e os valores informados. Os dados preenchidos foram mantidos."
            : formState.error === "invalid-specs"
              ? "Revise as especificações técnicas. Os dados preenchidos foram mantidos."
              : "Não foi possível cadastrar a peça. Os dados preenchidos foram mantidos; tente novamente."}
        </p>
      ) : null}
      <div className="max-w-xl">
        <label className="grid gap-2 text-sm font-semibold text-[#294333]" htmlFor="component-category">
          Categoria
          <select
            id="component-category"
            className="h-12 rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal"
            name="category"
            onChange={(event) => {
              const nextCategory = event.target.value as ComponentCategory;
              setCategory(nextCategory);
              setSpecValues(nextCategory === "CPU" ? { integratedGraphics: "false" } : nextCategory === "PSU" ? { activePfc: "false" } : {});
              setManufacturer("");
              setSocketPlatform("");
              setModel("");
              setQuantity("");
              setLotCode("");
              setLotNoInformation(false);
              setLotNotes("");
              setShowLotDetails(false);
              setInvalidFields(new Set());
            }}
            value={category}
          >
            {componentCategories.map((item) => (
              <option key={item} value={item}>{categoryLabels[item]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-8 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <section>
          <h2 className="text-lg font-semibold text-[#153b2a]">Identificação</h2>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div data-required-field="manufacturer" className={`grid gap-2 rounded-xl text-sm font-medium text-[#294333] ${invalidFields.has("manufacturer") ? "border border-[#b42318] p-3" : ""}`}>
              <label htmlFor="component-manufacturer">Fabricante</label>
              {manufacturerChoices[category] ? (
                <select
                  id="component-manufacturer"
                  className={`h-12 w-full rounded-xl border bg-white px-3 font-normal ${invalidFields.has("manufacturer") ? "border-[#b42318]" : "border-[#d9e2d8]"}`}
                  name="manufacturer"
                  required
                  value={manufacturer}
                  onChange={(event) => updateManufacturer(event.target.value)}
                >
                  <option value="">Selecione o fabricante</option>
                  {manufacturerChoices[category]?.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              ) : <input
                id="component-manufacturer"
                className={`h-12 w-full rounded-xl border px-3 font-normal ${invalidFields.has("manufacturer") ? "border-[#b42318]" : "border-[#d9e2d8]"}`}
                name="manufacturer"
                required
                maxLength={100}
                autoComplete="off"
                placeholder="Fabricante"
                value={manufacturer}
                onChange={(event) => updateManufacturer(event.target.value)}
              />}
              {showRequiredError("manufacturer")}
            </div>
            {category !== "RAM" && category !== "STORAGE" && category !== "PSU" && category !== "CPU_COOLER" ? <div data-required-field="model" className={`grid gap-2 rounded-xl text-sm font-medium text-[#294333] ${invalidFields.has("model") ? "border border-[#b42318] p-3" : ""}`}>
              <label htmlFor="component-model">Modelo</label>
              <input
                id="component-model"
                className={`h-12 w-full rounded-xl border px-3 font-normal ${invalidFields.has("model") ? "border-[#b42318]" : "border-[#d9e2d8]"}`}
                name="model"
                required={category !== "MOTHERBOARD" && category !== "CASE"}
                aria-invalid={invalidFields.has("model")}
                maxLength={140}
                autoComplete="off"
                placeholder={category === "CPU" ? manufacturer === "AMD" ? "Ex.: Ryzen 5 5600" : "Ex.: i3-9100F" : category === "GPU" ? "Ex.: GeForce RTX 4060" : "Ex.: modelo do componente"}
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setInvalidFields((current) => {
                    const next = new Set(current);
                    next.delete("model");
                    return next;
                  });
                }}
              />
              {category === "CPU" && manufacturer === "Intel" ? <a className="w-fit text-xs font-medium text-[#426d35] underline underline-offset-2" href="https://www.intel.com/content/www/us/en/ark.html" rel="noreferrer" target="_blank">Consultar processadores no Intel ARK</a> : null}
              {category === "CPU" && manufacturer === "AMD" ? <a className="w-fit text-xs font-medium text-[#426d35] underline underline-offset-2" href="https://www.amd.com/en/products/specifications/processors.html" rel="noreferrer" target="_blank">Consultar lista oficial de processadores AMD</a> : null}
              {category !== "MOTHERBOARD" && category !== "CASE" ? showRequiredError("model") : null}
            </div> : null}
          </div>
        </section>

      <section>
        <div>
          <h2 className="text-lg font-semibold text-[#153b2a]">Especificações técnicas</h2>
          <p className="mt-1 text-sm leading-6 text-[#718276]">
            {category === "CPU"
              ? "Preencha os dados conhecidos. A geração é preenchida automaticamente de acordo com o socket."
              : "Preencha manualmente o que souber. Use as opções padronizadas ou informe um valor personalizado quando necessário."}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {specFields[category].filter((field) => category !== "CPU_COOLER" || field.key !== "adapterSockets" || specValues.socketBase !== "Genérico" && specValues.socketAdapter === "true").map((field) => {
            const required = isSpecFieldRequired(field);
            return (
            <div
              key={field.key}
              data-required-field={required ? `spec_${field.key}` : undefined}
              className={`grid gap-2 text-sm font-medium text-[#294333] ${required && invalidFields.has(`spec_${field.key}`) ? "rounded-xl border border-[#b42318] p-3" : ""}`}
            >
              <p>{field.label}{field.unit ? ` (${field.unit})` : ""} {required ? showRequiredError(`spec_${field.key}`) : null}</p>
              {renderSpecField(field)}
              {field.hint && field.type === "boolean" ? <span className="text-xs font-normal text-[#7b897f]">{field.hint}</span> : null}
            </div>
            );
          })}
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
        <p className="mt-1 text-sm leading-6 text-[#718276]">Informe quantas unidades existem.{category === "RAM" ? " Informe o lote ou marque Sem Informação." : category !== "CPU" && category !== "MOTHERBOARD" && category !== "GPU" && category !== "STORAGE" && category !== "PSU" && category !== "CASE" && category !== "CPU_COOLER" ? " O código de lote é opcional." : ""}</p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div data-required-field="quantity" className={`grid gap-2 rounded-xl text-sm font-medium text-[#294333] ${invalidFields.has("quantity") ? "border border-[#b42318] p-3" : ""}`}>
            <label htmlFor="component-quantity">Quantidade</label>
            <input id="component-quantity" className={`h-12 w-full rounded-xl border px-3 font-normal ${invalidFields.has("quantity") ? "border-[#b42318]" : "border-[#d9e2d8]"}`} name="quantity" type="number" min="0" max="100000" step="1" value={quantity} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => {
              setQuantity(event.target.value);
              setInvalidFields((current) => {
                const next = new Set(current);
                next.delete("quantity");
                return next;
              });
            }} required />
            {showRequiredError("quantity")}
          </div>
          {category === "RAM" ? (
            <div data-required-field="lotCode" className={`grid gap-3 rounded-xl text-sm font-medium text-[#294333] ${invalidFields.has("lotCode") ? "border border-[#b42318] p-3" : ""}`}>
              <label htmlFor="component-lot-code">Lote</label>
              <input type="hidden" name="lotNoInformation" value={lotNoInformation ? "true" : "false"} />
              {lotNoInformation ? (
                <input type="hidden" name="lotCode" value="Sem Informação" />
              ) : (
                <input
                  id="component-lot-code"
                  className={`h-12 w-full rounded-xl border px-3 font-normal ${invalidFields.has("lotCode") ? "border-[#b42318]" : "border-[#d9e2d8]"}`}
                  name="lotCode"
                  maxLength={80}
                  value={lotCode}
                  required
                  onChange={(event) => {
                    setLotCode(event.target.value);
                    setInvalidFields((current) => {
                      const next = new Set(current);
                      next.delete("lotCode");
                      return next;
                    });
                  }}
                />
              )}
              <label className="flex items-center gap-2 text-sm font-normal text-[#44594b]">
                <input type="checkbox" className="size-4 accent-[#315b3c]" checked={lotNoInformation} onChange={(event) => {
                  setLotNoInformation(event.target.checked);
                  setInvalidFields((current) => {
                    const next = new Set(current);
                    next.delete("lotCode");
                    return next;
                  });
                }} />
                Sem Informação
              </label>
              {showRequiredError("lotCode")}
            </div>
          ) : null}
          {category !== "CPU" && category !== "MOTHERBOARD" && category !== "RAM" && category !== "GPU" && category !== "STORAGE" && category !== "PSU" && category !== "CASE" && category !== "CPU_COOLER" ? (
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
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-[#e7ede4] pt-6">
        <button className="h-12 rounded-xl bg-[#153b2a] px-6 font-semibold text-white hover:bg-[#205138] disabled:opacity-60" type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Cadastrar componente"}</button>
        <Link className="flex h-12 items-center rounded-xl border border-[#d9e2d8] px-5 font-medium text-[#315b3c] hover:bg-[#f5f7f2]" href="/estoque">Cancelar</Link>
      </div>
      </div>
    </form>
  );
}
