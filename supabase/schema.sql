-- Controle de Distribuição de Processos — Fase 1 (Supabase / Postgres 15+)
-- Run once in the Supabase SQL editor (or `supabase db push` as a migration).
-- Dates are calendar dates in America/Sao_Paulo.

-- ------------------------------------------------------------------ enums
create type natureza_processo as enum ('civel', 'previdenciaria');
create type status_contrato   as enum ('em_andamento', 'distribuido', 'cancelado');
create type motivo_cancelamento as enum ('desistencia', 'sem_potencial');
create type papel_usuario     as enum ('admin', 'usuario');
create type tipo_alerta       as enum ('d_menos_3', 'd_menos_1', 'd_zero', 'atraso_1', 'atraso_2');

-- ------------------------------------------------------------------ helpers
create or replace function hoje_brt() returns date
  language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function set_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ------------------------------------------------------------------ settings (single row)
create table configuracoes (
  id              boolean primary key default true check (id),
  prazo_dias      int not null default 10,     -- deadline in calendar days
  atraso_2_dias   int not null default 3,      -- 2nd late alert: N days after the deadline
  meta_no_prazo   numeric(5,2) not null default 80.00, -- KPI target (%)
  pausar_com_pendencia boolean not null default false  -- reserved (decide during dev)
);
insert into configuracoes default values;

-- ------------------------------------------------------------------ users
create table perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  papel      papel_usuario not null default 'usuario',
  whatsapp   text,                 -- E.164 digits, e.g. 5524999999999 (alerts)
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- create a profile automatically for each new auth user
create or replace function criar_perfil() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome) values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function criar_perfil();

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin' and ativo)
$$;

-- ------------------------------------------------------------------ lookup: tipos
create table tipos_processo (
  id        serial primary key,
  natureza  natureza_processo not null,
  nome      text not null,
  ativo     boolean not null default true,
  unique (natureza, nome)
);
insert into tipos_processo (natureza, nome) values
  ('previdenciaria', 'Auxílio por incapacidade'),
  ('previdenciaria', 'Aposentadoria'),
  ('previdenciaria', 'Revisão'),
  ('previdenciaria', 'BPC/LOAS'),
  ('previdenciaria', 'Acerto de contribuições'),
  ('previdenciaria', 'Isenção de imposto de renda');

