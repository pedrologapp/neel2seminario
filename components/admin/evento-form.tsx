"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import {
  AlertCircle,
  ImagePlus,
  Plus,
  Trash2,
  X,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CreateEventoState } from "@/app/admin/(authed)/eventos/actions";

type LoteLinha = {
  nome: string;
  preco: string;
  valido_ate: string; // datetime-local "YYYY-MM-DDTHH:mm" or ""
};

type TipoLinha = {
  id?: string;
  nome: string;
  preco: string;
  descricao: string;
  max_ingressos: string; // "" = sem limite
  lotes: LoteLinha[];
};

const NOVO_LOTE: LoteLinha = { nome: "", preco: "", valido_ate: "" };

/**
 * Converte ISO UTC vindo do banco para datetime-local em horário de Brasília
 * (formato "YYYY-MM-DDTHH:mm" que o input[type=datetime-local] aceita).
 */
function isoUtcToBrtLocal(iso: string): string {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(" ", "T");
  return partes;
}

/** Converte datetime-local interpretado como Brasília pra ISO UTC. */
function brtLocalToIsoUtc(localValue: string): string | null {
  if (!localValue) return null;
  // localValue = "2026-05-30T23:59" — interpretado como -03:00
  const withOffset = `${localValue}:00-03:00`;
  const d = new Date(withOffset);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export interface EventoFormInitial {
  nome: string;
  descricao_curta: string | null;
  descricao_longa: string | null;
  data_evento: string;
  hora_evento: string | null;
  local: string | null;
  imagem_capa_url: string | null;
  cor_tematica: string;
  metodos_pagamento: string[];
  max_parcelas: number;
  prazo_inscricao: string | null;
  status: string;
  destinacao_valores: string | null;
  infos_importantes: string[] | null;
  mostrar_estoque_publico: boolean;
}

export interface EventoFormTipoInitialLote {
  nome: string;
  preco: number;
  valido_ate: string | null;
}

export interface EventoFormTipoInitial {
  id?: string;
  nome: string;
  preco: number;
  descricao: string | null;
  max_ingressos: number | null;
  lotes?: EventoFormTipoInitialLote[] | null;
}

interface Props {
  initial?: EventoFormInitial;
  initialTipos?: EventoFormTipoInitial[];
  submitAction: (
    state: CreateEventoState,
    formData: FormData,
  ) => Promise<CreateEventoState>;
  submitLabel?: string;
  cancelHref?: string;
}

export function EventoForm({
  initial,
  initialTipos,
  submitAction,
  submitLabel,
  cancelHref = "/admin/eventos",
}: Props) {
  const isEdit = !!initial;
  const [state, action, isPending] = useActionState(submitAction, null);

  const [tipos, setTipos] = useState<TipoLinha[]>(() => {
    if (initialTipos && initialTipos.length > 0) {
      return initialTipos.map((t) => ({
        id: t.id,
        nome: t.nome,
        preco: t.preco.toString().replace(".", ","),
        descricao: t.descricao ?? "",
        max_ingressos:
          t.max_ingressos && t.max_ingressos > 0
            ? t.max_ingressos.toString()
            : "",
        lotes: (t.lotes ?? []).map((l) => ({
          nome: l.nome,
          preco: l.preco.toString().replace(".", ","),
          valido_ate: l.valido_ate ? isoUtcToBrtLocal(l.valido_ate) : "",
        })),
      }));
    }
    return [
      { nome: "", preco: "", descricao: "", max_ingressos: "", lotes: [] },
    ];
  });

  const [imagemPreview, setImagemPreview] = useState<string | null>(
    initial?.imagem_capa_url ?? null,
  );
  const [removerImagem, setRemoverImagem] = useState(false);
  const [novoArquivoSelecionado, setNovoArquivoSelecionado] = useState(false);
  const [cor, setCor] = useState(initial?.cor_tematica ?? "#C2410C");
  const [publicar, setPublicar] = useState(initial?.status === "publicado");
  const [mostrarEstoque, setMostrarEstoque] = useState(
    initial?.mostrar_estoque_publico ?? false,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      // Voltou pro estado original (sem novo arquivo)
      setImagemPreview(initial?.imagem_capa_url ?? null);
      setNovoArquivoSelecionado(false);
      setRemoverImagem(false);
      return;
    }
    setImagemPreview(URL.createObjectURL(file));
    setNovoArquivoSelecionado(true);
    setRemoverImagem(false);
  }

  function removeImage() {
    setImagemPreview(null);
    setRemoverImagem(true);
    setNovoArquivoSelecionado(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateTipo(idx: number, patch: Partial<TipoLinha>) {
    setTipos((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    );
  }
  function addTipo() {
    setTipos((prev) => [
      ...prev,
      { nome: "", preco: "", descricao: "", max_ingressos: "", lotes: [] },
    ]);
  }
  function removeTipo(idx: number) {
    setTipos((prev) => prev.filter((_, i) => i !== idx));
  }
  function addLote(tipoIdx: number) {
    setTipos((prev) =>
      prev.map((t, i) =>
        i === tipoIdx ? { ...t, lotes: [...t.lotes, { ...NOVO_LOTE }] } : t,
      ),
    );
  }
  function removeLote(tipoIdx: number, loteIdx: number) {
    setTipos((prev) =>
      prev.map((t, i) =>
        i === tipoIdx
          ? { ...t, lotes: t.lotes.filter((_, j) => j !== loteIdx) }
          : t,
      ),
    );
  }
  function updateLote(
    tipoIdx: number,
    loteIdx: number,
    patch: Partial<LoteLinha>,
  ) {
    setTipos((prev) =>
      prev.map((t, i) =>
        i === tipoIdx
          ? {
              ...t,
              lotes: t.lotes.map((l, j) =>
                j === loteIdx ? { ...l, ...patch } : l,
              ),
            }
          : t,
      ),
    );
  }

  // Redimensiona/comprime a imagem no navegador antes de enviar, para não
  // estourar o limite de body do servidor (Next/Vercel) com fotos grandes.
  async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) return file;
    const MAX = 1600;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new window.Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Falha ao carregar a imagem"));
        i.src = dataUrl;
      });
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82),
      );
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
        type: "image/jpeg",
      });
    } catch {
      return file;
    }
  }

  async function submit(formData: FormData) {
    const file = formData.get("imagem_capa");
    if (file instanceof File && file.size > 0) {
      formData.set("imagem_capa", await compressImage(file));
    }
    formData.set(
      "tipos_ingresso",
      JSON.stringify(
        tipos.map((t) => {
          const lotesParsed = t.lotes.map((l) => ({
            nome: l.nome.trim(),
            preco: parseFloat(l.preco.replace(",", ".")) || 0,
            valido_ate: brtLocalToIsoUtc(l.valido_ate),
          }));
          // preco fallback: se houver lotes, usa o do primeiro (cronologicamente
          // mais cedo); senão usa o preço único informado.
          const precoFallback =
            lotesParsed.length > 0
              ? lotesParsed[0].preco
              : parseFloat(t.preco.replace(",", ".")) || 0;
          const maxNum = parseInt(t.max_ingressos.trim(), 10);
          const maxIngressos =
            Number.isFinite(maxNum) && maxNum > 0 ? maxNum : null;
          return {
            id: t.id,
            nome: t.nome.trim(),
            preco: precoFallback,
            descricao: t.descricao.trim() || null,
            max_ingressos: maxIngressos,
            lotes: lotesParsed,
          };
        }),
      ),
    );
    formData.set("status", publicar ? "publicado" : "rascunho");
    formData.set("remover_imagem", removerImagem ? "1" : "0");
    formData.set("mostrar_estoque_publico", mostrarEstoque ? "1" : "0");
    action(formData);
  }

  const erros = state?.fieldErrors;
  const horaInicial = initial?.hora_evento
    ? initial.hora_evento.slice(0, 5)
    : "";
  const prazoInicial = initial?.prazo_inscricao
    ? initial.prazo_inscricao.slice(0, 16)
    : "";
  const infosInicial = initial?.infos_importantes?.join("\n") ?? "";

  return (
    <form action={submit} className="space-y-6">
      {state?.error && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* ===== Básico ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Informações básicas</CardTitle>
          <CardDescription>
            Os dados principais que aparecem no card e no topo da página do
            evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Nome do evento *" error={erros?.nome}>
            <Input
              name="nome"
              placeholder="Ex: Dia das Mães 2026"
              defaultValue={initial?.nome ?? ""}
              required
            />
          </Field>
          <Field
            label="Descrição curta"
            hint="Aparece abaixo do título no card e no hero. Capriche em uma frase."
            error={erros?.descricao_curta}
          >
            <Input
              name="descricao_curta"
              placeholder="Ex: Uma tarde de carinho para celebrar nossas mães"
              defaultValue={initial?.descricao_curta ?? ""}
              maxLength={140}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data do evento *" error={erros?.data_evento}>
              <Input
                name="data_evento"
                type="date"
                defaultValue={initial?.data_evento ?? ""}
                required
              />
            </Field>
            <Field label="Horário" error={erros?.hora_evento}>
              <Input
                name="hora_evento"
                type="time"
                defaultValue={horaInicial}
              />
            </Field>
          </div>
          <Field label="Local" error={erros?.local}>
            <Input
              name="local"
              placeholder="Ex: Salão principal do NEEL"
              defaultValue={initial?.local ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ===== Visual ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Identidade visual</CardTitle>
          <CardDescription>
            Uma boa foto e uma cor temática deixam o evento muito mais
            convidativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Imagem de capa"
            hint="JPG ou PNG. Idealmente 1600×900px (16:9)."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <label
                htmlFor="imagem_capa"
                className="group relative grid h-32 w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-input bg-amadeus-blue-50/30 transition-colors hover:border-amadeus-blue/40 sm:w-56"
              >
                {imagemPreview ? (
                  <Image
                    src={imagemPreview}
                    alt="Pré-visualização da capa"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="text-center text-amadeus-blue">
                    <ImagePlus className="mx-auto size-7" />
                    <span className="mt-1 block text-xs font-semibold">
                      {isEdit ? "Trocar imagem" : "Selecionar"}
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  id="imagem_capa"
                  name="imagem_capa"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleImageChange}
                />
              </label>
              {(imagemPreview || novoArquivoSelecionado) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removeImage}
                >
                  <X />
                  Remover imagem
                </Button>
              )}
            </div>
          </Field>
          <Field
            label="Cor temática"
            hint="Será aplicada nos botões e destaques da página do evento."
            error={erros?.cor_tematica}
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="cor_tematica"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-11 w-16 cursor-pointer rounded-xl border border-input"
              />
              <Input
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="max-w-[140px]"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* ===== Tipos de ingresso ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tipos de ingresso</CardTitle>
              <CardDescription>
                Cada tipo vira uma opção pros pais escolherem na inscrição.
              </CardDescription>
            </div>
            <Badge variant="muted">{tipos.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {tipos.map((tipo, idx) => {
            const usaLotes = tipo.lotes.length > 0;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border/70 bg-white p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                  <Input
                    placeholder="Nome (ex: Senha de Mãe)"
                    value={tipo.nome}
                    onChange={(e) => updateTipo(idx, { nome: e.target.value })}
                  />
                  {usaLotes ? (
                    <div className="grid h-11 place-items-center rounded-xl border border-dashed border-amadeus-blue/30 bg-amadeus-blue-50/40 text-xs font-semibold text-amadeus-blue">
                      Por lotes
                    </div>
                  ) : (
                    <Input
                      placeholder="R$ 0,00"
                      inputMode="decimal"
                      value={tipo.preco}
                      onChange={(e) => updateTipo(idx, { preco: e.target.value })}
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTipo(idx)}
                    disabled={tipos.length === 1}
                    title="Remover"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Descrição opcional (ex: por mãe)"
                  value={tipo.descricao}
                  onChange={(e) =>
                    updateTipo(idx, { descricao: e.target.value })
                  }
                  className="mt-3"
                />

                {/* Limite de ingressos */}
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Limite
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder="ilimitado"
                    value={tipo.max_ingressos}
                    onChange={(e) =>
                      updateTipo(idx, { max_ingressos: e.target.value })
                    }
                    className="max-w-[140px]"
                  />
                  <span className="text-xs text-muted-foreground">
                    quantidade máxima vendida deste tipo (vazio = sem limite)
                  </span>
                </div>

                {/* Lotes */}
                <div className="mt-4 rounded-xl border border-amadeus-blue/15 bg-amadeus-blue-50/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-amadeus-blue">
                        Lotes (preço varia ao longo do tempo)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Opcional. Se ativado, o preço acima é ignorado e cada
                        lote tem seu próprio preço + prazo.
                      </p>
                    </div>
                    {!usaLotes && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addLote(idx)}
                      >
                        <Plus />
                        Ativar lotes
                      </Button>
                    )}
                  </div>

                  {usaLotes &&
                    (() => {
                      const statuses = computeLoteStatuses(tipo.lotes);
                      return (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-amadeus-blue/70">
                            {tipo.lotes.length}{" "}
                            {tipo.lotes.length === 1 ? "lote" : "lotes"}{" "}
                            configurado{tipo.lotes.length === 1 ? "" : "s"}
                          </p>
                          {tipo.lotes.map((lote, lidx) => (
                            <LoteCard
                              key={lidx}
                              lote={lote}
                              ordem={lidx + 1}
                              status={statuses[lidx]}
                              onChange={(patch) => updateLote(idx, lidx, patch)}
                              onRemove={() => removeLote(idx, lidx)}
                            />
                          ))}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <p className="text-xs text-muted-foreground">
                              💡 Horário de Brasília. Deixe &quot;Válido até&quot;
                              vazio no <strong>último lote</strong> (sem prazo).
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addLote(idx)}
                            >
                              <Plus />
                              Adicionar lote
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            );
          })}
          {erros?.tipos_ingresso && (
            <p className="text-sm text-destructive">
              {erros.tipos_ingresso.join(", ")}
            </p>
          )}
          <Button type="button" variant="outline" onClick={addTipo}>
            <Plus />
            Adicionar tipo
          </Button>
        </CardContent>
      </Card>

      {/* ===== Pagamento ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamento</CardTitle>
          <CardDescription>
            Métodos aceitos e regras de parcelamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">Métodos aceitos *</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox
                name="metodos_pagamento"
                value="pix"
                label="PIX"
                hint="Sem taxas adicionais"
                defaultChecked={initial?.metodos_pagamento?.includes("pix") ?? true}
              />
              <Checkbox
                name="metodos_pagamento"
                value="cartao"
                label="Cartão de crédito"
                hint="Taxas do Asaas aplicadas"
                defaultChecked={
                  initial?.metodos_pagamento?.includes("cartao") ?? true
                }
              />
            </div>
            {erros?.metodos_pagamento && (
              <p className="mt-2 text-sm text-destructive">
                {erros.metodos_pagamento.join(", ")}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Máximo de parcelas">
              <Select
                name="max_parcelas"
                defaultValue={(initial?.max_parcelas ?? 3).toString()}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Prazo final de inscrição"
              hint="Após essa data, ninguém poderá mais se inscrever."
              error={erros?.prazo_inscricao}
            >
              <Input
                name="prazo_inscricao"
                type="datetime-local"
                defaultValue={prazoInicial}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ===== Conteúdo extra ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Conteúdo da página</CardTitle>
          <CardDescription>
            Tudo que ajuda os pais a entenderem o evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Descrição completa"
            hint="Aparece logo após o hero da página do evento."
          >
            <Textarea
              name="descricao_longa"
              rows={4}
              placeholder="Conte tudo o que vai rolar..."
              defaultValue={initial?.descricao_longa ?? ""}
            />
          </Field>
          <Field
            label="O que está incluído"
            hint="Lista do que o pagamento cobre. Aparece logo abaixo da descrição na página do evento."
          >
            <Textarea
              name="destinacao_valores"
              rows={3}
              placeholder="Ex: Lembrancinhas, ornamentação, alimentação..."
              defaultValue={initial?.destinacao_valores ?? ""}
            />
          </Field>
          <Field
            label="Informações importantes"
            hint="Uma linha por item — vira lista com bolinhas na página."
          >
            <Textarea
              name="infos_importantes"
              rows={4}
              placeholder={`Cantina aberta durante o evento\nLevar um agasalho\nAtenção ao prazo final`}
              defaultValue={infosInicial}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ===== Publicação ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Publicação</CardTitle>
          <CardDescription>
            Eventos em rascunho ficam invisíveis pros pais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Switch
            checked={publicar}
            onChange={(e) => setPublicar(e.target.checked)}
            label={
              publicar
                ? "Publicar imediatamente"
                : "Salvar como rascunho"
            }
          />
          <Switch
            checked={mostrarEstoque}
            onChange={(e) => setMostrarEstoque(e.target.checked)}
            label={
              mostrarEstoque
                ? "Mostrar contador de ingressos restantes pro cliente"
                : "Esconder contador (só aparece 'Esgotado' quando estourar)"
            }
          />
        </CardContent>
      </Card>

      {/* ===== Ações ===== */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending
            ? "Salvando..."
            : submitLabel
              ? submitLabel
              : publicar
                ? "Publicar evento"
                : "Salvar rascunho"}
        </Button>
      </div>
    </form>
  );
}

// ---------- Helper ----------

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string[];
  children: React.ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error?.length && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && error.length > 0 && (
        <p className="text-xs text-destructive">{error.join(", ")}</p>
      )}
    </div>
  );
}

