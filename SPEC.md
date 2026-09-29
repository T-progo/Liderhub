# Controle de Distribuição de Processos — Fase 1

Client: Estúdio Jurídico Almeida Lima (same client as the Liderhub/OneDrive project in `../`).
Agreed price: **R$ 2.500** (incl. WhatsApp alerts). Deliver the **full Phase 1 scope as quoted**
(everything below, plus online training and 30 days of post-delivery support). Keep the architecture
simple (logic in SQL views, reuse n8n) so the full scope is delivered efficiently; new requests beyond
this list are quoted separately.

## Goal

Replace the Excel control sheet with a small web system that tracks, **per contract**, the
10-calendar-day deadline between **document delivery** and **case distribution** by the lawyer,
with automatic KPIs and WhatsApp deadline alerts. Must be modular: later phases add
staff-productivity and case-tracking (tramitação) modules on the same database.

## Client answers (29/09/2026)

| Topic | Decision |
|---|---|
| Contract number | Typed manually by the team (for now). Unique key. May come from another system later. |
| Clients × contracts | One client can have **several contracts** at the same time. |
| Users | 12 people today, plan for **up to 20**. **Everyone sees everything.** One admin role. |
| Existing data | Import the current Excel, **~300 cases** (ask client for the file). |
| Alerts | **5 WhatsApp messages** to the responsible person: 3 days before, day before, deadline day, day after (late), and later (late again). |
| Devices | **Web (desktop) only.** No mobile/PWA. |

## Functional scope

### Records
- **Cliente**: name, CPF (optional, used to match Liderhub), phone, Liderhub chat id.
- **Contrato**: número do contrato (unique; may be empty only while created automatically from
  Liderhub — must be filled before distribution), cliente, natureza (`Cível` | `Previdenciária`),
  tipo previdenciário (auxílio por incapacidade, aposentadoria, revisão, BPC/LOAS, acerto de
  contribuições, isenção de IR — editable list), responsável (user), data de assinatura,
  data de entrega dos documentos (starts the deadline), data de finalização/distribuição,
  link da pasta OneDrive, status.
- **Status**: `em_andamento` → `distribuido`; or `cancelado` with reason
  (`desistencia` | `sem_potencial`) + note. Cancelled contracts are **excluded from KPIs**.
- **Pendências**: per contract — has missing docs (derived: any open pendência), description,
  providência adotada, ação realizada, resolved date.

### Calculations (database views, not app code)
- `prazo` = data de entrega + 10 days (calendar days — setting `prazo_dias`).
- `dias_restantes`, `dias_atraso` (while open), `tempo_distribuicao` (distributed − delivered),
  `no_prazo` (tempo_distribuicao ≤ prazo_dias).
- Open decision (setting, decide during dev): does an open pendência pause the clock? Default: **no**.

### KPIs (dashboard)
- Average distribution time (office-wide), % distributed on time, **80% target** highlighted.
- Breakdown by responsável and by tipo. Counters: open, late, due in ≤3 days.

### Liderhub integration (via the existing n8n)
- When a Liderhub conversation reaches the "documentação completa" status (configurable — default
  `Documentos em Análise`), n8n upserts **cliente** (by CPF from the `Cadastro:` line, else chat id)
  and creates a **contrato** with `data_entrega_docs` = status date, tipo from the benefit agent,
  OneDrive folder link, and no contract number yet (team fills it in).

### WhatsApp alerts (via n8n + Liderhub API)
- Daily job (weekdays, morning) reads the `alertas_pendentes` view and sends each due alert
  to the responsável's WhatsApp through Liderhub `POST /v1/send/message`, then records it in
  `alertas_enviados` (unique per contract + kind → never sent twice).
- Kinds: `d_menos_3`, `d_menos_1`, `d_zero`, `atraso_1`, `atraso_2` (atraso_2 = 3 days late,
  setting). Recipient phone stored on the user profile.

### Import
- One-off script: Excel/CSV (~300 rows) → clientes + contratos. Report rows that fail validation.

### Access
- Email + password login (Supabase Auth). Roles: `admin` (users, settings, lists) and `usuario`.
- Everyone reads/writes all contracts.

## Out of scope (Phase 1)
Productivity module, tramitação module, integrations with e-signature/financial systems,
mobile app/PWA, per-lawyer visibility rules.

## Tech stack
- **Supabase** (Postgres + Auth + auto REST API + RLS). Free tier is enough; Pro US$25/mo if needed.
- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, deployed on **Vercel** (free tier).
- **n8n** (client's existing cloud instance) for Liderhub → contratos and WhatsApp alerts.
- KPIs and deadline math live in **SQL views** so the UI stays thin.

## Agreed terms (proposal sent 29/09/2026, accepted at R$ 2.500)
- Timeline: **2 weeks** from approval + first payment.
- Payment: **50% at start (R$ 1.250), 50% on final delivery (R$ 1.250)**.
- Includes testing, team training (week 2) and **30 days of support** after delivery.
- Client must send the current Excel (names may be hidden) before the import.

## Schedule (2 weeks)
1. Week 1: system structure, login, users, clientes/contratos CRUD + list with filters,
   pendências, cancellations, deadline/lateness calculations.
2. Week 2: KPI dashboard, Liderhub integration, WhatsApp alerts, Excel import, testing, training.

## Acceptance checklist
- [ ] Create client with 2 contracts; each has its own deadline.
- [ ] Contract without delivery date shows no deadline; with date shows due date and days left.
- [ ] Late contract shows days late; distributing it records tempo de distribuição and on-time flag.
- [ ] Cancelled contract disappears from KPIs.
- [ ] Dashboard: average time, % on time vs 80% target, by responsável and by tipo.
- [ ] Liderhub status change creates the contract automatically (within 15 min).
- [ ] Each of the 5 alerts is sent once, on the right day, to the responsável.
- [ ] ~300 Excel rows imported; failures listed.
