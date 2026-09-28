/* eslint-disable @next/next/no-img-element -- Satori desenha <img>, não é página */
import "server-only";
import QRCode from "qrcode";
import { dataPorExtenso, horaCurta, type DadosIngressos, type Ingresso } from "@/lib/ingressos";

/** Identidade do NEEL: marrom do logo, laranja do arco e creme. */
export const COR = {
  marrom: "#5B3A1F",
  marromEscuro: "#3E2712",
  laranja: "#F29B3F",
  laranjaForte: "#E07B1A",
  creme: "#FDF6EC",
  areia: "#F5E6CF",
  cinza: "#7A6553",
};

async function fonte(origem: string, arquivo: string) {
  return (await fetch(new URL(`/fonts/${arquivo}`, origem))).arrayBuffer();
}

export async function fontes(origem: string) {
  const [d500, d700, d800, f700, fi] = await Promise.all([
    fonte(origem, "DMSans-500.woff"),
    fonte(origem, "DMSans-700.woff"),
    fonte(origem, "DMSans-800.woff"),
    fonte(origem, "Fraunces-700.woff"),
    fonte(origem, "Fraunces-500-italic.woff"),
  ]);
  return [
    { name: "DM", data: d500, weight: 500 as const, style: "normal" as const },
    { name: "DM", data: d700, weight: 700 as const, style: "normal" as const },
    { name: "DM", data: d800, weight: 800 as const, style: "normal" as const },
    { name: "Serif", data: f700, weight: 700 as const, style: "normal" as const },
    { name: "SerifI", data: fi, weight: 500 as const, style: "italic" as const },
  ];
}

