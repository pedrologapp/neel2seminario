import Link from "next/link";
import { ChevronLeft, Receipt } from "lucide-react";
import { CobrancaForm } from "./cobranca-form";

export default function NovaCobrancaPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin/cobrancas"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neel-blue hover:underline"
      >
        <ChevronLeft className="size-4" />
        Voltar para cobranças
      </Link>
      <h1 className="mt-4 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
        <Receipt className="size-7" />
        Nova cobrança avulsa
      </h1>
      <p className="mt-1 text-muted-foreground">
        Cobre qualquer item fora de eventos (livro, material, taxa...). O link
        de pagamento vai pro WhatsApp do responsável e a confirmação chega
        automaticamente quando o pagamento cair.
      </p>

      <div className="mt-8">
        <CobrancaForm />
      </div>
    </div>
  );
}
