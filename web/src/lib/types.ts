// Types mirroring supabase/schema.sql (tables and views).

export type Natureza = "civel" | "previdenciaria";
export type StatusContrato = "em_andamento" | "distribuido" | "cancelado";
export type MotivoCancelamento = "desistencia" | "sem_potencial";
export type Papel = "admin" | "usuario";

export type Perfil = {
  id: string;
  nome: string;
  papel: Papel;
  whatsapp: string | null;
  ativo: boolean;
};

export type TipoProcesso = {
  id: number;
  natureza: Natureza;
  nome: string;
  ativo: boolean;
};

export type Cliente = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
};

export type Pendencia = {
  id: string;
  contrato_id: string;
  descricao: string;
  providencia: string | null;
  acao: string | null;
  resolvida_em: string | null;
  created_at: string;
};

// Row of the contratos_prazos view.
export type ContratoPrazo = {
  id: string;
  numero: string | null;
  cliente_id: string;
  natureza: Natureza;
  tipo_id: number | null;
  descricao: string | null;
  responsavel_id: string | null;
  status: StatusContrato;
  motivo_cancelamento: MotivoCancelamento | null;
  obs_cancelamento: string | null;
  data_assinatura: string | null;
  data_entrega_docs: string | null;
  data_distribuicao: string | null;
  onedrive_url: string | null;
  origem: "manual" | "liderhub" | "importacao";
  cliente_nome: string;
  cliente_cpf: string | null;
  tipo_nome: string | null;
  responsavel_nome: string | null;
  tem_pendencia: boolean;
  data_prazo: string | null;
  dias_restantes: number | null;
  dias_atraso: number | null;
  tempo_distribuicao: number | null;
  no_prazo: boolean | null;
};

export type KpisGerais = {
  tempo_medio_dias: number | null;
  pct_no_prazo: number | null;
  meta_pct: number;
  distribuidos: number;
  em_andamento: number;
  atrasados: number;
  vencendo_3_dias: number;
};

export type Configuracoes = {
  prazo_dias: number;
  atraso_2_dias: number;
  meta_no_prazo: number;
};
