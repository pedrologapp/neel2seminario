"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { ValorSensivel } from "@/components/admin/valores-sensiveis";
import type { Despesa } from "@/lib/despesas";
import { excluirDespesa, prepararComprovante, salvarDespesa } from "./actions";

type Linha = Despesa & { link: string | null };

const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
const data = (d: string) => d.split("-").reverse().join("/");
const vazio = { id: null as string | null, data: "", descricao: "", categoria: "", fornecedor: "", valor: "", forma: "Pix", obs: "", comprovante: null as string | null };

/** Reduz foto grande (celular) para ~1600 px; PDF vai como está. */
async function prepararArquivo(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 1_500_000) return f;
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return b ? new File([b], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

export function PainelDespesas({ despesas, categorias, formas }: { despesas: Linha[]; categorias: string[]; formas: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ ...vazio, data: hoje(), categoria: categorias[0] });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const campoArquivo = useRef<HTMLInputElement>(null);

  const novo = () => { setF({ ...vazio, data: hoje(), categoria: categorias[0] }); setArquivo(null); setErro(null); setAberto(true); };
  const editar = (d: Linha) => {
    setF({ id: d.id, data: d.data, descricao: d.descricao, categoria: d.categoria, fornecedor: d.fornecedor ?? "", valor: String(d.valor).replace(".", ","), forma: d.forma ?? "", obs: d.obs ?? "", comprovante: d.comprovante });
    setArquivo(null); setErro(null); setAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const salvar = async () => {
    setErro(null);
    const valor = Number(f.valor.replace(/\./g, "").replace(",", "."));
    if (!f.descricao.trim() || !(valor > 0)) { setErro("Preencha a descrição e o valor."); return; }
    setSalvando(true);
    try {
      let comprovante = f.comprovante;
      if (arquivo) {
        const arq = await prepararArquivo(arquivo);
        const p = await prepararComprovante(arq.name);
        if (!p.ok) throw new Error(p.erro);
        const { error } = await createClient().storage.from("financeiro-comprovantes").uploadToSignedUrl(p.path, p.token, arq, { contentType: arq.type || undefined });
        if (error) throw new Error(`O comprovante não subiu: ${error.message}`);
        comprovante = p.path;
      }
      const r = await salvarDespesa({ id: f.id, data: f.data, descricao: f.descricao, categoria: f.categoria, fornecedor: f.fornecedor, valor, forma: f.forma, obs: f.obs, comprovante });
      if (!r.ok) throw new Error(r.erro);
      setAberto(false);
      iniciar(() => router.refresh());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async (d: Linha) => {
    if (!window.confirm(`Excluir a despesa "${d.descricao}" (${formatCurrency(d.valor)})?`)) return;
    const r = await excluirDespesa(d.id);
    if (!r.ok) window.alert(r.erro);
    else iniciar(() => router.refresh());
  };

  const campo = "mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-neel-blue";

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-neel-blue">Lançamentos</h2>
        {!aberto && (
          <button type="button" onClick={novo} className="inline-flex items-center gap-2 rounded-xl bg-neel-blue px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            <Plus className="size-4" /> Nova despesa
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3 rounded-2xl border border-neel-blue/30 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-neel-blue">{f.id ? "Editar despesa" : "Nova despesa"}</p>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="text-muted-foreground"><X className="size-5" /></button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold sm:col-span-2">Descrição<input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: Passagem aérea do Jorge Elarrat" className={campo} /></label>
            <label className="text-sm font-semibold">Valor (R$)<input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} inputMode="decimal" placeholder="0,00" className={campo} /></label>
            <label className="text-sm font-semibold">Data<input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className={campo} /></label>
            <label className="text-sm font-semibold sm:col-span-2">Categoria
              <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} className={campo}>
                {categorias.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Fornecedor / pago a<input value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} className={campo} /></label>
            <label className="text-sm font-semibold">Forma de pagamento
              <select value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })} className={campo}>
                <option value="">—</option>
                {formas.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">Observação<input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} className={campo} /></label>
            <div className="text-sm font-semibold">
              Comprovante
              <input ref={campoArquivo} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => campoArquivo.current?.click()} className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-left font-normal text-muted-foreground hover:bg-neel-blue-50">
                <Paperclip className="size-4 shrink-0" />
                <span className="truncate">{arquivo ? arquivo.name : f.comprovante ? "Já tem comprovante (trocar)" : "Foto ou PDF"}</span>
              </button>
            </div>
          </div>
          {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-neel-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {salvando && <Loader2 className="size-4 animate-spin" />} {f.id ? "Salvar alterações" : "Lançar despesa"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Cancelar</button>
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Descrição</th>
              <th className="px-4 py-2">Categoria</th>
              <th className="px-4 py-2">Fornecedor</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2">Comprovante</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {despesas.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="px-4 py-2 tabular-nums">{data(d.data)}</td>
                <td className="px-4 py-2">
                  {d.descricao}
                  {d.obs && <span className="block text-xs text-muted-foreground">{d.obs}</span>}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{d.categoria}</td>
                <td className="px-4 py-2">{d.fornecedor ?? "—"}{d.forma && <span className="block text-xs text-muted-foreground">{d.forma}</span>}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-700"><ValorSensivel valor={formatCurrency(d.valor)} /></td>
                <td className="px-4 py-2">
                  {d.link ? (
                    <a href={d.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-neel-blue underline"><FileText className="size-4" /> Ver</a>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700">Falta</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => editar(d)} aria-label="Editar" className="rounded-lg p-1.5 text-neel-blue hover:bg-neel-blue-50"><Pencil className="size-4" /></button>
                    <button type="button" onClick={() => apagar(d)} aria-label="Excluir" className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {despesas.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma despesa lançada ainda. Clique em &quot;Nova despesa&quot;.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
