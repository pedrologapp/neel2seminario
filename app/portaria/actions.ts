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
 * Portaria em dois modos (2º Seminário, 31/10): "entrada" valida os
 * ingressos; "almoco" valida só os almoços. Cada QR é de um tipo; um QR de
 * almoço lido na entrada (ou o contrário) NÃO é marcado — aparece o aviso.
 * O tipo vem do nome: "Almoço - ..." é almoço; o resto é entrada.
 */
export type Modo = "entrada" | "almoco";

function modoDoTipo(nomeTipo: string | null | undefined): Modo {
  return normalizar(nomeTipo ?? "").startsWith("almoco") ? "almoco" : "entrada";
}

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

/**
 * Quantas senhas DO MODO a inscrição comprou (itens pagos) e quantas já foram
 * usadas (ordens distintas, pra duplicatas do n8n não contarem duas vezes).
 */
async function progresso(
  admin: Admin,
  inscricaoId: string,
  modo: Modo,
): Promise<{ usadas: number; total: number }> {
  const [{ data: insc }, { data: tks }] = await Promise.all([
    admin.from("inscricoes").select("itens").eq("id", inscricaoId).maybeSingle(),
    admin
      .from("tickets")
      .select("status, ordem, nome_tipo")
      .eq("inscricao_id", inscricaoId)
      .neq("status", "cancelado"),
  ]);
  const itens = (insc?.itens as ItemInscricao[] | null) ?? [];
  let total = itens
    .filter((it) => modoDoTipo(it.nome) === modo)
    .reduce((s, it) => s + (it.qtd && it.qtd > 0 ? it.qtd : 0), 0);
  const doModo = (tks ?? []).filter((t) => modoDoTipo(t.nome_tipo) === modo);
  if (total === 0) total = new Set(doModo.map((t) => t.ordem)).size;
  const usadas = new Set(doModo.filter((t) => t.status === "usado").map((t) => t.ordem)).size;
  return { usadas: Math.min(usadas, total), total };
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
  | { status: "tipo_errado"; nome: string; tipo: string; modoDoQr: Modo }
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
  modo: Modo = "entrada",
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
      const todos = await montarParticipantes(admin, eventoId, modo);
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

  // QR de almoço na entrada (ou de entrada no almoço): não marca nada
  const modoDoQr = modoDoTipo(ticket.nome_tipo);
  if (modoDoQr !== modo) {
    return { status: "tipo_errado", nome, tipo: ticket.nome_tipo, modoDoQr };
  }

  if (ticket.status === "usado") {
    const prog = await progresso(admin, ticket.inscricao_id, modo);
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

  const prog = await progresso(admin, ticket.inscricao_id, modo);

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
  modo: Modo = "entrada",
): Promise<ConfirmacaoManual> {
  if (!(await portariaAutenticada())) {
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  }

  const admin = createAdminClient();
  const antes = await progresso(admin, inscricaoId, modo);
  if (antes.total > 0 && antes.usadas >= antes.total) {
    return {
      ok: false,
      error: modo === "almoco" ? "Todos os almoços já foram entregues." : "Todas as entradas já foram confirmadas.",
      ...antes,
    };
  }

  // Próxima senha ativa DO MODO (menor ordem) dessa inscrição neste evento
  const { data: ativos } = await admin
    .from("tickets")
    .select("id, nome_tipo, ordem")
    .eq("inscricao_id", inscricaoId)
    .eq("evento_id", eventoId)
    .eq("status", "ativo")
    .order("ordem", { ascending: true });
  const ticket = (ativos ?? []).find((t) => modoDoTipo(t.nome_tipo) === modo);

  if (!ticket) {
    // Comprou (itens pagos) mas não tem senha gerada — ex.: inscrições do site
    // antigo. Registra a presença criando a senha já usada, para a conta e a
    // lista ficarem certas e um QR lido depois não passar de novo.
    if (antes.total === 0) {
      return { ok: false, error: modo === "almoco" ? "Essa pessoa não comprou almoço." : "Essa inscrição não tem entrada.", ...antes };
    }
    const { data: ult } = await admin
      .from("tickets")
      .select("ordem, aluno_nome")
      .eq("inscricao_id", inscricaoId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const tok = (tokenLido || "").trim();
    let token = "NEEL-PORTARIA-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    if (tok) {
      const { data: existe } = await admin.from("tickets").select("id").eq("token", tok).maybeSingle();
      if (!existe) token = tok;
    }
    const { error } = await admin.from("tickets").insert({
      inscricao_id: inscricaoId,
      evento_id: eventoId,
      nome_tipo: modo === "almoco" ? "Almoço (confirmado na portaria)" : "Entrada (confirmada na portaria)",
      preco_unitario: 0,
      ordem: (ult?.ordem ?? 0) + 1,
      token,
      status: "usado",
      usado_em: new Date().toISOString(),
      aluno_nome: ult?.aluno_nome ?? null,
    });
    const prog = await progresso(admin, inscricaoId, modo);
    if (error) return { ok: false, error: "Não foi possível registrar. Tente de novo.", ...prog };
    return { ok: true, ...prog };
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

  const prog = await progresso(admin, inscricaoId, modo);
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
  /** quando foi a última confirmação (para mostrar "às 08:12") */
  ultimaEm: string | null;
  /** os tipos comprados neste modo, ex.: "Creme de Frango" (almoço) */
  tipos: string[];
  /** "Cortesia" ou "Fará em outro dia" (lançados à mão pela organização) */
  etiqueta: string | null;
};

export async function listarParticipantes(
  eventoId: string,
  modo: Modo = "entrada",
): Promise<Participante[]> {
  if (!(await portariaAutenticada())) return [];
  return montarParticipantes(createAdminClient(), eventoId, modo);
}

type ItemInscricao = { nome?: string; qtd?: number };

async function montarParticipantes(
  admin: Admin,
  eventoId: string,
  modo: Modo = "entrada",
): Promise<Participante[]> {
  // Base = inscrições PAGAS (+ as liberadas para pagar depois, 31/10). O total de senhas vem da quantidade realmente
  // comprada (itens.qtd), igual ao relatório — não da contagem de linhas em
  // tickets, que pode ter duplicatas (n8n gerou tickets mais de uma vez).
  const { data: inscricoes } = await admin
    .from("inscricoes")
    .select("id, responsavel_nome, itens, registrado_por")
    .eq("evento_id", eventoId)
    .or("status_pagamento.eq.pago,and(status_pagamento.eq.pendente,registrado_por.eq.portaria-paga-depois)");

  if (!inscricoes || inscricoes.length === 0) return [];

  // Tickets só para saber quantas senhas já foram usadas (por ordem distinta,
  // pra duplicatas não contarem a mesma entrada duas vezes) e o nome snapshot.
  const { data: tickets } = await admin
    .from("tickets")
    .select("inscricao_id, status, ordem, aluno_nome, nome_tipo, usado_em")
    .eq("evento_id", eventoId)
    .neq("status", "cancelado");

  const usadasPorInsc = new Map<string, Set<number>>();
  const alunoNomePorInsc = new Map<string, string>();
  const ultimaPorInsc = new Map<string, string>();
  for (const t of tickets ?? []) {
    if (t.status === "usado" && modoDoTipo(t.nome_tipo) === modo) {
      if (t.usado_em && (!ultimaPorInsc.has(t.inscricao_id) || t.usado_em > ultimaPorInsc.get(t.inscricao_id)!)) {
        ultimaPorInsc.set(t.inscricao_id, t.usado_em);
      }
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
    const itens = ((i.itens as ItemInscricao[] | null) ?? []).filter(
      (it) => modoDoTipo(it.nome) === modo,
    );
    const total = itens.reduce(
      (s, it) => s + (it.qtd && it.qtd > 0 ? it.qtd : 0),
      0,
    );
    if (total === 0) continue;

    const responsavel = (i.responsavel_nome ?? "").trim();
    const nome = alunoNomePorInsc.get(i.id) || responsavel || "Participante";
    const usadas = Math.min(usadasPorInsc.get(i.id)?.size ?? 0, total);

    const tipos = [...new Set(itens.map((it) => (it.nome ?? "").replace(/^Almo[cç]o\s*-\s*/i, "").replace(/[.,].*$/, "").trim()).filter(Boolean))];
    out.push({ inscricaoId: i.id, nome, responsavel, usadas, total, ultimaEm: ultimaPorInsc.get(i.id) ?? null, tipos, etiqueta: i.registrado_por?.startsWith("portaria-cortesia") || i.registrado_por?.startsWith("cortesia") ? "Cortesia" : i.registrado_por === "portaria-paga-depois" ? "Fará em outro dia" : null });
  }

  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
