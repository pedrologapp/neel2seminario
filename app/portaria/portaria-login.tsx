"use client";

import { useActionState } from "react";
import { AlertCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { entrarPortaria } from "./actions";

export function PortariaLogin() {
  const [state, action, isPending] = useActionState(entrarPortaria, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-2">
        <CardHeader className="items-center pb-2 text-center">
          <Logo variant="stacked" className="mb-6" />
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-neel-blue-50 px-3 py-1 text-sm font-semibold text-neel-blue">
            <ScanLine className="size-4" />
            Portaria
          </div>
          <CardTitle className="text-2xl">Leitura de entradas</CardTitle>
          <CardDescription>
            Digite a senha de acesso para ler os QR Codes do evento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha de acesso</Label>
              <Input
                id="senha"
                name="senha"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
                required
                disabled={isPending}
              />
            </div>
            {state?.error && (
              <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {state.error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
