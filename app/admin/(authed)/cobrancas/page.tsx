import Link from "next/link";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { ValorSensivel } from "@/components/admin/valores-sensiveis";
import { CobrancasTable, type CobrancaRow } from "./cobrancas-table";

export default async function CobrancasPage() {
  const supabase = await createClient();
  const { data: cobrancas, error } = await supabase
    .from("cobrancas_avulsas")
    .select(
      "id, descricao, valor, valor_total, metodo_cobranca, parcelas, repassar_juros, responsavel_nome, telefone, status_pagamento, payment_url, created_at, link_enviado_em, link_erro, confirmacao_enviada_em, confirmacao_erro",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar cobranças</CardTitle>
            <CardDescription>
              {error.message}. Se a tabela ainda não existe, rode a migration{" "}
              <code>0009_cobrancas_avulsas.sql</code> no Supabase.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const lista: CobrancaRow[] = (cobrancas ?? []).map((c) => ({
    id: c.id,
    descricao: c.descricao,
    valor: Number(c.valor),
    valor_total: c.valor_total === null ? null : Number(c.valor_total),
    metodo_cobranca: c.metodo_cobranca ?? null,
    parcelas: c.parcelas ?? null,
    repassar_juros: c.repassar_juros ?? null,
    responsavel_nome: c.responsavel_nome,
    telefone: c.telefone,
    status_pagamento: c.status_pagamento,
    payment_url: c.payment_url,
    created_at: c.created_at,
    link_enviado_em: c.link_enviado_em ?? null,
    link_erro: c.link_erro ?? null,
    confirmacao_enviada_em: c.confirmacao_enviada_em ?? null,
    confirmacao_erro: c.confirmacao_erro ?? null,
  }));

  const totalPago = lista
    .filter((c) => c.status_pagamento === "pago")
    .reduce((sum, c) => sum + Number(c.valor_total ?? c.valor), 0);

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">
            Cobranças avulsas
          </h1>
          <p className="mt-1 text-muted-foreground">
            {lista.length === 0 ? (
              "Nenhuma cobrança criada ainda."
            ) : (
              <>
                {lista.length} cobrança{lista.length === 1 ? "" : "s"} ·{" "}
                <ValorSensivel valor={formatCurrency(totalPago)} /> recebido
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/cobrancas/nova">
            <Receipt />
            Nova cobrança
          </Link>
        </Button>
      </header>

      {lista.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="mx-auto size-10 opacity-40" />
            <p className="mt-3">
              Crie uma cobrança pra vender livro, material ou qualquer item
              fora de eventos. O link de pagamento vai direto pro WhatsApp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-8 overflow-hidden p-0">
          <CobrancasTable cobrancas={lista} />
        </Card>
      )}
    </div>
  );
}
