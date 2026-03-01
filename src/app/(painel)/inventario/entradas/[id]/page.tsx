"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Entrada = {
  id: string;
  numero: number | null;
  status: string;
  produto_id: string;
  deposito_id: string;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number | null;
  nota_fiscal: string | null;
  fornecedor: string | null;
  data_entrada: string | null;
  observacoes: string | null;
  created_at: string;
  produtos: { nome: string; unidade: string } | null;
  depositos: { nome: string } | null;
};

export default function DetalheEntradaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("entradas_estoque")
        .select("*, produtos(nome, unidade), depositos(nome)")
        .eq("id", id)
        .maybeSingle();
      if (!data) { router.replace("/inventario/entradas"); return; }
      setEntrada(data as unknown as Entrada);
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function receberEntrada() {
    if (!entrada) return;
    setAcao(true);
    const { error } = await supabase.rpc("rpc_receber_entrada", { entrada_id: id });
    if (!error) {
      await supabase.from("entradas_estoque").update({ status: "recebido" }).eq("id", id);
      setEntrada((prev) => prev ? { ...prev, status: "recebido" } : prev);
    }
    setAcao(false);
  }

  async function cancelarEntrada() {
    if (!entrada || !confirm("Cancelar esta entrada?")) return;
    setAcao(true);
    await supabase.from("entradas_estoque").update({ status: "cancelado" }).eq("id", id);
    setEntrada((prev) => prev ? { ...prev, status: "cancelado" } : prev);
    setAcao(false);
  }

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;
  if (!entrada) return null;

  const fmt = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
  const numero = entrada.numero ? `ENT-${String(entrada.numero).padStart(4, "0")}` : "Entrada";

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/entradas" className="text-sm text-slate-400 hover:text-white">← Entradas</Link>
        <h1 className="text-xl font-semibold text-white">{numero}</h1>
        <span className={`ml-auto text-xs px-2 py-1 rounded border ${
          entrada.status === "recebido" ? "border-green-300 text-green-700 bg-green-50"
          : entrada.status === "cancelado" ? "border-red-200 text-red-700 bg-red-50"
          : "border-amber-200 text-amber-700 bg-amber-50"}`}>
          {entrada.status}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-slate-500">Produto</span><div className="font-medium">{entrada.produtos?.nome ?? "—"}</div></div>
          <div><span className="text-slate-500">Depósito</span><div className="font-medium">{entrada.depositos?.nome ?? "—"}</div></div>
          <div><span className="text-slate-500">Quantidade</span><div className="font-medium">{entrada.quantidade} {entrada.produtos?.unidade ?? ""}</div></div>
          <div><span className="text-slate-500">Valor Unitário</span><div className="font-medium">{fmt(entrada.valor_unitario)}</div></div>
          <div><span className="text-slate-500">Valor Total</span><div className="font-medium">{fmt(entrada.valor_total)}</div></div>
          <div><span className="text-slate-500">Nota Fiscal</span><div className="font-medium">{entrada.nota_fiscal ?? "—"}</div></div>
          <div><span className="text-slate-500">Fornecedor</span><div className="font-medium">{entrada.fornecedor ?? "—"}</div></div>
          <div><span className="text-slate-500">Data da Entrada</span><div className="font-medium">{entrada.data_entrada ? new Date(entrada.data_entrada).toLocaleDateString("pt-BR") : "—"}</div></div>
        </div>
        {entrada.observacoes && (
          <div><span className="text-slate-500">Observações</span><div>{entrada.observacoes}</div></div>
        )}
      </div>

      {entrada.status === "pendente" && (
        <div className="flex gap-3">
          <button onClick={receberEntrada} disabled={acao}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-60 transition text-sm">
            {acao ? "Processando..." : "Confirmar Recebimento"}
          </button>
          <button onClick={cancelarEntrada} disabled={acao}
            className="border border-red-300 text-red-600 px-6 py-2 rounded-md hover:bg-red-50 disabled:opacity-60 transition text-sm">
            Cancelar Entrada
          </button>
        </div>
      )}
    </div>
  );
}
