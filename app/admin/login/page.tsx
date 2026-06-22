import { ScanLine } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  // A portaria fica no domínio principal (o subdomínio admin exige login).
  const baseSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const portariaUrl = `${baseSite}/portaria`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-2">
        <CardHeader className="items-center pb-2 text-center">
          <Logo variant="stacked" className="mb-6" />
          <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
          <CardDescription>
            Acesse o painel para gerenciar os eventos do NEEL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <a
        href={portariaUrl}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-neel-blue shadow-sm transition-colors hover:bg-neel-blue-50"
      >
        <ScanLine className="size-4" />
        Ler Entradas do Evento
      </a>
    </div>
  );
}
