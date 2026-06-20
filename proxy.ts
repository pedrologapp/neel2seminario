import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy (Next.js 16) — sucessor do middleware.
 *
 * Responsabilidades:
 *  1. Auth gate em /admin/* (redireciona não autenticados pra /admin/login)
 *
 * Roteamento: domínio único (ex.: neel2seminario.vercel.app).
 *  - site público na raiz
 *  - painel em /admin/*
 *  - portaria em /portaria/*
 * Sem subdomínios (não dá pra rotear subdomínios aninhados de *.vercel.app).
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Não é área admin? Passa direto.
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // === Daqui pra baixo é área admin ===

  // Atualiza/valida sessão Supabase (lê e escreve cookies)
  const { response, user } = await updateSession(request);

  const isLoginPage = pathname === "/admin/login";

  // Não autenticado → manda pro login (a não ser que já esteja lá)
  if (!user && !isLoginPage) {
    return withCookies(
      NextResponse.redirect(new URL("/admin/login", request.url)),
      response,
    );
  }

  // Autenticado tentando ver login → manda pro dashboard
  if (user && isLoginPage) {
    return withCookies(
      NextResponse.redirect(new URL("/admin/dashboard", request.url)),
      response,
    );
  }

  return response;
}

/**
 * Copia cookies setadas pelo Supabase para uma nova response (redirect/rewrite).
 * Sem isso a sessão se perde entre o updateSession e o redirect.
 */
function withCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
