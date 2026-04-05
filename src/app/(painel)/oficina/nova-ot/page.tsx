"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { criarOT, loadVeiculosAtivos, loadClientesAtivos, fetchMecanicos } from "@/lib/oficina";
import { supabase } from "@/lib/supabase/client";

type SelectOption = { id: string; nome?: string | null; placa?: string | null; modelo?: string | null };

export default function OficinaNovaOTPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const solicitacaoId = searchParams.get("sol");
  const [veiculos, setVeiculos] = useState<SelectOption[]>([]);
  const [clientes, setClientes] = useState<SelectOption[]>([]);
  const [mecanicos, setMecanicos] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    veiculo_id: "",
    cliente_id: "",
    mecanico_id: "",
    tipo_servico: "mecanica",
    prioridade: "normal",
    reclamacao: "",
    km_entrada: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vei, cli, mec] = await Promise.all([
        loadVeiculosAtivos(),
        loadClientesAtivos(),
        fetchMecanicos(),
      ]);
      setVeiculos(vei);
      setClientes(cli);
      setMecanicos(mec);

      if (solicitacaoId) {
        const { data: sol } = await supabase
          .from("manutencao_solicitacoes")
          .select("id, veiculo_id, titulo, descricao, categoria, prioridade, km_atual")
          .eq("id", solicitacaoId)
          .maybeSingle();

        if (sol) {
          const categoriaMap: Record<string, string> = {
            motor: "motor",
            freios: "freios",
            suspensao: "suspensao",
            direcao: "suspensao",
            eletrica: "eletrica",
            pneus: "mecanica",
            carroceria: "funilaria",
            ar_condicionado: "ar_condicionado",
            oleo_filtro: "revisao",
            transmissao: "transmissao",
            escapamento: "mecanica",
            outros: "diagnostico",
          };

          const prioridadeMap: Record<string, string> = {
            baixa: "baixa",
            media: "normal",
            alta: "alta",
            critica: "urgente",
          };

          setForm((prev) => ({
            ...prev,
            veiculo_id: sol.veiculo_id ?? prev.veiculo_id,
            tipo_servico: categoriaMap[String(sol.categoria ?? "outros")] ?? prev.tipo_servico,
            prioridade: prioridadeMap[String(sol.prioridade ?? "media")] ?? prev.prioridade,
            km_entrada: sol.km_atual ? String(sol.km_atual) : prev.km_entrada,
            reclamacao: [sol.titulo, sol.descricao].filter(Boolean).join(" — "),
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
      const otId = await criarOT({
        veiculo_id: form.veiculo_id,
        cliente_id: form.cliente_id || null,
        mecanico_id: form.mecanico_id || null,
        tipo_servico: form.tipo_servico,
        prioridade: form.prioridade,
        reclamacao: form.reclamacao || null,
        km_entrada: form.km_entrada ? parseInt(form.km_entrada) : null,
      });
      router.push(`/oficina/ordens/${otId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar OT.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficina · Nova OT"
        description={solicitacaoId ? "Criar OT a partir de diagnóstico da manutenção" : "Criar nova ordem de trabalho"}
        actions={
          <Link href="/oficina/ordens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
            Cancelar
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        {solicitacaoId ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
            Esta OT será criada com base em uma solicitação já diagnosticada no módulo de Manutenção.
          </div>
        ) : null}

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Veículo *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Cliente (opcional)</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
              <option value="">Sem cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Mecânico Responsável</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.mecanico_id} onChange={e => setForm(f => ({ ...f, mecanico_id: e.target.value }))}>
              <option value="">Sem mecânico</option>
              {mecanicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tipo de Serviço</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.tipo_servico} onChange={e => setForm(f => ({ ...f, tipo_servico: e.target.value }))}>
              <option value="mecanica">Mecânica</option>
              <option value="eletrica">Elétrica</option>
              <option value="funilaria">Funilaria</option>
              <option value="pintura">Pintura</option>
              <option value="ar_condicionado">Ar-condicionado</option>
              <option value="suspensao">Suspensão</option>
              <option value="freios">Freios</option>
              <option value="motor">Motor</option>
              <option value="transmissao">Transmissão</option>
              <option value="diagnostico">Diagnóstico</option>
              <option value="revisao">Revisão</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Prioridade</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">KM na Entrada</label>
            <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={form.km_entrada} onChange={e => setForm(f => ({ ...f, km_entrada: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Reclamação do Cliente / Descrição do Problema</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" rows={4} value={form.reclamacao} onChange={e => setForm(f => ({ ...f, reclamacao: e.target.value }))} placeholder="Descreva o problema relatado..." />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={submitting} className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-60">
            {submitting ? "Criando..." : "Criar OT"}
          </button>
          <Link href="/oficina/ordens" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}