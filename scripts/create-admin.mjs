/**
 * Cria um usuário admin no Supabase Auth.
 *
 * Como rodar (a partir da raiz do projeto):
 *   node --env-file=.env.local scripts/create-admin.mjs <email> <senha>
 *
 * Exemplo:
 *   node --env-file=.env.local scripts/create-admin.mjs pedrolog.app@gmail.com MinhaSenh@2026
 *
 * O usuário é criado com o e-mail já confirmado (email_confirm: true), então
 * dá pra logar imediatamente em http://localhost:3000/admin/login.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ Variáveis SUPABASE_* não encontradas.");
  console.error("   Rode com: node --env-file=.env.local scripts/create-admin.mjs <email> <senha>");
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Uso: node --env-file=.env.local scripts/create-admin.mjs <email> <senha>");
  console.error("Ex:  node --env-file=.env.local scripts/create-admin.mjs admin@escola.com Senha@123");
  process.exit(1);
}

if (password.length < 8) {
  console.error("❌ A senha precisa ter no mínimo 8 caracteres.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`📝 Criando usuário admin: ${email}`);

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  if (error.message.includes("already") || error.message.includes("registered")) {
    console.error(`⚠️  Já existe um usuário com este email.`);
    console.error(`   Acesse o painel pra trocar a senha ou usar outro email:`);
    console.error(`   https://supabase.com/dashboard/project/lzqhjutknqeuhscfxald/auth/users`);
  } else {
    console.error(`❌ Erro: ${error.message}`);
  }
  process.exit(1);
}

console.log("");
console.log(`✅ Conta criada com sucesso!`);
console.log(`   Email:  ${data.user.email}`);
console.log(`   ID:     ${data.user.id}`);
console.log("");
console.log("🚀 Faça login em: http://localhost:3000/admin/login");
