"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pag = {
  id: string;
  status: string;
  gateway: string;
  metodo: string;
  valor: number;
  created_at: string;
};

export default function ViagemFinanceiroPage() {
  const params = useParams<{ id: string }>();
  const viagemId = params?.id;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("Viagem");
  const [pagamentos, setPagamentos] = useState<Pag[]>([]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!viagemId) return;
        setLoading(true);

        const [{ data: v, error: errV }, { data: pays, error: errP }] = await Promise.all([
          supabase.from("viagens").select("titulo").eq("id", viagemId).maybeSingle(),
          supabase.from("pagamentos_viagem").select("id,status,gateway,metodo,valor,created_at").eq("viagem_id", viagemId).order("created_at", { ascending: false }),
        ]);

        if (errV || errP) {
          setErro(errV?.message ?? errP?.message ?? "Erro ao carregar financeiro");
          setLoading(false);
          return;
        }

        setTitulo((v?.titulo as string) ?? "Viagem");
        setPagamentos((pays ?? []) as Pag[]);
        setLoading(false);
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [viagemId]);

  const resumo = useMemo(() => {
    let total = 0;
    let aprovado = 0;
    let pendente = 0;
    pagamentos.forEach((p) => {
      total += Number(p.valor ?? 0);
      if (p.status === "aprovado") aprovado += Number(p.valor ?? 0);
      if (p.status === "pendente" || p.status === "aguardando_confirmacao") pendente += Number(p.valor ?? 0);
    });
    return { total, aprovado, pendente };
  }, [pagamentos]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Financeiro da Viagem</h1>
          <p className="text-sm text-slate-600">{titulo}</p>
        </div>
        <Link href={`/viagens/${viagemId}`} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">Voltar</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card label="Total lançado" value={fmt(resumo.total)} />
        <Card label="Total aprovado" value={fmt(resumo.aprovado)} />
        <Card label="Total pendente" value={fmt(resumo.pendente)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {erro ? <div className="text-red-700 text-sm">{erro}</div> : null}
        {loading ? <div className="text-slate-600">Carregando pagamentos...</div> : null}
        {!loading && pagamentos.length === 0 ? <div className="text-slate-600">Sem pagamentos.</div> : null}

        {!loading && pagamentos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Gateway</th>
                  <th className="py-2 pr-4">Método</th>
                  <th className="py-2 pr-0">Valor</th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{new Date(p.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-4">{p.status}</td>
                    <td className="py-2 pr-4">{p.gateway}</td>
                    <td className="py-2 pr-4">{p.metodo}</td>
                    <td className="py-2 pr-0">{fmt(Number(p.valor ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function fmt(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-900 font-semibold mt-1">{value}</div>
    </div>
  );
}
