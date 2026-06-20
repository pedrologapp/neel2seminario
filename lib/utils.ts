import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata uma data sempre no fuso horário de Brasília (America/Sao_Paulo).
 *
 * - String "YYYY-MM-DD" (PG date) → tratada como dia em BRT
 * - String ISO completa (timestamptz) → convertida pra BRT
 * - Date → renderizada em BRT
 *
 * Sem isso, o servidor Vercel (em UTC) mostraria 23:59 BRT como o dia seguinte.
 */
export function formatDate(date: string | Date) {
  let d: Date;
  if (typeof date === "string") {
    // Date-only (sem hora) — interpreta como meia-noite BRT
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      d = new Date(`${date}T00:00:00-03:00`);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

/** Formata data + hora em BRT (ex: "31/05 às 23:59"). */
export function formatDateTimeBrt(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

/** Formata só DD/MM em BRT. */
export function formatDayMonthBrt(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

/**
 * Formata DD/MM do dia SEGUINTE a uma data em BRT.
 * Útil pra mostrar "a partir do próximo lote começa": se lote 1
 * vale até 31/05 23:59, o lote 2 vigora a partir de 01/06.
 */
export function formatProximoDiaBrt(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  // +24h cobre o caso (Brasil não tem DST desde 2019)
  const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return formatDayMonthBrt(next);
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
