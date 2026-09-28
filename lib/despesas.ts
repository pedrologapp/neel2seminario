import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Despesas do 2º Seminário (28/09/2026), para a prestação de contas.
 *
 * O banco do NEEL fica em outra conta do Supabase (sem acesso para criar
 * tabela), então as despesas moram num JSON no Storage, no mesmo esquema da
 * Divulgação: cada gravação é um arquivo novo em "despesas/" e a leitura pega
 * o mais recente (sobrescrever o mesmo arquivo devolvia versão velha do CDN).
 * Os comprovantes ficam no bucket privado "financeiro-comprovantes".
 */

export const BUCKET_DADOS = "financeiro-dados";
export const BUCKET_COMPROVANTES = "financeiro-comprovantes";
const PASTA = "despesas";

export const CATEGORIAS = [
  "Palestrantes (passagem, hospedagem, cachê)",
  "Local (auditório)",
  "Alimentação",
  "Material gráfico e brindes",
  "Decoração",
  "Som, imagem e transmissão",
  "Transporte",
  "Divulgação",
  "Taxas e serviços",
  "Outros",
] as const;

export const FORMAS = ["Pix", "Dinheiro", "Cartão", "Transferência", "Boleto"] as const;

export interface Despesa {
  id: string;
  data: string; // AAAA-MM-DD
  descricao: string;
  categoria: string;
  fornecedor: string | null;
  valor: number;
  forma: string | null;
  comprovante: string | null; // caminho no bucket de comprovantes
  obs: string | null;
  criado_em: string;
  criado_por: string | null;
}

interface Estado {
  despesas: Despesa[];
  atualizado_em: string | null;
}

export async function lerDespesas(): Promise<Despesa[]> {
  const storage = createAdminClient().storage;
  const { data: lista, error } = await storage.from(BUCKET_DADOS).list(PASTA, { limit: 1, sortBy: { column: "name", order: "desc" } });
  if (error && !/not.?found|does not exist/i.test(error.message)) throw new Error(`Não consegui ler as despesas: ${error.message}`);
  if (!lista?.length) return [];
  const { data, error: e2 } = await storage.from(BUCKET_DADOS).download(`${PASTA}/${lista[0].name}`);
  if (e2 || !data) throw new Error(`Não consegui ler as despesas: ${e2?.message ?? "sem dados"}`);
  return ((JSON.parse(await data.text()) as Partial<Estado>).despesas ?? []).sort((a, b) => b.data.localeCompare(a.data));
}

export async function salvarDespesas(despesas: Despesa[]) {
  const storage = createAdminClient().storage;
  const agora = new Date();
  const corpo = JSON.stringify({ despesas, atualizado_em: agora.toISOString() } satisfies Estado);
  const nome = `${PASTA}/${agora.toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 7)}.json`;
  const envio = () => storage.from(BUCKET_DADOS).upload(nome, new Blob([corpo], { type: "application/json" }), { contentType: "application/json", cacheControl: "0" });
  let { error } = await envio();
  if (error && /bucket not found/i.test(error.message)) {
    await storage.createBucket(BUCKET_DADOS, { public: false });
    ({ error } = await envio());
  }
  if (error) throw new Error(error.message);
  // Guarda as 50 versões mais recentes (dá para voltar atrás se algo for apagado sem querer).
  const { data: todas } = await storage.from(BUCKET_DADOS).list(PASTA, { limit: 300, sortBy: { column: "name", order: "desc" } });
  const velhas = (todas ?? []).slice(50).map((x) => `${PASTA}/${x.name}`);
  if (velhas.length) await storage.from(BUCKET_DADOS).remove(velhas);
}

/** Links temporários (8h) para abrir os comprovantes. */
export async function linksComprovantes(caminhos: string[]) {
  if (!caminhos.length) return new Map<string, string>();
  const { data } = await createAdminClient().storage.from(BUCKET_COMPROVANTES).createSignedUrls(caminhos, 60 * 60 * 8);
  return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? "", d.signedUrl]));
}
