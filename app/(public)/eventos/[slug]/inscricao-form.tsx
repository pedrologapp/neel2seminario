"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  CreditCard,
  Heart,
  Minus,
  Phone,
  Plus,
  Ticket,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { calcularTotal, type MetodoPagamento } from "@/lib/pricing";
import {
  getLoteAtivo,
  getPrecoAtual,
  limparPrefixoLote,
  montaNomeItem,
  type Lote,
} from "@/lib/lotes";
import { formatCurrency } from "@/lib/utils";
import {
  apenasDigitos,
  formatarCPF,
  formatarTelefone,
  telefoneValido,
  validarCPF,
} from "@/lib/validators";
import { submitInscricao } from "./actions";

interface Tipo {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  ordem: number | null;
  lotes?: Lote[];
  opcional?: boolean;
  grupo?: string | null;
  restantes?: number | null; // null = sem limite, 0 = esgotado
  esgotado?: boolean;
  mostrar_estoque?: boolean;
}

interface EventoInfo {
  id: string;
  slug: string;
  nome: string;
  cor_tematica: string;
  metodos_pagamento: ("pix" | "cartao")[];
  max_parcelas: number;
}

interface Props {
  evento: EventoInfo;
  tipos: Tipo[];
}

export function InscricaoForm({ evento, tipos }: Props) {
  const cor = evento.cor_tematica;
  const aceitaPix = evento.metodos_pagamento.includes("pix");
  const aceitaCartao = evento.metodos_pagamento.includes("cartao");

  const [showForm, setShowForm] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ---------- Participante ----------
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");

  // ---------- Pagamento ----------
  const [metodo, setMetodo] = useState<MetodoPagamento>(
    aceitaPix ? "pix" : "cartao",
  );
  const [parcelas, setParcelas] = useState(1);

  // ---------- Quantidades por tipo ----------
  const [qtds, setQtds] = useState<Record<string, number>>(() =>
    Object.fromEntries(tipos.map((t) => [t.id, 0])),
  );

  // ---------- Validações ----------
  const cpfDigits = apenasDigitos(cpf);
  const cpfValid = cpfDigits.length === 11 && validarCPF(cpf);
  const cpfError =
    !cpf || cpfDigits.length === 0
      ? null
      : cpfDigits.length < 11
        ? "CPF deve ter 11 dígitos"
        : !cpfValid
          ? "CPF inválido"
          : null;

  const phoneValid = telefoneValido(phone);
  const phonesMatch =
    apenasDigitos(phone) === apenasDigitos(phoneConfirm);
  const phoneError =
    !phone
      ? null
      : !phoneValid
        ? "Telefone deve ter 11 dígitos com DDD"
        : phoneConfirm && !phonesMatch
          ? "Os telefones não coincidem"
          : null;

  const totalSenhas = useMemo(
    () => Object.values(qtds).reduce((a, b) => a + b, 0),
    [qtds],
  );

  // Separa ingressos obrigatórios das vendas opcionais (ex: almoço).
  const tiposObrigatorios = useMemo(
    () => tipos.filter((t) => !t.opcional),
    [tipos],
  );
  const tiposOpcionais = useMemo(
    () => tipos.filter((t) => t.opcional),
    [tipos],
  );
  // Agrupa as vendas opcionais pelo rótulo `grupo` (ex: "Almoço" → Frango,
  // Vegetariano). Itens sem grupo viram um grupo de um item só.
  const gruposOpcionais = useMemo(() => {
    const map = new Map<string, { nome: string; itens: Tipo[] }>();
    for (const t of tiposOpcionais) {
      const chave = t.grupo?.trim() || t.nome;
      let g = map.get(chave);
      if (!g) {
        g = { nome: chave, itens: [] };
        map.set(chave, g);
      }
      g.itens.push(t);
    }
    return Array.from(map.values());
  }, [tiposOpcionais]);
  // A inscrição exige ao menos um item NÃO opcional. Se o evento só tiver
  // itens opcionais (raro), qualquer quantidade serve.
  const totalObrigatorias = useMemo(
    () =>
      tiposObrigatorios.reduce((a, t) => a + (qtds[t.id] ?? 0), 0),
    [tiposObrigatorios, qtds],
  );
  const minimoOk =
    tiposObrigatorios.length > 0 ? totalObrigatorias > 0 : totalSenhas > 0;

  const valorBase = useMemo(
    () =>
      tipos.reduce(
        (sum, t) => sum + (qtds[t.id] ?? 0) * getPrecoAtual(t),
        0,
      ),
    [tipos, qtds],
  );

  const calc = useMemo(
    () => calcularTotal(valorBase, metodo, parcelas),
    [valorBase, metodo, parcelas],
  );

  const formValido =
    parentName.trim().length >= 2 &&
    cpfValid &&
    !!email &&
    /\S+@\S+\.\S+/.test(email) &&
    phoneValid &&
    phonesMatch &&
    minimoOk;

  // ---------- Handlers ----------
  function inc(tipoId: string) {
    setQtds((prev) => {
      const tipo = tipos.find((t) => t.id === tipoId);
      const atual = prev[tipoId] ?? 0;
      const limite =
        typeof tipo?.restantes === "number" ? tipo.restantes : Infinity;
      if (atual >= limite) return prev; // bate o teto, não incrementa
      return { ...prev, [tipoId]: atual + 1 };
    });
    setParcelas(1);
  }

  function dec(tipoId: string) {
    setQtds((prev) => ({
      ...prev,
      [tipoId]: Math.max(0, (prev[tipoId] ?? 0) - 1),
    }));
    setParcelas(1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValido) return;
    setSubmitError(null);

    startTransition(async () => {
      const itens = tipos
        .filter((t) => (qtds[t.id] ?? 0) > 0)
        .map((t) => ({
          tipo_id: t.id,
          // Junta nome do tipo (sem prefixo "Nº Lote -") com o lote ativo.
          // Assim a descrição que vai pro WhatsApp / detalhe sempre reflete
          // o lote vigente no momento da compra. Vendas opcionais ganham o
          // prefixo do grupo (ex: "Almoço - Frango").
          nome: t.opcional && t.grupo
            ? `${t.grupo} - ${montaNomeItem(t.nome, getLoteAtivo(t.lotes))}`
            : montaNomeItem(t.nome, getLoteAtivo(t.lotes)),
          qtd: qtds[t.id]!,
          preco_unitario: getPrecoAtual(t),
        }));

      const result = await submitInscricao({
        evento_id: evento.id,
        evento_slug: evento.slug,
        responsavel_nome: parentName.trim(),
        cpf,
        email: email.trim(),
        telefone: phone,
        itens,
        metodo_pagamento: metodo,
        parcelas: metodo === "cartao" ? parcelas : 1,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      setPaymentUrl(result.paymentUrl);
      // Redireciona automaticamente
      window.location.href = result.paymentUrl;
    });
  }

  // Linha de um tipo (ingresso ou venda opcional) com contador.
  function renderTipoRow(tipo: Tipo) {
    const q = qtds[tipo.id] ?? 0;
    const esgotado = tipo.esgotado ?? false;
    const restantes = tipo.restantes;
    const limite = typeof restantes === "number" ? restantes : Infinity;
    const noLimite = q >= limite;
    return (
      <div
        key={tipo.id}
        className="flex items-center justify-between rounded-2xl border-2 p-4"
        style={{
          borderColor: esgotado ? "#9ca3af33" : q > 0 ? cor : "transparent",
          background: esgotado
            ? "#9ca3af14"
            : q > 0
              ? `${cor}10`
              : "var(--muted)",
          opacity: esgotado ? 0.7 : 1,
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-semibold"
              style={{ color: esgotado ? "#6b7280" : cor }}
            >
              {limparPrefixoLote(tipo.nome)}
            </span>
            {esgotado && (
              <span className="rounded-full bg-gray-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Esgotado
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {(() => {
              const precoAtual = getPrecoAtual(tipo);
              const ativo = getLoteAtivo(tipo.lotes);
              const parts: string[] = [];
              if (tipo.descricao) parts.push(tipo.descricao);
              parts.push(formatCurrency(precoAtual));
              if (ativo) parts.push(`(${ativo.nome})`);
              return parts.join(" · ");
            })()}
          </div>
          {!esgotado &&
            tipo.mostrar_estoque &&
            typeof restantes === "number" && (
              <div
                className="mt-1 text-[11px] font-semibold"
                style={{ color: cor }}
              >
                Restam {restantes}
              </div>
            )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => dec(tipo.id)}
            disabled={q === 0 || esgotado}
            className="size-9"
          >
            <Minus className="size-3.5" />
          </Button>
          <span
            className="w-8 text-center text-xl font-extrabold tabular-nums"
            style={{ color: esgotado ? "#6b7280" : cor }}
          >
            {q}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => inc(tipo.id)}
            disabled={esgotado || noLimite}
            className="size-9"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // ============ TELA DE SUCESSO ============
  if (paymentUrl) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader className="text-center">
          <div
            className="mx-auto grid size-14 place-items-center rounded-2xl text-white shadow-float"
            style={{ background: cor }}
          >
            <CheckCircle className="size-7" />
          </div>
          <CardTitle className="mt-4" style={{ color: cor }}>
            Inscrição registrada!
          </CardTitle>
          <CardDescription>
            Finalize o pagamento para garantir sua vaga.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <a
            href={paymentUrl}
            className="block w-full rounded-2xl py-4 text-base font-extrabold text-white shadow-float transition-all hover:-translate-y-0.5 hover:shadow-float-lg"
            style={{ background: cor }}
          >
            Ir para o pagamento
          </a>
          <p className="text-xs text-muted-foreground">
            Se o botão acima não funcionar, copie e cole o link no navegador:
          </p>
          <div className="rounded-2xl bg-neel-blue-50/60 p-3 text-left text-xs break-all">
            {paymentUrl}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ BOTÃO INICIAL ============
  if (!showForm) {
    return (
      <div
        className="mt-10 rounded-3xl border-2 border-dashed p-8 text-center"
        style={{ borderColor: `${cor}40`, background: `${cor}1F` }}
      >
        <h3 className="text-xl font-extrabold" style={{ color: cor }}>
          Pronto pra garantir sua vaga?
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Preencha seus dados em poucos minutos. Pagamento via{" "}
          <strong>
            {aceitaPix && "PIX"}
            {aceitaPix && aceitaCartao && " ou "}
            {aceitaCartao && `cartão (até ${evento.max_parcelas}x)`}
          </strong>
          .
        </p>
        <Button
          size="lg"
          className="mt-5"
          style={{ background: cor }}
          onClick={() => setShowForm(true)}
        >
          Fazer inscrição
          <Heart fill="currentColor" />
        </Button>
      </div>
    );
  }

  // ============ FORMULÁRIO ============
  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-6">
      {/* ===== Participante ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: cor }}>
            <User className="size-5" />
            Seus dados
          </CardTitle>
          <CardDescription>
            Preencha os dados de quem vai participar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="parentName">Nome completo do participante *</Label>
            <Input
              id="parentName"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>

          {/* Telefone com confirmação */}
          <div
            className="rounded-2xl border-2 p-4 space-y-3"
            style={{ borderColor: `${cor}33`, background: `${cor}0D` }}
          >
            <p
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: cor }}
            >
              <Phone className="size-4" />
              📲 O QR Code do ingresso será enviado por WhatsApp — confira com atenção.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(formatarTelefone(e.target.value))}
                  placeholder="(84) 99999-9999"
                  inputMode="numeric"
                  className={
                    phone && phoneError
                      ? "border-red-500 bg-red-50"
                      : phone && phoneValid && phonesMatch && phoneConfirm
                        ? "border-green-500 bg-green-50"
                        : ""
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phoneConfirm">Confirme o WhatsApp *</Label>
                <Input
                  id="phoneConfirm"
                  value={phoneConfirm}
                  onChange={(e) =>
                    setPhoneConfirm(formatarTelefone(e.target.value))
                  }
                  placeholder="(84) 99999-9999"
                  inputMode="numeric"
                  className={
                    phoneConfirm && !phonesMatch
                      ? "border-red-500 bg-red-50"
                      : phoneConfirm && phonesMatch && phoneValid
                        ? "border-green-500 bg-green-50"
                        : ""
                  }
                  required
                />
              </div>
            </div>
            {phoneError && (
              <p className="text-sm font-medium text-red-700">
                ⚠️ {phoneError}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className={
                  cpf && cpfError
                    ? "border-red-500 bg-red-50"
                    : cpf && cpfValid
                      ? "border-green-500 bg-green-50"
                      : ""
                }
                required
              />
              {cpfError && (
                <p className="text-xs text-red-700">⚠️ {cpfError}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Ingressos ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: cor }}>
            <Ticket className="size-5" />
            Quantidade de ingressos
          </CardTitle>
          <CardDescription>
            Escolha quantos ingressos de cada tipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(tiposObrigatorios.length > 0 ? tiposObrigatorios : tipos).map(
            renderTipoRow,
          )}

          {/* Vendas opcionais (ex: almoço → Frango, Vegetariano) */}
          {tiposObrigatorios.length > 0 && gruposOpcionais.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pt-1">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: cor }}
                >
                  Opcionais
                </span>
                <span className="text-xs text-muted-foreground">
                  adicione se quiser — não é obrigatório
                </span>
              </div>
              {gruposOpcionais.map((grupo) => (
                <div key={grupo.nome} className="space-y-2">
                  {grupo.itens.length > 1 && (
                    <p className="text-sm font-semibold" style={{ color: cor }}>
                      {grupo.nome}
                    </p>
                  )}
                  {grupo.itens.map(renderTipoRow)}
                </div>
              ))}
            </div>
          )}

          {!minimoOk && (
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle className="size-4" />
              Selecione pelo menos um ingresso.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ===== Pagamento ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: cor }}>
            <CreditCard className="size-5" />
            Forma de pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {aceitaPix && (
              <PaymentRadio
                cor={cor}
                checked={metodo === "pix"}
                onSelect={() => {
                  setMetodo("pix");
                  setParcelas(1);
                }}
                label="PIX"
                description={`${formatCurrency(valorBase)} (sem taxas)`}
              />
            )}
            {aceitaCartao && (
              <PaymentRadio
                cor={cor}
                checked={metodo === "cartao"}
                onSelect={() => setMetodo("cartao")}
                label="Cartão de crédito"
                description={`Parcele em até ${evento.max_parcelas}x (com taxas)`}
              />
            )}
          </div>

          {metodo === "cartao" && totalSenhas > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="parcelas">Número de parcelas</Label>
              <Select
                id="parcelas"
                value={parcelas}
                onChange={(e) => setParcelas(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: evento.max_parcelas }, (_, i) => i + 1).map(
                  (n) => {
                    const c = calcularTotal(valorBase, "cartao", n);
                    return (
                      <option key={n} value={n}>
                        {n}x de {formatCurrency(c.valorParcela)} (total{" "}
                        {formatCurrency(c.valorTotal)})
                      </option>
                    );
                  },
                )}
              </Select>
            </div>
          )}

          {/* Total */}
          <div
            className="rounded-2xl p-5 text-center"
            style={{ background: `${cor}1A` }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: cor }}>
              Valor total
            </div>
            <div
              className="mt-1 text-4xl font-extrabold tabular-nums"
              style={{ color: cor }}
            >
              {formatCurrency(calc.valorTotal)}
            </div>
            {metodo === "cartao" && parcelas > 1 && (
              <div className="mt-1 text-sm" style={{ color: cor }}>
                {parcelas}x de {formatCurrency(calc.valorParcela)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== Submit ===== */}
      {submitError && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={!formValido || isPending}
          style={{ background: cor }}
        >
          {isPending ? (
            "Processando..."
          ) : (
            <>
              Continuar para pagamento
              <ArrowRight />
            </>
          )}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ao continuar, você será redirecionado para o pagamento via Asaas.
      </p>
    </form>
  );
}

function PaymentRadio({
  checked,
  onSelect,
  label,
  description,
  cor,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  description: string;
  cor: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors"
      style={{
        borderColor: checked ? cor : "var(--border)",
        background: checked ? `${cor}10` : "white",
      }}
    >
      <span
        className="grid size-5 place-items-center rounded-full border-2"
        style={{ borderColor: checked ? cor : "var(--input)" }}
      >
        {checked && (
          <span
            className="size-2.5 rounded-full"
            style={{ background: cor }}
          />
        )}
      </span>
      <div className="flex-1">
        <div className="font-semibold" style={{ color: checked ? cor : undefined }}>
          {label}
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}
