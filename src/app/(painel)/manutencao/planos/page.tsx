"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadOptions } from "@/lib/manutencao";

type Plano = {
  id: string;
  nome: string;
  tipo_veiculo: string | null;
  ativo: boolean;
};

type PlanoItem = {
  id: string;
  plano_id: string;
  intervalo_km: number | null;
  intervalo_dias: number | null;
  tipos_servico: { nome: string | null } | null;
};

export default function PlanosManutencaoPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [itens, setItens] = useState<PlanoItem[]>([]);
  const [tiposServico, setTiposServico] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [planoSelecionado, setPlanoSelecionado] = useState("");
  const [tipoServicoId, setTipoServicoId] = useState("");
  const [intervaloKm, setIntervaloKm] = useState("");
  const [intervaloDias, setIntervaloDias] = useState("");

  async function carregar() {
    setLoading(true);
    const [plRes, itRes, tsRes] = await Promise.all([
      supabase.from("planos_manutencao").select("id,nome,tipo_veiculo,ativo").order("nome"),
      supabase.from("plano_itens").select("id,plano_id,intervalo_km,intervalo_dias,tipos_servico(nome)").order("created_at", { ascending: false }),
      loadOptions("tipos_servico", "nome", true),
    ]);

    setPlanos((plRes.data as Plano[] | null) ?? []);
    setItens((itRes.data as PlanoItem[] | null) ?? []);
    setTiposServico(tsRes);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, []);

  const itensDoPlano = useMemo(() => itens.filter((i) => (planoSelecionado ? i.plano_id === planoSelecionado : true)), [itens, planoSelecionado]);

  async function criarPlano(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nome.trim()) return;
    await supabase.from("planos_manutencao").insert({ nome: nome.trim(), tipo_veiculo: tipoVeiculo || null, ativo: true });
    setNome("");
    setTipoVeiculo("");
    await carregar();
  }

  async function addItemPlano(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!planoSelecionado) return;
    await supabase.from("plano_itens").insert({
      plano_id: planoSelecionado,
      tipo_servico_id: tipoServicoId || null,
      intervalo_km: intervaloKm ? Number(intervaloKm) : null,
      intervalo_dias: intervaloDias ? Number(intervaloDias) : null,
    });
    setTipoServicoId("");
    setIntervaloKm("");
    setIntervaloDias("");
    await carregar();
  }

  async function togglePlano(id: string, ativo: boolean) {
    await supabase.from("planos_manutencao").update({ ativo: !ativo }).eq("id", id);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manutenção · Planos" description="CRUD de planos de manutenção e itens por intervalo de KM/dias." />

      <form onSubmit={criarPlano} className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-4">
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" placeholder="Nome do plano" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Tipo de veículo" value={tipoVeiculo} onChange={(e) => setTipoVeiculo(e.target.value)} />
        <button type="submit" className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500">Criar plano</button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Plano</th>
              <th className="py-2 pr-4">Tipo de veículo</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="py-3 text-slate-500">Carregando...</td></tr> : null}
            {!loading && planos.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{p.nome}</td>
                <td className="py-2 pr-4">{p.tipo_veiculo ?? "—"}</td>
                <td className="py-2 pr-4">{p.ativo ? "Ativo" : "Inativo"}</td>
                <td className="py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button type="button" onClick={() => setPlanoSelecionado(p.id)} className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">Ver itens</button>
                    <button type="button" onClick={() => void togglePlano(p.id, p.ativo)} className="px-2 py-1 text-xs border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50">{p.ativo ? "Desativar" : "Ativar"}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={addItemPlano} className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-5">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={planoSelecionado} onChange={(e) => setPlanoSelecionado(e.target.value)} required>
          <option value="">Plano</option>
          {planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoServicoId} onChange={(e) => setTipoServicoId(e.target.value)}>
          <option value="">Tipo de serviço</option>
          {tiposServico.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <input type="number" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Intervalo KM" value={intervaloKm} onChange={(e) => setIntervaloKm(e.target.value)} />
        <input type="number" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Intervalo dias" value={intervaloDias} onChange={(e) => setIntervaloDias(e.target.value)} />
        <button type="submit" className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500">Adicionar item</button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Tipo de serviço</th>
              <th className="py-2 pr-4">Intervalo KM</th>
              <th className="py-2 pr-4">Intervalo dias</th>
            </tr>
          </thead>
          <tbody>
            {itensDoPlano.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{i.tipos_servico?.nome ?? "—"}</td>
                <td className="py-2 pr-4">{i.intervalo_km ?? "—"}</td>
                <td className="py-2 pr-4">{i.intervalo_dias ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
