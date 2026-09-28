import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { assinaturaValida, carregarIngressos } from "@/lib/ingressos";
import { Capa, fontes, fotoJpeg } from "@/lib/ingressos-arte";

/** Capa 16:9 da confirmação (vai como imagem no WhatsApp, antes do PDF). */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const id = searchParams.get("i") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !assinaturaValida(id, searchParams.get("s") ?? "")) {
    return new Response("Link inválido.", { status: 403 });
  }
  const d = await carregarIngressos(id);
  if (!d) return new Response("Inscrição não encontrada ou não paga.", { status: 404 });

  const W = 1600, H = 900;
  const [fs, fotos] = await Promise.all([
    fontes(origin),
    Promise.all(d.evento.palestrantes.slice(0, 3).map((p) => fotoJpeg(p.foto_url, 320))),
  ]);
  return new ImageResponse(<Capa d={d} logo={new URL("/logo-neel.png", origin).toString()} fotos={fotos} W={W} H={H} />, {
    width: W,
    height: H,
    fonts: fs,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
