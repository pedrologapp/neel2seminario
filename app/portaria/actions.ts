"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  criarSessaoPortaria,
  encerrarSessaoPortaria,
  portariaAutenticada,
  senhaPortariaValida,
} from "@/lib/portaria-auth";

// ============================================================
// Acesso
// ============================================================

export type EntrarState = { error?: string } | null;

export async function entrarPortaria(
  _prev: EntrarState,
  formData: FormData,
): Promise<EntrarState> {
  const senha = formData.get("senha")?.toString() ?? "";
  if (!senhaPortariaValida(senha)) {
    return { error: "Senha incorreta." };
  }
  await criarSessaoPortaria();
  redirect("/portaria");
}

export async function sairPortaria(): Promise<void> {
  await encerrarSessaoPortaria();
  redirect("/portaria");
}

// ============================================================
// Helpers internos
// ============================================================

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Extrai o token do conteúdo lido. Os QRs do fluxo normal contêm só o token
 * (ex: "AMZ-SAOJOAO-..."); os de reenvio/avulsa contêm "nome | tipo | token".
 * Em ambos, o token é o último segmento separado por "|".
 */
function extrairToken(raw: string): string {
  const txt = (raw || "").trim();
  if (!txt) return "";
  const partes = txt
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  return partes.length ? partes[partes.length - 1] : txt;
}

async function progresso(
  admin: Admin,
  inscricaoId: string,
): Promise<{ usadas: number; total: number }> {
  const { data } = await admin
    .from("tickets")
    .select("status")
    .eq("inscricao_id", inscricaoId)
    .neq("status", "cancelado");
  const total = data?.length ?? 0;
  const usadas = (data ?? []).filter((t) => t.status === "usado").length;
  return { usadas, total };
}

// ============================================================
// Leitura / validação de QR
// ============================================================

export type ResultadoLeitura =
  | {
      status: "liberado";
      nome: string;
      tipo: string;
      usadas: number;
      total: number;
    }
  | {
      status: "ja_usado";
      nome: string;
      tipo: string;
      usadas: number;
      total: number;
      usadoEm: string | null;
    }
  | { status: "cancelado"; nome: string }
  | { status: "outro_evento"; eventoNome: string }
  | {
      status: "por_nome";
      nomeQr: string;
      tokenLido: string;
      candidatos: Participante[];
    }
  | { status: "nao_encontrado"; codigo: string; nomeQr?: string }
  | { status: "erro"; mensagem: string };

/**
 * Alguns QRs trazem "nome | tipo | token". Quando o token não bate com o
 * banco, ainda dá pra usar o nome lido para achar a pessoa na base.
 */
function nomeDoQr(raw: string): string | undefined {
  const partes = (raw || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  return partes.length >= 2 ? partes[0] : undefined;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export async function validarTicket(
  eventoId: string,
  codigoRaw: string,
): Promise<ResultadoLeitura> {
  if (!(await portariaAutenticada())) {
    return { status: "erro", mensagem: "Sessão expirada. Entre novamente." };
  }

  const token = extrairToken(codigoRaw);
  if (!token) return { status: "nao_encontrado", codigo: codigoRaw };

  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("tickets")
    .select("id, evento_id, inscricao_id, aluno_nome, nome_tipo, status, usado_em")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return { status: "erro", mensagem: "Erro ao consultar. Tente de novo." };
  }
  if (!ticket) {
    // Token não está na base. Se o QR trouxer o nome, tenta achar a pessoa
    // pelo nome (resgate de QRs antigos cujo código não bate com o banco).
    const nomeQr = nomeDoQr(codigoRaw);
    if (nomeQr) {
      const todos = await montarParticipantes(admin, eventoId);
      const alvo = normalizar(nomeQr);
      const candidatos = todos
        .filter((p) => {
          const n = normalizar(p.nome);
          return n === alvo || n.includes(alvo) || alvo.includes(n);
        })
        .slice(0, 8);
      if (candidatos.length > 0) {
        return { status: "por_nome", nomeQr, tokenLido: token, candidatos };
      }
      return { status: "nao_encontrado", codigo: token, nomeQr };
    }
    return { status: "nao_encontrado", codigo: token };
  }

  const nome = await resolverNome(admin, ticket.aluno_nome, ticket.inscricao_id);

  if (ticket.evento_id !== eventoId) {
    const { data: ev } = await admin
      .from("eventos")
      .select("nome")
      .eq("id", ticket.evento_id)
      .maybeSingle();
    return { status: "outro_evento", eventoNome: ev?.nome ?? "outro evento" };
  }

  if (ticket.status === "cancelado") {
    return { status: "cancelado", nome };
  }

  if (ticket.status === "usado") {
    const prog = await progresso(admin, ticket.inscricao_id);
    return {
      status: "ja_usado",
      nome,
      tipo: ticket.nome_tipo,
      usadoEm: ticket.usado_em,
      ...prog,
    };
  }

  // status 'ativo' → marca como usado de forma atômica.
  // O `.eq("status", "ativo")` garante que apenas uma leitura concorrente vence.
  const { data: upd } = await admin
    .from("tickets")
    .update({ status: "usado", usado_em: new Date().toISOString() })
    .eq("id", ticket.id)
    .eq("status", "ativo")
    .select("id")
    .maybeSingle();

  const prog = await progresso(admin, ticket.inscricao_id);

  if (!upd) {
    // Outra leitura marcou primeiro (entre o SELECT e o UPDATE).
    return {
      status: "ja_usado",
      nome,
      tipo: ticket.nome_tipo,
      usadoEm: new Date().toISOString(),
      ...prog,
    };
  }

  return { status: "liberado", nome, tipo: ticket.nome_tipo, ...prog };
}

async function resolverNome(
  admin: Admin,
  alunoNome: string | null,
  inscricaoId: string,
): Promise<string> {
  if (alunoNome && alunoNome.trim()) return alunoNome.trim();
  const { data } = await admin
    .from("inscricoes")
    .select("responsavel_nome")
    .eq("id", inscricaoId)
    .maybeSingle();
  return data?.responsavel_nome?.trim() || "Participante";
}

// ============================================================
// Confirmação manual (QR perdido / com problema)
// ============================================================

export type ConfirmacaoManual = {
  ok: boolean;
  usadas?: number;
  total?: number;
  error?: string;
};

export async function confirmarManual(
  eventoId: string,
  inscricaoId: string,
  tokenLido?: string,
): Promise<ConfirmacaoManual> {
  if (!(await portariaAutenticada())) {
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  }

  const admin = createAdminClient();

  // Próxima senha ativa (menor ordem) dessa inscrição neste evento
  const { data: ticket } = await admin
    .from("tickets")
    .select("id")
    .eq("inscricao_id", inscricaoId)
    .eq("evento_id", eventoId)
    .eq("status", "ativo")
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ticket) {
    const prog = await progresso(admin, inscricaoId);
    return { ok: false, error: "Todas as senhas já foram validadas.", ...prog };
  }

  const patch: { status: string; usado_em: string; token?: string } = {
    status: "usado",
    usado_em: new Date().toISOString(),
  };

  // Se veio um código no QR (confirmação por nome), grava esse código no
  // ticket — assim reler o mesmo QR passa a ser reconhecido como "já usado".
  // Só grava se o código ainda não existir na base (token é único).
  const tok = (tokenLido || "").trim();
  if (tok) {
    const { data: existente } = await admin
      .from("tickets")
      .select("id")
      .eq("token", tok)
      .maybeSingle();
    if (!existente) patch.token = tok;
  }

  const { data: upd } = await admin
    .from("tickets")
    .update(patch)
    .eq("id", ticket.id)
    .eq("status", "ativo")
    .select("id")
    .maybeSingle();

  const prog = await progresso(admin, inscricaoId);
  if (!upd) {
    return { ok: false, error: "Outra leitura já validou essa senha.", ...prog };
  }
  return { ok: true, ...prog };
}

