"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EventoForm } from "@/components/admin/evento-form";
import type {
  CreateEventoState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- just for type reference
} from "../actions";
import type { ExtractedEvento } from "@/lib/extract-evento";
import { importarEvento, type ImportarState } from "./actions";

type CreateAction = (
  state: CreateEventoState,
  formData: FormData,
) => Promise<CreateEventoState>;

interface Props {
  createAction: CreateAction;
}

export function ImportarFlow({ createAction }: Props) {
  const [state, action, isPending] = useActionState<ImportarState, FormData>(
    importarEvento,
    null,
  );

  if (state?.ok) {
    return <FormDepoisExtracao dados={state.dados} createAction={createAction} />;
  }

  return <FormImportar action={action} state={state} isPending={isPending} />;
}

// ============================================================
// ETAPA 1 — Form de importar (texto ou PDF)
// ============================================================

interface FormImportarProps {
  action: (formData: FormData) => void;
  state: ImportarState;
  isPending: boolean;
}

function FormImportar({ action, state, isPending }: FormImportarProps) {
  const [tipo, setTipo] = useState<"texto" | "pdf">("texto");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-amadeus-yellow-dark" />
          Importar com IA
        </CardTitle>
        <CardDescription>
          Cole o texto do aviso ou faça upload do PDF. A IA vai extrair os
          dados e pré-preencher o formulário do evento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="mb-5 flex gap-2">
          <TabButton active={tipo === "texto"} onClick={() => setTipo("texto")}>
            <Type className="size-4" />
            Colar texto
          </TabButton>
          <TabButton active={tipo === "pdf"} onClick={() => setTipo("pdf")}>
            <FileText className="size-4" />
            Upload PDF
          </TabButton>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="tipo" value={tipo} />

          {tipo === "texto" ? (
            <Textarea
              name="texto"
              rows={14}
              placeholder={`Cole aqui o texto do aviso. Exemplo:

ENCONTRO DE CONFRATERNIZAÇÃO 2026
O NEEL convida todos para uma tarde especial no dia 16/05/2026 (sábado), às 15h, no salão principal.

Valores:
- Contribuição: R$ 80,00
- Contribuição extra: R$ 40,00

Prazo de inscrição: 11/05/2026
Crianças são isentas.
...`}
              required
              disabled={isPending}
            />
          ) : (
            <label
              htmlFor="pdf-input"
              className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-amadeus-blue/30 bg-amadeus-blue-50/30 py-12 transition-colors hover:border-amadeus-blue/60"
            >
              <div className="text-center">
                <Upload className="mx-auto size-8 text-amadeus-blue" />
                <p className="mt-3 text-sm font-semibold text-amadeus-blue">
                  {pdfFile ? pdfFile.name : "Clique para escolher o PDF"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Apenas PDF · máx 10MB
                </p>
              </div>
              <input
                id="pdf-input"
                type="file"
                name="pdf"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                required
                disabled={isPending}
              />
            </label>
          )}

          {state && state.ok === false && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center">
            <p className="text-xs text-muted-foreground">
              💡 Custa cerca de <strong>R$ 0,015</strong> por extração. Modelo:
              Claude Sonnet 4.6.
            </p>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? (
                <>
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Lendo o aviso...
                </>
              ) : (
                <>
                  <Sparkles />
                  Analisar com IA
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-amadeus-blue text-white shadow-float"
          : "border border-amadeus-blue/30 text-amadeus-blue hover:bg-amadeus-blue-50"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================
// ETAPA 2 — Form pré-preenchido com os dados extraídos
// ============================================================

interface FormDepoisExtracaoProps {
  dados: ExtractedEvento;
  createAction: CreateAction;
}

function FormDepoisExtracao({ dados, createAction }: FormDepoisExtracaoProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-green-300 bg-green-50 p-4 text-sm">
        <CheckCircle className="mt-0.5 size-5 shrink-0 text-green-700" />
        <div className="text-green-900">
          <p className="font-semibold">Dados extraídos com sucesso!</p>
          <p className="mt-1 text-green-800">
            Revise abaixo e ajuste o que precisar antes de criar o evento.
            Campos não detectados ficaram em branco.
          </p>
        </div>
      </div>

      <EventoForm
        initial={{
          nome: dados.nome,
          descricao_curta: dados.descricao_curta,
          descricao_longa: dados.descricao_longa,
          data_evento: dados.data_evento,
          hora_evento: dados.hora_evento,
          local: dados.local,
          imagem_capa_url: null,
          cor_tematica: dados.cor_tematica,
          metodos_pagamento: dados.metodos_pagamento,
          max_parcelas: dados.max_parcelas,
          prazo_inscricao: dados.prazo_inscricao,
          status: "rascunho",
          destinacao_valores: dados.destinacao_valores,
          infos_importantes: dados.infos_importantes,
          mostrar_estoque_publico: false,
        }}
        initialTipos={dados.tipos_ingresso.map((t) => ({
          nome: t.nome,
          preco: t.preco,
          descricao: t.descricao,
          max_ingressos: null,
          lotes: t.lotes ?? [],
        }))}
        submitAction={createAction}
        submitLabel="Criar evento"
      />
    </div>
  );
}
