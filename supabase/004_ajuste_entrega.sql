-- 004: a case distributed before the documents were delivered (the lawyer anticipated the petition while
-- a simple document was still missing) counts as delivered on the distribution date: 0 days, on time.
-- Applies to every path (app, import, n8n). Run after 003_tipos.sql.
create or replace function ajustar_entrega_antecipada() returns trigger
  language plpgsql as $$
begin
  if new.status = 'distribuido' and new.data_distribuicao < new.data_entrega_docs then
    new.data_entrega_docs := new.data_distribuicao;
  end if;
  return new;
end $$;

drop trigger if exists contratos_ajustar_entrega on contratos;
create trigger contratos_ajustar_entrega
  before insert or update on contratos
  for each row execute function ajustar_entrega_antecipada();

-- Existing rows (e.g. imported from the spreadsheet).
update contratos set data_entrega_docs = data_distribuicao
where status = 'distribuido' and data_distribuicao < data_entrega_docs;
