import Link from "next/link";

/** Abas do Financeiro: entradas (Asaas) e despesas (lançadas à mão). */
export function AbasFinanceiro({ atual }: { atual: "entradas" | "despesas" }) {
  const abas = [
    { v: "entradas", t: "Entradas e retiradas", href: "/admin/financeiro" },
    { v: "despesas", t: "Despesas e resultado", href: "/admin/financeiro/despesas" },
  ] as const;
  return (
    <nav className="flex flex-wrap gap-2">
      {abas.map((a) => (
        <Link
          key={a.v}
          href={a.href}
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${atual === a.v ? "bg-neel-blue text-white" : "bg-neel-blue-50 text-neel-blue hover:bg-neel-blue-50/70"}`}
        >
          {a.t}
        </Link>
      ))}
    </nav>
  );
}
