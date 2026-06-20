import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "default" | "compact" | "stacked";
}

const SIZES = {
  sm: 36,
  md: 48,
  lg: 64,
} as const;

/**
 * Logo do NEEL — Núcleo Espírita Esperança de Luz.
 * Placeholder textual enquanto a arte oficial não chega.
 * Quando tiver o arquivo, troque o <LogoMark> por uma <Image src="/logo-neel.png" />.
 */
export function Logo({ className, variant = "default" }: LogoProps) {
  if (variant === "compact") {
    // Barras de navegação compactas (mobile/header)
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <LogoMark size="sm" />
        <div className="flex flex-col leading-none">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-amadeus-yellow sm:block">
            Núcleo Espírita
          </span>
          <span className="text-base font-extrabold tracking-tight text-amadeus-blue">
            NEEL
          </span>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    // Empty states grandes, hero do admin, telas de login
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <LogoMark size="lg" />
        <div className="flex flex-col items-center leading-none">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amadeus-yellow">
            Núcleo Espírita
          </span>
          <span className="mt-1 text-3xl font-extrabold tracking-tight text-amadeus-blue">
            NEEL
          </span>
        </div>
      </div>
    );
  }

  // default — cards, headers de página
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size="md" />
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amadeus-yellow">
          Núcleo Espírita
        </span>
        <span className="mt-1 text-xl font-extrabold tracking-tight text-amadeus-blue">
          NEEL
        </span>
      </div>
    </div>
  );
}

interface LogoMarkProps {
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Placeholder do símbolo: quadrado arredondado com a sigla "NEEL".
 * Substitua por <Image src="/logo-neel.png" /> quando a arte chegar.
 */
export function LogoMark({ size = "md", className }: LogoMarkProps) {
  const px = SIZES[size];
  return (
    <div
      aria-label="NEEL — Núcleo Espírita Esperança de Luz"
      role="img"
      style={{ width: px, height: px }}
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl bg-amadeus-blue font-extrabold leading-none tracking-tight text-white shadow-float",
        size === "sm" ? "text-[11px]" : size === "lg" ? "text-lg" : "text-sm",
        className,
      )}
    >
      NEEL
    </div>
  );
}
