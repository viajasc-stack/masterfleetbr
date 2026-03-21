"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import {
  converterSolicitacaoEmOS,
  dataBR,
  loadOptions,
  prioridadeOptions,
  solicitacaoStatusOptions,
} from "@/lib/manutencao";

type Solicitacao = {
  id: string;
  veiculo_id: string;
  motorista_id: string | null;
  descricao: string;
  prioridade: "baixa" | "media" | "alta";
  status: "nova" | "em_analise" | "aprovada" | "rejeitada" | "convertida";
  km: number | null;
  origem: string;
  created_at: string;
  veiculos: { placa: string | null; modelo: string | null } | null;
  motoristas: { nome: string | null } | null;
};

type FormState = {
  veiculo_id: string;
  motorista_id: string;
  descricao: string;
  prioridade: "baixa" | "media" | "alta";
  km: string;
  origem: "motorista" | "admin" | "checklist" | "preventiva";
};

const initialForm: FormState = {
  veiculo_id: "",
  motorista_id: "",
  descricao: "",
  prioridade: "media",
  km: "",
  origem: "admin",
};

export default function SolicitacoesManutencaoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [veiculos, setVeiculos] = useState<Array<{ id: string; nome: string }>>([]);
  const [motoristas, setMotoristas] = useState<Array<{ id: string; nome: string }>>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const [solRes, veiRes, motRes] = await Promise.all([
      supabase
        .from("solicitacoes_manutencao")
        .select("id,veiculo_id,motorista_id,descricao,prioridade,status,km,origem,created_at,veiculos(placa,modelo),motoristas(nome)")
        .order("created_at", { ascending: false })
        .limit(300),
      loadOptions("veiculos", "placa", true),
      loadOptions("motoristas", "nome", true),
    ]);

    setSolicitacoes((solRes.data as Solicitacao[] | null) ?? []);
    setVeiculos(veiRes);
    setMotoristas(motRes);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return solicitacoes
      .filter((s) => (filtroStatus === "todos" ? true : s.status === filtroStatus))
      .filter((s) => {
        if (!q) return true;
        return [s.descricao, s.veiculos?.placa ?? "", s.motoristas?.nome ?? "", s.status].join(" ").toLowerCase().includes(q);
      });
  }, [solicitacoes, busca, filtroStatus]);

  function limparForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.veiculo_id || !form.descricao.trim()) return;

    setSaving(true);

    const payload = {
      veiculo_id: form.veiculo_id,
      motorista_id: form.motorista_id || null,
      descricao: form.descricao.trim(),
      prioridade: form.prioridade,
      km: form.km ? Number(form.km) : null,
      origem: form.origem,
    };

    if (editingId) {
      await supabase.from("solicitacoes_manutencao").update(payload).eq("id", editingId);
    } else {
      await supabase.from("solicitacoes_manutencao").insert(payload);
    }

    setSaving(false);
    limparForm();
    await carregar();
  }

  async function mudarStatus(id: string, status: string) {
    await supabase.from("solicitacoes_manutencao").update({ status }).eq("id", id);
    await carregar();
  }

  async function converterEmOs(id: string) {
    try {
      const ordemId = await converterSolicitacaoEmOS(id);
      await carregar();
      window.location.href = `/manutencao/ordens/${ordemId}`;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível converter.";
      alert(mensagem);
    }
  }

  function editar(s: Solicitacao) {
    setEditingId(s.id);
    setForm({
      veiculo_id: s.veiculo_id,
      motorista_id: s.motorista_id ?? "",
      descricao: s.descricao,
      prioridade: s.prioridade,
      km: s.km ? String(s.km) : "",
      origem: (s.origem as FormState["origem"]) ?? "admin",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Solicitações"
        description="Solicitações por veículo/motorista com aprovação e conversão em OS."
        actions={
          <Link href="/manutencao/ordens" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">
            Ver ordens
          </Link>
        }
      />

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={form.veiculo_id} onChange={(e) => setForm((v) => ({ ...v, veiculo_id: e.target.value }))} required>
          <option value="">Veículo</option>
          {veiculos.map((v) => (
            <option key={v.id} value={v.id}>{v.nome}</option>
          ))}
        </select>

        <select className="border border-slate-300 rounded-md px-3 py-2" value={form.motorista_id} onChange={(e) => setForm((v) => ({ ...v, motorista_id: e.target.value }))}>
          <option value="">Motorista (opcional)</option>
          {motoristas.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>

        <select className="border border-slate-300 rounded-md px-3 py-2" value={form.prioridade} onChange={(e) => setForm((v) => ({ ...v, prioridade: e.target.value as FormState["prioridade"] }))}>
          {prioridadeOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <textarea className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" rows={2} placeholder="Descrição da solicitação" value={form.descricao} onChange={(e) => setForm((v) => ({ ...v, descricao: e.target.value }))} required />

        <div className="grid grid-cols-2 gap-2">
          <input type="number" className="border border-slate-300 rounded-md px-3 py-2" placeholder="KM" value={form.km} onChange={(e) => setForm((v) => ({ ...v, km: e.target.value }))} />
          <select className="border border-slate-300 rounded-md px-3 py-2" value={form.origem} onChange={(e) => setForm((v) => ({ ...v, origem: e.target.value as FormState["origem"] }))}>
            <option value="admin">admin</option>
            <option value="motorista">motorista</option>
            <option value="checklist">checklist</option>
            <option value="preventiva">preventiva</option>
          </select>
        </div>

        <div className="md:col-span-3 flex gap-2">
          <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-60">
            {editingId ? "Salvar edição" : "Criar solicitação"}
          </button>
          {editingId ? (
            <button type="button" onClick={limparForm} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">
              Cancelar edição
            </button>
          ) : null}
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" placeholder="Buscar por veículo, motorista ou descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select className="border border-slate-300 rounded-md px-3 py-2" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos</option>
            {solicitacaoStatusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Veículo</th>
                <th className="py-2 pr-4">Motorista</th>
                <th className="py-2 pr-4">Descrição</th>
                <th className="py-2 pr-4">Prioridade</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-3 text-slate-500">Carregando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={7} className="py-3 text-slate-500">Nenhuma solicitação.</td></tr>
              ) : (
                filtradas.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 font-medium">{s.veiculos?.placa ?? "—"}</td>
                    <td className="py-2 pr-4">{s.motoristas?.nome ?? "—"}</td>
                    <td className="py-2 pr-4 max-w-[320px]">{s.descricao}</td>
                    <td className="py-2 pr-4">{s.prioridade}</td>
                    <td className="py-2 pr-4">{s.status}</td>
                    <td className="py-2 pr-4">{dataBR(s.created_at)}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        <button type="button" onClick={() => editar(s)} className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">Editar</button>
                        <button type="button" onClick={() => void mudarStatus(s.id, "aprovada")} className="px-2 py-1 text-xs border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">Aprovar</button>
                        <button type="button" onClick={() => void mudarStatus(s.id, "rejeitada")} className="px-2 py-1 text-xs border border-rose-300 text-rose-700 rounded hover:bg-rose-50">Rejeitar</button>
                        {s.status !== "convertida" ? (
                          <button type="button" onClick={() => void converterEmOs(s.id)} className="px-2 py-1 text-xs border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50">Converter em OS</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
