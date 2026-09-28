import { NextRequest, NextResponse } from "next/server";
import { lerEstado, salvarEstado } from "@/lib/divulgacao";

/** O n8n registra aqui cada envio (enviado ou erro) para o histórico da aba. */
export async function POST(req: NextRequest) {
  const esperado = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!esperado || req.headers.get("x-webhook-secret") !== esperado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) as {
    dia?: string; horario?: string; chat_id?: string; nome?: string; tipo?: string; status?: string; erro?: string;
  } | null;
  if (!b?.dia || !b.chat_id) return NextResponse.json({ error: "dia e chat_id obrigatórios" }, { status: 400 });
  const estado = await lerEstado();
  estado.envios.unshift({
    id: Date.now(),
    dia: b.dia,
    horario: b.horario ?? null,
    nome: b.nome ?? null,
    tipo: b.tipo ?? null,
    status: b.status === "erro" ? "erro" : "enviado",
    erro: b.erro ? String(b.erro).slice(0, 300) : null,
    criado_em: new Date().toISOString(),
  });
  await salvarEstado(estado);
  return NextResponse.json({ ok: true });
}
