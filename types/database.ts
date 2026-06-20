/**
 * Tipos do banco de dados Supabase.
 * Será regenerado automaticamente com `supabase gen types` no futuro.
 */

export type EventoStatus = "rascunho" | "publicado" | "encerrado";

export type Evento = {
  id: string;
  slug: string;
  nome: string;
  descricao_curta: string | null;
  descricao_longa: string | null;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
  imagem_capa_url: string | null;
  imagens_galeria: string[] | null;
  cor_tematica: string | null;
  metodos_pagamento: ("pix" | "cartao")[];
  max_parcelas: number;
  prazo_inscricao: string | null;
  status: EventoStatus;
  destinacao_valores: string | null;
  infos_importantes: string[] | null;
  mostrar_estoque_publico: boolean;
  created_at: string;
  updated_at: string;
};

export type TipoIngresso = {
  id: string;
  evento_id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  max_ingressos: number | null;
};

export type InscricaoItem = {
  tipo_id: string;
  nome: string;
  qtd: number;
  preco_unitario: number;
};

export type InscricaoStatus =
  | "pendente"
  | "pago"
  | "cancelado"
  | "estornado";

export type CobrancaMetodo = "aberto" | "pix" | "cartao";

export type CobrancaAvulsa = {
  id: string;
  descricao: string;
  valor: number;
  metodo_cobranca: CobrancaMetodo;
  parcelas: number;
  repassar_juros: boolean;
  valor_total: number | null;
  responsavel_nome: string;
  cpf: string;
  telefone: string;
  status_pagamento: InscricaoStatus;
  payment_url: string | null;
  asaas_payment_id: string | null;
  asaas_customer_id: string | null;
  registrado_por: string | null;
  link_enviado_em: string | null;
  link_erro: string | null;
  confirmacao_enviada_em: string | null;
  confirmacao_erro: string | null;
  created_at: string;
};

export type Inscricao = {
  id: string;
  evento_id: string;
  responsavel_nome: string;
  cpf: string;
  email: string;
  telefone: string;
  itens: InscricaoItem[];
  valor_base: number;
  valor_total: number;
  metodo_pagamento: "pix" | "cartao";
  parcelas: number;
  status_pagamento: InscricaoStatus;
  asaas_payment_id: string | null;
  created_at: string;
};
