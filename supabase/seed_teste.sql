-- Test data (all states relative to today). Run in the SQL editor AFTER creating your admin user.
-- Remove before delivery with the DELETE block at the end.

do $$
declare
  resp uuid := (select id from perfis where papel = 'admin' order by created_at limit 1);
  bpc int := tipo_por_nome('BPC/LOAS');
  apo int := tipo_por_nome('Aposentadoria');
  inc int := tipo_por_nome('Auxílio por incapacidade');
  c1 uuid; c2 uuid; c3 uuid;
  hoje date := hoje_brt();
begin
  insert into clientes (nome, cpf) values ('TESTE Maria da Silva', '00000000191') returning id into c1;
  insert into clientes (nome, cpf) values ('TESTE João Souza', '00000000272') returning id into c2;
  insert into clientes (nome) values ('TESTE Ana Lima') returning id into c3;

  insert into contratos (numero, cliente_id, natureza, tipo_id, responsavel_id, data_assinatura, data_entrega_docs, origem) values
    ('T-001', c1, 'previdenciaria', bpc, resp, hoje - 20, hoje - 2,  'manual'),   -- 8 days left
    ('T-002', c1, 'previdenciaria', apo, resp, hoje - 20, hoje - 7,  'manual'),   -- d-3
    ('T-003', c2, 'previdenciaria', inc, resp, hoje - 20, hoje - 9,  'manual'),   -- d-1
    ('T-004', c2, 'previdenciaria', bpc, resp, hoje - 20, hoje - 10, 'manual'),   -- due today
    ('T-005', c3, 'previdenciaria', apo, resp, hoje - 30, hoje - 11, 'manual'),   -- 1 day late
    ('T-006', c3, 'civel',          null, null, hoje - 30, hoje - 15, 'manual'),  -- 5 days late, no responsável
    (null,    c3, 'previdenciaria', bpc, resp, null,       hoje - 1,  'liderhub');-- auto-created, no number yet

  insert into contratos (numero, cliente_id, natureza, tipo_id, responsavel_id, data_entrega_docs, status, data_distribuicao, origem) values
    ('T-101', c1, 'previdenciaria', bpc, resp, hoje - 40, 'distribuido', hoje - 33, 'manual'), -- 7 d: on time
    ('T-102', c2, 'previdenciaria', apo, resp, hoje - 40, 'distribuido', hoje - 25, 'manual'), -- 15 d: late
    ('T-103', c2, 'previdenciaria', inc, resp, hoje - 30, 'distribuido', hoje - 21, 'manual'); -- 9 d: on time

  insert into contratos (numero, cliente_id, natureza, tipo_id, data_entrega_docs, status, motivo_cancelamento, obs_cancelamento, origem) values
    ('T-201', c3, 'previdenciaria', bpc, hoje - 20, 'cancelado', 'desistencia', 'Cliente desistiu (teste)', 'manual');

  insert into pendencias (contrato_id, descricao, criado_por)
  select id, 'Falta laudo médico atualizado (teste)', null from contratos where numero = 'T-003';
end $$;

-- Expected in the Painel: 3 distributed, 2 on time -> 66.7% (below the 80% target), average 10.3 days.

-- ------------------------------------------------------------------ cleanup (run before delivery)
-- delete from contratos where cliente_id in (select id from clientes where nome like 'TESTE %');
-- delete from clientes where nome like 'TESTE %';
