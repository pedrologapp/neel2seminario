"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Clock, History, XCircle } from "lucide-react";
import { formatDateTimeBrt } from "@/lib/utils";

export interface LogItem {
  etapa: string;
  sucesso: boolean;
  mensagem: string | null;
  created_at: string;
}

export function LogsDisclosure({ logs }: { logs: LogItem[] }) {
  const [open, setOpen] = useState(false);

  if (logs.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-semibold text-neel-blue transition-colors hover:bg-neel-blue-50"
      >
        <History className="size-3.5" />
        {logs.length}
        <ChevronDown
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* backdrop pra fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-border bg-white p-3 shadow-float-lg">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neel-blue">
              Histórico
            </p>
            <ol className="space-y-2">
              {logs.map((log, i) => {
                const Icone = log.sucesso ? CheckCircle2 : XCircle;
                const cor = log.sucesso ? "text-green-600" : "text-red-600";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <Icone className={`mt-0.5 size-4 shrink-0 ${cor}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        {log.mensagem || log.etapa}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" />
                        {formatDateTimeBrt(log.created_at)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
