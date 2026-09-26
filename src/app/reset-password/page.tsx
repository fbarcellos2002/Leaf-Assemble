import Link from "next/link";

import { updatePassword } from "./actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f2] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[#dce6d8] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Leaf Assemble</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">Defina uma nova senha</h1>
        {error ? (
          <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#8d3c32]">
            {error === "invalid-password" ? "Use pelo menos 12 caracteres." : "Não foi possível atualizar a senha. Solicite um novo link."}
          </p>
        ) : null}
        <form action={updatePassword} className="mt-7 space-y-5">
          <label className="block space-y-2 text-sm font-medium text-[#294333]">
            Nova senha
            <input
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-[#d9e2d8] px-4 text-base outline-none focus:border-[#5da52f] focus:ring-4 focus:ring-[#5da52f]/10"
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="h-12 w-full rounded-xl bg-[#153b2a] font-semibold text-white hover:bg-[#205138]" type="submit">
            Salvar nova senha
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link className="font-medium text-[#315b3c] hover:underline" href="/login">Voltar ao login</Link>
        </p>
      </section>
    </main>
  );
}
