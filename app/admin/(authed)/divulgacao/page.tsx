import { agoraNatal, calendario, carregarDivulgacao, sugerido } from "@/lib/divulgacao";
import { PainelDivulgacao } from "./painel";

/**
 * Divulgação nos grupos do WhatsApp (28/09/2026): o Pedro escolhe os grupos,
 * sobe flyer/vídeo, cola os textos e define horários. O envio automático só
 * acontece com a divulgação LIGADA.
 */
export const metadata = { title: "Divulgação · Admin NEEL" };
export const dynamic = "force-dynamic";

export default async function DivulgacaoPage() {
  const d = await carregarDivulgacao();
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-neel-blue sm:text-4xl">Divulgação</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Escolha os grupos do seu WhatsApp que recebem a divulgação, suba o flyer e o vídeo e cole os textos. Nada é enviado enquanto a divulgação estiver desligada.
      </p>
      {d.faltaTabela ? (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">Falta criar as tabelas da divulgação no banco.</p>
          <p className="mt-1">Rode o arquivo <code>supabase/migrations/0015_divulgacao.sql</code> no SQL Editor do Supabase do NEEL e recarregue esta página.</p>
        </div>
      ) : d.erro || !d.config ? (
        <p className="mt-6 text-sm text-red-700">Erro ao carregar: {d.erro ?? "configuração não encontrada"}</p>
      ) : (
        <PainelDivulgacao
          config={d.config}
          grupos={d.grupos.map((g) => ({ ...g, sugerido: sugerido(g.nome) }))}
          envios={d.envios}
          calendario={calendario(d.config)}
          hoje={agoraNatal().dia}
        />
      )}
    </div>
  );
}
