import { supabase } from "@/lib/supabase/client";

export function financeiroErrorMessage(error: unknown, fallback = "Ocorreu um erro inesperado.") {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const err = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message = typeof err.message === "string" ? err.message.trim() : "";
    const details = typeof err.details === "string" ? err.details.trim() : "";
    const hint = typeof err.hint === "string" ? err.hint.trim() : "";
    const code = typeof err.code === "string" ? err.code.trim() : "";

    const merged = [message, details, hint, code].filter(Boolean).join(" | ").trim();
    if (merged) return merged;
  }
  return fallback;
}

export async function getAccessTokenOrThrow() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente para continuar.");
  return token;
}