// ---------- Lote: status + card ----------

type LoteStatus = "ativo" | "aguardando" | "encerrado";

function computeLoteStatuses(lotes: LoteLinha[]): LoteStatus[] {
  if (lotes.length === 0) return [];
  const now = new Date();

  const indexed = lotes.map((l, idx) => {
    const isoStr = l.valido_ate ? brtLocalToIsoUtc(l.valido_ate) : null;
    return { idx, dt: isoStr ? new Date(isoStr) : null };
  });

  // Ordena cronologicamente — null vai pro fim (sem prazo)
  const sorted = [...indexed].sort((a, b) => {
    if (a.dt === null && b.dt === null) return 0;
    if (a.dt === null) return 1;
    if (b.dt === null) return -1;
    return a.dt.getTime() - b.dt.getTime();
  });

  const result = new Array<LoteStatus>(lotes.length);
  let achouAtivo = false;
  for (const item of sorted) {
    if (item.dt !== null && item.dt.getTime() <= now.getTime()) {
      result[item.idx] = "encerrado";
    } else if (!achouAtivo) {
      result[item.idx] = "ativo";
      achouAtivo = true;
    } else {
      result[item.idx] = "aguardando";
    }
  }
  return result;
}

const statusVisual: Record<
  LoteStatus,
  { rotulo: string; chip: string; borda: string }
