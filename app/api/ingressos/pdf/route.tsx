import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { assinaturaValida, carregarIngressos } from "@/lib/ingressos";
import { PaginaIngresso, PaginaResumo, fontes, qrDataUri } from "@/lib/ingressos-arte";

/**
 * PDF com os ingressos de uma inscrição: 1ª página com o resumo e depois uma
 * página por ingresso (entradas primeiro, almoço depois), no formato de tela
 * de celular. Cada página é desenhada como imagem e montada no PDF.
 */
export const maxDuration = 60;

const W = 1080, H = 1920; // desenho
const PW = 405, PH = 720; // página do PDF em pontos (9:16)

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const id = searchParams.get("i") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !assinaturaValida(id, searchParams.get("s") ?? "")) {
    return new Response("Link inválido.", { status: 403 });
  }
  const d = await carregarIngressos(id);
  if (!d) return new Response("Inscrição não encontrada ou não paga.", { status: 404 });
  if (!d.ingressos.length) return new Response("Os ingressos ainda não foram gerados.", { status: 404 });

  const fs = await fontes(origin);
  const logo = new URL("/logo-neel.png", origin).toString();
  const png = async (el: React.ReactElement) => new Uint8Array(await new ImageResponse(el, { width: W, height: H, fonts: fs }).arrayBuffer());

  const paginas = [await png(<PaginaResumo d={d} logo={logo} W={W} H={H} />)];
  for (let i = 0; i < d.ingressos.length; i++) {
    const ing = d.ingressos[i];
    paginas.push(await png(<PaginaIngresso d={d} ing={ing} n={i + 1} total={d.ingressos.length} qr={await qrDataUri(ing.token)} logo={logo} W={W} H={H} />));
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ingressos · ${d.evento.nome}`);
  pdf.setAuthor("NEEL — Núcleo Espírita Esperança de Luz");
  for (const p of paginas) {
    const img = await pdf.embedPng(p);
    pdf.addPage([PW, PH]).drawImage(img, { x: 0, y: 0, width: PW, height: PH });
  }
  const bytes = await pdf.save();
  const nome = `ingressos-${d.pessoa.split(/\s+/)[0]?.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase() || "neel"}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
