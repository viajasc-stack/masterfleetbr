"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OSResumo = {
  status: string;
  total: number;
  valor_total: number;
};

type OSPorCliente = {
  nome: string;
  total: number;
  valor: number;
};

type OSPorVeiculo = {
  placa: string;
  total: number;
};

function FiltrosPeriodo({ inicio, fim, onChange }: {
  inicio: string; fim: string;
  onChange: (i: string, f: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap gap-4 items-end text-sm">
      <div>
        <label className="block font-medium mb-1">De</label>
        <input type="date" className="border border-slate-300 rounded-md px-3 py-2"
          value={inicio} onChange={(e) => onChange(e.target.value, fim)} />
      </div>
      <div>
        <label className="block font-medium mb-1">Até</label>
        <input type="date" className="border border-slate-300 rounded-md px-3 py-2"
          value={fim} onChange={(e) => onChange(inicio, e.target.value)} />
      </div>
      <div className="flex gap-2">
        {["Este mês", "Mês anterior", "Este ano"].map((label) => (
          <button key={label} onClick={() => {
            const hoje = new Date();
            let i: Date, f: Date;
            if (label === "Este mês") {
              i = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
              f = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            } else if (label === "Mês anterior") {
              i = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
              f = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
            } else {
              i = new Date(hoje.getFullYear(), 0, 1);
              f = new Date(hoje.getFullYear(), 11, 31);
            }
            onChange(i.toISOString().slice(0, 10), f.toISOString().slice(0, 10));
          }} className="border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-50 transition text-xs">
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RelatoriosPage() {
  const hoje = new Date();
  const [inicio, setInicio] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10));
  const [fim, setFim] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10));

  const [osResumo, setOsResumo] = useState<OSResumo[]>([]);
  const [osClientes, setOsClientes] = useState<OSPorCliente[]>([]);
  const [osVeiculos, setOsVeiculos] = useState<OSPorVeiculo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: osData } = await supabase.from("ordens_servico")
        .select("status, valor_total, clientes(nome), veiculos(placa)")
        .gte("created_at", inicio + "T00:00:00")
        .lte("created_at", fim + "T23:59:59");

      const lista = (osData as unknown as { status: string; valor_total: number | null; clientes: { nome: string } | null; veiculos: { placa: string } | null }[]) ?? [];

      const porStatus: Record<string, { total: number; valor: number }> = {};
      const porCliente: Record<string, { total: number; valor: number }> = {};
      const porVeiculo: Record<string, number> = {};

      lista.forEach((os) => {
        const s = os.status || "desconhecido";
        porStatus[s] = porStatus[s] ?? { total: 0, valor: 0 };
        porStatus[s].total++;
        porStatus[s].valor += os.valor_total ?? 0;

        const cn = os.clientes?.nome ?? "Sem cliente";
        porCliente[cn] = porCliente[cn] ?? { total: 0, valor: 0 };
        porCliente[cn].total++;
        porCliente[cn].valor += os.valor_total ?? 0;

        const vp = os.veiculos?.placa ?? "Sem veículo";
        porVeiculo[vp] = (porVeiculo[vp] ?? 0) + 1;
      });

      setOsResumo(Object.entries(porStatus).map(([status, d]) => ({ status, total: d.total, valor_total: d.valor })));
      setOsClientes(Object.entries(porCliente)
        .map(([nome, d]) => ({ nome, total: d.total, valor: d.valor }))
        .sort((a, b) => b.total - a.total).slice(0, 10));
      setOsVeiculos(Object.entries(porVeiculo)
        .map(([placa, total]) => ({ placa, total }))
        .sort((a, b) => b.total - a.total).slice(0, 10));

      setLoading(false);
    }
    load();
  }, [inicio, fim]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const totalOS = osResumo.reduce((s, r) => s + r.total, 0);
  const totalValor = osResumo.reduce((s, r) => s + r.valor_total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Relatórios</h1>
        <p className="text-slate-400 mt-0.5 text-sm">Análise operacional por período</p>
      </div>

      <FiltrosPeriodo inicio={inicio} fim={fim} onChange={(i, f) => { setInicio(i); setFim(f); }} />

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
              <div className="text-3xl font-bold text-white">{totalOS}</div>
              <div className="text-sm text-slate-400 mt-1">OS no período</div>
            </div>
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
              <div className="text-2xl font-bold text-white">{fmt(totalValor)}</div>
              <div className="text-sm text-slate-400 mt-1">Receita Total</div>
            </div>
            {osResumo.map((r) => (
              <div key={r.status} className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                <div className="text-2xl font-bold text-white">{r.total}</div>
                <div className="text-sm text-slate-400 mt-1">{r.status.replace("_", " ")}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold mb-4">OS por Cliente (top 10)</h2>
              {osClientes.length === 0 ? (
                <div className="text-slate-500 text-sm">Sem dados</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left border-b text-slate-500">
                    <th className="py-1 pr-4">Cliente</th>
                    <th className="py-1 pr-4">OS</th>
                    <th className="py-1">Valor</th>
                  </tr></thead>
                  <tbody>
                    {osClientes.map((c) => (
                      <tr key={c.nome} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{c.nome}</td>
                        <td className="py-2 pr-4">{c.total}</td>
                        <td className="py-2">{fmt(c.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold mb-4">OS por Veículo (top 10)</h2>
              {osVeiculos.length === 0 ? (
                <div className="text-slate-500 text-sm">Sem dados</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left border-b text-slate-500">
                    <th className="py-1 pr-4">Veículo</th>
                    <th className="py-1">OS</th>
                  </tr></thead>
                  <tbody>
                    {osVeiculos.map((v) => (
                      <tr key={v.placa} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{v.placa}</td>
                        <td className="py-2">{v.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
