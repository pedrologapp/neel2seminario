"use client";

import { useEffect } from "react";
import { trackPixel } from "@/lib/analytics/meta-pixel";

interface Props {
  /** Slug do evento — vira o content_id no Meta */
  id: string;
  nome: string;
  /** Menor preço de ingresso, pra o Meta conseguir estimar valor */
  valor?: number;
}

/**
 * Dispara o evento "ViewContent" do Meta quando alguém abre a página de um
 * evento. É o sinal que o gestor de tráfego usa pra montar públicos de
 * remarketing ("quem viu o evento e não se inscreveu").
 */
export function TrackViewContent({ id, nome, valor }: Props) {
  useEffect(() => {
    trackPixel("ViewContent", {
      content_type: "product",
      content_ids: [id],
      content_name: nome,
      ...(valor != null ? { value: valor, currency: "BRL" } : {}),
    });
  }, [id, nome, valor]);

  return null;
}
