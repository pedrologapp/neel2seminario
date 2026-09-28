import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Divulgação nos grupos de WhatsApp do Pedro (28/09/2026).
 * Grupos chegam do WhatsApp pelo n8n (/api/divulgacao/grupos); no admin ele
 * marca quais recebem e cuida do material. Só envia com a divulgação LIGADA.
 *
 * Enquanto não há acesso ao SQL do banco do NEEL (a conta é de outra pessoa),
 * o estado fica num JSON no Storage, num bucket PRIVADO (divulgacao-dados).
 * Flyer e vídeo ficam no bucket público "eventos" (o WhatsApp baixa de lá).
 * A migration 0015 fica pronta para quando der para mover para tabelas.
 */

export interface GrupoDivulgacao {
  chat_id: string;
  nome: string | null;
  divulgar: boolean;
  visto_em: string | null;
}

export interface ConfigDivulgacao {
  ativo: boolean;
  ritmo: "diario" | "alternado";
  inicio: string | null;
  fim: string | null;
  horarios: string[];
  intervalo_min: number;
  flyer_url: string | null;
  video_url: string | null;
  textos: string[];
  link: string | null;
}

export interface EnvioDivulgacao {
  id: number;
  dia: string;
  horario: string | null;
  nome: string | null;
  tipo: string | null;
  status: string;
  erro: string | null;
  criado_em: string;
}

export interface EstadoDivulgacao {
  config: ConfigDivulgacao;
  grupos: GrupoDivulgacao[];
  envios: EnvioDivulgacao[];
  atualizado_em: string | null;
}

const BUCKET = "divulgacao-dados";
const ARQUIVO = "estado.json";

const PADRAO: EstadoDivulgacao = {
  config: {
    ativo: false,
    ritmo: "diario",
    inicio: null,
    fim: null,
    horarios: ["07:00", "20:00", "12:30", "18:00", "09:00", "19:30"],
    intervalo_min: 3,
    flyer_url: null,
    video_url: null,
    textos: [],
    link: null,
  },
  grupos: [],
  envios: [],
  atualizado_em: null,
};

/** Grupos que parecem espíritas / do NEEL: aparecem com o selo "sugerido". */
export function sugerido(nome: string | null) {
  return /neel|crenorte|fern\b|esp[ií]rit|kardec|evangelho|seminário esp/i.test(nome ?? "");
}

export async function lerEstado(): Promise<EstadoDivulgacao> {
  const storage = createAdminClient().storage;
  const { data, error } = await storage.from(BUCKET).download(ARQUIVO);
  if (error && !/not.?found|does not exist|404/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ""}`)) {
    // Falha de leitura (rede etc.): não seguir com o estado vazio, senão um salvar apagaria tudo.
    throw new Error(`Não consegui ler a divulgação: ${error.message}`);
  }
  if (error || !data) {
    // Primeira vez: cria o bucket privado (se já existir, o erro é ignorado).
    await storage.createBucket(BUCKET, { public: false }).catch(() => null);
    return structuredClone(PADRAO);
  }
  const salvo = JSON.parse(await data.text()) as Partial<EstadoDivulgacao>;
  return {
    config: { ...PADRAO.config, ...(salvo.config ?? {}) },
    grupos: salvo.grupos ?? [],
    envios: salvo.envios ?? [],
    atualizado_em: salvo.atualizado_em ?? null,
  };
}

export async function salvarEstado(e: EstadoDivulgacao) {
  const storage = createAdminClient().storage;
  const corpo = JSON.stringify({ ...e, envios: e.envios.slice(0, 500), atualizado_em: new Date().toISOString() });
  const envio = () => storage.from(BUCKET).upload(ARQUIVO, new Blob([corpo], { type: "application/json" }), { upsert: true, contentType: "application/json", cacheControl: "0" });
  let { error } = await envio();
  if (error && /bucket not found/i.test(error.message)) {
    await storage.createBucket(BUCKET, { public: false });
    ({ error } = await envio());
  }
  if (error) throw new Error(error.message);
}

export async function carregarDivulgacao() {
  try {
    const e = await lerEstado();
    const grupos = [...e.grupos].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
    return { faltaTabela: false, erro: null as string | null, config: e.config, grupos, envios: e.envios.slice(0, 60) };
  } catch (err) {
    return { faltaTabela: false, erro: (err as Error).message, config: null, grupos: [] as GrupoDivulgacao[], envios: [] as EnvioDivulgacao[] };
  }
}
