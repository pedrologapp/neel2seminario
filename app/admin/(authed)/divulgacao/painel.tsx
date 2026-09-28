"use client";

/* eslint-disable @next/next/no-img-element -- prévia do flyer vem do Storage */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pause, Play, RefreshCw, Search, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ConfigDivulgacao, EnvioDivulgacao, GrupoDivulgacao } from "@/lib/divulgacao";
import { atualizarGrupos, marcarGrupo, prepararUpload, salvarConfig, salvarMaterial } from "./actions";

type Grupo = GrupoDivulgacao & { sugerido: boolean };

const campo = "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neel-blue";

function Material({ tipo, url }: { tipo: "flyer" | "video"; url: string | null }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const subir = async (arq: File) => {
    setErro(null);
    if (arq.size > 50 * 1024 * 1024) return setErro("Arquivo maior que 50 MB. Comprima o vídeo antes de enviar.");
    setEnviando(true);
    try {
      const p = await prepararUpload(tipo, arq.name);
      if (!p.ok) throw new Error(p.erro);
      const { error } = await createClient().storage.from("eventos").uploadToSignedUrl(p.path, p.token, arq, { contentType: arq.type || undefined });
      if (error) throw new Error(error.message);
      const s = await salvarMaterial(tipo, p.url);
      if (!s.ok) throw new Error(s.erro);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="rounded-xl border border-border/70 bg-white p-4">
      <p className="text-sm font-bold">{tipo === "flyer" ? "Flyer (imagem)" : "Vídeo"}</p>
      <div className="mt-3 grid min-h-40 place-items-center overflow-hidden rounded-lg bg-muted/50">
        {url ? (
          tipo === "flyer" ? <img src={url} alt="Flyer" className="max-h-72 w-auto" /> : <video src={url} controls className="max-h-72 w-full" />
        ) : (
          <span className="text-sm text-muted-foreground">Nenhum {tipo === "flyer" ? "flyer" : "vídeo"} ainda</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-neel-blue px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {enviando ? "Enviando…" : url ? "Trocar" : "Enviar"}
          <input type="file" className="hidden" accept={tipo === "flyer" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime"} onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} disabled={enviando} />
        </label>
        {url && !enviando && (
          <button type="button" onClick={async () => { await salvarMaterial(tipo, null); router.refresh(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted">
            <X className="size-4" /> Remover
          </button>
        )}
      </div>
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
    </div>
  );
}

export function PainelDivulgacao({ config, grupos, envios }: { config: ConfigDivulgacao; grupos: Grupo[]; envios: EnvioDivulgacao[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    ativo: config.ativo,
    ritmo: config.ritmo,
    inicio: config.inicio ?? "",
    fim: config.fim ?? "",
    horarios: config.horarios.join(", "),
    intervalo_min: config.intervalo_min,
    textos: config.textos.join("\n---\n"),
    link: config.link ?? "",
  });
  const [salvando, iniciarSalvar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "marcados" | "sugeridos">("sugeridos");
  const [marcando, setMarcando] = useState<string | null>(null);
  const [atualizando, iniciarAtualizar] = useTransition();

  const salvar = (extra?: Partial<typeof f>) =>
    iniciarSalvar(async () => {
      const dados = { ...f, ...extra };
      const r = await salvarConfig(dados);
      if (r.ok) setF(dados);
      setMsg(r.ok ? "Salvo." : r.erro ?? "Não consegui salvar.");
      router.refresh();
    });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return grupos
      .filter((g) => (filtro === "marcados" ? g.divulgar : filtro === "sugeridos" ? g.sugerido || g.divulgar : true))
      .filter((g) => !q || (g.nome ?? "").toLowerCase().includes(q))
      .sort((a, b) => Number(b.divulgar) - Number(a.divulgar) || Number(b.sugerido) - Number(a.sugerido) || (a.nome ?? "").localeCompare(b.nome ?? ""));
  }, [grupos, busca, filtro]);
  const nMarcados = grupos.filter((g) => g.divulgar).length;
  const podeLigar = nMarcados > 0 && (config.flyer_url || config.video_url) && config.textos.length > 0;

  return (
    <div className="mt-6 grid gap-6">
      {/* Situação geral */}
      <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 ${f.ativo ? "border-emerald-300 bg-emerald-50" : "border-border/60 bg-white"}`}>
        <div>
          <p className="text-lg font-extrabold">{f.ativo ? "Divulgação LIGADA" : "Divulgação desligada"}</p>
          <p className="text-sm text-muted-foreground">
            {nMarcados} grupo(s) marcado(s) · {config.flyer_url ? "flyer ok" : "sem flyer"} · {config.video_url ? "vídeo ok" : "sem vídeo"} · {config.textos.length} texto(s)
          </p>
        </div>
        <button
          type="button"
          disabled={salvando || (!f.ativo && !podeLigar)}
          title={!f.ativo && !podeLigar ? "Marque os grupos, suba o material e salve os textos antes de ligar" : undefined}
          onClick={() => salvar({ ativo: !f.ativo })}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 ${f.ativo ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {f.ativo ? <Pause className="size-4" /> : <Play className="size-4" />} {f.ativo ? "Pausar divulgação" : "Ligar divulgação"}
        </button>
      </section>

      {/* Material */}
      <section className="grid gap-4 md:grid-cols-2">
        <Material tipo="flyer" url={config.flyer_url} />
        <Material tipo="video" url={config.video_url} />
      </section>

      {/* Configuração */}
      <section className="grid gap-4 rounded-2xl border border-border/60 bg-white p-5 text-sm">
        <p className="font-bold text-neel-blue">Textos e horários</p>
        <label className="block font-semibold">
          Textos da divulgação
          <textarea value={f.textos} onChange={(e) => setF({ ...f, textos: e.target.value })} rows={9} className={campo} placeholder={"Cole o texto aqui.\nPara ter variações, separe cada texto com uma linha contendo só ---"} />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Cada dia usa um texto diferente, em rodízio. Separe as variações com uma linha contendo só <b>---</b>.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-semibold">Link de inscrição (opcional)
            <input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} className={campo} placeholder="https://neel2seminario.vercel.app" />
          </label>
          <label className="block font-semibold">Horários (um por dia, em rodízio)
            <input value={f.horarios} onChange={(e) => setF({ ...f, horarios: e.target.value })} className={campo} />
          </label>
          <label className="block font-semibold">Começa em
            <input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} className={campo} />
          </label>
          <label className="block font-semibold">Termina em
            <input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} className={campo} />
          </label>
          <label className="block font-semibold">Ritmo
            <select value={f.ritmo} onChange={(e) => setF({ ...f, ritmo: e.target.value as "diario" | "alternado" })} className={campo}>
              <option value="diario">Todo dia</option>
              <option value="alternado">Dia sim, dia não</option>
            </select>
          </label>
          <label className="block font-semibold">Minutos entre um grupo e outro
            <input type="number" min={1} max={30} value={f.intervalo_min} onChange={(e) => setF({ ...f, intervalo_min: Number(e.target.value) })} className={campo} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" disabled={salvando} onClick={() => salvar()} className="inline-flex items-center gap-2 rounded-xl bg-neel-blue px-4 py-2.5 font-bold text-white hover:opacity-90 disabled:opacity-50">
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </button>
          {msg && <span className={`text-xs ${msg === "Salvo." ? "text-emerald-700" : "text-red-700"}`}>{msg}</span>}
        </div>
      </section>

      {/* Grupos */}
      <section className="rounded-2xl border border-border/60 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold text-neel-blue">Grupos do seu WhatsApp ({grupos.length}) · {nMarcados} marcado(s)</p>
          <button type="button" disabled={atualizando} onClick={() => iniciarAtualizar(async () => { const r = await atualizarGrupos(); setMsg(r.ok ? `Lista atualizada${r.recebidos != null ? ` (${r.recebidos} grupos)` : ""}.` : r.erro ?? "Falhou."); router.refresh(); })} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-neel-blue hover:bg-neel-blue-50 disabled:opacity-50">
            <RefreshCw className={`size-4 ${atualizando ? "animate-spin" : ""}`} /> Atualizar lista do WhatsApp
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {([["sugeridos", "Sugeridos"], ["marcados", "Marcados"], ["todos", "Todos"]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setFiltro(v)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filtro === v ? "bg-neel-blue text-white" : "bg-muted text-foreground"}`}>{t}</button>
          ))}
          <label className="ml-auto flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
            <Search className="size-4 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar grupo" className="w-40 text-sm outline-none" />
          </label>
        </div>
        {grupos.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Nenhum grupo ainda. Clique em “Atualizar lista do WhatsApp”.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {lista.map((g) => (
              <li key={g.chat_id} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={g.divulgar}
                  disabled={marcando === g.chat_id}
                  onClick={async () => { setMarcando(g.chat_id); await marcarGrupo(g.chat_id, !g.divulgar); setMarcando(null); router.refresh(); }}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${g.divulgar ? "bg-emerald-600" : "bg-slate-300"}`}
                  title={g.divulgar ? "Recebe a divulgação" : "Não recebe"}
                >
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${g.divulgar ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.nome || "(sem nome)"}</span>
                {g.sugerido && <span className="shrink-0 rounded-full bg-neel-yellow-50 px-2 py-0.5 text-[11px] font-bold text-neel-yellow-dark">sugerido</span>}
                <span className={`shrink-0 text-xs font-semibold ${g.divulgar ? "text-emerald-700" : "text-muted-foreground"}`}>{g.divulgar ? "divulgar" : "não divulgar"}</span>
              </li>
            ))}
            {lista.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhum grupo neste filtro.</li>}
          </ul>
        )}
      </section>

      {/* Histórico */}
      <section className="rounded-2xl border border-border/60 bg-white p-5">
        <p className="font-bold text-neel-blue">Envios</p>
        {envios.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum envio ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {envios.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="tabular-nums text-muted-foreground">{e.dia.split("-").reverse().join("/")} {e.horario}</span>
                <span className="font-semibold">{e.nome}</span>
                <span className="text-xs text-muted-foreground">{e.tipo}</span>
                <span className={`ml-auto text-xs font-bold ${e.status === "enviado" ? "text-emerald-700" : "text-red-700"}`} title={e.erro ?? undefined}>{e.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
