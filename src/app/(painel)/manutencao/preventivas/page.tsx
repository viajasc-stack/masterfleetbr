"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";

type Plano = {
  id: string;
  nome: string;
  categoria: string | null;
  proxima_data: string | null;
  proxima_km: number | null;
  ativo: boolean;
  veiculos: { placa: string | null } | null;
};

export default function ManutencaoPreventivasPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("manutencao_planos_preventivos")
      .select("id,nome,categoria,proxima_data,proxima_km,ativo,veiculos(placa)")
      .order("created_at", { ascending: false })
      .limit(100);
    setPlanos((data as Plano[] | null) ?? []);
    setLoading(false);
  }

  async function gerarPreventivas() {
    setGerando(true);
    const { data, error } = await supabase.rpc("rpc_manutencao_gerar_preventivas");
    if (error) alert(error.message);
    else alert(`Preventivas geradas: ${Number(data ?? 0)}`);
    await load();
    setGerando(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preventivas"
        description="Planos preventivos por veículo e geração automática de manutenções vencidas."
        actions={
          <button onClick={gerarPreventivas} disabled={gerando} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">
            {gerando ? "Gerando..." : "Gerar preventivas vencidas"}
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : planos.length === 0 ? (
          <div className="text-slate-600">Nenhum plano preventivo cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Plano</th>
                  <th className="py-2 pr-4">Categoria</th>
                  <th className="py-2 pr-4">Próx. data</th>
                  <th className="py-2 pr-4">Próx. km</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {planos.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{p.veiculos?.placa ?? "—"}</td>
                    <td className="py-2 pr-4">{p.nome}</td>
                    <td className="py-2 pr-4">{p.categoria ?? "—"}</td>
                    <td className="py-2 pr-4">{p.proxima_data ? new Date(p.proxima_data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="py-2 pr-4">{p.proxima_km ?? "—"}</td>
                    <td className="py-2">{p.ativo ? "Ativo" : "Inativo"}</td>
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
