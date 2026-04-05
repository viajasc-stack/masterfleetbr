"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { numberBR } from "@/lib/estoque";

type Movimento = {
  id: string;
  created_at: string;
  tipo: string;
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  motivo: string | null;
  observacao: string | null;
  itens_estoque?: { nome?: string } | null;
  locais_estoque?: { nome?: string } | null;
};

export default function MovimentacoesEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Movimento[]>([]);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select("id, created_at, tipo, quantidade, saldo_anterior, saldo_posterior, motivo, observacao, itens_estoque(nome), locais_estoque(nome)")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) setErro(error.message);
      setLista((data as Movimento[] | null) ?? []);
      setLoading(false);
    }
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista
      .filter((m) => (tipo === "todos" ? true : m.tipo === tipo))
      .filter((m) => !q || [m.itens_estoque?.nome ?? "", m.locais_estoque?.nome ?? "", m.motivo ?? "", m.observacao ?? ""].join(" ").toLowerCase().includes(q));
  }, [lista, busca, tipo]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Movimentações"
        description="Auditoria completa de entradas, saídas e ajustes com saldo anterior/posterior."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-3 gap-3">
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" placeholder="Buscar por item, local, motivo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
          <option value="ajuste_positivo">Ajuste positivo</option>
          <option value="ajuste_negativo">Ajuste negativo</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando movimentações...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhuma movimentação encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data/hora</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Quantidade</th>
                <th className="py-2 pr-4">Saldo anterior</th>
                <th className="py-2 pr-4">Saldo posterior</th>
                <th className="py-2 pr-4">Local</th>
                <th className="py-2">Motivo/Obs.</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 font-medium">{m.itens_estoque?.nome ?? "—"}</td>
                  <td className="py-2 pr-4 capitalize">{m.tipo.replaceAll("_", " ")}</td>
                  <td className="py-2 pr-4">{numberBR(m.quantidade, 3)}</td>
                  <td className="py-2 pr-4 text-slate-600">{numberBR(m.saldo_anterior, 3)}</td>
                  <td className="py-2 pr-4 text-slate-600">{numberBR(m.saldo_posterior, 3)}</td>
                  <td className="py-2 pr-4 text-slate-600">{m.locais_estoque?.nome ?? "—"}</td>
                  <td className="py-2 text-slate-600">{m.motivo ?? m.observacao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
