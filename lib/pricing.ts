/**
 * Cálculo de taxas de pagamento (Asaas).
 *
 * Importado do .jsx original do Dia das Mães. Os valores estão calibrados
 * pra o gateway que a escola usa hoje. Se mudar de gateway no futuro,
 * ajustar tudo aqui.
 */

export const TAXA_CARTAO_VISTA = 0.0299;
export const TAXA_CARTAO_PARCELADO = 0.0349;
export const TAXA_FIXA_CARTAO = 0.49;
export const TAXA_ANTECIPACAO_VISTA = 0.0115;
export const TAXA_ANTECIPACAO_PARCELADO = 0.016;

export type MetodoPagamento = "pix" | "cartao";

export interface CalculoPreco {
  valorBase: number;
  valorTotal: number;
  valorParcela: number;
  taxaCartao: number;
  taxaFixa: number;
  taxaAntecipacao: number;
}

/**
 * Calcula a taxa de antecipação do Asaas com base no valor e número de parcelas.
 * Para 1x usa taxa à vista. Para 2x+ usa fórmula proporcional ao prazo.
 */
export function calcularTaxaAntecipacao(
  valorBase: number,
  numParcelas: number,
): number {
  if (numParcelas <= 1) {
    return valorBase * TAXA_ANTECIPACAO_VISTA;
  }
  const somaMeses = (numParcelas * (numParcelas + 1)) / 2;
  const valorParcela = valorBase / numParcelas;
  return valorParcela * TAXA_ANTECIPACAO_PARCELADO * somaMeses;
}

/**
 * Calcula o valor total da inscrição considerando o método e parcelamento.
 * PIX = sem taxas. Cartão = base + taxa percentual + taxa fixa + antecipação.
 */
export function calcularTotal(
  valorBase: number,
  metodo: MetodoPagamento,
  parcelas: number = 1,
): CalculoPreco {
  if (valorBase <= 0 || metodo === "pix") {
    return {
      valorBase,
      valorTotal: valorBase,
      valorParcela: valorBase,
      taxaCartao: 0,
      taxaFixa: 0,
      taxaAntecipacao: 0,
    };
  }

  const p = Math.max(1, Math.floor(parcelas));
  const taxaPercentual = p === 1 ? TAXA_CARTAO_VISTA : TAXA_CARTAO_PARCELADO;
  const taxaCartao = valorBase * taxaPercentual;
  const taxaAntecipacao = calcularTaxaAntecipacao(valorBase, p);
  const valorTotal = valorBase + taxaCartao + TAXA_FIXA_CARTAO + taxaAntecipacao;
  const valorParcela = valorTotal / p;

  return {
    valorBase,
    valorTotal,
    valorParcela,
    taxaCartao,
    taxaFixa: TAXA_FIXA_CARTAO,
    taxaAntecipacao,
  };
}
