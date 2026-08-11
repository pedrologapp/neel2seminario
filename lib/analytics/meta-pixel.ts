/**
 * Meta (Facebook) Pixel — rastreamento de campanhas.
 *
 * O ID ("identificação do conjunto de dados" no Gerenciador de Eventos do
 * Meta) é público por natureza: aparece no HTML de qualquer site que usa
 * pixel. Por isso fica aqui como padrão — não precisa de variável na Vercel.
 *
 * Dá pra sobrescrever com NEXT_PUBLIC_META_PIXEL_ID (ex.: um pixel
 * diferente numa campanha específica).
 *
 * Em desenvolvimento nada é carregado, pra não sujar os dados da conta com
 * navegação de teste.
 */
const PIXEL_NEEL = "2353902015011610";

export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
  (process.env.NODE_ENV === "production" ? PIXEL_NEEL : "");

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara um evento padrão do Meta (ViewContent, InitiateCheckout, ...).
 * Seguro de chamar sempre: se o pixel não estiver configurado ou o script
 * ainda não tiver carregado, simplesmente não faz nada.
 */
export function trackPixel(
  evento: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || !META_PIXEL_ID) return;
  window.fbq?.("track", evento, params);
}
