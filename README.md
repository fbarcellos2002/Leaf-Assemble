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

Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` no `.env.local` ao conectar um projeto Supabase. A chave publishable pode ser usada no cliente com RLS. `SUPABASE_SECRET_KEY` (ou a chave antiga `SUPABASE_SERVICE_ROLE_KEY`) é necessária para cadastrar usuários e deve ficar somente no servidor, como variável sensível; nunca a exponha com o prefixo `NEXT_PUBLIC_`.

Na tela de novo componente, informe fabricante e modelo/MPN e use **Buscar dados técnicos na internet** para consultar a ficha correspondente no Open Icecat. Crie uma conta gratuita no Open Icecat, gere um API token e configure `ICECAT_USERNAME` e `ICECAT_API_TOKEN` como variáveis privadas no `.env.local` e na Vercel; não use o prefixo `NEXT_PUBLIC_`. A busca é feita no servidor por fabricante e código exato, e a tela mantém um link para a ficha consultada. A cobertura depende dos fabricantes e produtos disponíveis no catálogo. Valores compatíveis com o Leaf Assemble são preenchidos nos campos conhecidos e os demais dados da ficha são guardados junto ao componente.

O cadastro administrativo cria a conta com e-mail confirmado e senha inicial definida pelo administrador; esse fluxo não envia e-mail. Para fluxos futuros que enviem e-mails de autenticação, configure um servidor SMTP próprio em Authentication → Emails → SMTP Settings.

Para o Supabase local, instale a Supabase CLI e execute:

```bash
npx supabase start
npx supabase db reset
```

As migrations versionadas ficam em `supabase/migrations/`. Elas criam perfis e papéis, administração de usuários e auditoria, estoque por categoria/lote e builds com reservas atômicas. Não há dados fictícios de inventário. O fluxo de imagens já tem bucket privado e políticas no banco; o formulário de envio de arquivos ainda precisa ser concluído.

Para o primeiro acesso, crie o usuário pelo Supabase Auth e promova seu perfil no SQL Editor. Depois, administradores podem cadastrar contas pela aplicação. Não existe cadastro público. Para escolher o primeiro administrador, crie o usuário em Auth e promova seu perfil:

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

- Login, cadastro administrativo de usuários, perfis, papéis e proteção do último administrador.
- Gestão de usuários e trilha de auditoria para operações administrativas e de estoque.
- Catálogo com especificações por categoria, lotes, recebimento de quantidades e estoque reservado/usado.
- Regras de compatibilidade com estados compatível, aviso, incompatível e desconhecido.
- Criação e edição de builds, reserva e liberação de peças, cancelamento e conclusão por operações atômicas no banco.
- Dashboard e estimativa do que pode ser montado, incluindo gargalos e cenário hipotético de compra.

## Ainda pendente para o MVP

- Formulário de upload e visualização de fotos dos componentes (a estrutura privada de Storage já existe).
- Simulador 2D para organizar as peças visualmente.
- Cobertura de testes de domínio e integração; pipeline de CI já executa `npm run test` quando testes forem adicionados.
- Configurar um projeto Supabase real, aplicar as migrations, configurar URLs de autenticação e promover o primeiro administrador.

A estimativa de builds depende da qualidade e completude das especificações cadastradas. Dados desconhecidos não são tratados como confirmação de compatibilidade; buscas que atinjam o limite computacional são identificadas na tela.

O acesso de usuários e cada operação de estoque serão validados no servidor/banco. A interface não será a única camada de segurança.
