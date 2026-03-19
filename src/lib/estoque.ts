import { supabase } from "@/lib/supabase/client";

export type SelectOption = {
  id: string;
  nome: string;
};

export function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function numberBR(value: number | null | undefined, maximumFractionDigits = 2) {
  return Number(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits });
}

export async function getEmpresaIdFromSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return (data?.empresa_id as string | null) ?? null;
}

export async function loadOptions(table: string, labelField = "nome") {
  const client = supabase as unknown as {
    from: (tableName: string) => {
      select: (fields: string) => {
        order: (field: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }>;
      };
    };
  };

  const { data, error } = await client
    .from(table)
    .select("*")
    .order(labelField, { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    nome: String(row[labelField] ?? "—"),
  })) as SelectOption[];
}

export async function ensureConfiguracoesInventario(empresaId: string) {
  const { data } = await supabase
    .from("configuracoes_inventario")
    .select("id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (data?.id) return data.id as string;

  const { data: inserted, error } = await supabase
    .from("configuracoes_inventario")
    .insert({ empresa_id: empresaId })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return (inserted?.id as string | undefined) ?? null;
}

export async function registrarEntrada(entradaId: string) {
  const { data, error } = await supabase.rpc("estoque_registrar_entrada", { p_entrada_id: entradaId });
  if (error) throw error;
  return data;
}

export async function registrarSaida(saidaId: string) {
  const { data, error } = await supabase.rpc("estoque_registrar_saida", { p_saida_id: saidaIdCompat(saidaId) });
  if (error) throw error;
  return data;
}

export async function transferirEstoque(transferenciaId: string) {
  const { error } = await supabase.rpc("estoque_transferir", { p_transferencia_id: transferenciaId });
  if (error) throw error;
}

export async function aplicarAjuste(ajusteId: string) {
  const { data, error } = await supabase.rpc("estoque_aplicar_ajuste", { p_ajuste_id: ajusteId });
  if (error) throw error;
  return data;
}

function saidaIdCompat(id: string) {
  return id;
}
