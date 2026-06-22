import Link from "next/link";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Receipt,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/admin/actions";
import {
  OlhinhoGlobal,
  ValoresSensiveisProvider,
} from "@/components/admin/valores-sensiveis";

interface AdminShellProps {
  userEmail: string;
  children: React.ReactNode;
}

const navLinks = [
  { href: "/admin/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/admin/cobrancas", label: "Cobranças", icon: Receipt },
];

export function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <ValoresSensiveisProvider>
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-white/85 backdrop-blur-md print:hidden">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/admin/dashboard" aria-label="Início do painel">
              <Logo variant="compact" />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const Icone = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-neel-blue-50 hover:text-neel-blue"
                  >
                    <Icone className="size-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <OlhinhoGlobal />
            <span
              className="hidden text-sm text-muted-foreground sm:inline"
              title={userEmail}
            >
              {userEmail}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" title="Sair">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </form>
          </div>
        </div>
        {/* Nav mobile */}
        <nav className="container mx-auto flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {navLinks.map((link) => {
            const Icone = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-neel-blue-50/70 px-3 py-2 text-sm font-semibold text-neel-blue"
              >
                <Icone className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main>{children}</main>
    </div>
    </ValoresSensiveisProvider>
  );
}
