import { NextRequest, NextResponse } from "next/server";
import { agoraNatal, calendario, lerEstado, salvarEstado } from "@/lib/divulgacao";

/**
 * O n8n pergunta aqui, a cada 5 minutos, se é hora de divulgar.
 * Só responde "enviar" quando: divulgação LIGADA, hoje está no calendário,
 * já passou do horário sorteado (até 2h depois) e hoje ainda não foi iniciado.
 * Ao responder "enviar", marca o dia como iniciado (nunca envia 2x no dia).
 * Header: X-Webhook-Secret = WEBHOOK_CONFIRM_SECRET.
 */
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

export async function POST(req: NextRequest) {
  const esperado = process.env.WEBHOOK_CONFIRM_SECRET;
  if (!esperado || req.headers.get("x-webhook-secret") !== esperado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const estado = await lerEstado();
  const c = estado.config;
  const { dia, hora } = agoraNatal();
  const nao = (motivo: string) => NextResponse.json({ enviar: false, motivo, dia, hora });

  if (!c.ativo) return nao("divulgação desligada");
  const cal = calendario(c);
  const idx = cal.findIndex((x) => x.dia === dia);
  if (idx < 0) return nao("hoje não é dia de divulgação");
  const slot = cal[idx];
  if (estado.rodadas[dia]) return nao("hoje já foi enviado");
  const atraso = minutos(hora) - minutos(slot.horario);
  if (atraso < 0) return nao(`ainda não: hoje é às ${slot.horario}`);
  if (atraso > 120) return nao(`passou do horário (${slot.horario}); não envia fora de hora`);
  const grupos = estado.grupos.filter((g) => g.divulgar).map((g) => ({ chat_id: g.chat_id, nome: g.nome }));
  if (!grupos.length) return nao("nenhum grupo marcado");
  const url = slot.tipo === "flyer" ? c.flyer_url : c.video_url;
  if (!url) return nao(`sem ${slot.tipo}`);
  if (!c.textos.length) return nao("sem texto");

  let texto = c.textos[idx % c.textos.length];
  if (c.link && !texto.includes(c.link)) texto = `${texto}\n\n${c.link}`;
  const ext = (url.split("?")[0].split(".").pop() ?? "").toLowerCase();
  const mimetype = slot.tipo === "video" ? (ext === "mov" ? "video/quicktime" : "video/mp4") : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  // Trava do dia ANTES de responder: se o n8n perguntar de novo, não repete.
  estado.rodadas[dia] = { iniciado_em: new Date().toISOString() };
  await salvarEstado(estado);

  return NextResponse.json({
    enviar: true,
    dia,
    horario: slot.horario,
    tipo: slot.tipo,
    texto,
    midia: { url, mimetype, filename: slot.tipo === "video" ? "seminario-neel.mp4" : `seminario-neel.${ext || "jpg"}` },
    intervalo_min: c.intervalo_min,
    grupos,
  });
}
