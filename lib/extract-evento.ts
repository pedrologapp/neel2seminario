import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Extrai dados estruturados de eventos a partir de texto ou PDF do aviso do NEEL.
 * Usa Claude Sonnet 4.6 com tool_use pra forçar JSON estrito, e prompt caching
 * pra reduzir custo a partir da 2ª extração.
 */

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair informações estruturadas de comunicados/avisos sobre eventos.

CONTEXTO:
- NEEL — Núcleo Espírita Esperança de Luz

REGRAS DE EXTRAÇÃO:
1. Leia atentamente o documento/texto enviado
2. Extraia TODAS as informações sobre o evento que conseguir identificar
3. Se um campo não estiver explícito no documento, retorne null — NUNCA INVENTE
4. Datas: formato YYYY-MM-DD (ex: "16/05/2026" → "2026-05-16")
5. Horários: formato HH:MM em 24h (ex: "15h" → "15:00", "7 da noite" → "19:00")
6. Datetime (prazo de inscrição): ISO 8601 com timezone -03:00 (ex: "2026-05-11T23:59:00-03:00")
7. Preços: número decimal, sem moeda (ex: "R$ 80,00" → 80.00)
8. Cor temática: sugira hex adequado ao tema:
   - Dia das Mães → "#EC4899" (rosa)
   - Festa Junina → "#F59E0B" (âmbar/laranja)
   - Natal → "#16A34A" (verde)
   - Formatura → "#7C3AED" (roxo)
   - Carnaval → "#F5A623" (amarelo)
   - Genérico → "#C2410C" (laranja NEEL)
9. infos_importantes: cada item DEVE ser uma frase completa, autocontida (ex: "Inscrições por ordem de chegada.")
10. tipos_ingresso: SEMPRE pelo menos 1 item. Se o evento for gratuito, crie 1 tipo com preço 0.
11. LOTES — IMPORTANTE: Avisos frequentemente cobram preços diferentes em datas diferentes. SEMPRE procure padrões como:
    - Explícitos: "1º lote", "2º lote", "lote promocional", "pré-venda", "lote final"
    - Implícitos por data: "R$ 60 até 30/05, depois R$ 80", "Valor promocional até 25/03: R$ 50. Após essa data: R$ 70"
    - Por antecipação: "Adquirindo até 20/04: R$ 40. Valor normal: R$ 60", "Antecipado: R$ 30. Na hora: R$ 50"
    - Estendido: "Senha R$ 80 até dia 10. Entre 11 e 20: R$ 90. Depois disso: R$ 100"

    REGRAS pra extrair:
    - Identifique CADA faixa de preço como um lote separado
    - Cada lote: {nome, preco, valido_ate}
    - "nome" descritivo: "1º Lote", "Lote Promocional", "Lote Pré-venda", "Valor Antecipado", "Lote Final"
    - "valido_ate": ISO 8601 com -03:00 e hora 23:59 do dia limite (ex: "2026-05-30T23:59:00-03:00")
    - O ÚLTIMO lote (sem prazo final / "depois disso vale isso") DEVE ter valido_ate = null
    - Se NÃO houver lotes (só um preço único), deixe lotes como array vazio []
    - Quando houver lotes, "preco" do tipo = preço do PRIMEIRO lote (cronologicamente mais cedo)

    Exemplo de extração:
    Aviso: "Senha de Mãe R$ 60 até 30/05, depois R$ 80 até 10/06, e depois disso R$ 100"
    → tipos_ingresso[0].lotes = [
        {nome: "1º Lote", preco: 60, valido_ate: "2026-05-30T23:59:00-03:00"},
        {nome: "2º Lote", preco: 80, valido_ate: "2026-06-10T23:59:00-03:00"},
        {nome: "Lote Final", preco: 100, valido_ate: null}
      ]
    → tipos_ingresso[0].preco = 60
12. metodos_pagamento: padrão ["pix", "cartao"] a menos que o aviso restrinja
13. max_parcelas: padrão 3, a menos que mencione outro número

