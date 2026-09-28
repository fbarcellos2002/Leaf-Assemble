import Link from "next/link";

import { requireAdminProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import { createUser, updateUser } from "./actions";
import { RemoveUserButton } from "./remove-user-button";

type Props = { searchParams: Promise<{ error?: string; notice?: string }> };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const errorMessages: Record<string, string> = {
  "invalid-input": "Confira os dados. A senha precisa ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.",
  "admin-key": "Configure SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) no .env.local para desenvolvimento e como variável Sensitive na Vercel. Nunca use o prefixo NEXT_PUBLIC_.",
  "email-exists": "Já existe uma conta com esse e-mail. Use outro identificador ou edite a conta existente.",
  "auth-rate-limit": "O Supabase limitou temporariamente os cadastros. Aguarde um pouco e tente novamente.",
  "auth-database": "O Supabase Auth recusou o cadastro ao gravar o usuário. Confira se as migrations de perfis estão aplicadas e consulte os logs do servidor.",
  "create-failed": "Não foi possível cadastrar a conta. Confira a chave administrativa do Supabase e tente novamente.",
  "profile-failed": "A conta Auth foi iniciada, mas o perfil não foi configurado. Atualize a página e confira a lista antes de tentar novamente.",
  "update-failed": "Não foi possível salvar. Verifique se o administrador protegido continua ativo.",
  "delete-self": "Você não pode remover a própria conta enquanto estiver usando o sistema.",
  "delete-protected": "O administrador principal protegido não pode ser removido.",
  "delete-last-admin": "O sistema precisa manter ao menos um administrador ativo.",
  "delete-not-found": "Essa conta já foi removida ou não existe mais.",
  "delete-failed": "Não foi possível remover a conta. Verifique se ela não é proprietária de arquivos no Supabase Storage.",
};

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Nunca acessou";
}

export default async function UsersPage({ searchParams }: Props) {
  await requireAdminProfile();
  const { error, notice } = await searchParams;
  const supabase = await createClient();
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, auth_user_id, email, name, role, is_active, is_protected, created_at, last_login_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Administração</p>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#153b2a]">Usuários</h1>
          <p className="mt-2 max-w-2xl leading-7 text-[#607266]">
            Cadastre contas, edite permissões e acompanhe acessos. Nenhum e-mail é enviado; o e-mail cadastrado serve como identificador de login.
          </p>
        </div>
        <Link className="w-fit text-sm font-semibold text-[#315b3c] underline-offset-4 hover:underline" href="/auditoria">
          Abrir auditoria completa
        </Link>
      </div>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#8d3c32]">{errorMessages[error] ?? "Ocorreu um erro ao processar a solicitação."}</p> : null}
      {notice ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">{notice === "created" ? "Conta cadastrada. Nenhum e-mail foi enviado." : notice === "deleted" ? "Conta removida e ação registrada na auditoria." : "Alterações salvas."}</p> : null}
      {profilesError ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível carregar os perfis.</p> : null}

      <section className="mt-8 rounded-3xl border border-[#dce6d8] bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-[#153b2a]">Cadastrar usuário</h2>
        <p className="mt-1 text-sm leading-6 text-[#718276]">A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial. Compartilhe-a diretamente com a pessoa.</p>
        <form action={createUser} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-[#294333]">
            Nome
            <input className="h-11 w-full min-w-0 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="name" required minLength={2} maxLength={80} />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-[#294333]">
            E-mail para login
            <input className="h-11 w-full min-w-0 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="email" type="email" autoComplete="off" required />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-[#294333]">
            Senha inicial
            <input className="h-11 w-full min-w-0 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} pattern="(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}" title="Use no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial." required />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-[#294333]">
            Perfil
            <select className="h-11 w-full rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal" name="role" defaultValue="VISITANTE">
              <option value="VISITANTE">Visitante</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          <button className="mt-auto h-11 rounded-xl bg-[#153b2a] px-4 font-semibold text-white transition hover:bg-[#205138]" type="submit">
            Cadastrar conta
          </button>
        </form>
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-[#dce6d8] bg-white shadow-sm">
        <div className="border-b border-[#e7ede4] px-5 py-5 sm:px-8">
          <h2 className="text-xl font-semibold text-[#153b2a]">Contas cadastradas</h2>
        </div>
        <div className="divide-y divide-[#edf1ea]">
          {(profiles ?? []).map((profile) => (
            <form action={updateUser} key={profile.id} className="grid gap-4 px-5 py-5 sm:px-8 xl:grid-cols-[minmax(10rem,1.2fr)_minmax(13rem,1.4fr)_minmax(8rem,0.7fr)_minmax(7rem,0.6fr)_minmax(10rem,1fr)_auto] xl:items-end">
              <input type="hidden" name="authUserId" value={profile.auth_user_id} />
              <label className="grid min-w-0 gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">
                Nome
                <input className="h-10 w-full min-w-0 rounded-lg border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal text-[#16271e]" name="name" defaultValue={profile.name} required minLength={2} maxLength={80} />
              </label>
              <div className="min-w-0 text-sm">
                <p className="text-xs font-semibold tracking-wide text-[#718276] uppercase">E-mail de login</p>
                <p className="mt-2 break-all text-[#44594b]">{profile.email}</p>
              </div>
              {profile.is_protected ? (
                <>
                  <input type="hidden" name="role" value={profile.role} />
                  <input type="hidden" name="isActive" value={String(profile.is_active)} />
                  <div className="text-sm font-medium text-[#315b3c]">Administrador protegido</div>
                  <div className="text-sm text-[#607266]">{profile.is_active ? "Ativo" : "Inativo"}</div>
                </>
              ) : (
                <>
                  <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">
                    Perfil
                    <select className="h-10 rounded-lg border border-[#d9e2d8] bg-white px-3 text-sm font-normal normal-case tracking-normal" name="role" defaultValue={profile.role}>
                      <option value="VISITANTE">Visitante</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">
                    Acesso
                    <select className="h-10 rounded-lg border border-[#d9e2d8] bg-white px-3 text-sm font-normal normal-case tracking-normal" name="isActive" defaultValue={String(profile.is_active)}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </label>
                </>
              )}
              <div className="text-sm text-[#607266]">
                <p className="text-xs font-semibold tracking-wide text-[#718276] uppercase">Último acesso</p>
                <p className="mt-2">{formatDate(profile.last_login_at)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="h-10 rounded-lg border border-[#cdddc7] px-4 text-sm font-semibold text-[#315b3c] transition hover:bg-[#f5f7f2]" type="submit">Salvar</button>
                {!profile.is_protected ? <RemoveUserButton name={profile.name} /> : <span className="text-xs font-medium text-[#5b8c35]">Protegido</span>}
              </div>
            </form>
          ))}
          {profiles?.length === 0 ? <p className="px-5 py-8 text-sm text-[#718276] sm:px-8">Nenhuma conta cadastrada.</p> : null}
        </div>
      </section>

    </div>
  );
}
