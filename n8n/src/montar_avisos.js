// Builds one WhatsApp message per due alert (view alertas_pendentes).
// Recipient: the contract's responsável; if they have no WhatsApp (or no responsável), every active admin.
const cfg = $('Config').first().json;

const digits = (v) => String(v || '').replace(/\D/g, '');
const telefone = (v) => {
  const d = digits(v);
  if (d.length < 10) return null;
  return d.startsWith('55') && d.length >= 12 ? d : `55${d}`;
};
const data = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '-');

// Liderhub connection used to send (the office number).
const conexoes = $('Liderhub conexões').all().flatMap((i) => {
  const j = i.json;
  if (Array.isArray(j)) return j;
  return j.connections || j.data || [j];
});
const conexao =
  conexoes.find((c) => digits(c.number).endsWith(digits(cfg.numeroConexao)) && c.connectionStatus !== 'disconnected') ||
  conexoes.find((c) => c.connectionStatus === 'connected') ||
  conexoes[0];
if (!conexao?.id) throw new Error('Nenhuma conexão WhatsApp encontrada no Liderhub.');

const admins = $('Supabase administradores')
  .all()
  .flatMap((i) => (Array.isArray(i.json) ? i.json : [i.json]))
  .filter((a) => a && a.whatsapp);

const TEXTO = {
  d_menos_3: (a) => `vence em 3 dias (${data(a.data_prazo)}).`,
  d_menos_1: (a) => `vence amanhã (${data(a.data_prazo)}).`,
  d_zero: (a) => `vence HOJE (${data(a.data_prazo)}).`,
  atraso_1: (a) => `está ATRASADO: o prazo venceu em ${data(a.data_prazo)}.`,
  atraso_2: (a) => `continua ATRASADO: o prazo venceu em ${data(a.data_prazo)}.`,
};

const alertas = $input.all().flatMap((i) => (Array.isArray(i.json) ? i.json : [i.json])).filter((a) => a && a.contrato_id);
const out = [];
for (const a of alertas) {
  const contrato = a.numero ? `O contrato ${a.numero}` : 'O contrato (sem nº)';
  const corpo = `${cfg.prefixo} ${contrato} de ${a.cliente_nome} ${TEXTO[a.tipo](a)}\n${cfg.linkSistema}`;
  const dono = telefone(a.responsavel_whatsapp);
  const destinos = dono
    ? [{ numero: dono, nome: a.responsavel_nome, texto: corpo }]
    : admins.map((ad) => ({
        numero: telefone(ad.whatsapp),
        nome: ad.nome,
        texto: `${corpo}\n(Sem responsável com WhatsApp cadastrado. Defina o responsável no sistema.)`,
      }));
  for (const d of destinos.filter((x) => x.numero)) {
    out.push({ json: { contrato_id: a.contrato_id, tipo: a.tipo, connection: conexao.id, ...d } });
  }
}
return out;
