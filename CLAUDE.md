# Controle de Distribuição de Processos

Phase 1 of a small web system for Estúdio Jurídico Almeida Lima (Brazilian law firm, INSS/civil cases).
Full requirements: `SPEC.md`. Database: `supabase/schema.sql`. Parent folder `../` holds the earlier,
finished Liderhub → OneDrive automation (`../PROJECT_CONTEXT.md`, `../n8n/`).

## Constraints
- Fixed price R$ 2.500 for the FULL Phase 1 scope in SPEC.md (everything listed there is delivered).
  Prefer simple, boring solutions; features not in SPEC.md are quoted separately.
- UI language: **Portuguese (Brazil)**. Code, comments in code, commits: English is fine.
- Dates are calendar dates in America/Sao_Paulo. Deadline/KPI math lives in SQL views
  (`contratos_prazos`, `kpis_*`, `alertas_pendentes`) — the app only reads them.
- Everyone sees everything; only `admin` edits settings, type lists and users.

## Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, deployed on Vercel.
- Supabase: Postgres + Auth (email/password) + RLS. Browser uses the anon key; the service_role
  key is only for n8n and scripts — never ship it to the client.
- n8n Cloud (client's instance `almeidalima.app.n8n.cloud`) for:
  1. Liderhub → contratos (when a conversation reaches the "documentação completa" status).
  2. Daily WhatsApp alerts: read `alertas_pendentes`, send via Liderhub `POST /v1/send/message`,
     insert into `alertas_enviados`.

## Screens (Phase 1)
1. Login.
2. Contratos: list with filters (status, natureza, tipo, responsável, atrasados, vencendo) + counters.
3. Contrato: create/edit (cliente pick-or-create, número, natureza, tipo, responsável, datas,
   OneDrive link), pendências sub-list, cancel (motivo + obs), mark distributed (date).
4. Painel: KPIs gerais, por responsável, por tipo; 80% target highlighted.
5. Admin: users (nome, papel, WhatsApp, ativo), tipos, configurações (prazo_dias, meta).

## Liderhub API facts (from the earlier project)
- Base `https://api.liderhub.com.br`, header `x-company-key`, ~3 req/s.
- `GET /v1/contacts` (filters department/status/modifiedAfter; contact.status is a status UUID),
  `GET /v1/settings/status`, `GET /v1/message?contact=`, `POST /v1/send/message`
  `{contact, content, messageType:'conversation', note?, scheduledAt?}`.
- Agents write `Cadastro: NOME - CPF 000.000.000-00` and `Recebido: NN Tipo` lines; the benefit is
  known from which agent handles the chat (Docs - BPC/LOAS, Auxílio-Doença, Auxílio-Acidente,
  Aposentadoria Negada).
- Sending WhatsApp to staff numbers needs a Liderhub contact id for each staff phone
  (check how `/v1/send/message` addresses a phone that is not yet a contact).

## Client messages
Messages to the client are pasted as plain text: numbered "1.", "・" bullets, "->" arrows,
"-" instead of dashes, no emoji, no markdown bold.
