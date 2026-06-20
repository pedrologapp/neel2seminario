"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Lock, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDateTimeBrt } from "@/lib/utils";
import type { InscricaoStatus } from "@/types/database";
import { verificarSenhaAcao } from "../eventos/actions";
import { excluirCobrancasCanceladas } from "./actions";
import { ExcluirCobrancaButton } from "./excluir-cobranca-button";

export interface CobrancaRow {
  id: string;
  descricao: string;
  valor: number;
  valor_total: number | null;
  metodo_cobranca: string | null;
  parcelas: number | null;
  repassar_juros: boolean | null;
  responsavel_nome: string;
  telefone: string;
  status_pagamento: string;
  payment_url: string | null;
  created_at: string;
  link_enviado_em: string | null;
  link_erro: string | null;
  confirmacao_enviada_em: string | null;
  confirmacao_erro: string | null;
}

const statusBadge: Record<InscricaoStatus, { label: string; className: string }> =
  {
    pendente: {
      label: "Pendente",
      className: "bg-amber-100 text-amber-800 border-amber-300",
    },
    pago: {
      label: "Pago",
      className: "bg-green-100 text-green-800 border-green-300",
    },
    cancelado: {
      label: "Cancelado",
      className: "bg-gray-100 text-gray-600 border-gray-300",
    },
    estornado: {
      label: "Estornado",
      className: "bg-red-100 text-red-800 border-red-300",
    },
  };

type Aba = "todas" | "pagas" | "pendentes" | "canceladas";

