import { NextRequest, NextResponse } from "next/server";
import { carregarIngressos, dataPorExtenso, horaCurta, linksIngressos } from "@/lib/ingressos";

/**
 * Chamado pelo n8n depois de gerar os tickets e marcar como pago: devolve a
 * capa 16:9, o PDF dos ingressos (links assinados) e o texto da confirmação.
 * Header: X-Webhook-Secret = WEBHOOK_CONFIRM_SECRET.
 */
export async function POST(req: NextRequest) {
  const esperado = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!esperado || req.headers.get("x-webhook-secret") !== esperado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { inscricaoId?: string } | null;
  const id = body?.inscricaoId ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "inscricaoId inválido" }, { status: 400 });

  const d = await carregarIngressos(id);
  if (!d) return NextResponse.json({ error: "Inscrição não encontrada ou não paga" }, { status: 404 });
  if (!d.ingressos.length) return NextResponse.json({ error: "Ingressos ainda não gerados" }, { status: 409 });

  const nome = d.pessoa.trim().split(/\s+/)[0] ?? "";
  const primeiro = nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
  const partes = [
    d.entradas ? `${d.entradas} ${d.entradas === 1 ? "entrada" : "entradas"}` : null,
    d.almocos ? `${d.almocos} ${d.almocos === 1 ? "almoço" : "almoços"}` : null,
  ].filter(Boolean);
  const hora = horaCurta(d.evento.hora);
  const [dia] = dataPorExtenso(d.evento.data).split(",");
  const data = new Date(`${d.evento.data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const local = d.evento.local ? d.evento.local.split(" - ")[0] : null;

  const texto = [
    `Olá, ${primeiro}! Sua inscrição no *${d.evento.nome}* está confirmada.`,
    "",
    `${dia}, ${data}${hora ? `, às ${hora}` : ""}${local ? `, no ${local}` : ""}.`,
    "",
    `Seus ingressos estão no PDF abaixo: ${partes.join(" e ")}. Na entrada, é só mostrar o QR code${d.ingressos.length > 1 ? " de cada pessoa" : ""} pelo celular.`,
    "",
    `Dúvidas: ${d.contato}`,
    "NEEL — Núcleo Espírita Esperança de Luz",
  ].join("\n");

  const origem = req.nextUrl.origin;
  const links = linksIngressos(origem, id);
  return NextResponse.json({
    ok: true,
    capaUrl: links.capa,
    pdfUrl: links.pdf,
    arquivo: `Ingressos - ${d.evento.nome}.pdf`,
    texto,
    ingressos: d.ingressos.length,
  });
}
