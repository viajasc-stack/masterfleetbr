"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Fatura = {
  id: string;
  empresa_id: string;
  empresa_nome: string | null;
  valor_centavos: number;
  status: string;
  vencimento: string | null;
  created_at: string;
  mp_payment_id: string | null;
};

export default function MasterFinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [erro, setErro] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase.rpc("master_list_faturas", { p_limit: 200 });
    if (error) {
      setErro(error.message);
      setFaturas([]);
      setLoading(false);
      return;
    }
    setFaturas(((data ?? []) as unknown as Fatura[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const resumo = useMemo(() => {
    const abertas = faturas.filter((f) => f.status === "aberta");
    const pagas = faturas.filter((f) => f.status === "paga");
    const vencidas = abertas.filter((f) => f.vencimento && new Date(f.vencimento) < new Date());

    const totalAberto = abertas.reduce((acc, f) => acc + Number(f.valor_centavos || 0), 0);
    const totalPago = pagas.reduce((acc, f) => acc + Number(f.valor_centavos || 0), 0);
    const totalVencido = vencidas.reduce((acc, f) => acc + Number(f.valor_centavos || 0), 0);

    return { totalAberto, totalPago, totalVencido, qtdAbertas: abertas.length, qtdPagas: pagas.length, qtdVencidas: vencidas.length };
  }, [faturas]);

  const dinheiro = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Financeiro Master</h1>
        <p className="text-slate-600 text-sm mt-0.5">Controle global de faturas e cobrança SaaS</p>
      </div>

      <div className="flex justify-end">
        <button onClick={carregar} className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition">
          Recarregar
        </button>
      </div>

      {erro && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-xs text-amber-700">Em aberto ({resumo.qtdAbertas})</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{dinheiro(resumo.totalAberto)}</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="text-xs text-green-700">Recebido ({resumo.qtdPagas})</div>
          <div className="text-2xl font-bold text-green-900 mt-1">{dinheiro(resumo.totalPago)}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="text-xs text-red-700">Vencido ({resumo.qtdVencidas})</div>
          <div className="text-2xl font-bold text-red-900 mt-1">{dinheiro(resumo.totalVencido)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Carregando...</div>
        ) : faturas.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">Nenhuma fatura encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 text-slate-400">Empresa</th>
                <th className="px-4 py-3 text-slate-400">Valor</th>
                <th className="px-4 py-3 text-slate-400">Status</th>
                <th className="px-4 py-3 text-slate-400">Vencimento</th>
                <th className="px-4 py-3 text-slate-400">MP Payment</th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{f.empresa_nome ?? f.empresa_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{dinheiro(Number(f.valor_centavos || 0))}</td>
                  <td className="px-4 py-3 text-slate-700">{f.status}</td>
                  <td className="px-4 py-3 text-slate-400">{f.vencimento ? new Date(f.vencimento).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{f.mp_payment_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
