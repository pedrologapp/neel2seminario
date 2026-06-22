import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "default" | "compact" | "stacked";
  priority?: boolean;
}

// Altura de exibição (px) por contexto. A largura acompanha a proporção da arte.
const HEIGHTS = {
  compact: 38, // barras de navegação (header/mobile)
  default: 52, // cards e headers de página
  stacked: 88, // telas de login, hero, empty states
} as const;

/**
 * Logo do NEEL — Núcleo Espírita Esperança de Luz.
 * Arte oficial (oval + NEEL + assinatura) em public/logo-neel.png, fundo transparente.
 */
export function Logo({ className, variant = "default", priority }: LogoProps) {
  return (
    <Image
      src="/logo-neel.png"
      alt="NEEL — Núcleo Espírita Esperança de Luz"
      width={720}
      height={464}
      priority={priority ?? variant === "stacked"}
      className={cn("select-none", className)}
      style={{ height: HEIGHTS[variant], width: "auto" }}
    />
  );
}
