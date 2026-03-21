import { supabase } from "@/lib/supabase/client";

export function financeiroErrorMessage(error: unknown, fallback = "Ocorreu um erro inesperado.") {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export async function getAccessTokenOrThrow() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente para continuar.");
  return token;
}