USE A FERRAMENTA "extrair_evento" pra retornar a resposta estruturada. Nunca responda em texto livre.`;

const extractEventoTool: Anthropic.Tool = {
  name: "extrair_evento",
  description: "Estrutura os dados extraídos do aviso de evento do NEEL.",
  input_schema: {
    type: "object",
    properties: {
      nome: {
        type: "string",
        description:
          "Nome do evento (ex: 'Dia das Mães 2026', 'Festa Junina 2026'). Sempre inclua o ano.",
      },
      descricao_curta: {
        type: ["string", "null"],
        description:
          "Frase resumo do evento (até 140 caracteres). Aparece como subtítulo do card.",
      },
      descricao_longa: {
        type: ["string", "null"],
        description:
          "Descrição completa. Pode ter parágrafos separados por '\\n\\n' e itens em bullets (linhas começando com '•').",
      },
      data_evento: {
        type: "string",
        description: "Data do evento no formato YYYY-MM-DD.",
      },
      hora_evento: {
        type: ["string", "null"],
        description: "Horário no formato HH:MM (24h).",
      },
      local: {
        type: ["string", "null"],
        description: "Local físico do evento (ex: 'Salão principal do NEEL').",
      },
      cor_tematica: {
        type: "string",
        pattern: "^#[0-9A-Fa-f]{6}$",
        description: "Cor hex adequada ao tema (ex: '#EC4899' para Dia das Mães).",
      },
      metodos_pagamento: {
        type: "array",
        items: {
          type: "string",
          enum: ["pix", "cartao"],
        },
        minItems: 1,
        description: "Métodos aceitos. Padrão: ['pix', 'cartao'].",
      },
      max_parcelas: {
        type: "integer",
        minimum: 1,
        maximum: 12,
        description: "Máximo de parcelas no cartão. Padrão: 3.",
      },
      prazo_inscricao: {
        type: ["string", "null"],
        description:
          "Data limite pra inscrição no formato ISO 8601 com timezone -03:00.",
      },
      destinacao_valores: {
        type: ["string", "null"],
        description:
          "Pra que será usado o dinheiro arrecadado (ex: 'Lembrancinhas, ornamentação...').",
      },
      infos_importantes: {
        type: "array",
        items: { type: "string" },
        description:
          "Lista de avisos importantes (uma frase completa por item).",
      },
      tipos_ingresso: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: {
              type: "string",
              description: "Nome do ingresso (ex: 'Senha de Mãe').",
            },
            preco: {
              type: "number",
              minimum: 0,
              description:
                "Preço base em reais. Se houver lotes, use o preço do PRIMEIRO lote (mais cedo).",
            },
            descricao: {
              type: ["string", "null"],
              description: "Descrição opcional (ex: 'por mãe').",
            },
            lotes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: {
                    type: "string",
                    description: "Nome do lote (ex: '1º Lote', 'Lote Promocional').",
                  },
                  preco: {
                    type: "number",
                    minimum: 0,
                    description: "Preço deste lote em reais.",
                  },
                  valido_ate: {
                    type: ["string", "null"],
                    description:
                      "Data/hora limite ISO 8601 -03:00 (ex: '2026-05-30T23:59:00-03:00'). Use null no ÚLTIMO lote (sem prazo).",
                  },
                },
                required: ["nome", "preco", "valido_ate"],
              },
              description:
                "Lotes do ingresso. Deixe vazio [] se o aviso NÃO mencionar lotes. Use quando houver preços diferentes por período.",
            },
          },
          required: ["nome", "preco", "lotes"],
        },
        minItems: 1,
        description:
          "Tipos de ingresso com preços. SEMPRE pelo menos 1 (use preço 0 se gratuito).",
      },
    },
    required: [
      "nome",
      "data_evento",
      "cor_tematica",
      "tipos_ingresso",
      "metodos_pagamento",
      "max_parcelas",
      "infos_importantes",
    ],
  },
};

export interface ExtractedEvento {
  nome: string;
  descricao_curta: string | null;
  descricao_longa: string | null;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
  cor_tematica: string;
  metodos_pagamento: string[];
  max_parcelas: number;
  prazo_inscricao: string | null;
  destinacao_valores: string | null;
  infos_importantes: string[];
  tipos_ingresso: {
    nome: string;
    preco: number;
    descricao: string | null;
    lotes: { nome: string; preco: number; valido_ate: string | null }[];
  }[];
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não está configurada. Adicione a chave no arquivo .env.local e reinicie o servidor.",
    );
  }
  return new Anthropic({ apiKey });
}

async function callClaudeWithExtraction(
  userContent: Anthropic.ContentBlockParam[],
): Promise<ExtractedEvento> {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [extractEventoTool],
    tool_choice: { type: "tool", name: "extrair_evento" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "extrair_evento",
  );

  if (!toolUse) {
    throw new Error(
      "A IA não retornou dados estruturados. Tente novamente com um conteúdo mais claro.",
    );
  }

  return toolUse.input as ExtractedEvento;
}

/** Extrai evento a partir de texto livre (Word, e-mail, mensagem do Drive, etc.). */
export async function extractEventoFromText(
  text: string,
): Promise<ExtractedEvento> {
  return callClaudeWithExtraction([
    {
      type: "text",
      text: `Analise o aviso abaixo e extraia as informações do evento:\n\n---\n${text}\n---`,
    },
  ]);
}

/** Extrai evento a partir de um PDF (recebe base64 do arquivo). */
export async function extractEventoFromPDF(
  pdfBase64: string,
): Promise<ExtractedEvento> {
  return callClaudeWithExtraction([
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdfBase64,
      },
    },
    {
      type: "text",
      text: "Analise este PDF de aviso e extraia as informações do evento.",
    },
  ]);
}
