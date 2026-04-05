"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadVeiculosAtivos, loadMotoristasAtivos, loadFornecedoresAtivos } from "@/lib/manutencao";

type SelectOption = { id: string; nome?: string | null; placa?: string | null; modelo?: string | null; prioridade?: string; categoria?: string | null; descricao?: string | null; veiculo_id?: string; motorista_id?: string | null };

export default function NovaOrdemManutencaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const solicitacaoId = searchParams.get("sol");

  const [veiculos, setVeiculos] = useState<SelectOption[]>([]);
  const [motoristas, setMotoristas] = useState<SelectOption[]>([]);
  const [fornecedores, setFornecedores] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    veiculo_id: "",
    motorista_id: "",
    tipo: "corretiva",
    prioridade: "media",
    categoria: "outros",
    diagnostico: "",
    fornecedor_id: "",
    oficina_interna: true,
    km_entrada: "",
    responsavel_tecnico: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vei, mot, forn] = await Promise.all([
        loadVeiculosAtivos(),
        loadMotoristasAtivos(),
        loadFornecedoresAtivos(),
      ]);
      setVeiculos(vei);
      setMotoristas(mot);
      setFornecedores(forn);

      if (solicitacaoId) {
        const { data } = await supabase.from("manutencao_solicitacoes").select("*").eq("id", solicitacaoId).maybeSingle();
        if (data) {
          setForm(prev => ({
            ...prev,
            veiculo_id: data.veiculo_id,
            motorista_id: data.motorista_id ?? "",
            prioridade: data.prioridade,
            categoria: data.categoria ?? "outros",
            diagnostico: data.descricao,
          }));
        }
      }
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [solicitacaoId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.veiculo_id) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("manutencao_ordens").insert({
        veiculo_id: form.veiculo_id,
        motorista_id: form.motorista_id || null,
        tipo: form.tipo,
        status: "aberta",
        prioridade: form.prioridade,
        categoria: form.categoria,
        diagnostico: form.diagnostico || null,
        fornecedor_id: form.fornecedor_id || null,
        oficina_interna: form.oficina_interna,
        km_entrada: form.km_entrada ? parseInt(form.km_entrada) : null,
        responsavel_tecnico: form.responsavel_tecnico || null,
        solicitacao_id: solicitacaoId || null,
      }).select().single();

      if (error) throw new Error(error.message);

      if (solicitacaoId) {
        await supabase.from("manutencao_solicitacoes").update({ status: "convertida" }).eq("id", solicitacaoId);
      }

      router.push(`/manutencao/ordens/${data.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar OS de manutenção.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Nova OS"
        description={solicitacaoId ? "Criar OS a partir de solicitação" : "Criar nova ordem de serviço"}
        actions={<Link href="/manutencao/ordens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">Cancelar</Link>}
      />

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Veículo *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Motorista</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.motorista_id} onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))}>
              <option value="">Sem motorista</option>
              {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tipo *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              <option value="corretiva">Corretiva</option>
              <option value="preventiva">Preventiva</option>
              <option value="emergencial">Emergencial</option>
              <option value="preditiva">Preditiva</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Prioridade</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Categoria</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              <option value="motor">Motor</option>
              <option value="freios">Freios</option>
              <option value="suspensao">Suspensão/Direção</option>
              <option value="eletrica">Elétrica</option>
              <option value="pneus">Pneus</option>
              <option value="carroceria">Carroceria</option>
              <option value="ar_condicionado">Ar-condicionado</option>
              <option value="oleo_filtro">Óleo e Filtros</option>
              <option value="transmissao">Transmissão</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">KM Entrada</label>
            <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.km_entrada} onChange={e => setForm(f => ({ ...f, km_entrada: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Diagnóstico / Descrição</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" rows={3} value={form.diagnostico} onChange={e => setForm(f => ({ ...f, diagnostico: e.target.value }))} />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Responsável Técnico</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.responsavel_tecnico} onChange={e => setForm(f => ({ ...f, responsavel_tecnico: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Oficina</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.oficina_interna ? "interna" : (form.fornecedor_id || "")} onChange={e => {
              if (e.target.value === "interna") setForm(f => ({ ...f, oficina_interna: true, fornecedor_id: "" }));
              else setForm(f => ({ ...f, oficina_interna: false, fornecedor_id: e.target.value }));
            }}>
              <option value="interna">Oficina Interna</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={submitting} className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-60">
            {submitting ? "Criando..." : "Criar OS"}
          </button>
          <Link href="/manutencao/ordens" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}