// ============================================================
// Lista de participantes
// ============================================================

export type Participante = {
  inscricaoId: string;
  nome: string;
  responsavel: string;
  usadas: number;
  total: number;
};

export async function listarParticipantes(
  eventoId: string,
): Promise<Participante[]> {
  if (!(await portariaAutenticada())) return [];
  return montarParticipantes(createAdminClient(), eventoId);
}

type ItemInscricao = { nome?: string; qtd?: number };

async function montarParticipantes(
  admin: Admin,
  eventoId: string,
): Promise<Participante[]> {
  // Base = inscrições PAGAS. O total de senhas vem da quantidade realmente
  // comprada (itens.qtd), igual ao relatório — não da contagem de linhas em
  // tickets, que pode ter duplicatas (n8n gerou tickets mais de uma vez).
  const { data: inscricoes } = await admin
    .from("inscricoes")
    .select("id, responsavel_nome, itens")
    .eq("evento_id", eventoId)
    .eq("status_pagamento", "pago");

  if (!inscricoes || inscricoes.length === 0) return [];

  // Tickets só para saber quantas senhas já foram usadas (por ordem distinta,
  // pra duplicatas não contarem a mesma entrada duas vezes) e o nome snapshot.
  const { data: tickets } = await admin
    .from("tickets")
    .select("inscricao_id, status, ordem, aluno_nome")
    .eq("evento_id", eventoId)
    .neq("status", "cancelado");

  const usadasPorInsc = new Map<string, Set<number>>();
  const alunoNomePorInsc = new Map<string, string>();
  for (const t of tickets ?? []) {
    if (t.status === "usado") {
      let s = usadasPorInsc.get(t.inscricao_id);
      if (!s) {
        s = new Set<number>();
        usadasPorInsc.set(t.inscricao_id, s);
      }
      s.add(t.ordem);
    }
    if (t.aluno_nome && t.aluno_nome.trim() && !alunoNomePorInsc.has(t.inscricao_id)) {
      alunoNomePorInsc.set(t.inscricao_id, t.aluno_nome.trim());
    }
  }

  const out: Participante[] = [];
  for (const i of inscricoes) {
    const itens = (i.itens as ItemInscricao[] | null) ?? [];
    const total = itens.reduce(
      (s, it) => s + (it.qtd && it.qtd > 0 ? it.qtd : 0),
      0,
    );
    if (total === 0) continue;

    const responsavel = (i.responsavel_nome ?? "").trim();
    const nome = alunoNomePorInsc.get(i.id) || responsavel || "Participante";
    const usadas = Math.min(usadasPorInsc.get(i.id)?.size ?? 0, total);

    out.push({ inscricaoId: i.id, nome, responsavel, usadas, total });
  }

  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
