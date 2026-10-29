"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { enviarIngressosPagosSemIngresso, verificarSenhaAcao } from "../actions";

export interface PagoSemIngressoRow {
  inscricaoId: string;
  nome: string;
  telefone: string;
  statusSistema: string;
  conta: "neel" | "escola";
  forma: string | null;
  valor: number;
  recebidoEm: string | null;
  motivo: "nao_marcado" | "sem_qr";
}

const FORMA: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "Cartão", BOLETO: "Boleto" };
const data = (d: string | null) => (d ? d.split("-").reverse().join("/") : "a cair");

/**
 * Quem pagou no Asaas e não recebeu a confirmação/QR (conferido com o Asaas ao abrir a página).
 * O envio só sai com a senha de ações: o n8n marca pago, gera os ingressos e manda no WhatsApp.
 */
export function PagosSemIngresso({ eventoId, lista }: { eventoId: string; lista: PagoSemIngressoRow[] }) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(lista.map((l) => l.inscricaoId)));
  const [confirmando, setConfirmando] = useState(false);
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pending, start] = useTransition();

  if (!lista.length) {
    return (
      <p className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="size-4" /> Conferido com o Asaas: todo mundo que pagou recebeu a confirmação e o QR.
      </p>
    );
  }

  const alternar = (id: string) =>
    setMarcadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function enviar() {
    start(async () => {
      if (!(await verificarSenhaAcao(senha))) {
        setMsg({ ok: false, texto: "Senha incorreta." });
        return;
      }
      const r = await enviarIngressosPagosSemIngresso(eventoId, [...marcadas]);
      setConfirmando(false);
      setSenha("");
      setMsg(
        r.error
          ? { ok: false, texto: r.error }
          : {
              ok: r.ok,
              texto:
                `${r.enviados} pedido(s) de envio feito(s). A confirmação e o QR chegam no WhatsApp em alguns minutos.` +
                (r.falhas.length ? ` Falharam: ${r.falhas.map((f) => `${f.nome ?? "?"} (${f.erro ?? "erro"})`).join(", ")}.` : ""),
            },
      );
      router.refresh();
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
      <p className="flex items-center gap-2 font-bold text-red-800">
        <AlertTriangle className="size-4" />
        {lista.length === 1
          ? "1 pessoa pagou no Asaas e não recebeu a confirmação e o QR"
          : `${lista.length} pessoas pagaram no Asaas e não receberam a confirmação e o QR`}
      </p>
      <p className="mt-1 text-sm text-red-900/80">
        Conferido agora com as duas contas do Asaas. O aviso do pagamento não chegou ao sistema, por isso nada foi enviado.
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Inscrito</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">Pagou</th>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2">No sistema</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => (
              <tr key={l.inscricaoId} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={marcadas.has(l.inscricaoId)}
                    onChange={() => alternar(l.inscricaoId)}
                    className="size-4 cursor-pointer accent-neel-blue"
                  />
                </td>
                <td className="px-3 py-2 font-semibold">{l.nome}</td>
                <td className="px-3 py-2 tabular-nums">{l.telefone}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatCurrency(l.valor)} · {FORMA[l.forma ?? ""] ?? l.forma ?? "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">{data(l.recebidoEm)}</td>
                <td className="px-3 py-2">{l.conta === "escola" ? "Escola" : "NEEL"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {l.motivo === "sem_qr" ? "Pago, QR não saiu" : l.statusSistema === "cancelado" ? "Cancelada" : "Pendente"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!confirmando ? (
          <Button type="button" disabled={!marcadas.size || pending} onClick={() => { setMsg(null); setConfirmando(true); }}>
            <Send /> Enviar confirmação e QR ({marcadas.size})
          </Button>
        ) : (
          <>
            <span className="text-sm font-semibold text-red-900">
              Vai mandar no WhatsApp para {marcadas.size} pessoa(s). Senha de ações:
            </span>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-9 w-40 bg-white"
              autoFocus
            />
            <Button type="button" disabled={!senha || pending} onClick={enviar}>
              {pending ? "Enviando..." : "Confirmar envio"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => { setConfirmando(false); setSenha(""); }}>
              Cancelar
            </Button>
          </>
        )}
      </div>
      {msg && (
        <p className={`mt-2 text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.texto}</p>
      )}
    </section>
  );
}
