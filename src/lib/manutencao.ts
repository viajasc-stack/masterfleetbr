import { supabase } from "@/lib/supabase/client";

export type Option = { id: string; nome: string };

export const prioridadeOptions = ["baixa", "media", "alta"] as const;
export const solicitacaoStatusOptions = ["nova", "em_analise", "aprovada", "rejeitada", "convertida"] as const;
export const ordemStatusOptions = ["aberta", "analise", "aguardando_pecas", "andamento", "finalizada"] as const;
export const ordemTipoOptions = ["corretiva", "preventiva", "emergencial"] as const;

export function moeda(valor: number | null | undefined) {
  return Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function numero(valor: number | null | undefined, casas = 0) {
  return Number(valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function dataBR(data: string | null | undefined) {
  if (!data) return "—";
  return new Date(data).toLocaleDateString("pt-BR");
}

export async function loadOptions(table: string, label = "nome", onlyActive = false): Promise<Option[]> {
  const client = supabase as unknown as {
    from: (tableName: string) => {
      select: (fields: string) => {
        order: (field: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }>;
      };
    };
  };

  const { data, error } = await client.from(table).select(`id, ${label}, ativo`).order(label, { ascending: true });
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => (onlyActive ? Boolean(row.ativo ?? true) : true))
    .map((row) => ({
    id: String(row.id),
    nome: String(row[label] ?? "—"),
    }));
}

export async function converterSolicitacaoEmOS(solicitacaoId: string) {
  const { data, error } = await supabase.rpc("manutencao_converter_solicitacao_em_os", {
    p_solicitacao_id: solicitacaoId,
  });
  if (error) throw error;
  return data as string;
}

export async function adicionarPecaNaOS(payload: {
  ordemId: string;
  itemId: string;
  localEstoqueId: string;
  quantidade: number;
  valorUnitario: number;
  origem: "estoque" | "compra";
}) {
  const { data, error } = await supabase.rpc("manutencao_adicionar_peca", {
    p_ordem_id: payload.ordemId,
    p_item_id: payload.itemId,
    p_local_estoque_id: payload.localEstoqueId,
    p_quantidade: payload.quantidade,
    p_valor_unitario: payload.valorUnitario,
    p_origem: payload.origem,
  });
  if (error) throw error;
  return data as string;
}

export async function finalizarOrdem(ordemId: string) {
  const { error } = await supabase.rpc("manutencao_finalizar_ordem", {
    p_ordem_id: ordemId,
    p_data_conclusao: new Date().toISOString(),
    p_gerar_conta_pagar: true,
  });
  if (error) throw error;
}
