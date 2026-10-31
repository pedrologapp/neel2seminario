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
  Ticket,
  UserSearch,
  Users,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import { QrScanner } from "./qr-scanner";
import {
  confirmarManual,
  listarParticipantes,
  validarTicket,
  type Modo,
  type Participante,
  type ResultadoLeitura,
} from "../actions";

// Portaria do evento (refeita em 31/10 para o 2º Seminário): dois modos —
// ENTRADA (ingressos) e ALMOÇO (refeições compradas) — cada um com a sua
// contagem, o leitor de QR e a lista para confirmar quem chega sem o QR.
// Visual: inspirado nos apps de check-in de eventos (Luma, Eventbrite
// Organizer): papel claro, tinta escura, uma cor por modo, resultado em tela
// cheia para quem está na fila enxergar de longe.

type Aba = "ler" | "lista";

const COR: Record<Modo, { forte: string; suave: string; texto: string }> = {
  entrada: { forte: "#c2410c", suave: "#fff1e6", texto: "#9a3412" },
  almoco: { forte: "#0f766e", suave: "#e6f4f1", texto: "#115e59" },
};
const ROTULO: Record<Modo, string> = { entrada: "Entrada", almoco: "Almoço" };

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function hora(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  });
}

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function PortariaApp({
  evento,
  listasIniciais,
}: {
  evento: { id: string; nome: string };
  listasIniciais: Record<Modo, Participante[]>;
}) {
  const [modo, setModo] = useState<Modo>("entrada");
  const [aba, setAba] = useState<Aba>("ler");
  const [listas, setListas] = useState(listasIniciais);
  const [, startTransition] = useTransition();

  async function refresh() {
    const [entrada, almoco] = await Promise.all([
      listarParticipantes(evento.id, "entrada"),
      listarParticipantes(evento.id, "almoco"),
    ]);
    setListas({ entrada, almoco });
  }

  // Vários celulares na portaria: a contagem se atualiza sozinha
  useEffect(() => {
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conta = (m: Modo) => ({
    feitas: listas[m].reduce((s, p) => s + p.usadas, 0),
    total: listas[m].reduce((s, p) => s + p.total, 0),
  });
  const cor = COR[modo];

  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#1c1917]">
      <div className="mx-auto max-w-xl px-4 pb-10 pt-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/portaria"
            aria-label="Trocar de evento"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#e7e5e4] bg-white text-[#78716c] active:scale-95"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#78716c]">
              Portaria
            </div>
            <h1 className="truncate text-base font-bold leading-tight">{evento.nome}</h1>
          </div>
        </header>

        {/* os dois modos: contagem + botão de trocar */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          {(["entrada", "almoco"] as Modo[]).map((m) => {
            const c = conta(m), ativo = m === modo, k = COR[m];
            const pct = c.total ? Math.round((c.feitas / c.total) * 100) : 0;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                aria-pressed={ativo}
                className="relative overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98]"
                style={{
                  borderColor: ativo ? k.forte : "#e7e5e4",
                  background: ativo ? k.forte : "#fff",
                  color: ativo ? "#fff" : "#1c1917",
                }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-90">
                  {m === "entrada" ? <Ticket className="size-3.5" /> : <UtensilsCrossed className="size-3.5" />}
                  {ROTULO[m]}
                </div>
                <div className="mt-1 flex items-baseline gap-1 tabular-nums">
                  <span className="text-3xl font-extrabold leading-none">{c.feitas}</span>
                  <span className="text-sm font-semibold opacity-75">/ {c.total}</span>
                </div>
                <div
                  className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: ativo ? "rgba(255,255,255,.28)" : "#f1efec" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: ativo ? "#fff" : k.forte }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* abas */}
        <div className="mb-4 flex gap-1 rounded-full border border-[#e7e5e4] bg-white p-1">
          {([
            ["ler", "Ler QR", ScanLine],
            ["lista", "Lista de nomes", Users],
          ] as const).map(([a, rotulo, Icone]) => (
            <button
              key={a}
              type="button"
              onClick={() => setAba(a)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors"
              style={aba === a ? { background: "#1c1917", color: "#fff" } : { color: "#57534e" }}
            >
              <Icone className="size-4" />
              {rotulo}
            </button>
          ))}
        </div>

        {aba === "ler" ? (
          <LeitorTab
            key={modo}
            eventoId={evento.id}
            modo={modo}
            onValidado={() => startTransition(refresh)}
          />
        ) : (
          <ListaTab
            key={modo}
            eventoId={evento.id}
            modo={modo}
            participantes={listas[modo]}
            onMudou={refresh}
          />
        )}

        <p className="mt-6 text-center text-xs" style={{ color: cor.texto }}>
          Você está no modo <strong>{ROTULO[modo].toUpperCase()}</strong>.
          {modo === "almoco" ? " Só os QR de almoço são aceitos." : " Só os QR de ingresso são aceitos."}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Ler QR
// ============================================================

type Leitura = { nome: string; status: ResultadoLeitura["status"]; t: number };

function LeitorTab({
  eventoId,
  modo,
  onValidado,
}: {
  eventoId: string;
  modo: Modo;
  onValidado: () => void;
}) {
  const [resultado, setResultado] = useState<ResultadoLeitura | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState("");
  const [digitar, setDigitar] = useState(false);
  const [ultimas, setUltimas] = useState<Leitura[]>([]);
  const [, startTransition] = useTransition();
  const cor = COR[modo];

  // throttle/dedupe das leituras da câmera
  const ocupadoRef = useRef(false);
  const ultimoRef = useRef<{ codigo: string; t: number }>({ codigo: "", t: 0 });

  function processar(codigo: string) {
    const agora = Date.now();
    if (ocupadoRef.current) return;
    if (codigo === ultimoRef.current.codigo && agora - ultimoRef.current.t < 3000) return;
    ultimoRef.current = { codigo, t: agora };
    ocupadoRef.current = true;

    startTransition(async () => {
      const r = await validarTicket(eventoId, codigo, modo);
      setResultado(r);
      vibrar(r.status);
      onValidado();
      const nome = "nome" in r ? r.nome : r.status === "por_nome" ? r.nomeQr : "Código não reconhecido";
      setUltimas((u) => [{ nome, status: r.status, t: Date.now() }, ...u].slice(0, 6));
      setTimeout(() => {
        ocupadoRef.current = false;
      }, 1500);
    });
  }

  function validarManual() {
    const c = codigoManual.trim();
    if (!c) return;
    setCodigoManual("");
    ocupadoRef.current = false;
    ultimoRef.current = { codigo: "", t: 0 };
    processar(c);
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-sm">
        {camError ? (
          <div className="flex items-start gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="size-5 shrink-0" />
            <div>
              <p className="font-semibold">Câmera indisponível</p>
              <p className="mt-0.5">{camError} Use a lista de nomes ou digite o código.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl bg-black shadow-[0_10px_30px_rgba(28,25,23,.18)]">
              <QrScanner onResult={processar} onError={setCamError} />
            </div>
            {/* cantoneiras na cor do modo */}
            <div className="pointer-events-none absolute inset-0">
              {["left-3 top-3 border-l-4 border-t-4 rounded-tl-2xl", "right-3 top-3 border-r-4 border-t-4 rounded-tr-2xl", "left-3 bottom-3 border-l-4 border-b-4 rounded-bl-2xl", "right-3 bottom-3 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
                <span key={c} className={`absolute size-10 ${c}`} style={{ borderColor: cor.forte }} />
              ))}
            </div>
            <div
              className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white"
              style={{ background: cor.forte }}
            >
              {ROTULO[modo]}
            </div>
          </>
        )}
      </div>

      <p className="text-center text-sm text-[#78716c]">
        Aponte para o QR Code. A confirmação é automática.
      </p>

      {digitar ? (
        <div className="flex gap-2 rounded-2xl border border-[#e7e5e4] bg-white p-2">
          <input
            autoFocus
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") validarManual();
            }}
            placeholder="NEEL-..."
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl bg-transparent px-3 text-base outline-none"
          />
          <button
            type="button"
            onClick={validarManual}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: cor.forte }}
          >
            Validar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDigitar(true)}
          className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-[#57534e] underline-offset-4 hover:underline"
        >
          <Keyboard className="size-4" />
          Digitar o código
        </button>
      )}

      {ultimas.length > 0 && (
        <div className="rounded-2xl border border-[#e7e5e4] bg-white">
          <div className="border-b border-[#f1efec] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#78716c]">
            Últimas leituras
          </div>
          <ul>
            {ultimas.map((u) => (
              <li key={u.t} className="flex items-center gap-3 border-b border-[#f5f4f2] px-4 py-2.5 last:border-0">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: corStatus(u.status) }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{u.nome}</span>
                <span className="text-xs text-[#a8a29e] tabular-nums">{hora(new Date(u.t).toISOString())}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado?.status === "por_nome" ? (
        <PainelPorNome
          eventoId={eventoId}
          modo={modo}
          tokenLido={resultado.tokenLido}
          candidatos={resultado.candidatos}
          onFechar={() => setResultado(null)}
          onConfirmado={onValidado}
        />
      ) : resultado ? (
        <ResultadoTela resultado={resultado} modo={modo} onFechar={() => setResultado(null)} />
      ) : null}
    </div>
  );
}

function corStatus(s: ResultadoLeitura["status"]) {
  return s === "liberado" ? "#16a34a" : s === "ja_usado" ? "#dc2626" : "#d97706";
}

function vibrar(status: ResultadoLeitura["status"]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(status === "liberado" ? 120 : [70, 60, 70]);
  } catch {
    /* ignore */
  }
}

// Resultado em tela cheia (quem está na fila enxerga de longe). O verde some
// sozinho em 2,5 s; os outros ficam até tocar.
function ResultadoTela({
  resultado: r,
  modo,
  onFechar,
}: {
  resultado: ResultadoLeitura;
  modo: Modo;
  onFechar: () => void;
}) {
  useEffect(() => {
    if (r.status !== "liberado") return;
    const id = setTimeout(onFechar, 2500);
    return () => clearTimeout(id);
  }, [r, onFechar]);

  const unidade = modo === "almoco" ? "Almoço" : "Entrada";
  const v = (() => {
    switch (r.status) {
      case "liberado":
        return { fundo: "#15803d", Icone: CheckCircle2, titulo: modo === "almoco" ? "Almoço liberado" : "Entrada liberada" };
      case "ja_usado":
        return { fundo: "#b91c1c", Icone: XCircle, titulo: "Já foi usado" };
      case "tipo_errado":
        return { fundo: "#b45309", Icone: AlertTriangle, titulo: r.modoDoQr === "almoco" ? "Este QR é do almoço" : "Este QR é de entrada" };
      case "cancelado":
        return { fundo: "#44403c", Icone: Ban, titulo: "Ingresso cancelado" };
      case "outro_evento":
        return { fundo: "#b45309", Icone: AlertTriangle, titulo: "QR de outro evento" };
      case "nao_encontrado":
        return { fundo: "#b45309", Icone: AlertTriangle, titulo: "Código não encontrado" };
      default:
        return { fundo: "#7f1d1d", Icone: AlertTriangle, titulo: "Erro" };
    }
  })();

  return (
    <button
      type="button"
      onClick={onFechar}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white"
      style={{ background: v.fundo, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <v.Icone className="size-24" strokeWidth={1.75} />
      <div className="mt-5 text-3xl font-extrabold tracking-tight">{v.titulo}</div>

      {(r.status === "liberado" || r.status === "ja_usado") && (
        <>
          <div className="mt-4 max-w-full text-2xl font-bold leading-snug">{r.nome}</div>
          <div className="mt-1 text-base opacity-85">{r.tipo}</div>
          <div className="mt-4 rounded-full bg-white/20 px-4 py-1.5 text-base font-bold tabular-nums">
            {unidade} {r.usadas} de {r.total}
          </div>
          {r.status === "ja_usado" && r.usadoEm && (
            <div className="mt-2 text-base opacity-90">Usado às {hora(r.usadoEm)}</div>
          )}
        </>
      )}
      {(r.status === "cancelado" || r.status === "tipo_errado") && (
        <div className="mt-4 text-2xl font-bold">{r.nome}</div>
      )}
      {r.status === "tipo_errado" && (
        <div className="mt-2 max-w-sm text-base opacity-90">
          Nada foi marcado. Troque para o modo <strong>{ROTULO[r.modoDoQr]}</strong> se for o caso.
        </div>
      )}
      {r.status === "outro_evento" && <div className="mt-3 text-base">Este QR é do evento {r.eventoNome}.</div>}
      {r.status === "nao_encontrado" && (
        <div className="mt-3 max-w-sm text-base opacity-90">
          {r.nomeQr ? <>Não achei <strong>{r.nomeQr}</strong>. </> : null}
          Procure o nome na <strong>Lista de nomes</strong>.
        </div>
      )}
      {r.status === "erro" && <div className="mt-3 text-base">{r.mensagem}</div>}

      <div className="mt-10 text-sm font-semibold uppercase tracking-[0.14em] opacity-75">Toque para continuar</div>
    </button>
  );
}

function PainelPorNome({
  eventoId,
  modo,
  tokenLido,
  candidatos,
  onFechar,
  onConfirmado,
}: {
  eventoId: string;
  modo: Modo;
  tokenLido: string;
  candidatos: Participante[];
  onFechar: () => void;
  onConfirmado: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const cor = COR[modo];

  function confirmar(p: Participante) {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarManual(eventoId, p.inscricaoId, tokenLido, modo);
      onConfirmado();
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível confirmar.");
        return;
      }
      setSucesso(p.nome);
      setTimeout(onFechar, 1800);
    });
  }

  return (
    <Folha onFechar={onFechar}>
      <div className="flex items-center gap-2">
        <UserSearch className="size-6" style={{ color: cor.forte }} />
        <span className="text-lg font-extrabold">{sucesso ? "Confirmado" : "É uma dessas pessoas?"}</span>
      </div>
      {sucesso ? (
        <p className="mt-3 text-lg font-bold">{sucesso}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#78716c]">O código do QR não está no sistema, mas o nome bate com:</p>
          <ul className="mt-3 space-y-2">
            {candidatos.map((p) => {
              const completo = p.usadas >= p.total;
              return (
                <li key={p.inscricaoId} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e5e4] p-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.nome}</div>
                    <div className="text-sm tabular-nums text-[#78716c]">{p.usadas} de {p.total}</div>
                  </div>
                  <button
                    type="button"
                    disabled={pending || completo}
                    onClick={() => confirmar(p)}
                    className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: cor.forte }}
                  >
                    Confirmar
                  </button>
                </li>
              );
            })}
          </ul>
          {erro && <p className="mt-3 text-sm font-semibold text-red-700">{erro}</p>}
        </>
      )}
    </Folha>
  );
}

