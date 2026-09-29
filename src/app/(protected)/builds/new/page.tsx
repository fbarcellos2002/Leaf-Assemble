import Link from "next/link";

import { createBuild } from "../actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewBuildPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/builds" className="text-sm font-medium text-[#4b7b3b] hover:underline">← Voltar para Montar</Link>
      <p className="mt-6 text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Computadores</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">Criar computador</h1>
      <p className="mt-2 leading-7 text-[#607266]">Crie um rascunho. Você poderá reservar componentes conforme preenche os slots.</p>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Informe um nome válido e tente novamente.</p> : null}
      <form action={createBuild} className="mt-7 space-y-5 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <label className="grid gap-2 text-sm font-medium text-[#294333]">
          Nome do computador
          <input className="h-12 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="name" maxLength={100} required placeholder="Ex.: PC para edição de vídeo" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#294333]">
          Observações
          <textarea rows={1} className="w-full rounded-xl border border-[#d9e2d8] px-3 py-2 font-normal" name="notes" maxLength={1000} />
        </label>
        <button className="h-12 rounded-xl bg-[#153b2a] px-6 font-semibold text-white hover:bg-[#205138]" type="submit">Criar rascunho</button>
      </form>
    </div>
  );
}
