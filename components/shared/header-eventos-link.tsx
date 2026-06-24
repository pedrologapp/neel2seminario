"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Botão "Ver todos nossos eventos" no header — aparece só nas páginas
 * internas de evento (/eventos/<slug>), volta pra lista (hub).
 *
 * Detalhe: em `neel2seminario.vercel.app` a raiz "/" redireciona pro 2º
 * Seminário (regra de host). Por isso, nesse host, o botão aponta direto
 * pro hub `eventosneel.vercel.app`. Nos demais hosts usa "/" (soft nav).
 */
export function HeaderEventosLink() {
  const pathname = usePathname();
  const [href, setHref] = useState("/");

  useEffect(() => {
    if (window.location.host === "neel2seminario.vercel.app") {
      setHref("https://eventosneel.vercel.app/");
    }
  }, []);

  if (!pathname?.startsWith("/eventos/")) return null;

  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
      <ArrowLeft />
      <span className="hidden sm:inline">Ver todos nossos eventos</span>
      <span className="sm:hidden">Eventos</span>
    </Link>
  );
}