// folha que sobe de baixo (o polegar alcança o botão)
function Folha({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1917]/45 sm:items-center" role="dialog" aria-modal="true" onClick={onFechar}>
      <div
        className="relative w-full max-w-md rounded-t-[28px] bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-4 top-4 rounded-full p-1.5 text-[#78716c] hover:bg-[#f5f4f2]">
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// Lista de nomes (para quem chega sem o QR)
// ============================================================

type Filtro = "faltam" | "presentes" | "todos" | "cortesia" | "outro-dia";

const AZUL = "#2563eb";

/** uma caixinha por senha; fica azul quando aquela senha foi confirmada */
function Caixas({ usadas, total }: { usadas: number; total: number }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1" aria-label={`${usadas} de ${total}`}>
      {Array.from({ length: total }, (_, k) => (
        <span
          key={k}
          className="grid size-[18px] place-items-center rounded-[5px] border-2"
          style={k < usadas ? { background: AZUL, borderColor: AZUL } : { borderColor: "#d6d3d1", background: "#fff" }}
        >
          {k < usadas && <Check className="size-3 text-white" strokeWidth={3.5} />}
        </span>
      ))}
    </div>
  );
}

function ListaTab({
  eventoId,
  modo,
  participantes,
  onMudou,
}: {
  eventoId: string;
  modo: Modo;
  participantes: Participante[];
  onMudou: () => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("faltam");
  const [confirmando, setConfirmando] = useState<Participante | null>(null);
  const cor = COR[modo];

  // cortesias e "fará em outro dia" ficam nas abas delas (e em Todos / na busca)
  const faltam = participantes.filter((p) => p.usadas < p.total && !p.etiqueta);
  const presentes = participantes.filter((p) => p.usadas > 0);
  const cortesias = participantes.filter((p) => p.etiqueta === "Cortesia");
  const outroDia = participantes.filter((p) => p.etiqueta === "Fará em outro dia");
  const base =
    filtro === "faltam" ? faltam
    : filtro === "presentes" ? presentes
    : filtro === "cortesia" ? cortesias
    : filtro === "outro-dia" ? outroDia
    : participantes;

  // cada palavra precisa aparecer no nome ou no responsável ("ali melo" acha "Alice Melo")
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const lista = termos.length
    ? participantes.filter((p) => termos.every((t) => normalizar(`${p.nome} ${p.responsavel}`).includes(t)))
    : base;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#a8a29e]" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome"
          className="w-full rounded-2xl border border-[#e7e5e4] bg-white py-3.5 pl-12 pr-4 text-base outline-none focus:border-[#a8a29e]"
        />
      </div>

      {!termos.length && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {([
            ["faltam", "Faltam", faltam.length],
            ["presentes", modo === "almoco" ? "Já pegaram" : "Já entraram", presentes.length],
            ["todos", "Todos", participantes.length],
            ["cortesia", "Cortesia", cortesias.length],
            ["outro-dia", "Fará em outro dia", outroDia.length],
          ] as const).filter(([f, , n]) => n > 0 || (f !== "cortesia" && f !== "outro-dia")).map(([f, rotulo, n]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold"
              style={filtro === f ? { background: "#1c1917", borderColor: "#1c1917", color: "#fff" } : { borderColor: "#e7e5e4", background: "#fff", color: "#57534e" }}
            >
              {rotulo} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d6d3d1] bg-white py-12 text-center text-sm text-[#78716c]">
          {termos.length ? `Ninguém encontrado para "${busca.trim()}".` : participantes.length === 0 ? (modo === "almoco" ? "Ninguém comprou almoço neste evento." : "Nenhuma inscrição paga neste evento.") : "Ninguém nesta lista."}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-[#e7e5e4] bg-white">
          {lista.map((p) => {
            const completo = p.usadas >= p.total;
            const sub = modo === "almoco" ? p.tipos.join(" · ") : p.responsavel && normalizar(p.responsavel) !== normalizar(p.nome) ? `Resp.: ${p.responsavel}` : "";
            return (
              <li key={p.inscricaoId} className="flex items-center gap-3 border-b border-[#f5f4f2] px-3.5 py-3 last:border-0">
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
                  style={completo ? { background: "#dcfce7", color: "#15803d" } : { background: cor.suave, color: cor.texto }}
                >
                  {completo ? <Check className="size-5" /> : iniciais(p.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold leading-tight">{p.nome}</span>
                    {p.etiqueta && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={p.etiqueta === "Fará em outro dia" ? { background: "#fef3c7", color: "#92400e" } : { background: "#ede9fe", color: "#5b21b6" }}
                      >
                        {p.etiqueta}
                      </span>
                    )}
                  </div>
                  {sub && <div className="truncate text-xs text-[#78716c]">{sub}</div>}
                  <Caixas usadas={p.usadas} total={p.total} />
                </div>
                {completo ? (
                  <span className="shrink-0 text-xs font-semibold text-[#15803d] tabular-nums">{hora(p.ultimaEm)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(p)}
                    className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white active:scale-95"
                    style={{ background: cor.forte }}
                  >
                    {modo === "almoco" ? "Entregar" : "Chegou"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirmando && (
        <ConfirmarFolha
          eventoId={eventoId}
          modo={modo}
          participante={confirmando}
          onFechar={() => setConfirmando(null)}
          onConfirmado={onMudou}
        />
      )}
    </div>
  );
}

function ConfirmarFolha({
  eventoId,
  modo,
  participante: p,
  onFechar,
  onConfirmado,
}: {
  eventoId: string;
  modo: Modo;
  participante: Participante;
  onFechar: () => void;
  onConfirmado: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const cor = COR[modo];
  const proximo = Math.min(p.usadas + 1, p.total);

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarManual(eventoId, p.inscricaoId, undefined, modo);
      await onConfirmado();
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível confirmar.");
        return;
      }
      vibrar("liberado");
      onFechar();
    });
  }

  return (
    <Folha onFechar={onFechar}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: cor.texto }}>
        {modo === "almoco" ? "Entregar almoço" : "Confirmar presença"}
      </div>
      <div className="mt-1.5 pr-8 text-2xl font-extrabold leading-tight">{p.nome}</div>
      {p.etiqueta === "Fará em outro dia" && <div className="mt-1 text-sm font-semibold text-[#92400e]">Liberado para pagar depois</div>}
      {p.etiqueta === "Cortesia" && <div className="mt-1 text-sm font-semibold text-[#5b21b6]">Cortesia da organização</div>}
      {modo === "almoco" && p.tipos.length > 0 && <div className="mt-1 text-sm text-[#57534e]">{p.tipos.join(" · ")}</div>}
      {p.total > 1 && (
        <div className="mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold tabular-nums" style={{ background: cor.suave, color: cor.texto }}>
          {modo === "almoco" ? "Almoço" : "Entrada"} {proximo} de {p.total}
        </div>
      )}
      {erro && <p className="mt-3 text-sm font-semibold text-red-700">{erro}</p>}
      <button
        type="button"
        onClick={confirmar}
        disabled={pending}
        className="mt-6 w-full rounded-2xl py-4 text-base font-bold text-white active:scale-[0.99] disabled:opacity-60"
        style={{ background: cor.forte }}
      >
        {pending ? "Confirmando..." : modo === "almoco" ? "Confirmar entrega" : "Confirmar presença"}
      </button>
      <button type="button" onClick={onFechar} className="mt-2 w-full py-3 text-sm font-semibold text-[#78716c]">
        Cancelar
      </button>
    </Folha>
  );
}
