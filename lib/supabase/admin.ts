import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com SERVICE ROLE KEY. Ignora RLS — poder total no banco.
 *
 * Use APENAS em:
 *  - Route handlers (app/api/*)
 *  - Server actions
 *  - Server components do admin
 *
 * NUNCA importe em código que roda no browser.
 * O import de "server-only" no topo garante erro em build se vazar.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definida");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
