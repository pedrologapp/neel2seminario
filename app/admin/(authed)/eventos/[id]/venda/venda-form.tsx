"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  Minus,
  Plus,
  Ticket,
  User,
  Wallet,
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
import {
  getLoteAtivo,
  getPrecoAtual,
  limparPrefixoLote,
  type Lote,
} from "@/lib/lotes";
import { formatCurrency } from "@/lib/utils";
import { formatarTelefone } from "@/lib/validators";
import { registrarVendaDinheiro } from "../../actions";

interface Tipo {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  lotes: Lote[];
  opcional?: boolean;
  grupo?: string | null;
  restantes?: number | null;
  esgotado?: boolean;
}

interface Props {
  eventoId: string;
  eventoNome: string;
  cor: string;
  tipos: Tipo[];
}

export function VendaForm({
  eventoId,
  eventoNome,
  cor,
  tipos,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Participante
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  // Quantidades
  const [qtds, setQtds] = useState<Record<string, number>>(() =>
    Object.fromEntries(tipos.map((t) => [t.id, 0])),
  );

  const totalSenhas = useMemo(
    () => Object.values(qtds).reduce((a, b) => a + b, 0),
    [qtds],
  );
  const valorTotal = useMemo(
    () => tipos.reduce((sum, t) => sum + (qtds[t.id] ?? 0) * getPrecoAtual(t), 0),
    [tipos, qtds],
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
  const totalObrigatorias = useMemo(
    () => tiposObrigatorios.reduce((a, t) => a + (qtds[t.id] ?? 0), 0),
    [tiposObrigatorios, qtds],
  );
  const minimoOk =
    tiposObrigatorios.length > 0 ? totalObrigatorias > 0 : totalSenhas > 0;

  const valido =
    nome.trim().length >= 2 && telefone.length >= 8 && minimoOk;

  function inc(id: string) {
    setQtds((p) => {
      const tipo = tipos.find((t) => t.id === id);
      const atual = p[id] ?? 0;
      const limite =
        typeof tipo?.restantes === "number" ? tipo.restantes : Infinity;
      if (atual >= limite) return p;
      return { ...p, [id]: atual + 1 };
    });
  }
  function dec(id: string) {
    setQtds((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) - 1) }));
  }

  function submit() {
    if (!valido) return;
    setErro(null);
    startTransition(async () => {
      const result = await registrarVendaDinheiro({
        evento_id: eventoId,
        responsavel_nome: nome.trim(),
        telefone,
        quantidades: qtds,
      });
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setSucesso(true);
      setTimeout(() => router.push(`/admin/eventos/${eventoId}`), 1500);
    });
  }

  // Linha de um tipo (senha ou venda opcional) com contador.
  function renderTipoRow(tipo: Tipo) {
    const q = qtds[tipo.id] ?? 0;
    const preco = getPrecoAtual(tipo);
    const lote = getLoteAtivo(tipo.lotes);
    const esgotado = tipo.esgotado ?? false;
    const limite =
      typeof tipo.restantes === "number" ? tipo.restantes : Infinity;
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
            {formatCurrency(preco)}
            {lote ? ` · ${lote.nome}` : ""}
            {typeof tipo.restantes === "number" &&
              !esgotado &&
              ` · restam ${tipo.restantes}`}
          </div>
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

  if (sucesso) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-10 text-center">
          <div
            className="mx-auto grid size-14 place-items-center rounded-2xl text-white shadow-float"
            style={{ background: cor }}
          >
            <CheckCircle className="size-7" />
          </div>
          <h3 className="mt-4 text-xl font-extrabold" style={{ color: cor }}>
            Venda registrada!
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Pagamento em dinheiro confirmado. Os QR Codes estão sendo enviados
            no WhatsApp.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Participante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: cor }}>
            <User className="size-5" />
            Dados do participante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{eventoNome}</p>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome do participante * (vai no ingresso)</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tel">WhatsApp * (recebe o QR)</Label>
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

      {/* Ingressos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: cor }}>
            <Ticket className="size-5" />
            Senhas
          </CardTitle>
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
                  adicione se o cliente quiser
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

          <div
            className="mt-2 flex items-center justify-between rounded-2xl p-4"
            style={{ background: `${cor}1A` }}
          >
            <span className="flex items-center gap-2 font-semibold" style={{ color: cor }}>
              <Wallet className="size-5" />
              Total em dinheiro
            </span>
            <span className="text-2xl font-extrabold tabular-nums" style={{ color: cor }}>
              {formatCurrency(valorTotal)}
            </span>
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
          <a href={`/admin/eventos/${eventoId}`}>Cancelar</a>
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={!valido || isPending}
          style={{ background: cor }}
        >
          {isPending ? "Registrando..." : "Registrar venda em dinheiro"}
        </Button>
      </div>
    </div>
  );
}