-- ------------------------------------------------------------------ clientes
create table clientes (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  cpf               text unique,        -- digits only
  telefone          text,
  liderhub_chat_id  text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger clientes_updated before update on clientes for each row execute function set_updated_at();

-- ------------------------------------------------------------------ contratos
create table contratos (
  id                 uuid primary key default gen_random_uuid(),
  numero             text unique,       -- contract number (main key for the team); null only while auto-created
  cliente_id         uuid not null references clientes(id) on delete restrict,
  natureza           natureza_processo not null default 'previdenciaria',
  tipo_id            int references tipos_processo(id),
  descricao          text,              -- objeto / descrição livre (ex.: "Ação em face do Banco BMG")
  responsavel_id     uuid references perfis(id),
  status             status_contrato not null default 'em_andamento',
  motivo_cancelamento motivo_cancelamento,
  obs_cancelamento   text,
  data_assinatura    date,
  data_entrega_docs  date,              -- starts the deadline
  data_distribuicao  date,              -- finalized / distributed
  onedrive_url       text,
  liderhub_chat_id   text,
  origem             text not null default 'manual' check (origem in ('manual', 'liderhub', 'importacao')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint cancelamento_com_motivo check (status <> 'cancelado' or motivo_cancelamento is not null),
  constraint distribuido_com_data   check (status <> 'distribuido' or data_distribuicao is not null),
  constraint distribuido_com_numero check (status <> 'distribuido' or numero is not null)
);
create index contratos_cliente_idx on contratos(cliente_id);
create index contratos_status_idx on contratos(status);
create trigger contratos_updated before update on contratos for each row execute function set_updated_at();

-- ------------------------------------------------------------------ pendências
create table pendencias (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references contratos(id) on delete cascade,
  descricao     text not null,         -- e.g. documento faltante
  providencia   text,                  -- providência adotada
  acao          text,                  -- ação realizada
  resolvida_em  date,
  criado_por    uuid references perfis(id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index pendencias_contrato_idx on pendencias(contrato_id);

-- ------------------------------------------------------------------ alerts log
create table alertas_enviados (
  contrato_id  uuid not null references contratos(id) on delete cascade,
  tipo         tipo_alerta not null,
  enviado_em   timestamptz not null default now(),
  destino      text,
  primary key (contrato_id, tipo)       -- each alert at most once per contract
);

-- ------------------------------------------------------------------ views
-- Deadline math per contract (security_invoker => respects RLS of the caller)
create view contratos_prazos with (security_invoker = on) as
select
  c.*,
  cl.nome  as cliente_nome,
  cl.cpf   as cliente_cpf,
  t.nome   as tipo_nome,
  p.nome   as responsavel_nome,
  p.whatsapp as responsavel_whatsapp,
  exists (select 1 from pendencias pe where pe.contrato_id = c.id and pe.resolvida_em is null) as tem_pendencia,
  (c.data_entrega_docs + cfg.prazo_dias) as data_prazo,
  case when c.status = 'em_andamento' and c.data_entrega_docs is not null
       then (c.data_entrega_docs + cfg.prazo_dias) - hoje_brt() end as dias_restantes,
  case when c.status = 'em_andamento' and c.data_entrega_docs is not null
       then greatest(hoje_brt() - (c.data_entrega_docs + cfg.prazo_dias), 0) end as dias_atraso,
  case when c.status = 'distribuido' and c.data_entrega_docs is not null
       then c.data_distribuicao - c.data_entrega_docs end as tempo_distribuicao,
  case when c.status = 'distribuido' and c.data_entrega_docs is not null
       then (c.data_distribuicao - c.data_entrega_docs) <= cfg.prazo_dias end as no_prazo
from contratos c
join clientes cl on cl.id = c.cliente_id
left join tipos_processo t on t.id = c.tipo_id
left join perfis p on p.id = c.responsavel_id
cross join configuracoes cfg;

-- Office-wide KPIs (cancelled excluded)
create view kpis_gerais with (security_invoker = on) as
select
  round(avg(tempo_distribuicao)::numeric, 1)                                   as tempo_medio_dias,
  round(100.0 * count(*) filter (where no_prazo) / nullif(count(no_prazo), 0), 1) as pct_no_prazo,
  (select meta_no_prazo from configuracoes)                                     as meta_pct,
  count(*) filter (where status = 'distribuido')                                as distribuidos,
  count(*) filter (where status = 'em_andamento')                               as em_andamento,
  count(*) filter (where status = 'em_andamento' and dias_atraso > 0)           as atrasados,
  count(*) filter (where status = 'em_andamento' and dias_restantes between 0 and 3) as vencendo_3_dias
from contratos_prazos
where status <> 'cancelado';

create view kpis_por_responsavel with (security_invoker = on) as
select responsavel_id, coalesce(responsavel_nome, '(sem responsável)') as responsavel_nome,
  round(avg(tempo_distribuicao)::numeric, 1) as tempo_medio_dias,
  round(100.0 * count(*) filter (where no_prazo) / nullif(count(no_prazo), 0), 1) as pct_no_prazo,
  count(*) filter (where status = 'distribuido') as distribuidos,
  count(*) filter (where status = 'em_andamento' and dias_atraso > 0) as atrasados
from contratos_prazos where status <> 'cancelado'
group by responsavel_id, responsavel_nome;

create view kpis_por_tipo with (security_invoker = on) as
select natureza, coalesce(tipo_nome, '(sem tipo)') as tipo_nome,
  round(avg(tempo_distribuicao)::numeric, 1) as tempo_medio_dias,
  round(100.0 * count(*) filter (where no_prazo) / nullif(count(no_prazo), 0), 1) as pct_no_prazo,
  count(*) filter (where status = 'distribuido') as distribuidos,
  count(*) filter (where status = 'em_andamento') as em_andamento
from contratos_prazos where status <> 'cancelado'
group by natureza, tipo_nome;

-- Which alert is due today: only the most recent applicable kind, if not sent yet
-- (a contract created already late gets one alert, not five).
create view alertas_pendentes with (security_invoker = on) as
with marcos as (
  select cp.id as contrato_id, cp.numero, cp.cliente_nome, cp.responsavel_nome,
         cp.responsavel_whatsapp, cp.data_prazo, m.tipo, m.data_alvo
  from contratos_prazos cp
  cross join configuracoes cfg
  cross join lateral (values
    ('d_menos_3'::tipo_alerta, cp.data_prazo - 3),
    ('d_menos_1'::tipo_alerta, cp.data_prazo - 1),
    ('d_zero'::tipo_alerta,    cp.data_prazo),
    ('atraso_1'::tipo_alerta,  cp.data_prazo + 1),
    ('atraso_2'::tipo_alerta,  cp.data_prazo + cfg.atraso_2_dias)
  ) as m(tipo, data_alvo)
  where cp.status = 'em_andamento' and cp.data_entrega_docs is not null
    and m.data_alvo <= hoje_brt()
),
ultimo as (
  select distinct on (contrato_id) * from marcos order by contrato_id, data_alvo desc
)
select u.* from ultimo u
where not exists (select 1 from alertas_enviados a where a.contrato_id = u.contrato_id and a.tipo = u.tipo);

-- ------------------------------------------------------------------ RLS
alter table configuracoes    enable row level security;
alter table perfis           enable row level security;
alter table tipos_processo   enable row level security;
alter table clientes         enable row level security;
alter table contratos        enable row level security;
alter table pendencias       enable row level security;
alter table alertas_enviados enable row level security;

-- everyone logged in reads everything
create policy leitura on configuracoes    for select to authenticated using (true);
create policy leitura on perfis           for select to authenticated using (true);
create policy leitura on tipos_processo   for select to authenticated using (true);
create policy leitura on clientes         for select to authenticated using (true);
create policy leitura on contratos        for select to authenticated using (true);
create policy leitura on pendencias       for select to authenticated using (true);
create policy leitura on alertas_enviados for select to authenticated using (true);

-- everyone logged in edits the case data
create policy escrita on clientes   for all to authenticated using (true) with check (true);
create policy escrita on contratos  for all to authenticated using (true) with check (true);
create policy escrita on pendencias for all to authenticated using (true) with check (true);

-- admin-only: settings, lists, users; own profile (name/whatsapp) editable by the user
create policy admin_escrita on configuracoes  for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_escrita on tipos_processo for all    to authenticated using (is_admin()) with check (is_admin());
create policy admin_escrita on perfis         for update to authenticated using (is_admin() or id = auth.uid())
  with check (is_admin() or (id = auth.uid() and papel = (select papel from perfis where id = auth.uid())));

-- n8n (Liderhub trigger + alerts) uses the service_role key, which bypasses RLS.
