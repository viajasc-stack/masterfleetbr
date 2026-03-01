"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Manutencao = {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  data_prevista: string | null;
  data_realizada: string | null;
  km_previsto: number | null;
  km_realizado: number | null;
  custo: number | null;
  observacoes: string | null;
  created_at: string;
  veiculos: { placa: string; modelo: string | null } | null;
};

export default function DetalheManutencaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<Manutencao | null>(null);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState(false);
  const [dataReal, setDataReal] = useState(new Date().toISOString().slice(0, 10));
  const [kmReal, setKmReal] = useState("");
  const [custo, setCusto] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("manutencoes")
        .select("*, veiculos(placa, modelo)").eq("id", id).maybeSingle();
      if (!data) { router.replace("/manutencao"); return; }
      setM(data as unknown as Manutencao);
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function concluir() {
    if (!m) return;
    setAcao(true);
    await supabase.from("manutencoes").update({
      status: "concluida",
      data_realizada: dataReal,
      km_realizado: kmReal ? parseInt(kmReal) : null,
      custo: custo ? parseFloat(custo) : null,
    }).eq("id", id);
    setM((prev) => prev ? { ...prev, status: "concluida", data_realizada: dataReal } : prev);
    setAcao(false);
  }

  async function cancelar() {
    if (!confirm("Cancelar esta manutenção?")) return;
    setAcao(true);
    await supabase.from("manutencoes").update({ status: "cancelada" }).eq("id", id);
    setM((prev) => prev ? { ...prev, status: "cancelada" } : prev);
    setAcao(false);
  }

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;
  if (!m) return null;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manutencao" className="text-sm text-slate-400 hover:text-white">← Manutenção</Link>
        <h1 className="text-xl font-semibold text-white">{m.tipo} – {m.veiculos?.placa ?? "—"}</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-slate-500">Veículo</span><div className="font-medium">{m.veiculos?.placa ?? "—"} {m.veiculos?.modelo ?? ""}</div></div>
          <div><span className="text-slate-500">Tipo</span><div className="font-medium">{m.tipo}</div></div>
          <div><span className="text-slate-500">Status</span>
            <div><span className={`text-xs px-2 py-1 rounded border ${
              m.status === "concluida" ? "border-green-200 text-green-700 bg-green-50"
              : m.status === "cancelada" ? "border-slate-200 text-slate-500"
              : "border-amber-200 text-amber-700 bg-amber-50"}`}>{m.status.replace("_", " ")}</span></div>
          </div>
          <div><span className="text-slate-500">Data Prevista</span><div>{m.data_prevista ? new Date(m.data_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div></div>
          {m.data_realizada && <div><span className="text-slate-500">Data Realizada</span><div className="text-green-600 font-medium">{new Date(m.data_realizada + "T00:00:00").toLocaleDateString("pt-BR")}</div></div>}
          {m.km_previsto && <div><span className="text-slate-500">KM Previsto</span><div>{m.km_previsto.toLocaleString("pt-BR")}</div></div>}
          {m.km_realizado && <div><span className="text-slate-500">KM Realizado</span><div>{m.km_realizado.toLocaleString("pt-BR")}</div></div>}
          {m.custo != null && <div><span className="text-slate-500">Custo</span><div className="font-semibold">{m.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div></div>}
        </div>
        <div><span className="text-slate-500">Descrição</span><div>{m.descricao}</div></div>
        {m.observacoes && <div><span className="text-slate-500">Observações</span><div>{m.observacoes}</div></div>}
      </div>

      {m.status === "pendente" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
          <h2 className="font-semibold">Registrar execução</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1">Data realizada</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={dataReal} onChange={(e) => setDataReal(e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">KM realizado</label>
              <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={kmReal} onChange={(e) => setKmReal(e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">Custo (R$)</label>
              <input type="number" step="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={custo} onChange={(e) => setCusto(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={concluir} disabled={acao}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-60 transition">
              {acao ? "Salvando..." : "Marcar como Concluída"}
            </button>
            <button onClick={cancelar} disabled={acao}
              className="border border-red-300 text-red-600 px-4 py-2 rounded-md hover:bg-red-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
