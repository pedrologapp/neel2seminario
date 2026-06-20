/**
 * Validações e formatações de CPF e telefone (PT-BR).
 * Importado do .jsx original.
 */

export function apenasDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Formata CPF como 000.000.000-00 (parcial enquanto digita). */
export function formatarCPF(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Valida CPF (algoritmo oficial). */
export function validarCPF(cpf: string): boolean {
  const c = apenasDigitos(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;

  let soma = 0;
  for (let i = 1; i <= 9; i++) soma += parseInt(c[i - 1]) * (11 - i);
  let resto = (soma * 10) % 11;
  if (resto >= 10) resto = 0;
  if (resto !== parseInt(c[9])) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(c[i - 1]) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto >= 10) resto = 0;
  if (resto !== parseInt(c[10])) return false;

  return true;
}

/** Formata telefone como (84) 99999-9999 (parcial enquanto digita). */
export function formatarTelefone(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

/** Telefone válido = 11 dígitos (com DDD + 9 + 8 dígitos). */
export function telefoneValido(value: string): boolean {
  return apenasDigitos(value).length === 11;
}
