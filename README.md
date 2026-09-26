# Leaf Assemble

Aplicação web para controlar peças reais de computador e planejar builds compatíveis com o estoque disponível.

## Stack

- Next.js 16 App Router, React e TypeScript
- Tailwind CSS e Zod
- Supabase Auth, PostgreSQL, RLS, Storage e migrations
- Vitest para testes de domínio
- GitHub Actions para lint, typecheck, testes e build

## Desenvolvimento local

Requisitos: Node.js 24 e npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` no `.env.local` ao conectar um projeto Supabase. A chave publishable pode ser usada no cliente com RLS. `SUPABASE_SERVICE_ROLE_KEY` é necessária para convites de usuários e deve ficar somente no servidor; nunca a exponha com o prefixo `NEXT_PUBLIC_`.

Para o Supabase local, instale a Supabase CLI e execute:

```bash
npx supabase start
npx supabase db reset
```

As migrations versionadas ficam em `supabase/migrations/`. Elas criam perfis e papéis, administração de usuários e auditoria, estoque por categoria/lote e builds com reservas atômicas. Não há dados fictícios de inventário. O fluxo de imagens já tem bucket privado e políticas no banco; o formulário de envio de arquivos ainda precisa ser concluído.

Para o primeiro acesso, crie os usuários por convite no Supabase Auth ou no fluxo de convite da aplicação depois de promover o primeiro administrador. A aplicação não cria senhas próprias nem permite cadastro público. Para escolher o primeiro administrador, crie o usuário em Auth e promova seu perfil no SQL Editor:

```sql
update public.profiles
set role = 'ADMIN', is_protected = true
where email = 'email-do-administrador@exemplo.com';
```

## Verificações

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Escopo implementado

- Login por convite, recuperação de senha, perfis, papéis e proteção do último administrador.
- Gestão de usuários e trilha de auditoria para operações administrativas e de estoque.
- Catálogo com especificações por categoria, lotes, recebimento de quantidades e estoque reservado/usado.
- Regras de compatibilidade com estados compatível, aviso, incompatível e desconhecido.
- Criação e edição de builds, reserva e liberação de peças, cancelamento e conclusão por operações atômicas no banco.
- Dashboard e estimativa do que pode ser montado, incluindo gargalos e cenário hipotético de compra.

## Ainda pendente para o MVP

- Formulário de upload e visualização de fotos dos componentes (a estrutura privada de Storage já existe).
- Simulador 2D para organizar as peças visualmente.
- Cobertura de testes de domínio e integração; pipeline de CI já executa `npm run test` quando testes forem adicionados.
- Configurar um projeto Supabase real, aplicar as migrations, configurar URLs de autenticação e convidar/promover o primeiro administrador.

A estimativa de builds depende da qualidade e completude das especificações cadastradas. Dados desconhecidos não são tratados como confirmação de compatibilidade; buscas que atinjam o limite computacional são identificadas na tela.

O acesso de usuários e cada operação de estoque serão validados no servidor/banco. A interface não será a única camada de segurança.
