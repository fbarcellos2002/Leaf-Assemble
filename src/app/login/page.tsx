import Image from "next/image";

import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const messages: Record<string, string> = {
  credentials: "E-mail ou senha inválidos. Confira os dados e tente novamente.",
  "invalid-input": "Informe um e-mail válido e a sua senha.",
  setup: "A conexão com o Supabase ainda não foi configurada neste ambiente.",
  inactive: "Esta conta está inativa. Peça ajuda a um administrador.",
  forbidden: "Seu perfil não tem permissão para acessar essa área.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen bg-[#f5f7f2] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#153b2a] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-40 top-20 size-[34rem] rounded-full border border-white/10" />
        <div className="absolute -right-20 top-40 size-[24rem] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="size-12 overflow-hidden rounded-2xl bg-white">
            <Image
              src="/brand/leaf-assemble-icon.jpg"
              alt=""
              width={48}
              height={48}
              priority
              className="size-full object-cover"
            />
          </div>
          <span className="text-lg font-semibold tracking-tight">Leaf Assemble</span>
        </div>
        <div className="relative max-w-xl pb-12">
          <p className="text-sm font-semibold tracking-[0.18em] text-[#a7d77e] uppercase">
            Montagem inteligente
          </p>
          <h1 className="mt-5 text-5xl leading-[1.05] font-semibold tracking-[-0.05em] xl:text-6xl">
            Cada peça conta. Cada montagem também.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">
            Acompanhe componentes reais, confira compatibilidades e planeje
            builds com segurança em um só lugar.
          </p>
        </div>
        <p className="relative text-sm text-white/50">Leaf Assemble · Controle de estoque e builds</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="size-11 overflow-hidden rounded-2xl bg-white shadow-sm">
              <Image
                src="/brand/leaf-assemble-icon.jpg"
                alt=""
                width={44}
                height={44}
                priority
                className="size-full object-cover"
              />
            </div>
            <span className="text-lg font-semibold text-[#153b2a]">Leaf Assemble</span>
          </div>

          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-[#5da52f] uppercase">
              Acesso seguro
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">
              Entre na sua conta
            </h2>
            <p className="mt-2 leading-7 text-[#647568]">
              Use o e-mail e a senha fornecidos pelo administrador.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-[#efcfca] bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#8d3c32]"
            >
              {messages[error] ?? "Não foi possível entrar. Tente novamente."}
            </p>
          ) : null}

          <form action={signIn} className="mt-8 space-y-5">
            <label className="block space-y-2 text-sm font-medium text-[#294333]">
              E-mail
              <input
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-[#d9e2d8] bg-white px-4 text-base text-[#16271e] outline-none transition placeholder:text-[#9aa79c] focus:border-[#5da52f] focus:ring-4 focus:ring-[#5da52f]/10"
                name="email"
                placeholder="voce@exemplo.com"
                required
                type="email"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-[#294333]">
              Senha
              <input
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-[#d9e2d8] bg-white px-4 text-base text-[#16271e] outline-none transition placeholder:text-[#9aa79c] focus:border-[#5da52f] focus:ring-4 focus:ring-[#5da52f]/10"
                name="password"
                placeholder="Sua senha"
                required
                type="password"
              />
            </label>
            <button
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#153b2a] px-5 font-semibold text-white shadow-sm transition hover:bg-[#205138] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5da52f]"
              type="submit"
            >
              Entrar
            </button>
          </form>

          <p className="mt-6 text-center text-sm leading-6 text-[#78867b]">
            A criação de contas é feita por um administrador do sistema.
          </p>
          <p className="mt-3 text-center text-sm">
            <a className="font-medium text-[#315b3c] underline-offset-4 hover:underline" href="/forgot-password">
              Esqueci minha senha
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
