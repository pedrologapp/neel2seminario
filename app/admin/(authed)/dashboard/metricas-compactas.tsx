"use client";

import { CalendarPlus, Ticket, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OlhinhoIcone,
  ValorSensivel,
} from "@/components/admin/valores-sensiveis";

const ICONES = {
  calendario: CalendarPlus,
  ingresso: Ticket,
  carteira: Wallet,
} as const;

export interface MetricaItem {
  titulo: string;
  valor: string;
  icone: keyof typeof ICONES;
  /** Sensível = entra oculto; revela pelo olhinho. */
  sensivel?: boolean;
}

export function MetricasCompactas({ metricas }: { metricas: MetricaItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Resumo</CardTitle>
          <OlhinhoIcone />
        </div>
      </CardHeader>
      <CardContent>
        {metricas.map((m) => {
          const Icone = ICONES[m.icone];
          return (
            <div
              key={m.titulo}
              className="flex items-center justify-between gap-3 border-b border-border/40 py-2.5 last:border-0"
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amadeus-blue-50 text-amadeus-blue">
                  <Icone className="size-3.5" />
                </span>
                {m.titulo}
              </span>
              <span className="text-sm font-extrabold tabular-nums text-amadeus-blue">
                {m.sensivel ? <ValorSensivel valor={m.valor} /> : m.valor}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
