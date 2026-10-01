import Image from "next/image";

import { signIn } from "./actions";
import { ClearSessionActivity } from "./clear-session-activity";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const messages: Record<string, string> = {
  credentials: "E-mail ou senha inválidos. Confira os dados e tente novamente.",
  "invalid-input": "Informe um e-mail válido e a sua senha.",
  setup: "A conexão com o Supabase ainda não foi configurada neste ambiente.",
  inactive: "Esta conta está inativa. Peça ajuda a um administrador.",
  "session-timeout": "Você foi desconectado após 30 minutos sem atividade.",
  "session-closed": "Sua sessão foi encerrada porque a página foi fechada. Entre novamente.",
  forbidden: "Seu perfil não tem permissão para acessar essa área.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="relative isolate flex min-h-screen min-h-svh items-center justify-center bg-[#eef5e9] px-4 py-8 sm:px-6">
      <ClearSessionActivity />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-28 size-72 rounded-full bg-[#d7e9cc] opacity-70 blur-3xl sm:size-96" />
        <div className="absolute -bottom-36 -right-24 size-80 rounded-full bg-[#dcebd5] opacity-80 blur-3xl sm:size-[28rem]" />
      </div>

      <section className="w-full max-w-md rounded-[1.75rem] border border-[#d7e6cf] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,59,42,0.4)] sm:p-9">
        <header className="text-center">
          <div className="mx-auto size-14 overflow-hidden rounded-2xl bg-[#edf5e8] shadow-sm ring-1 ring-[#dce9d4] sm:size-16">
            <Image
              src="/brand/leaf-assemble-icon.jpg"
              alt="Leaf Assemble"
              width={64}
              height={64}
              priority
              className="size-full object-cover"
            />
          </div>
          <p className="mt-4 text-sm font-semibold tracking-[0.12em] text-[#4b7b3b] uppercase">
            Leaf Assemble
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#153b2a] sm:text-3xl">
            Entrar na sua conta
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#647568] sm:text-base">
            Acesse com seu e-mail e sua senha.
          </p>
        </header>

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-[#efcfca] bg-[#fff5f3] px-4 py-3 text-left text-sm leading-6 text-[#8d3c32]"
          >
            {messages[error] ?? "Não foi possível entrar. Tente novamente."}
          </p>
        ) : null}

        <LoginForm action={signIn} />
      </section>
    </main>
  );
}
