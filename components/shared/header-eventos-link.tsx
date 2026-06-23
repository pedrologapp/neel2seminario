"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Botão "Ver todos nossos eventos" no header — aparece só nas páginas
 * internas de evento (/eventos/<slug>), volta pra lista (home). Na home
 * seria redundante, então não renderiza nada.
 */
export function HeaderEventosLink() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/eventos/")) return null;

  return (
    <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
      <ArrowLeft />
      <span className="hidden sm:inline">Ver todos nossos eventos</span>
      <span className="sm:hidden">Eventos</span>
    </Link>
  );
}
