import Link from "next/link";

import { requireActiveProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import { createUser } from "./actions";
import { UserDirectory, type UserRecord } from "./user-directory";

type Props = { searchParams: Promise<{ error?: string; notice?: string }> };

const errorMessages: Record<string, string> = {
  "invalid-input": "Confira os dados. A senha precisa ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.",
  "admin-key": "Configure SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) no ambiente da aplicação.",
  "email-exists": "Já existe uma conta com esse e-mail.",
  "auth-rate-limit": "O Supabase limitou temporariamente os cadastros. Aguarde um pouco e tente novamente.",
  "auth-database": "O Supabase Auth recusou o cadastro. Confira as migrations e os logs do servidor.",
  "create-failed": "Não foi possível cadastrar a conta. Confira a chave administrativa do Supabase.",
  "profile-failed": "A conta Auth foi iniciada, mas o perfil não foi configurado. Confira as migrations do Supabase.",
  "update-failed": "Não foi possível salvar. Verifique se o administrador protegido continua ativo.",
  "delete-self": "Você não pode remover a própria conta enquanto estiver usando o sistema.",
  "delete-protected": "O administrador principal protegido não pode ser removido.",
  "delete-last-admin": "O sistema precisa manter ao menos um administrador ativo.",
  "delete-not-found": "Essa conta já foi removida ou não existe mais.",
  "delete-failed": "Não foi possível remover a conta.",
  "password-invalid": "As senhas devem ser iguais e conter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.",
  "password-update-failed": "Não foi possível alterar a senha. Tente novamente.",
  "directory-unavailable": "Não foi possível carregar a lista de usuários. A migration do diretório pode ainda não ter sido aplicada.",
};

export default async function UsersPage({ searchParams }: Props) {
  const currentProfile = await requireActiveProfile();
  const isAdmin = currentProfile.role === "ADMIN";
  const { error, notice } = await searchParams;
  const supabase = await createClient();
  let users: UserRecord[] = [];
  let loadError = false;

  if (isAdmin) {
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id, auth_user_id, email, name, role, is_active, is_protected, created_at, last_login_at")
      .order("created_at", { ascending: false });

    loadError = Boolean(queryError);
    users = (data ?? []).map((profile) => ({
      id: profile.id,
      authUserId: profile.auth_user_id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      isActive: profile.is_active,
      isProtected: profile.is_protected,
      createdAt: profile.created_at,
      lastLoginAt: profile.last_login_at,
    }));
  } else {
    const [{ data: directory, error: directoryError }, { data: ownProfile, error: ownError }] = await Promise.all([
      supabase.rpc("user_directory"),
      supabase
        .from("profiles")
        .select("id, auth_user_id, email, name, role, is_active, is_protected, created_at, last_login_at")
        .eq("auth_user_id", currentProfile.auth_user_id)
        .maybeSingle(),
    ]);

    loadError = Boolean(directoryError || ownError || !ownProfile);
    const directoryProfiles = (directory ?? []) as Array<Pick<UserRecord, "id" | "name" | "role">>;
    users = directoryProfiles.map((profile) => ({
      id: profile.id,
      authUserId: null,
      email: null,
      name: profile.name,
      role: profile.role,
      isActive: null,
      isProtected: false,
      createdAt: null,
      lastLoginAt: null,
    }));

    if (ownProfile) {
      users = users.map((user) => user.id === ownProfile.id ? {
        ...user,
        authUserId: ownProfile.auth_user_id,
        email: ownProfile.email,
        isActive: ownProfile.is_active,
        isProtected: ownProfile.is_protected,
        createdAt: ownProfile.created_at,
        lastLoginAt: ownProfile.last_login_at,
      } : user);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Administração</p>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#153b2a]">Usuários</h1>
          <p className="mt-2 max-w-2xl leading-7 text-[#607266]">
            {isAdmin ? "Consulte e gerencie as contas cadastradas." : "Consulte os usuários e gerencie os dados da sua própria conta."}
          </p>
        </div>
        {isAdmin ? <Link className="w-fit text-sm font-semibold text-[#315b3c] underline-offset-4 hover:underline" href="/auditoria">Abrir auditoria</Link> : null}
      </div>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#8d3c32]">{errorMessages[error] ?? "Ocorreu um erro ao processar a solicitação."}</p> : null}
      {notice ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">{notice === "created" ? "Conta cadastrada. Nenhum e-mail foi enviado." : notice === "deleted" ? "Conta removida e ação registrada na auditoria." : notice === "password-updated" ? "Sua senha foi alterada." : "Alterações salvas."}</p> : null}
      {loadError ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">{errorMessages["directory-unavailable"]}</p> : null}

      {isAdmin ? (
        <details className="mt-8 rounded-2xl border border-[#dce6d8] bg-white p-5 sm:p-6">
          <summary className="cursor-pointer font-semibold text-[#153b2a]">Cadastrar usuário</summary>
          <p className="mt-3 text-sm leading-6 text-[#718276]">A senha inicial deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.</p>
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
            <button className="mt-auto h-11 rounded-xl bg-[#153b2a] px-4 font-semibold text-white transition hover:bg-[#205138]" type="submit">Cadastrar conta</button>
          </form>
        </details>
      ) : null}

      <UserDirectory
        users={users}
        currentUserId={currentProfile.auth_user_id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
