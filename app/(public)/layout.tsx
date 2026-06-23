import { Logo } from "@/components/shared/logo";
import { HeaderEventosLink } from "@/components/shared/header-eventos-link";
import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-white/85 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" aria-label="Início">
            <Logo variant="compact" />
          </Link>
          <HeaderEventosLink />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 bg-neel-blue-50/40">
        <div className="container mx-auto flex flex-col items-center gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} NEEL — Núcleo Espírita Esperança de Luz.
            Todos os direitos reservados.
          </span>
          <span>São Gonçalo do Amarante · RN</span>
        </div>
      </footer>
    </div>
  );
}
