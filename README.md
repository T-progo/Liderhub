# Controle de Distribuição de Processos

Web system that tracks the 10-day deadline between document delivery and case distribution,
with KPIs, Liderhub integration and WhatsApp deadline alerts. Requirements: `SPEC.md`.

```
supabase/   schema.sql (run first), 002_liderhub.sql, 003_tipos.sql, 004_ajuste_entrega.sql, seed_teste.sql (test data)
web/        Next.js 16 app (login, contratos, painel, admin) + scripts/ (run-sql, import-excel)
n8n/        build_alertas.py -> avisos-prazo.json (daily WhatsApp alerts workflow)
```

## 1. Supabase
1. Create a project (region São Paulo). Settings → API: copy the URL, `anon` key and `service_role` key.
2. SQL editor: run `supabase/schema.sql`, then `002_liderhub.sql`, `003_tipos.sql`, `004_ajuste_entrega.sql`.
   Or from `web/` with `DATABASE_URL` in `.env.local`:
   `node --env-file=.env.local scripts/run-sql.mjs ../supabase/schema.sql ../supabase/002_liderhub.sql ../supabase/003_tipos.sql ../supabase/004_ajuste_entrega.sql`
3. Authentication → Users → "Add user" (your e-mail + password, auto-confirm). Then in SQL:
   `update perfis set papel = 'admin', nome = 'Seu nome' where id = (select id from auth.users where email = 'SEU@EMAIL');`
4. Optional: run `supabase/seed_teste.sql` for test data (cleanup block at the end of the file).

## 2. Web app (local)
```bash
cd web
cp .env.local.example .env.local   # fill the values (DATABASE_URL only for scripts)
npm install
npm run dev                        # http://localhost:3000
```

## 3. Deploy (Vercel)
Import the GitHub repo, **Root Directory = `web`**, add the 3 `SUPABASE` environment variables, deploy.
In Supabase → Authentication → URL Configuration, set the Site URL to the Vercel URL.

## 4. n8n (client instance)
- **Liderhub → contratos**: branch "Preparar contratos" in the existing "Documentos Liderhub → OneDrive"
  workflow. Create an n8n credential **Supabase** (host + service_role key), select it in
  "Supabase registrar contrato", and set `controle.supabaseUrl` in its Config node (it stays off until then).
- **Avisos de prazo**: `python n8n/build_alertas.py`, import `n8n/avisos-prazo.json`, select the
  `Supabase` and `Liderhub API` credentials, set `supabaseUrl` and `linkSistema` in Config, publish.
  Runs weekdays 8:00 (America/Sao_Paulo). Each alert is recorded in `alertas_enviados` and sent once.

## 5. Excel import
Put the client's file in `data/` (git-ignored), then:
```bash
cd web
node --env-file=.env.local scripts/import-excel.mjs ../data/planilha.xlsx --aba "2026 - b"           # dry run report
node --env-file=.env.local scripts/import-excel.mjs ../data/planilha.xlsx --aba "2026 - b" --gravar  # import
```
Create the users first so "Responsável" names can be matched (by first name; spelling variants are merged).
The original "Tipo" text is kept in the contract's "Descrição"; cancelled/desistiu/distrato rows become
cancelled contracts; "pendência" text other than "não" becomes a pendência (resolved on the finalizado date).