> = {
  ativo: {
    rotulo: "🟢 Ativo agora",
    chip: "bg-green-100 text-green-800 ring-1 ring-green-300",
    borda: "border-green-500",
  },
  aguardando: {
    rotulo: "⏳ Aguardando vez",
    chip: "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
    borda: "border-amber-300",
  },
  encerrado: {
    rotulo: "⏸ Encerrado",
    chip: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300",
    borda: "border-zinc-300",
  },
};

function LoteCard({
  lote,
  ordem,
  status,
  onChange,
  onRemove,
}: {
  lote: LoteLinha;
  ordem: number;
  status: LoteStatus;
  onChange: (patch: Partial<LoteLinha>) => void;
  onRemove: () => void;
}) {
  const v = statusVisual[status];
  return (
    <div
      className={`rounded-2xl border-2 bg-white p-4 transition-opacity ${v.borda} ${
        status === "encerrado" ? "opacity-70" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${v.chip}`}
        >
          {v.rotulo}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          title="Remover lote"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr]">
        <div>
          <Label className="mb-1 block text-xs">Nome do lote</Label>
          <Input
            placeholder={`${ordem}º Lote`}
            value={lote.nome}
            onChange={(e) => onChange({ nome: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Preço</Label>
          <Input
            placeholder="R$ 0,00"
            inputMode="decimal"
            value={lote.preco}
            onChange={(e) => onChange({ preco: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Válido até</Label>
          <Input
            type="datetime-local"
            value={lote.valido_ate}
            onChange={(e) => onChange({ valido_ate: e.target.value })}
            title="Deixe vazio se for o último lote (sem prazo)"
          />
        </div>
      </div>
    </div>
  );
}
