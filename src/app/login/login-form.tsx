"use client";

type Props = { action: (formData: FormData) => Promise<void> };

export function LoginForm({ action }: Props) {
  return (
    <form
      action={action}
      className="mt-7 space-y-5"
      onSubmit={() => window.sessionStorage.setItem("leaf-assemble:tab-session", "active")}
    >
      <label className="block space-y-2 text-left text-sm font-medium text-[#294333]">
        E-mail
        <input autoComplete="email" className="h-12 w-full min-w-0 rounded-xl border border-[#d4e0d0] bg-white px-4 text-base text-[#16271e] outline-none transition placeholder:text-[#9aa79c] focus:border-[#5da52f] focus:ring-4 focus:ring-[#5da52f]/10" name="email" placeholder="voce@exemplo.com" required type="email" />
      </label>
      <label className="block space-y-2 text-left text-sm font-medium text-[#294333]">
        Senha
        <input autoComplete="current-password" className="h-12 w-full min-w-0 rounded-xl border border-[#d4e0d0] bg-white px-4 text-base text-[#16271e] outline-none transition placeholder:text-[#9aa79c] focus:border-[#5da52f] focus:ring-4 focus:ring-[#5da52f]/10" name="password" placeholder="Sua senha" required type="password" />
      </label>
      <button className="flex h-12 w-full items-center justify-center rounded-xl bg-[#2f713b] px-5 font-semibold text-white shadow-sm transition hover:bg-[#255f31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5da52f]" type="submit">Entrar</button>
    </form>
  );
}
