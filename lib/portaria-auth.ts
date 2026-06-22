import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sessão da Portaria — independente do login de admin (Supabase).
 *
 * O acesso é liberado por uma senha compartilhada (ADMIN_ACTION_PASSWORD).
 * Ao acertar a senha, gravamos um cookie httpOnly assinado por HMAC com um
 * segredo do servidor. Como o atacante não tem o segredo, não consegue forjar
 * o cookie; e por ser httpOnly o JavaScript do navegador não o lê.
 */

const COOKIE = "portaria_session";
const PAYLOAD = "portaria-v1";
const MAX_AGE = 60 * 60 * 12; // 12h

function secret(): string {
  // WEBHOOK_CONFIRM_SECRET é um segredo já existente e estável no servidor.
  return (
    process.env.WEBHOOK_CONFIRM_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "neel-portaria-fallback"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export async function criarSessaoPortaria(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sign(PAYLOAD), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function encerrarSessaoPortaria(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function portariaAutenticada(): Promise<boolean> {
  const store = await cookies();
  const valor = store.get(COOKIE)?.value;
  if (!valor) return false;
  const esperado = sign(PAYLOAD);
  try {
    const a = Buffer.from(valor);
    const b = Buffer.from(esperado);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function senhaPortariaValida(senha: string): boolean {
  // Mesmo fallback usado nas ações sensíveis do admin (verificarSenhaAcao):
  // a env var pode não estar configurada em produção.
  const esperada = process.env.ADMIN_ACTION_PASSWORD || "Admim123";
  return senha === esperada;
}
