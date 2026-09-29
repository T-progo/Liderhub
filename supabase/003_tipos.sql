-- 003: types found in the office's control sheet (besides the 6 initial ones and Auxílio-acidente).
-- Run after 002_liderhub.sql.
insert into tipos_processo (natureza, nome) values
  ('previdenciaria', 'Pensão por morte'),
  ('previdenciaria', 'Salário-maternidade'),
  ('previdenciaria', 'Auxílio-reclusão'),
  ('previdenciaria', 'Planejamento previdenciário'),
  ('previdenciaria', 'Outros (previdenciário)'),
  ('civel', 'Ação contra banco / instituição financeira'),
  ('civel', 'Indenização / danos morais'),
  ('civel', 'Outros (cível)')
on conflict (natureza, nome) do nothing;
