<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Leaf Assemble project rules

- Product: a Portuguese-language application for real PC-parts inventory and PC build planning. The product name is **Leaf Assemble**.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS, Zod, Supabase Auth/Postgres/Storage/RLS, and versioned SQL migrations.
- Keep component compatibility rules in a domain module, never scattered through React components.
- Treat stock, reservations, roles, and protected-admin rules as server/database responsibilities. Never rely on UI-only checks for these rules.
- Preserve real inventory and lot traceability; do not use sample counts to imply real stock.
- Make stock reservation and release atomic in the database and prevent the same physical unit from being assigned to multiple active builds.
- Use migrations for schema changes and update generated/application types with them. Keep secrets out of Git.
- Work in phases: foundation, authentication, user administration, inventory, compatibility, builds, 2D simulator, build planning, dashboard, then quality hardening.
- Do not skip ahead to a visual simulator before the data, security, and inventory foundations are in place.
- Check the relevant Next.js documentation shipped in `node_modules/next/dist/docs/` before using Next APIs; this project uses Next.js 16.
- Before completing implementation work, report changed files, database migrations, checks performed, and external setup still needed.
