"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Keyboard,
  ScanLine,
  Search,
  UserSearch,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBrt } from "@/lib/utils";
import { QrScanner } from "./qr-scanner";
import {
  confirmarManual,
  listarParticipantes,
  validarTicket,
  type Participante,
  type ResultadoLeitura,
} from "../actions";

type Aba = "ler" | "lista";

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function PortariaApp({
  evento,
  participantesIniciais,
}: {
  evento: { id: string; nome: string };
  participantesIniciais: Participante[];
}) {
  const [aba, setAba] = useState<Aba>("ler");
  const [participantes, setParticipantes] = useState(participantesIniciais);
  const [, startTransition] = useTransition();

  const totalEntradas = participantes.reduce((s, p) => s + p.usadas, 0);
  const totalSenhas = participantes.reduce((s, p) => s + p.total, 0);

  async function refreshLista() {
    const lista = await listarParticipantes(evento.id);
    setParticipantes(lista);
  }

  // Atualiza a lista periodicamente (vários celulares veem o mesmo estado)
  useEffect(() => {
    const id = setInterval(refreshLista, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/portaria"
          aria-label="Trocar de evento"
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-white text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-amadeus-blue">
            Portaria
          </div>
          <h1 className="truncate text-lg font-extrabold">{evento.nome}</h1>
        </div>
        <div className="shrink-0 rounded-2xl border border-green-200 bg-green-50 px-3 py-1.5 text-center">
          <div className="text-xl font-extrabold leading-none text-green-700 tabular-nums">
            {totalEntradas}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700/80">
            de {totalSenhas} entradas
          </div>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-white p-1 shadow-sm">
        <TabPill active={aba === "ler"} onClick={() => setAba("ler")}>
          <ScanLine className="size-4" />
          Ler QR
        </TabPill>
        <TabPill active={aba === "lista"} onClick={() => setAba("lista")}>
          <Users className="size-4" />
          Participantes
        </TabPill>
      </div>

      {aba === "ler" ? (
        <LeitorTab
          eventoId={evento.id}
          onValidado={() => startTransition(refreshLista)}
        />
      ) : (
        <ListaTab
          eventoId={evento.id}
          participantes={participantes}
          onMudou={refreshLista}
        />
      )}
    </div>
  );
}

function TabPill({
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-amadeus-blue text-white shadow-float"
          : "text-amadeus-blue hover:bg-amadeus-blue-50"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================
// Aba: Ler QR
// ============================================================

function LeitorTab({
  eventoId,
  onValidado,
}: {
  eventoId: string;
  onValidado: () => void;
}) {
  const [resultado, setResultado] = useState<ResultadoLeitura | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState("");
  const [, startTransition] = useTransition();

  // throttle/dedupe das leituras da câmera
  const ocupadoRef = useRef(false);
  const ultimoRef = useRef<{ codigo: string; t: number }>({ codigo: "", t: 0 });

  function processar(codigo: string) {
    const agora = Date.now();
    if (ocupadoRef.current) return;
    if (
      codigo === ultimoRef.current.codigo &&
      agora - ultimoRef.current.t < 3000
    ) {
      return;
    }
    ultimoRef.current = { codigo, t: agora };
    ocupadoRef.current = true;

    startTransition(async () => {
      const r = await validarTicket(eventoId, codigo);
      setResultado(r);
      vibrar(r.status);
      onValidado();
      // libera novas leituras depois de um instante
      setTimeout(() => {
        ocupadoRef.current = false;
      }, 1500);
    });
  }

  function validarManual() {
    const c = codigoManual.trim();
    if (!c) return;
    setCodigoManual("");
    ocupadoRef.current = false; // leitura manual sempre passa
    ultimoRef.current = { codigo: "", t: 0 };
    processar(c);
  }

  return (
    <div className="space-y-4">
      {camError ? (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">Câmera indisponível</p>
            <p className="mt-0.5">
              {camError} Você ainda pode validar digitando o código abaixo.
            </p>
          </div>
        </div>
      ) : (
        <QrScanner onResult={processar} onError={setCamError} />
      )}

      <p className="text-center text-xs text-muted-foreground">
        Aponte a câmera para o QR Code. A liberação é automática.
      </p>

      <div className="rounded-2xl border border-border bg-white p-3">
        <label
          htmlFor="codigo-manual"
          className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
        >
          <Keyboard className="size-4" />
          Digitar código manualmente
        </label>
        <div className="flex gap-2">
          <Input
            id="codigo-manual"
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") validarManual();
            }}
            placeholder="AMZ-..."
            autoComplete="off"
          />
          <Button type="button" onClick={validarManual}>
            Validar
          </Button>
        </div>
      </div>

      {resultado?.status === "por_nome" ? (
        <PainelPorNome
          eventoId={eventoId}
          tokenLido={resultado.tokenLido}
          candidatos={resultado.candidatos}
          onFechar={() => setResultado(null)}
          onConfirmado={onValidado}
        />
      ) : resultado ? (
        <ResultadoCard
          resultado={resultado}
          onFechar={() => setResultado(null)}
        />
      ) : null}
    </div>
  );
}

function PainelPorNome({
  eventoId,
  tokenLido,
  candidatos,
  onFechar,
  onConfirmado,
}: {
  eventoId: string;
  tokenLido: string;
  candidatos: Participante[];
  onFechar: () => void;
  onConfirmado: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [sucesso, setSucesso] = useState<{
    nome: string;
    usadas: number;
    total: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function confirmar(p: Participante) {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarManual(eventoId, p.inscricaoId, tokenLido);
      onConfirmado();
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível confirmar.");
        return;
      }
      setSucesso({ nome: p.nome, usadas: r.usadas ?? 0, total: r.total ?? 0 });
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl border-2 border-green-500 bg-green-50 p-6 shadow-float-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-green-900">
            {sucesso ? (
              <CheckCircle2 className="size-7 shrink-0 text-green-600" />
            ) : (
              <UserSearch className="size-7 shrink-0 text-green-600" />
            )}
            <span className="text-lg font-extrabold">
              {sucesso ? "ENTRADA CONFIRMADA" : "CONFIRMAR ENTRADA"}
            </span>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1 transition-colors hover:bg-black/10"
          >
            <X className="size-5" />
          </button>
        </div>

        {sucesso ? (
          <div className="mt-3 text-green-900">
            <div className="text-xl font-bold">{sucesso.nome}</div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-sm font-bold">
              Entrada {sucesso.usadas} de {sucesso.total}
            </div>
            <Button type="button" onClick={onFechar} className="mt-4 w-full">
              Ler próximo
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-green-900">
              Confira o nome e confirme a entrada:
            </p>
            <ul className="mt-3 space-y-2">
              {candidatos.map((p) => {
                const completo = p.usadas >= p.total;
                return (
                  <li
                    key={p.inscricaoId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.nome}</div>
                      <div
                        className={`text-sm font-bold tabular-nums ${
                          completo ? "text-green-700" : "text-amadeus-blue"
                        }`}
                      >
                        {p.usadas}/{p.total} {completo && "✓"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || completo}
                      onClick={() => confirmar(p)}
                    >
                      <Check className="size-4" />
                      Confirmar
                    </Button>
                  </li>
                );
              })}
            </ul>
            {erro && (
              <p className="mt-3 text-sm font-semibold text-destructive">
                {erro}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function vibrar(status: ResultadoLeitura["status"]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(status === "liberado" ? 120 : [70, 60, 70]);
  } catch {
    /* ignore */
  }
}

function ResultadoCard({
  resultado,
  onFechar,
}: {
  resultado: ResultadoLeitura;
  onFechar: () => void;
}) {
  const r = resultado;

  const visual = (() => {
    switch (r.status) {
      case "liberado":
        return {
          cor: "border-green-500 bg-green-50 text-green-900",
          icone: <CheckCircle2 className="size-12 text-green-600" />,
          titulo: "LIBERADO",
        };
      case "ja_usado":
        return {
          cor: "border-red-500 bg-red-50 text-red-900",
          icone: <XCircle className="size-12 text-red-600" />,
          titulo: "JÁ UTILIZADO",
        };
      case "cancelado":
        return {
          cor: "border-zinc-400 bg-zinc-100 text-zinc-800",
          icone: <Ban className="size-12 text-zinc-500" />,
          titulo: "INGRESSO CANCELADO",
        };
      case "outro_evento":
        return {
          cor: "border-amber-400 bg-amber-50 text-amber-900",
          icone: <AlertTriangle className="size-12 text-amber-600" />,
          titulo: "QR DE OUTRO EVENTO",
        };
      case "nao_encontrado":
        return {
          cor: "border-amber-400 bg-amber-50 text-amber-900",
          icone: <AlertTriangle className="size-12 text-amber-600" />,
          titulo: "CÓDIGO NÃO ENCONTRADO",
        };
      default:
        return {
          cor: "border-red-400 bg-red-50 text-red-900",
          icone: <AlertTriangle className="size-12 text-red-600" />,
          titulo: "ERRO",
        };
    }
  })();

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className={`pointer-events-auto w-full max-w-md rounded-3xl border-2 p-6 shadow-float-lg ${visual.cor}`}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0">{visual.icone}</div>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold tracking-tight">
              {visual.titulo}
            </div>

            {(r.status === "liberado" || r.status === "ja_usado") && (
              <>
                <div className="mt-1 truncate text-lg font-bold">{r.nome}</div>
                <div className="text-sm opacity-90">{r.tipo}</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 text-sm font-bold">
                  Entrada {r.usadas} de {r.total}
                </div>
                {r.status === "ja_usado" && r.usadoEm && (
                  <div className="mt-1 text-sm">
                    Entrou em {formatDateTimeBrt(r.usadoEm)}
                  </div>
                )}
              </>
            )}
            {r.status === "cancelado" && (
              <div className="mt-1 truncate text-lg font-bold">{r.nome}</div>
            )}
            {r.status === "outro_evento" && (
              <div className="mt-1 text-sm">
                Este QR é do evento <strong>{r.eventoNome}</strong>.
              </div>
            )}
            {r.status === "nao_encontrado" && (
              <div className="mt-1 text-sm">
                {r.nomeQr ? (
                  <p>
                    Não reconheci <strong>{r.nomeQr}</strong> na lista deste
                    evento. Confirme manualmente na aba{" "}
                    <strong>Participantes</strong>.
                  </p>
                ) : (
                  <p>
                    Não reconheci este QR. Confirme manualmente na aba{" "}
                    <strong>Participantes</strong>.
                  </p>
                )}
              </div>
            )}
            {r.status === "erro" && (
              <div className="mt-1 text-sm">{r.mensagem}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/10"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Aba: Participantes
// ============================================================

function ListaTab({
  eventoId,
  participantes,
  onMudou,
}: {
  eventoId: string;
  participantes: Participante[];
  onMudou: () => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [confirmando, setConfirmando] = useState<Participante | null>(null);

  // Cada palavra digitada precisa aparecer em algum lugar do nome do aluno
  // OU do responsável. Assim "ali melo" acha "Alice Melo", e dá pra buscar
  // pelo responsável também.
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const lista = termos.length
    ? participantes.filter((p) => {
        const alvo = normalizar(`${p.nome} ${p.responsavel}`);
        return termos.every((termo) => alvo.includes(termo));
      })
    : participantes;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-9"
        />
      </div>

      {lista.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-amadeus-blue/20 bg-white py-12 text-sm text-muted-foreground">
          {participantes.length === 0
            ? "Nenhum participante com senha neste evento."
            : `Ninguém encontrado para "${busca.trim()}".`}
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((p) => {
            const completo = p.usadas >= p.total;
            return (
              <li
                key={p.inscricaoId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.nome}</div>
                  {p.responsavel &&
                    normalizar(p.responsavel) !== normalizar(p.nome) && (
                      <div className="truncate text-xs text-muted-foreground">
                        Resp.: {p.responsavel}
                      </div>
                    )}
                  <div
                    className={`text-sm font-bold tabular-nums ${
                      completo ? "text-green-700" : "text-amadeus-blue"
                    }`}
                  >
                    {p.usadas}/{p.total} {completo && "✓"}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={completo ? "outline" : "default"}
                  disabled={completo}
                  onClick={() => setConfirmando(p)}
                >
                  <Check className="size-4" />
                  +1 entrada
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {confirmando && (
        <ConfirmarManualDialog
          eventoId={eventoId}
          participante={confirmando}
          onFechar={() => setConfirmando(null)}
          onConfirmado={onMudou}
        />
      )}
    </div>
  );
}

function ConfirmarManualDialog({
  eventoId,
  participante,
  onFechar,
  onConfirmado,
}: {
  eventoId: string;
  participante: Participante;
  onFechar: () => void;
  onConfirmado: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const proximo = Math.min(participante.usadas + 1, participante.total);

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarManual(eventoId, participante.inscricaoId);
      await onConfirmado();
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível confirmar.");
        return;
      }
      onFechar();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-float-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-amadeus-blue">
            Confirmar entrada
          </h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Confirmar 1 entrada de:
        </p>
        <p className="mt-1 text-lg font-bold">{participante.nome}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amadeus-blue-50 px-3 py-1 text-sm font-bold text-amadeus-blue">
          Vai ficar {proximo}/{participante.total}
        </div>

        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onFechar}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={pending}>
            {pending ? "Confirmando..." : "Confirmar entrada"}
          </Button>
        </div>
      </div>
    </div>
  );
}
