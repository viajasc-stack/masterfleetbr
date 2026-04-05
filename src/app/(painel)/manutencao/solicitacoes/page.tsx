"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchSolicitacoes, rejeitarSolicitacao, loadVeiculosAtivos, criarSolicitacao, atualizarStatusSolicitacao } from "@/lib/manutencao";
import type { ManutencaoSolicitacao } from "@/types/manutencao.types";
import { SOLICITACAO_STATUS_LABELS, SOLICITACAO_STATUS_COLORS, CATEGORIA_LABELS } from "@/types/manutencao.types";

type VeiculoOption = { id: string; placa: string; modelo: string | null };

export default function SolicitacoesInboxPage() {
  const searchParams = useSearchParams();
  const origem = searchParams.get("origem");
  const planoId = searchParams.get("plano");
  const [solicitacoes, setSolicitacoes] = useState<ManutencaoSolicitacao[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [showNovaSolicitacao, setShowNovaSolicitacao] = useState(false);

  // Form nova solicitacao
  const [formVeiculo, setFormVeiculo] = useState("");
  const [formCategoria, setFormCategoria] = useState("outros");
  const [formTitulo, setFormTitulo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formPrioridade, setFormPrioridade] = useState("media");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        const [solData, veiData] = await Promise.all([
        fetchSolicitacoes(filtroStatus === "todos" ? undefined : filtroStatus),
        loadVeiculosAtivos(),
      ]);
      setSolicitacoes(solData);
        setVeiculos(veiData as VeiculoOption[]);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (origem !== "preventiva") return;
    setShowNovaSolicitacao(true);
    setFormCategoria((prev) => (prev === "outros" ? "oleo_filtro" : prev));
    setFormTitulo((prev) => prev || "Solicitação preventiva para diagnóstico");
    setFormDescricao((prev) => prev || (planoId
      ? `Encaminhamento criado a partir da rotina preventiva (plano: ${planoId}).`
      : "Encaminhamento criado a partir da rotina preventiva."
    ));
  }, [origem, planoId]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase();
    if (!q) return solicitacoes;
    return solicitacoes.filter(s =>
      s.titulo.toLowerCase().includes(q) ||
      s.descricao.toLowerCase().includes(q) ||
      s.veiculos?.placa?.toLowerCase().includes(q) ||
      s.motoristas?.nome?.toLowerCase().includes(q)
    );
  }, [solicitacoes, busca]);

  async function handleIniciarDiagnostico(id: string) {
    try {
      await atualizarStatusSolicitacao(id, "em_analise");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao iniciar diagnóstico.");
    }
  }

  async function handleConcluirDiagnostico(id: string) {
    try {
      await atualizarStatusSolicitacao(id, "aprovada");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao concluir diagnóstico.");
    }
  }

  async function handleRejeitar(id: string) {
    const motivo = prompt("Motivo da rejeição:");
    if (!motivo) return;
    try {
      await rejeitarSolicitacao(id, motivo);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao rejeitar solicitação.");
    }
  }

  async function handleEncaminharExterna(id: string) {
    if (!confirm("Confirmar encaminhamento para oficina externa?")) return;
    try {
      await atualizarStatusSolicitacao(id, "convertida");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao encaminhar para oficina externa.");
    }
  }

  async function handleCriarSolicitacao(e: React.FormEvent) {
    e.preventDefault();
    if (!formVeiculo || !formTitulo || !formDescricao) return;
    try {
      await criarSolicitacao({
        veiculo_id: formVeiculo,
        categoria: formCategoria,
        titulo: formTitulo,
        descricao: formDescricao,
        prioridade: formPrioridade,
        origem: "admin",
      });
      setShowNovaSolicitacao(false);
      setFormVeiculo("");
      setFormTitulo("");
      setFormDescricao("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar solicitação.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Solicitações"
        description="Inbox de solicitações de manutenção"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowNovaSolicitacao(!showNovaSolicitacao)} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
              + Nova Solicitação
            </button>
            <Link href="/oficina/ordens" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">
              Abrir Oficina
            </Link>
          </div>
        }
      />

      {/* Form Nova Solicitação */}
      {origem === "preventiva" ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Você chegou aqui por um plano preventivo. Registre a solicitação e siga com o diagnóstico para decidir entre Oficina interna ou externa.
        </div>
      ) : null}

      {showNovaSolicitacao && (
        <form onSubmit={handleCriarSolicitacao} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">Nova Solicitação (Admin)</h3>
          <div className="grid md:grid-cols-4 gap-3">
            <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={formVeiculo} onChange={e => setFormVeiculo(e.target.value)} required>
              <option value="">Veículo</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</option>)}
            </select>
            <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={formCategoria} onChange={e => setFormCategoria(e.target.value)}>
              {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={formPrioridade} onChange={e => setFormPrioridade(e.target.value)}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Título" value={formTitulo} onChange={e => setFormTitulo(e.target.value)} required />
          </div>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" rows={2} placeholder="Descrição detalhada" value={formDescricao} onChange={e => setFormDescricao(e.target.value)} required />
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">Criar Solicitação</button>
            <button type="button" onClick={() => setShowNovaSolicitacao(false)} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">Cancelar</button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-3 gap-3">
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Buscar por título, descrição, veículo, motorista..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(SOLICITACAO_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhuma solicitação encontrada.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtradas.map(s => (
              <div key={s.id} className="p-4 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{s.titulo}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${SOLICITACAO_STATUS_COLORS[s.status]}`}>{SOLICITACAO_STATUS_LABELS[s.status]}</span>
                      {s.categoria && <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">{CATEGORIA_LABELS[s.categoria]}</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 truncate">{s.descricao}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>🚗 {s.veiculos?.placa ?? "—"}</span>
                      <span>👤 {s.motoristas?.nome ?? "Admin"}</span>
                      <span>📅 {new Date(s.created_at).toLocaleString("pt-BR")}</span>
                      {s.km_atual && <span>📏 {s.km_atual.toLocaleString("pt-BR")} km</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {s.status === "nova" ? (
                      <button onClick={() => handleIniciarDiagnostico(s.id)} className="px-3 py-1.5 text-xs border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50">
                        Iniciar diagnóstico
                      </button>
                    ) : null}

                    {s.status === "em_analise" ? (
                      <>
                        <button onClick={() => handleConcluirDiagnostico(s.id)} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-500">Concluir diagnóstico</button>
                        <button onClick={() => handleRejeitar(s.id)} className="px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded-md hover:bg-red-50">Rejeitar</button>
                      </>
                    ) : null}

                    {s.status === "aprovada" ? (
                      <>
                        <Link href={`/oficina/nova-ot?origem=manutencao&sol=${s.id}`} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-500">Encaminhar p/ Oficina</Link>
                        <button onClick={() => handleEncaminharExterna(s.id)} className="px-3 py-1.5 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50">Encaminhar Externa</button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}