/** Foto em JPEG (Satori não lê WebP). */
export async function fotoJpeg(url: string | undefined, lado: number) {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const sharp = (await import("sharp")).default;
    const b = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize(lado, lado, { fit: "cover", position: "attention" }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${b.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function qrDataUri(texto: string) {
  const svg = await QRCode.toString(texto, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: COR.marromEscuro, light: "#FFFFFF" } });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

const resumo = (d: DadosIngressos) =>
  [d.entradas ? `${d.entradas} ${d.entradas === 1 ? "entrada" : "entradas"}` : null, d.almocos ? `${d.almocos} ${d.almocos === 1 ? "almoço" : "almoços"}` : null]
    .filter(Boolean)
    .join(" + ");

/** Arco laranja do logo, como elemento de fundo. */
function Arco({ w, h, x, y, espessura, cor = COR.laranja, giro = -14 }: { w: number; h: number; x: number; y: number; espessura: number; cor?: string; giro?: number }) {
  return (
    <div style={{ display: "flex", position: "absolute", left: x, top: y, width: w, height: h, borderRadius: "50%", border: `${espessura}px solid ${cor}`, transform: `rotate(${giro}deg)` }} />
  );
}

// ---------------------------------------------------------------- capa 16:9
export function Capa({ d, logo, fotos, W, H }: { d: DadosIngressos; logo: string; fotos: (string | null)[]; W: number; H: number }) {
  const s = W / 1600;
  const px = (v: number) => Math.round(v * s);
  const hora = horaCurta(d.evento.hora);
  const pal = d.evento.palestrantes.slice(0, 3);
  return (
    <div style={{ display: "flex", width: W, height: H, position: "relative", background: COR.creme, fontFamily: "DM", color: COR.marrom, overflow: "hidden" }}>
      <Arco w={px(820)} h={px(1100)} x={px(900)} y={px(-100)} espessura={px(22)} giro={-10} />
      <Arco w={px(820)} h={px(1100)} x={px(930)} y={px(-70)} espessura={px(6)} cor={COR.areia} giro={-10} />
      <div style={{ display: "flex", position: "absolute", left: px(1040), top: px(-260), width: px(1100), height: px(1420), borderRadius: "50%", background: `linear-gradient(160deg, ${COR.laranja} 0%, ${COR.laranjaForte} 100%)` }} />

      {/* texto à esquerda */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: px(1000), height: H, padding: `${px(70)}px ${px(40)}px ${px(64)}px ${px(90)}px` }}>
        <img alt="" src={logo} width={px(250)} height={px(161)} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: px(12), background: COR.marrom, color: COR.creme, borderRadius: 999, padding: `${px(10)}px ${px(24)}px`, fontSize: px(24), fontWeight: 800, letterSpacing: px(3), textTransform: "uppercase" }}>
            <div style={{ display: "flex", width: px(14), height: px(14), borderRadius: 99, background: COR.laranja }} />
            Inscrição confirmada
          </div>
          <span style={{ marginTop: px(30), fontSize: px(40), color: COR.cinza }}>{`Olá, ${primeiroNome(d.pessoa)}! Sua vaga está garantida no`}</span>
          <span style={{ marginTop: px(8), fontFamily: "Serif", fontSize: px(d.evento.nome.length > 30 ? 74 : 86), lineHeight: 1.02, color: COR.marrom }}>{d.evento.nome}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: px(12), marginTop: px(34), fontSize: px(32), color: COR.marrom }}>
            <span style={{ fontWeight: 800 }}>{`${dataPorExtenso(d.evento.data)}${hora ? ` · ${hora}` : ""}`}</span>
            {d.evento.local && <span style={{ color: COR.cinza }}>{d.evento.local.split(" - ")[0]}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: px(20) }}>
          <div style={{ display: "flex", background: COR.laranja, color: COR.marromEscuro, borderRadius: px(16), padding: `${px(14)}px ${px(26)}px`, fontSize: px(30), fontWeight: 800 }}>{resumo(d)}</div>
          <span style={{ fontSize: px(26), color: COR.cinza }}>Seus ingressos estão no PDF abaixo</span>
        </div>
      </div>

      {/* palestrantes à direita */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "absolute", right: 0, top: 0, width: px(560), height: H, gap: px(30) }}>
        {pal.map((p, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {fotos[i] ? (
              <img alt="" src={fotos[i]!} width={px(pal.length > 2 ? 190 : 240)} height={px(pal.length > 2 ? 190 : 240)} style={{ borderRadius: 999, border: `${px(8)}px solid ${COR.creme}` }} />
            ) : (
              <div style={{ display: "flex", width: px(200), height: px(200), borderRadius: 999, background: COR.creme }} />
            )}
            <span style={{ marginTop: px(12), fontFamily: "Serif", fontSize: px(34), color: COR.creme }}>{p.nome.split(" (")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- páginas do PDF (9:16)
export function PaginaResumo({ d, logo, W, H }: { d: DadosIngressos; logo: string; W: number; H: number }) {
  const s = W / 1080;
  const px = (v: number) => Math.round(v * s);
  const hora = horaCurta(d.evento.hora);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, position: "relative", background: COR.creme, fontFamily: "DM", color: COR.marrom, overflow: "hidden", padding: `${px(110)}px ${px(90)}px ${px(90)}px` }}>
      <Arco w={px(820)} h={px(480)} x={px(560)} y={px(-190)} espessura={px(20)} giro={-12} />
      <img alt="" src={logo} width={px(380)} height={px(245)} />
      <span style={{ marginTop: px(90), fontSize: px(30), fontWeight: 800, letterSpacing: px(5), textTransform: "uppercase", color: COR.laranjaForte }}>Seus ingressos</span>
      <span style={{ marginTop: px(14), fontFamily: "Serif", fontSize: px(92), lineHeight: 1.02 }}>{d.evento.nome}</span>
      <span style={{ marginTop: px(40), fontSize: px(40), color: COR.cinza }}>Inscrição de</span>
      <span style={{ fontSize: px(52), fontWeight: 800 }}>{d.pessoa}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: px(16), marginTop: px(60), padding: px(46), borderRadius: px(36), background: "#FFFFFF", fontSize: px(38) }}>
        <span style={{ fontWeight: 800 }}>{`${dataPorExtenso(d.evento.data)}${hora ? ` · ${hora}` : ""}`}</span>
        {d.evento.local && <span style={{ color: COR.cinza, lineHeight: 1.3 }}>{d.evento.local}</span>}
        <div style={{ display: "flex", marginTop: px(12), alignSelf: "flex-start", background: COR.laranja, color: COR.marromEscuro, borderRadius: px(16), padding: `${px(12)}px ${px(26)}px`, fontWeight: 800 }}>{resumo(d)}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: px(14), marginTop: px(60), fontSize: px(34), color: COR.marrom, lineHeight: 1.35 }}>
        <span>• Na entrada, mostre o QR code de cada pessoa pelo celular (ou impresso).</span>
        <span>• Cada QR code vale uma única vez.</span>
        {d.almocos > 0 && <span>• O ingresso do almoço é apresentado na hora da refeição.</span>}
      </div>
      <span style={{ marginTop: "auto", fontSize: px(30), color: COR.cinza }}>{`Dúvidas: ${d.contato} · NEEL — Núcleo Espírita Esperança de Luz`}</span>
    </div>
  );
}

