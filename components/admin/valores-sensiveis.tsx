"use client";

import { createContext, useContext, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Olhinho global do admin: valores sensíveis (receita, contagens de venda)
 * entram SEMPRE ocultos a cada visita — a tela pode estar visível a
 * terceiros. O botão no topo revela/oculta tudo de uma vez.
 */
const ValoresSensiveisContext = createContext<{
  mostrar: boolean;
  alternar: () => void;
}>({ mostrar: false, alternar: () => {} });

export function ValoresSensiveisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <ValoresSensiveisContext.Provider
      value={{ mostrar, alternar: () => setMostrar((v) => !v) }}
    >
      {children}
    </ValoresSensiveisContext.Provider>
  );
}

export function useValoresSensiveis() {
  return useContext(ValoresSensiveisContext);
}

/** Botão do topo do admin que revela/oculta todos os valores sensíveis. */
export function OlhinhoGlobal() {
  const { mostrar, alternar } = useValoresSensiveis();
  return (
    <button
      type="button"
      onClick={alternar}
      title={
        mostrar
          ? "Ocultar valores sensíveis"
          : "Mostrar valores sensíveis (receitas e vendas)"
      }
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-amadeus-blue-50 hover:text-amadeus-blue"
    >
      {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      <span className="hidden lg:inline">
        {mostrar ? "Ocultar valores" : "Mostrar valores"}
      </span>
    </button>
  );
}

/** Botão compacto só com o ícone do olho (pra usar perto dos valores). */
export function OlhinhoIcone() {
  const { mostrar, alternar } = useValoresSensiveis();
  return (
    <button
      type="button"
      onClick={alternar}
      title={mostrar ? "Ocultar valores" : "Mostrar valores"}
      className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-amadeus-blue-50 hover:text-amadeus-blue"
    >
      {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

/**
 * Exibe o valor, ou a máscara quando o olhinho global está fechado.
 * Clicar na máscara também revela tudo.
 */
export function ValorSensivel({ valor }: { valor: string }) {
  const { mostrar, alternar } = useValoresSensiveis();
  if (mostrar) return <>{valor}</>;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        alternar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") alternar();
      }}
      title="Clique para mostrar os valores"
      className="cursor-pointer select-none underline decoration-dotted underline-offset-4"
    >
      {valor.trim().startsWith("R$") ? "R$ ••••" : "••••"}
    </span>
  );
}
