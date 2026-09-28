import Link from "next/link";

/** Cobranças avulsas x o que entrou no Asaas (contas NEEL e Escola). */
export function AbasCobrancas({ atual }: { atual: "avulsas" | "asaas" }) {
  const abas = [
    { id: "avulsas", href: "/admin/cobrancas", rotulo: "Cobranças avulsas" },
    { id: "asaas", href: "/admin/cobrancas/asaas", rotulo: "Recebimentos Asaas" },
  ] as const;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border/60">
      {abas.map((a) => (
        <Link
          key={a.id}
          href={a.href}
          aria-current={atual === a.id ? "page" : undefined}
          className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${atual === a.id ? "border-neel-blue text-neel-blue" : "border-transparent text-muted-foreground hover:text-neel-blue"}`}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