export function CobrancasTable({ cobrancas }: { cobrancas: CobrancaRow[] }) {
  const [aba, setAba] = useState<Aba>("todas");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const pagas = cobrancas.filter((c) => c.status_pagamento === "pago");
  const pendentes = cobrancas.filter(
    (c) => c.status_pagamento === "pendente",
  );
  const canceladas = cobrancas.filter((c) =>
    ["cancelado", "estornado"].includes(c.status_pagamento),
  );

  const lista =
    aba === "pagas"
      ? pagas
      : aba === "pendentes"
        ? pendentes
        : aba === "canceladas"
          ? canceladas
          : cobrancas;

  const excluiveis = lista
    .filter((c) => c.status_pagamento === "cancelado")
    .map((c) => c.id);
  const idsSelecionados = excluiveis.filter((id) => selecionadas.has(id));
  const todasMarcadas =
    excluiveis.length > 0 && idsSelecionados.length === excluiveis.length;

  function toggleSelecionada(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (todasMarcadas) excluiveis.forEach((id) => next.delete(id));
      else excluiveis.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <div>
      <div className="px-4 pt-4">
        <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm">
          <TabPill
            active={aba === "todas"}
            onClick={() => setAba("todas")}
            count={cobrancas.length}
          >
            Todas
          </TabPill>
          <TabPill
            active={aba === "pagas"}
            onClick={() => setAba("pagas")}
            count={pagas.length}
          >
            Pagas
          </TabPill>
          <TabPill
            active={aba === "pendentes"}
            onClick={() => setAba("pendentes")}
            count={pendentes.length}
          >
            Pendentes
          </TabPill>
          <TabPill
            active={aba === "canceladas"}
            onClick={() => setAba("canceladas")}
            count={canceladas.length}
          >
            Canceladas
          </TabPill>
        </div>
      </div>

      {idsSelecionados.length > 0 && (
        <div className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm font-semibold text-red-800">
            {idsSelecionados.length} cancelada
            {idsSelecionados.length === 1 ? "" : "s"} selecionada
            {idsSelecionados.length === 1 ? "" : "s"}
          </span>
          <ExcluirEmMassaButton
            ids={idsSelecionados}
            onDone={() => setSelecionadas(new Set())}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma cobrança{" "}
          {aba === "pagas"
            ? "paga"
            : aba === "pendentes"
              ? "pendente"
              : aba === "canceladas"
                ? "cancelada"
                : ""}{" "}
          por aqui.
        </div>
      ) : (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-8 px-3 py-3">
                {excluiveis.length > 0 && (
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={toggleTodas}
                    title="Selecionar todas as canceladas"
                    className="size-4 cursor-pointer accent-red-600"
                  />
                )}
              </th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Pessoa cobrada</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Link</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const badge =
                statusBadge[c.status_pagamento as InscricaoStatus] ??
                statusBadge.pendente;
              return (
                <tr
                  key={c.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-3">
                    {c.status_pagamento === "cancelado" && (
                      <input
                        type="checkbox"
                        checked={selecionadas.has(c.id)}
                        onChange={() => toggleSelecionada(c.id)}
                        className="size-4 cursor-pointer accent-red-600"
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTimeBrt(c.created_at)}
                  </td>
                  <td className="max-w-[220px] px-4 py-3">{c.descricao}</td>
                  <td className="px-4 py-3">
                    <div>{c.responsavel_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.telefone}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {formatCurrency(Number(c.valor_total ?? c.valor))}
                    <div className="text-xs font-normal text-muted-foreground">
                      {c.metodo_cobranca === "pix" && "PIX"}
                      {c.metodo_cobranca === "cartao" &&
                        `Cartão ${c.parcelas}x ${c.repassar_juros ? "com" : "sem"} juros`}
                      {(c.metodo_cobranca === "aberto" || !c.metodo_cobranca) &&
                        "Link aberto"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <div className="mt-1 space-y-0.5 text-xs">
                      {c.link_enviado_em ? (
                        <div className="text-green-700">✓ Link enviado</div>
                      ) : c.link_erro ? (
                        <div className="text-red-600" title={c.link_erro}>
                          ⚠ Link falhou
                        </div>
                      ) : null}
                      {c.confirmacao_enviada_em ? (
                        <div className="text-green-700">
                          ✓ Confirmação enviada
                        </div>
                      ) : c.confirmacao_erro ? (
                        <div
                          className="text-red-600"
                          title={c.confirmacao_erro}
                        >
                          ⚠ Confirmação falhou
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1.5">
                      {c.payment_url ? (
                        <a
                          href={c.payment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-amadeus-blue hover:underline"
                        >
                          Abrir
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {c.status_pagamento === "cancelado" && (
                        <ExcluirCobrancaButton
                          cobrancaId={c.id}
                          descricao={c.descricao}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function TabPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-amadeus-blue text-white shadow-float"
          : "text-amadeus-blue hover:bg-amadeus-blue-50"
      }`}
    >
      {children}
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          active
            ? "bg-white/25 text-white"
            : "bg-amadeus-blue-50 text-amadeus-blue"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ExcluirEmMassaButton({
  ids,
  onDone,
}: {
  ids: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [erroModal, setErroModal] = useState<string | null>(null);

  function abrirModal() {
    setSenha("");
    setErroModal(null);
    setOpen(true);
  }

  function confirmar() {
    setErroModal(null);
    startTransition(async () => {
      const senhaOk = await verificarSenhaAcao(senha);
      if (!senhaOk) {
        setErroModal("Senha incorreta.");
        return;
      }
      const r = await excluirCobrancasCanceladas(ids);
      if (!r.ok) {
        setErroModal(r.error);
        return;
      }
      setOpen(false);
      onDone();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={abrirModal}
        disabled={pending}
      >
        <Trash2 className="size-4" />
        {pending ? "Excluindo..." : `Excluir selecionadas (${ids.length})`}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-float-lg">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-amadeus-blue">
                <Lock className="size-5" />
                Confirmar senha
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Digite a senha para excluir {ids.length} cobranç
              {ids.length === 1 ? "a cancelada" : "as canceladas"}. Esta ação
              não pode ser desfeita.
            </p>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="senha-excluir-massa-cob">Senha</Label>
              <Input
                id="senha-excluir-massa-cob"
                type="password"
                value={senha}
                autoFocus
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmar();
                }}
                placeholder="••••••"
              />
              {erroModal && (
                <p className="text-xs text-destructive">{erroModal}</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmar}
                disabled={pending || senha.length === 0}
              >
                {pending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
