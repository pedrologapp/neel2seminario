"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Lock, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteEvento, duplicateEvento, verificarSenhaAcao } from "../actions";

type Kind = "editar" | "duplicar" | "excluir";

interface Props {
  kind: Kind;
  eventoId: string;
  eventoNome?: string;
}

const config: Record<
  Kind,
  {
    label: string;
    pending: string;
    variant: "default" | "outline" | "destructive";
    Icon: typeof Pencil;
  }
> = {
  editar: { label: "Editar", pending: "Editar", variant: "default", Icon: Pencil },
  duplicar: {
    label: "Duplicar",
    pending: "Duplicando...",
    variant: "outline",
    Icon: Copy,
  },
  excluir: {
    label: "Excluir",
    pending: "Excluindo...",
    variant: "destructive",
    Icon: Trash2,
  },
};

export function SenhaGateButton({ kind, eventoId, eventoNome }: Props) {
  const router = useRouter();
  const c = config[kind];
  const { Icon } = c;
  const [open, setOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir() {
    setSenha("");
    setErro(null);
    setOpen(true);
  }

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const ok = await verificarSenhaAcao(senha);
      if (!ok) {
        setErro("Senha incorreta.");
        return;
      }
      if (kind === "editar") {
        setOpen(false);
        router.push(`/admin/eventos/${eventoId}/editar`);
      } else if (kind === "duplicar") {
        setOpen(false);
        await duplicateEvento(eventoId);
      } else {
        const result = await deleteEvento(eventoId);
        if (result && "error" in result && result.error) {
          setErro(result.error);
          return;
        }
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={c.variant}
        onClick={abrir}
        disabled={isPending}
      >
        <Icon />
        {isPending ? c.pending : c.label}
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
              {kind === "excluir"
                ? `Para excluir "${eventoNome ?? "este evento"}", digite a senha. Esta ação não pode ser desfeita.`
                : `Digite a senha para ${kind === "editar" ? "editar" : "duplicar"} este evento.`}
            </p>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="senha-acao">Senha</Label>
              <Input
                id="senha-acao"
                type="password"
                value={senha}
                autoFocus
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmar();
                }}
                placeholder="••••••"
              />
              {erro && <p className="text-xs text-destructive">{erro}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant={kind === "excluir" ? "destructive" : "default"}
                onClick={confirmar}
                disabled={isPending || senha.length === 0}
              >
                {isPending ? "Verificando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
