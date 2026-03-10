"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Reserva = {
  id: string;
  status: string;
  quantidade_solicitada: number;
  quantidade_reservada: number;
  valor_total: number | null;
  created_at: string;
  manutencoes: { id: string; numero: number | null; status: string } | null;
  produtos: { nome: string; unidade: string } | null;
  depositos: { nome: string } | null;
};

export default function ReservasManutencaoPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [reservas, setReservas] = useState<Reserva[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("manutencao_itens")
        .select(
          "id, status, quantidade_solicitada, quantidade_reservada, valor_total, created_at, manutencoes(id, numero, status), produtos(nome, unidade), depositos(nome)"
        )
        .in("status", ["solicitado", "reservado"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) setErro(error.message);
      setReservas((data as Reserva[] | null) ?? []);
      setLoading(false);
    }

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reservas de peças</h1>
          <p className="text-sm text-slate-500">Itens reservados para manutenção sem baixa definitiva.</p>
        </div>
        <Link href="/manutencao/estoque" className="text-sm px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50">
          Voltar
        </Link>
      </div>

      {erro ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : reservas.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhuma reserva aberta.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Depósito</th>
                  <th className="py-2 pr-4">Solicitado</th>
                  <th className="py-2 pr-4">Reservado</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2">Manutenção</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-slate-500">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-4">{r.produtos?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{r.depositos?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{r.quantidade_solicitada} {r.produtos?.unidade ?? ""}</td>
                    <td className="py-2 pr-4">{r.quantidade_reservada} {r.produtos?.unidade ?? ""}</td>
                    <td className="py-2 pr-4">{Number(r.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="py-2">
                      {r.manutencoes?.id ? (
                        <Link href={`/manutencao/${r.manutencoes.id}`} className="text-indigo-700 hover:underline">
                          #{r.manutencoes.numero ?? r.manutencoes.id.slice(0, 8)}
                        </Link>
                      ) : (
                        "—"
                      )}
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
