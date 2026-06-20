"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  CreditCard,
  ExternalLink,
  Receipt,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcularTotal } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { formatarCPF, formatarTelefone } from "@/lib/validators";
import { criarCobrancaAvulsa } from "../actions";

type MetodoCobranca = "aberto" | "pix" | "cartao";

const METODOS: { id: MetodoCobranca; nome: string; descricao: string }[] = [
  { id: "pix", nome: "PIX", descricao: "Sem taxas — escola recebe o valor cheio" },
  {
    id: "cartao",
    nome: "Cartão parcelado",
    descricao: "Divida em até 12x, com ou sem juros",
  },
];

const COR = "#C2410C";

export function CobrancaForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Cobrança
  const [descricao, setDescricao] = useState("");
  const [valorTexto, setValorTexto] = useState("");

  // Pagamento / simulação
  const [metodo, setMetodo] = useState<MetodoCobranca>("pix");
  const [parcelas, setParcelas] = useState(1);
  const [repassarJuros, setRepassarJuros] = useState(true);

  // Pessoa cobrada
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");

  const valor = useMemo(() => {
    const limpo = valorTexto.replace(/\./g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : 0;
  }, [valorTexto]);

  // Resumo do que será cobrado, conforme método/parcelas/juros
  const resumo = useMemo(() => {
    if (valor < 1) return null;
    if (metodo !== "cartao") {
      return { total: valor, parcela: valor, recebe: valor };
    }
    const taxas = calcularTotal(valor, "cartao", parcelas).valorTotal - valor;
    if (repassarJuros) {
      const total = Math.round((valor + taxas) * 100) / 100;
      return { total, parcela: total / parcelas, recebe: valor };
    }
    return { total: valor, parcela: valor / parcelas, recebe: valor - taxas };
  }, [valor, metodo, parcelas, repassarJuros]);

  const valido =
    descricao.trim().length >= 3 &&
    valor >= 1 &&
    nome.trim().length >= 2 &&
    cpf.replace(/\D/g, "").length === 11 &&
    telefone.length >= 8;

  function submit() {
    if (!valido) return;
    setErro(null);
    startTransition(async () => {
      const result = await criarCobrancaAvulsa({
        descricao: descricao.trim(),
        valor,
        metodo_cobranca: metodo,
        parcelas: metodo === "cartao" ? parcelas : 1,
        repassar_juros: metodo === "cartao" ? repassarJuros : true,
        responsavel_nome: nome.trim(),
        cpf,
        telefone,
      });
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setPaymentUrl(result.paymentUrl);
    });
  }

  async function copiarLink() {
    if (!paymentUrl) return;
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  }

  if (paymentUrl) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-10 text-center">
          <div
            className="mx-auto grid size-14 place-items-center rounded-2xl text-white shadow-float"
            style={{ background: COR }}
          >
            <CheckCircle className="size-7" />
          </div>
          <h3 className="mt-4 text-xl font-extrabold" style={{ color: COR }}>
            Cobrança criada!
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            O link de pagamento foi enviado no WhatsApp do responsável. Quando
            o pagamento cair, a confirmação chega automaticamente.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={copiarLink}>
              <Copy className="size-4" />
              {copiado ? "Copiado!" : "Copiar link de pagamento"}
            </Button>
            <Button asChild variant="outline">
              <a href={paymentUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Abrir link
              </a>
            </Button>
            <Button
              type="button"
              style={{ background: COR }}
              onClick={() => router.push("/admin/cobrancas")}
            >
              Ver todas as cobranças
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* O que está sendo cobrado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: COR }}>
            <Receipt className="size-5" />
            O que está sendo cobrado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Livro de matemática — 3º ano"
            />
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              📲 Este texto vai na mensagem do WhatsApp e na fatura que o
              responsável recebe — escreva pensando nele (ex.: &quot;Livro de
              matemática — 3º ano&quot;).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valor">Valor (R$) *</Label>
            <Input
              id="valor"
              value={valorTexto}
              onChange={(e) =>
                setValorTexto(e.target.value.replace(/[^\d.,]/g, ""))
              }
              placeholder="Ex.: 45,00"
              inputMode="decimal"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pagamento + visor de simulação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: COR }}>
            <CreditCard className="size-5" />
            Pagamento e simulação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Forma de cobrança */}
          <div className="grid gap-2 sm:grid-cols-2">
            {METODOS.map((m) => {
              const ativo = metodo === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMetodo(m.id)}
                  className="rounded-2xl border-2 p-3 text-left transition-colors"
                  style={{
                    borderColor: ativo ? COR : "transparent",
                    background: ativo ? `${COR}10` : "var(--muted)",
                  }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: ativo ? COR : undefined }}
                  >
                    {m.nome}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.descricao}
                  </div>
                </button>
              );
            })}
          </div>

          {metodo === "cartao" && (
            <>
              {/* Com ou sem juros */}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRepassarJuros(true)}
                  className="rounded-2xl border-2 p-3 text-left transition-colors"
                  style={{
                    borderColor: repassarJuros ? COR : "transparent",
                    background: repassarJuros ? `${COR}10` : "var(--muted)",
                  }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: repassarJuros ? COR : undefined }}
                  >
                    Com juros
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Responsável paga as taxas do cartão
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRepassarJuros(false)}
                  className="rounded-2xl border-2 p-3 text-left transition-colors"
                  style={{
                    borderColor: !repassarJuros ? COR : "transparent",
                    background: !repassarJuros ? `${COR}10` : "var(--muted)",
                  }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: !repassarJuros ? COR : undefined }}
                  >
                    Sem juros
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Escola absorve as taxas do cartão
                  </div>
                </button>
              </div>

              {/* Visor de simulação 1x..12x */}
              {valor >= 1 ? (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2">Parcelas</th>
                        <th className="px-3 py-2 text-right">Valor da parcela</th>
                        <th className="px-3 py-2 text-right">Total cobrado</th>
                        <th className="px-3 py-2 text-right">Escola recebe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                        const taxas =
                          calcularTotal(valor, "cartao", n).valorTotal - valor;
                        const total = repassarJuros ? valor + taxas : valor;
                        const recebe = repassarJuros ? valor : valor - taxas;
                        const ativo = parcelas === n;
                        return (
                          <tr
                            key={n}
                            onClick={() => setParcelas(n)}
                            className="cursor-pointer border-b border-border/60 last:border-0"
                            style={{
                              background: ativo ? `${COR}14` : undefined,
                            }}
                          >
                            <td
                              className="px-3 py-2 font-semibold"
                              style={{ color: ativo ? COR : undefined }}
                            >
                              {ativo ? "● " : ""}
                              {n}x
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(total / n)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatCurrency(total)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(recebe)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Informe o valor acima pra ver a simulação de parcelas.
                </p>
              )}
            </>
          )}

          {/* Resumo do que será cobrado */}
          {resumo && (
            <div
              className="flex flex-col gap-1 rounded-2xl p-4"
              style={{ background: `${COR}1A` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: COR }}>
                  {metodo === "cartao" && parcelas > 1
                    ? `Total no cartão (${parcelas}x de ${formatCurrency(resumo.parcela)})`
                    : "Total a cobrar"}
                </span>
                <span
                  className="text-2xl font-extrabold tabular-nums"
                  style={{ color: COR }}
                >
                  {formatCurrency(resumo.total)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {metodo === "pix" && "PIX sem taxas — a escola recebe o valor cheio."}
                {metodo === "cartao" &&
                  (repassarJuros
                    ? `Taxas repassadas ao responsável — a escola recebe ≈ ${formatCurrency(resumo.recebe)}.`
                    : `Escola absorve as taxas — recebe ≈ ${formatCurrency(resumo.recebe)} líquido.`)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responsável */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: COR }}>
            <User className="size-5" />
            Dados de quem vai pagar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome de quem vai receber a cobrança"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF * (exigido pelo Asaas)</Label>
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(formatarCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tel">WhatsApp * (recebe o link)</Label>
            <Input
              id="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(84) 99999-9999"
              inputMode="numeric"
            />
          </div>
        </CardContent>
      </Card>

      {erro && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <a href="/admin/cobrancas">Cancelar</a>
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={!valido || isPending}
          style={{ background: COR }}
        >
          <Send className="size-4" />
          {isPending
            ? "Gerando link..."
            : "Gerar cobrança e enviar no WhatsApp"}
        </Button>
      </div>
    </div>
  );
}
