"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Plano = {
  id: string;
  nome: string;
  tipo_veiculo: string | null;
  intervalo_km: number | null;
  intervalo_dias: number | null;
  ativo: boolean;
  created_at?: string;
};

const TIPOS_VEICULO = ["automovel", "van", "microonibus", "onibus"] as const;
const INTERVALOS_DIAS = [30, 60, 90, 180, 365] as const;

export default function PlanosManutencaoPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const [nome, setNome] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState<(typeof TIPOS_VEICULO)[number]>("van");
  const [intervaloKm, setIntervaloKm] = useState("");
  const [intervaloDias, setIntervaloDias] = useState<string>("30");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("manutencao_planos")
        .select("id, nome, tipo_veiculo, intervalo_km, intervalo_dias, ativo, created_at")
        .order("nome", { ascending: true });

      if (error) throw error;
      setPlanos((data ?? []) as Plano[]);
    } catch (err) {
      console.error("Erro ao carregar planos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm() {
    setNome("");
    setTipoVeiculo("van");
    setIntervaloKm("");
    setIntervaloDias("30");
  }

  async function handleCriarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("manutencao_planos").insert({
        nome: nome.trim(),
        tipo_veiculo: tipoVeiculo,
        intervalo_km: intervaloKm ? parseInt(intervaloKm, 10) : null,
        intervalo_dias: parseInt(intervaloDias, 10),
      });

      if (error) throw error;

      setOpenModal(false);
      resetForm();
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar plano.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Planos"
        description="Listagem dos planos preventivos cadastrados pela empresa"
        actions={
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm"
          >
            + Novo Plano
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando planos...</div>
        ) : planos.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhum plano preventivo cadastrado ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4">Nome do Plano</th>
                <th className="py-3 px-4">Tipo de Veículo</th>
                <th className="py-3 px-4">Intervalo de KM</th>
                <th className="py-3 px-4">Intervalo de Dias</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {planos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{p.nome}</td>
                  <td className="py-3 px-4 text-slate-700">{p.tipo_veiculo ?? "—"}</td>
                  <td className="py-3 px-4 text-slate-700">{p.intervalo_km ? `${p.intervalo_km.toLocaleString("pt-BR")} km` : "—"}</td>
                  <td className="py-3 px-4 text-slate-700">{p.intervalo_dias ? `${p.intervalo_dias} dias` : "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${p.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Novo Plano Preventivo</h3>
              <button
                type="button"
                onClick={() => {
                  setOpenModal(false);
                  resetForm();
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarPlano} className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Nome do plano *</label>
                  <input
                    className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Revisão preventiva urbana"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Tipo de veículo *</label>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={tipoVeiculo}
                    onChange={(e) => setTipoVeiculo(e.target.value as (typeof TIPOS_VEICULO)[number])}
                  >
                    {TIPOS_VEICULO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Intervalo de KM</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={intervaloKm}
                    onChange={(e) => setIntervaloKm(e.target.value)}
                    placeholder="Ex.: 10000"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Intervalo de dias *</label>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={intervaloDias}
                    onChange={(e) => setIntervaloDias(e.target.value)}
                  >
                    {INTERVALOS_DIAS.map((dias) => (
                      <option key={dias} value={String(dias)}>
                        {dias} dias
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenModal(false);
                    resetForm();
                  }}
                  className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Criar Plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
