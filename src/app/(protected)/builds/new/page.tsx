import Link from "next/link";

import { WorkstationForm } from "./new-build-form";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewBuildPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/builds" className="text-sm font-medium text-[#4b7b3b] hover:underline">← Voltar para Montar</Link>
      <p className="mt-6 text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Computadores</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">Iniciar Nova Montagem</h1>
      <p className="mt-2 leading-7 text-[#607266]">Dê um nome à workstation e depois escolha os componentes disponíveis no estoque.</p>
      {error === "name-taken" ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Já existe uma montagem com esse nome. Escolha outro nome.</p> : null}
      {error && error !== "name-taken" ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Informe um nome válido e, se marcar observações, preencha a descrição.</p> : null}
      <WorkstationForm />
    </div>
  );
}
