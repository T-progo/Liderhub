-- 002: support for the Liderhub → contratos integration. Run after schema.sql.

-- Benefit handled by the "Docs - Auxílio-Acidente" agent (not in the client's initial list).
insert into tipos_processo (natureza, nome) values ('previdenciaria', 'Auxílio-acidente')
on conflict (natureza, nome) do nothing;

-- One automatic contract per Liderhub conversation (manual/imported contracts are not limited).
create unique index if not exists contratos_liderhub_chat_uidx
  on contratos (liderhub_chat_id) where origem = 'liderhub';

-- Look up a type id by name (used by n8n; case/accent-insensitive).
create or replace function tipo_por_nome(p_nome text) returns int
  language sql stable as $$
  select id from tipos_processo
  where lower(translate(nome, 'áàâãéêíóôõúç', 'aaaaeeiooouc')) = lower(translate(p_nome, 'áàâãéêíóôõúç', 'aaaaeeiooouc'))
  limit 1
$$;

-- Called by n8n (service_role) when a conversation reaches "documentação completa".
-- Upserts the client (by CPF, else by chat id) and creates the contract once per chat.
-- Returns the contract id (existing or new). Fills the OneDrive link later if it was missing.
create or replace function registrar_documentacao_liderhub(
  p_chat_id text,
  p_nome text,
  p_cpf text,
  p_telefone text,
  p_tipo text,
  p_data_entrega date,
  p_onedrive_url text
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_cliente uuid;
  v_contrato uuid;
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
begin
  select id into v_contrato from contratos where liderhub_chat_id = p_chat_id and origem = 'liderhub';
  if v_contrato is not null then
    update contratos set onedrive_url = coalesce(onedrive_url, p_onedrive_url) where id = v_contrato;
    return v_contrato;
  end if;

  if v_cpf is not null then
    select id into v_cliente from clientes where cpf = v_cpf;
  end if;
  if v_cliente is null then
    select id into v_cliente from clientes where liderhub_chat_id = p_chat_id;
  end if;
  if v_cliente is null then
    insert into clientes (nome, cpf, telefone, liderhub_chat_id)
    values (coalesce(nullif(p_nome, ''), 'Cliente Liderhub'), v_cpf, p_telefone, p_chat_id)
    returning id into v_cliente;
  else
    update clientes set liderhub_chat_id = coalesce(liderhub_chat_id, p_chat_id),
                        telefone = coalesce(telefone, p_telefone)
    where id = v_cliente;
  end if;

  insert into contratos (cliente_id, natureza, tipo_id, data_entrega_docs, onedrive_url, liderhub_chat_id, origem)
  values (v_cliente, 'previdenciaria', tipo_por_nome(p_tipo), p_data_entrega, p_onedrive_url, p_chat_id, 'liderhub')
  returning id into v_contrato;
  return v_contrato;
end $$;

-- Only the service_role (n8n) may call it.
revoke all on function registrar_documentacao_liderhub(text, text, text, text, text, date, text) from public, anon, authenticated;
