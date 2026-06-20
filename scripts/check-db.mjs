import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error, count } = await supabase
  .from("alunos")
  .select("*", { count: "exact" })
  .limit(1);

console.log("error:", JSON.stringify(error));
console.log("count:", count);
console.log("amostra colunas:", data && data[0] ? Object.keys(data[0]) : "(vazio)");
