"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

 

const TIPOS = ["Preventiva", "Corretiva", "Preditiva", "Revisão", "Troca de pneus", "Troca de óleo", "Outros"];

type Veiculo = { id: string; placa: string; modelo: string | null };

export default function NovaManutencaoPage() {
  const router = useRouter();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [form, setForm] = useState({
    veiculo_id: "",
    tipo: "Preventiva",
    descricao: "",
    data_prevista: "",
    km_previsto: "",
    observacoes: "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase.from("veiculos").select("id, placa, modelo").eq("status", "ativo").order("placa")
      .then(({ data }) => setVeiculos((data as Veiculo[]) ?? []));
  }, []);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.veiculo_id) { setErro("Selecione um veículo."); return; }
    setLoading(true); setErro("");
    const { error } = await supabase.from("manutencoes").insert({
      veiculo_id: form.veiculo_id,
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      data_prevista: form.data_prevista || null,
      km_previsto: form.km_previsto ? parseInt(form.km_previsto) : null,
      observacoes: form.observacoes.trim() || null,
      status: "pendente",
    });
    setLoading(false);
    if (error) { setErro(error.message); return; }
    router.push("/manutencao");
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manutencao" className="text-sm text-slate-400 hover:text-white">← Manutenção</Link>
        <h1 className="text-xl font-semibold text-white">Nova Manutenção</h1>
      </div>

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{erro}</div>}

        <div>
          <label className="block font-medium mb-1">Veículo *</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.veiculo_id}
            onChange={(e) => set("veiculo_id", e.target.value)} required>
            <option value="">— Selecione —</option>
            {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` – ${v.modelo}` : ""}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Tipo *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.tipo}
              onChange={(e) => set("tipo", e.target.value)}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Data Prevista</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.data_prevista} onChange={(e) => set("data_prevista", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Descrição *</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2}
            value={form.descricao} onChange={(e) => set("descricao", e.target.value)} required />
        </div>

        <div>
          <label className="block font-medium mb-1">KM Previsto</label>
          <input type="number" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={form.km_previsto} onChange={(e) => set("km_previsto", e.target.value)} placeholder="Ex: 50000" />
        </div>

        <div>
          <label className="block font-medium mb-1">Observações</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2}
            value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? "Salvando..." : "Registrar Manutenção"}
          </button>
          <Link href="/manutencao" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
