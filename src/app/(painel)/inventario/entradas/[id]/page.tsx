"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Entrada = {
  id: string;
  numero: number | null;
  status: string;
  produto_id: string | null;
  deposito_id: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  nota_fiscal: string | null;
  fornecedor: string | null;
  fornecedores: { nome: string } | null;
  data_entrada: string | null;
  forma_pagamento: string | null;
  data_vencimento: string | null;
  qtd_parcelas: number | null;
  parcelado: boolean | null;
  observacoes: string | null;
  created_at: string;
  entrada_produto: { nome: string; unidade: string } | null;
  depositos: { nome: string } | null;
};

type ItemEntrada = {
  id: string;
  produto_id: string;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number | null;
  produtos: { nome: string; unidade: string } | null;
};

export default function DetalheEntradaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [itens, setItens] = useState<ItemEntrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState(false);
  const [erroAcao, setErroAcao] = useState("");

  const carregarEntrada = useCallback(async () => {
    const [{ data: entradaData }, { data: itensData }] = await Promise.all([
      supabase
        .from("entradas_estoque")
        .select("id, numero, status, produto_id, deposito_id, quantidade, valor_unitario, valor_total, nota_fiscal, fornecedor, data_entrada, forma_pagamento, data_vencimento, qtd_parcelas, parcelado, observacoes, created_at, fornecedores(nome), entrada_produto:produtos(nome, unidade), depositos(nome)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("entradas_estoque_itens")
        .select("id, produto_id, quantidade, valor_unitario, valor_total, produtos(nome, unidade)")
        .eq("entrada_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (!entradaData) {
      router.replace("/inventario/entradas");
      return;
    }

    setEntrada(entradaData as unknown as Entrada);

    const listaItens = (itensData as unknown as ItemEntrada[]) ?? [];
    if (listaItens.length > 0) {
      setItens(listaItens);
    } else if (entradaData.produto_id && entradaData.quantidade) {
      setItens([
        {
          id: `legacy-${entradaData.id}`,
          produto_id: entradaData.produto_id,
          quantidade: entradaData.quantidade,
          valor_unitario: entradaData.valor_unitario,
          valor_total: entradaData.valor_total,
          produtos: (entradaData as unknown as Entrada).entrada_produto,
        },
      ]);
    } else {
      setItens([]);
    }
  }, [id, router]);

  useEffect(() => {
    async function load() {
      await carregarEntrada();

      setLoading(false);
    }
    load();
  }, [carregarEntrada]);

  async function receberEntrada() {
    if (!entrada) return;
    setErroAcao("");
    setAcao(true);
    const { error } = await supabase.rpc("rpc_receber_entrada", { p_entrada_id: id });
    if (error) {
      setErroAcao(error.message);
      setAcao(false);
      return;
    }
    await carregarEntrada();
    setAcao(false);
  }

  async function cancelarEntrada() {
    if (!entrada || !confirm("Cancelar esta entrada?")) return;
    setErroAcao("");
    setAcao(true);
    const { error } = await supabase.rpc("rpc_cancelar_entrada", { p_entrada_id: id });
    if (error) {
      setErroAcao(error.message);
      setAcao(false);
      return;
    }
    await carregarEntrada();
    setAcao(false);
  }

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;
  if (!entrada) return null;

  const fmt = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
  const numero = entrada.numero ? `ENT-${String(entrada.numero).padStart(4, "0")}` : `ENT-${entrada.id.slice(0, 8).toUpperCase()}`;
  const fornecedorNome = entrada.fornecedores?.nome ?? entrada.fornecedor ?? "Fornecedor não informado";
  const totalNota =
    entrada.valor_total ??
    itens.reduce((acc, item) => acc + (item.valor_total ?? ((item.valor_unitario ?? 0) * item.quantidade)), 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/entradas" className="text-sm text-slate-400 hover:text-white">← Entradas</Link>
        <h1 className="text-xl font-semibold text-white">Detalhes da Entrada</h1>
        <span className={`ml-auto text-xs px-2 py-1 rounded border ${
          entrada.status === "recebido" ? "border-green-300 text-green-700 bg-green-50"
          : entrada.status === "cancelado" ? "border-red-200 text-red-700 bg-red-50"
          : "border-amber-200 text-amber-700 bg-amber-50"}`}>
          {entrada.status}
        </span>
      </div>

      {erroAcao ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Erro ao processar entrada: {erroAcao}
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Fornecedor</p>
              <h2 className="text-xl font-semibold text-slate-900">{fornecedorNome}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Entrada</p>
              <p className="font-semibold text-slate-900">{numero}</p>
              <p className="text-xs text-slate-500 mt-1">NF: {entrada.nota_fiscal ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Depósito</span>
              <div className="font-medium">{entrada.depositos?.nome ?? "—"}</div>
            </div>
            <div>
              <span className="text-slate-500">Data da entrada</span>
              <div className="font-medium">{entrada.data_entrada ? new Date(entrada.data_entrada).toLocaleDateString("pt-BR") : new Date(entrada.created_at).toLocaleDateString("pt-BR")}</div>
            </div>
            <div>
              <span className="text-slate-500">Forma de pagamento</span>
              <div className="font-medium uppercase">{entrada.forma_pagamento ?? "—"}</div>
            </div>
            <div>
              <span className="text-slate-500">Parcelamento</span>
              <div className="font-medium">{entrada.parcelado ? `${entrada.qtd_parcelas ?? 1}x` : "À vista"}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Itens da Nota</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left border-b border-slate-200">
                    <th className="py-2 px-3">Produto</th>
                    <th className="py-2 px-3 text-right">Quantidade</th>
                    <th className="py-2 px-3 text-right">Vlr. Unitário</th>
                    <th className="py-2 px-3 text-right">Vlr. Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-slate-500">Nenhum item encontrado para esta entrada.</td>
                    </tr>
                  ) : (
                    itens.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 px-3 font-medium">{item.produtos?.nome ?? "—"}</td>
                        <td className="py-2 px-3 text-right">{item.quantidade} {item.produtos?.unidade ?? ""}</td>
                        <td className="py-2 px-3 text-right">{fmt(item.valor_unitario)}</td>
                        <td className="py-2 px-3 text-right">{fmt(item.valor_total ?? ((item.valor_unitario ?? 0) * item.quantidade))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-right font-semibold">Total da nota</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{fmt(totalNota)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {entrada.observacoes && (
            <div className="text-sm">
              <span className="text-slate-500">Observações</span>
              <div className="mt-1 text-slate-800">{entrada.observacoes}</div>
            </div>
          )}
        </div>
      </div>

      {entrada.status === "pendente" && (
        <div className="flex gap-3 justify-end">
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
