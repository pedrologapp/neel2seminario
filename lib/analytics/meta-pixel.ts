/**
 * Meta (Facebook) Pixel — rastreamento de campanhas.
 *
 * O ID vem do painel do Meta (Gerenciador de Eventos) e é público por
 * natureza: ele aparece no HTML da página. Se a variável não estiver
 * definida, tudo aqui vira no-op e nenhum script é carregado.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

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
