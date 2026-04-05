"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchMecanicos, criarMecanico, moeda } from "@/lib/oficina";
import type { OficinaMecanico } from "@/types/oficina.types";

export default function OficinaMecanicosPage() {
  const [mecanicos, setMecanicos] = useState<OficinaMecanico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", cpf: "", especialidade: "", telefone: "", email: "", valor_hora: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMecanicos(false);
      setMecanicos(data);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await criarMecanico({
        nome: form.nome,
        cpf: form.cpf || null,
        especialidade: form.especialidade || null,
        telefone: form.telefone || null,
        email: form.email || null,
        valor_hora: form.valor_hora ? parseFloat(form.valor_hora) : 0,
      });
      setShowForm(false);
      setForm({ nome: "", cpf: "", especialidade: "", telefone: "", email: "", valor_hora: "" });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar mecânico.");
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    const { supabase } = await import("@/lib/supabase/client");
    await supabase.from("oficina_mecanicos").update({ ativo: !ativo }).eq("id", id);
    await loadData();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficina · Mecânicos"
        description="Gestão da equipe de mecânicos"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">
            {showForm ? "Cancelar" : "+ Novo Mecânico"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCriar} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">Novo Mecânico</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Nome *" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="CPF" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Especialidade" value={form.especialidade} onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))} />
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Telefone" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input type="number" step="0.01" className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Valor/hora" value={form.valor_hora} onChange={e => setForm(f => ({ ...f, valor_hora: e.target.value }))} />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">Cadastrar</button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : mecanicos.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhum mecânico cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Especialidade</th>
                <th className="py-3 px-4">Telefone</th>
                <th className="py-3 px-4">Valor/Hora</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mecanicos.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-medium">{m.nome}</td>
                  <td className="py-3 px-4">{m.especialidade ?? "—"}</td>
                  <td className="py-3 px-4">{m.telefone ?? "—"}</td>
                  <td className="py-3 px-4">{moeda(m.valor_hora)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${m.ativo ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-700"}`}>
                      {m.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => toggleAtivo(m.id, m.ativo)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-md hover:bg-slate-50">
                      {m.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}