/**
 * De onde veio quem se inscreveu (29/09/2026), para saber quantos pagantes
 * vieram do tráfego pago.
 *
 * O navegador guarda no cookie "neel_origem" os parâmetros do link de entrada
 * (utm_* e o fbclid que o Facebook/Instagram acrescenta). Na inscrição, o
 * servidor lê esse cookie e grava em inscricao_logs (etapa "origem_trafego").
 *
 * Nos anúncios, use em "Parâmetros de URL":
 *   utm_source=meta&utm_medium=pago&utm_campaign={{campaign.name}}
 */

export const COOKIE_ORIGEM = "neel_origem";

export interface Origem {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
  landing?: string | null;
  em?: string | null; // quando chegou (ISO)
}

export type Canal = "anuncio" | "redes" | "outros";

export const ROTULO_CANAL: Record<Canal, string> = {
  anuncio: "Tráfego pago (anúncio)",
  redes: "Instagram / Facebook (sem anúncio identificado)",
  outros: "Direto, WhatsApp e outros",
};

/**
 * Anúncio: utm_medium de mídia paga (pago, paid, cpc, ads...) ou fonte com
 * "ads". Redes: veio do Facebook/Instagram (fbclid ou utm de fb/ig) sem marca
 * de anúncio — pode ser anúncio sem UTM ou link de post/bio.
 */
export function canal(o: Origem | null | undefined): Canal {
  if (!o) return "outros";
  const src = (o.utm_source ?? "").toLowerCase();
  const med = (o.utm_medium ?? "").toLowerCase();
  if (/pago|paid|cpc|cpm|ads?\b|an[uú]ncio|patrocinad/.test(med) || /ads/.test(src)) return "anuncio";
  if (o.fbclid || /face|fb|insta|ig|meta/.test(src)) return "redes";
  return "outros";
}
