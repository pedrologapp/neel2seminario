"use client";

import { useEffect } from "react";
import { COOKIE_ORIGEM } from "@/lib/analytics/origem";

const CHAVES = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

/**
 * Guarda de onde a pessoa chegou (utm_* e fbclid do link) por 30 dias.
 * Só grava quando o link traz algum desses parâmetros: uma visita depois,
 * direta, não apaga a origem do anúncio.
 */
export function CapturarOrigem() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const origem: Record<string, string> = {};
      for (const k of CHAVES) {
        const v = p.get(k);
        if (v) origem[k] = v.slice(0, 200);
      }
      if (!Object.keys(origem).length) return;
      origem.landing = window.location.pathname.slice(0, 200);
      origem.em = new Date().toISOString();
      const valor = encodeURIComponent(JSON.stringify(origem));
      document.cookie = `${COOKIE_ORIGEM}=${valor}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      // Cookie de clique do Meta (o pixel também cria; aqui garante para a API de Conversões).
      if (origem.fbclid && !/(^|; )_fbc=/.test(document.cookie)) {
        document.cookie = `_fbc=fb.1.${Date.now()}.${origem.fbclid}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
      }
    } catch {
      // sem cookie, sem origem — a inscrição segue normal
    }
  }, []);
  return null;
}
