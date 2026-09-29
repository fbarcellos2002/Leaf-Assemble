import { requireAdminProfile } from "@/lib/auth/profile";

import { createComponent } from "../actions";
import { ComponentForm } from "../component-form";

type Props = { searchParams: Promise<{ error?: string }> };

const errors: Record<string, string> = {
  "invalid-input": "Confira os campos obrigatórios e os valores informados.",
  "invalid-specs": "Revise as especificações técnicas. Valores numéricos precisam ser positivos e listas devem ser separadas por vírgula.",
  "save-failed": "Não foi possível salvar o componente. Verifique o banco e tente novamente.",
};

export default async function NewComponentPage({ searchParams }: Props) {
  await requireAdminProfile();
  const { error } = await searchParams;

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Inventário</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">Cadastrar componente</h1>
      <p className="mt-2 max-w-2xl leading-7 text-[#607266]">
        Registre os dados conhecidos. A compatibilidade tratará informações ausentes como desconhecidas, sem presumir que a peça funciona.
      </p>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">{errors[error] ?? "Não foi possível cadastrar o componente."}</p> : null}
      <section className="mt-7 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <ComponentForm action={createComponent} />
      </section>
    </div>
  );
}
