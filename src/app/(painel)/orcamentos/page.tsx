"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Orcamento = {
  id: string;
  nome: string | null;
  descricao: string | null;
  tipo: string;
  valor_centavos: number | null;
  status: string;
  negociacao: boolean;
  created_at: string;
};

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, nome, descricao, tipo, valor_centavos, status, negociacao, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setOrcamentos(data as Orcamento[]);
    else setOrcamentos([]);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const contador = orcamentos.length;

  async function atualizarStatus(id: string, status: string) {
    setLoading(true);
    const { error } = await supabase.from("orcamentos").update({ status }).eq("id", id);
    if (error) console.error(error);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos"
        description="Listagem de orçamentos recebidos. Aprove, recuse ou negocie."
        actions={
          <>
            <Link href="/orcamentos/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">+ Novo Orçamento</Link>
            <button onClick={carregar} className="ml-2 border border-slate-300 px-4 py-2 rounded-md">Recarregar</button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="text-sm text-slate-600">
          Mostrando <span className="font-semibold">{contador}</span> orçamentos.
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div>Carregando...</div>
        ) : orcamentos.length === 0 ? (
          <div className="text-slate-600">Nenhum orçamento encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                  <th className="py-2 pr-0">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orcamentos.map((o) => (
                  <tr key={o.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                    <td className="py-2 pr-4 font-medium">{o.nome ?? '—'}</td>
                    <td className="py-2 pr-4">{o.tipo}</td>
                    <td className="py-2 pr-4">{o.valor_centavos != null ? `R$ ${(o.valor_centavos/100).toFixed(2)}` : '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${o.status==='aprovado'? 'border-green-200 text-green-700 bg-green-50' : o.status==='recusado'? 'border-red-200 text-red-700 bg-red-50' : 'border-slate-200 text-slate-700 bg-slate-50'}`}>
                        {o.status}{o.negociacao? ' • negociação':''}
                      </span>
                    </td>
                    <td className="py-2 pr-0">{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                    <td className="py-2 pr-0">
                      <div className="flex gap-2">
                        {o.status !== 'aprovado' && (
                          <button onClick={() => atualizarStatus(o.id,'aprovado')} className="px-3 py-1 bg-green-600 text-white rounded-md text-sm">Aprovar</button>
                        )}
                        {o.status !== 'recusado' && (
                          <button onClick={() => atualizarStatus(o.id,'recusado')} className="px-3 py-1 bg-red-600 text-white rounded-md text-sm">Recusar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
