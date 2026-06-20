"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verificarSenhaAcao } from "../eventos/actions";
import { excluirCobrancaCancelada } from "./actions";

export function ExcluirCobrancaButton({
  cobrancaId,
  descricao,
}: {
  cobrancaId: string;
  descricao: string;
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
      const r = await excluirCobrancaCancelada(cobrancaId);
      if (!r.ok) {
        setErroModal(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="size-3" />
        {pending ? "Excluindo..." : "Excluir"}
      </button>

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
              Digite a senha para excluir a cobrança cancelada
              {descricao ? ` "${descricao}"` : ""}. Esta ação não pode ser
              desfeita.
            </p>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor={`senha-excluir-cob-${cobrancaId}`}>Senha</Label>
              <Input
                id={`senha-excluir-cob-${cobrancaId}`}
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