export function PaginaIngresso({ d, ing, n, total, qr, logo, W, H }: { d: DadosIngressos; ing: Ingresso; n: number; total: number; qr: string; logo: string; W: number; H: number }) {
  const s = W / 1080;
  const px = (v: number) => Math.round(v * s);
  const hora = horaCurta(d.evento.hora);
  const faixa = ing.almoco ? COR.laranja : COR.marrom;
  const tinta = ing.almoco ? COR.marromEscuro : COR.creme;
  const prato = ing.almoco ? ing.nome.replace(/^almo[cç]o\s*[-–—:]\s*/i, "").replace(/\.$/, "") : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: COR.creme, fontFamily: "DM", color: COR.marrom, overflow: "hidden" }}>
      {/* faixa do tipo */}
      <div style={{ display: "flex", flexDirection: "column", position: "relative", background: faixa, color: tinta, padding: `${px(80)}px ${px(90)}px ${px(70)}px`, overflow: "hidden" }}>
        <Arco w={px(900)} h={px(520)} x={px(520)} y={px(-220)} espessura={px(16)} cor={ing.almoco ? "#FFFFFF55" : COR.laranja} giro={-12} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: px(34), fontWeight: 800, letterSpacing: px(6), textTransform: "uppercase" }}>{ing.almoco ? "Almoço" : "Entrada"}</span>
          <span style={{ fontSize: px(30), fontWeight: 700, opacity: 0.85 }}>{`Ingresso ${n} de ${total}`}</span>
        </div>
        <span style={{ marginTop: px(24), fontFamily: "Serif", fontSize: px(76), lineHeight: 1.04 }}>{d.evento.nome}</span>
        {prato && <span style={{ marginTop: px(18), fontFamily: "SerifI", fontStyle: "italic", fontSize: px(40) }}>{prato}</span>}
      </div>

      {/* QR */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: px(70) }}>
        <div style={{ display: "flex", padding: px(34), background: "#FFFFFF", borderRadius: px(40), boxShadow: "0 10px 40px rgba(91,58,31,.12)" }}>
          <img alt="" src={qr} width={px(640)} height={px(640)} />
        </div>
        <span style={{ marginTop: px(26), fontSize: px(34), fontWeight: 800, letterSpacing: px(3), color: COR.marrom }}>{ing.token}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: px(10), margin: `${px(60)}px ${px(90)}px 0`, fontSize: px(38) }}>
        <span style={{ color: COR.cinza, fontSize: px(32) }}>Inscrição de</span>
        <span style={{ fontWeight: 800 }}>{d.pessoa}</span>
        <span style={{ marginTop: px(20), fontWeight: 700 }}>{`${dataPorExtenso(d.evento.data)}${hora ? ` · ${hora}` : ""}`}</span>
        {d.evento.local && <span style={{ color: COR.cinza, fontSize: px(32) }}>{d.evento.local.split(" - ")[0]}</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", padding: `${px(40)}px ${px(90)}px ${px(70)}px`, borderTop: `${px(4)}px dashed ${COR.areia}` }}>
        <span style={{ fontSize: px(28), color: COR.cinza, maxWidth: px(620) }}>{`Vale uma única ${ing.almoco ? "refeição" : "entrada"}. Mostre este QR code na hora.`}</span>
        <img alt="" src={logo} width={px(190)} height={px(122)} />
      </div>
    </div>
  );
}
