import Link from "next/link";

import { requestPasswordReset } from "./actions";

type Props = { searchParams: Promise<{ error?: string; status?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { error, status } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f2] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[#dce6d8] bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">
          Leaf Assemble
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">
          Recuperar senha
        </h1>
        <p className="mt-2 leading-7 text-[#647568]">
          Informe o e-mail da sua conta. Por segurança, não confirmamos se o endereço está cadastrado; confira também a pasta de spam.
        </p>

        {status === "sent" ? (
          <p role="status" className="mt-6 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm leading-6 text-[#315b3c]">
            Se houver uma conta ativa com esse e-mail, você receberá as instruções em instantes.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-6 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">
            {error === "send-failed"
              ? "Não foi possível enviar o e-mail agora. Confira a configuração de e-mail do Supabase e tente novamente."
              : error === "setup"
                ? "A conexão com o Supabase ainda não está configurada neste ambiente."
                : "Informe um e-mail válido."}
          </p>
        ) : null}

        <form action={requestPasswordReset} className="mt-7 space-y-5">
          <label className="block space-y-2 text-sm font-medium text-[#294333]">
            E-mail
            <input
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-[#d9e2d8] px-4 text-base outline-none focus:border-[#5da52f] focus:ring-4 focus:ring-[#5da52f]/10"
              name="email"
              required
              type="email"
            />
          </label>
          <button className="h-12 w-full rounded-xl bg-[#153b2a] font-semibold text-white hover:bg-[#205138]" type="submit">
            Enviar instruções
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link className="font-medium text-[#315b3c] hover:underline" href="/login">
            Voltar ao login
          </Link>
        </p>
      </section>
    </main>
  );
}
