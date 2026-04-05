"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchOrdemDetalhe, fetchPecasDaOrdem, fetchServicosDaOrdem, adicionarPecaNaOrdem, adicionarServicoNaOrdem, finalizarOrdem, loadVeiculosAtivos, loadMotoristasAtivos, loadFornecedoresAtivos, loadProdutosAtivos, loadLocaisEstoque, loadTiposServico, dataBR } from "@/lib/manutencao";
import type { ManutencaoOrdem, ManutencaoOrdemPeca, ManutencaoOrdemServico } from "@/types/manutencao.types";
import { STATUS_COLORS, STATUS_LABELS, PRIORIDADE_COLORS, PRIORIDADE_LABELS } from "@/types/manutencao.types";

type Aba = "dados" | "diagnostico" | "pecas" | "servicos" | "checklist";
type SelectOption = { id: string; nome?: string | null; placa?: string | null; modelo?: string | null };

export default function OrdemDetalhePage() {
  const params = useParams<{ id: string }>();
  useRouter();
  const [ordem, setOrdem] = useState<ManutencaoOrdem | null>(null);
  const [pecas, setPecas] = useState<ManutencaoOrdemPeca[]>([]);
  const [servicos, setServicos] = useState<ManutencaoOrdemServico[]>([]);
  const [aba, setAba] = useState<Aba>("dados");
  const [loading, setLoading] = useState(true);

  // Form peça
  const [pecaProduto, setPecaProduto] = useState("");
  const [pecaLocal, setPecaLocal] = useState("");
  const [pecaQtd, setPecaQtd] = useState("1");
  const [pecaOrigem, setPecaOrigem] = useState("estoque");

  // Form serviço
  const [srvTipo, setSrvTipo] = useState("");
  const [srvDesc, setSrvDesc] = useState("");
  const [srvHoras, setSrvHoras] = useState("1");

  // Form diagnóstico
  const [diagnostico, setDiagnostico] = useState("");
  const [causaRaiz, setCausaRaiz] = useState("");
  const [solucao, setSolucao] = useState("");

  // Options
  const [produtos, setProdutos] = useState<SelectOption[]>([]);
  const [locais, setLocais] = useState<SelectOption[]>([]);
  const [tiposServico, setTiposServico] = useState<SelectOption[]>([]);
  const [veiculos, setVeiculos] = useState<SelectOption[]>([]);
  const [motoristas, setMotoristas] = useState<SelectOption[]>([]);
  const [fornecedores, setFornecedores] = useState<SelectOption[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordemData, pecasData, servicosData, produtosData, locaisData, tiposData, veiculosData, motoristasData, fornecedoresData] = await Promise.all([
        fetchOrdemDetalhe(params.id),
        fetchPecasDaOrdem(params.id),
        fetchServicosDaOrdem(params.id),
        loadProdutosAtivos(),
        loadLocaisEstoque(),
        loadTiposServico(),
        loadVeiculosAtivos(),
        loadMotoristasAtivos(),
        loadFornecedoresAtivos(),
      ]);
      setOrdem(ordemData);
      setPecas(pecasData);
      setServicos(servicosData);
      setProdutos(produtosData);
      setLocais(locaisData);
      setTiposServico(tiposData);
      setVeiculos(veiculosData);
      setMotoristas(motoristasData);
      setFornecedores(fornecedoresData);
      if (ordemData) {
        setDiagnostico(ordemData.diagnostico ?? "");
        setCausaRaiz(ordemData.causa_raiz ?? "");
        setSolucao(ordemData.solucao_aplicada ?? "");
      }
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSalvarDiagnostico() {
    if (!ordem) return;
    const { supabase } = await import("@/lib/supabase/client");
    await supabase.from("manutencao_ordens").update({ diagnostico, causa_raiz: causaRaiz, solucao_aplicada: solucao }).eq("id", ordem.id);
    await loadData();
    alert("Diagnóstico salvo!");
  }

  async function handleAddPeca() {
    if (!ordem || !pecaProduto || !pecaQtd) return;
    try {
      await adicionarPecaNaOrdem({
        ordem_id: ordem.id,
        produto_id: pecaProduto,
        local_estoque_id: pecaLocal || null,
        quantidade: Number(pecaQtd),
        valor_unitario: 0,
        origem: pecaOrigem,
      });
      setPecaProduto("");
      setPecaQtd("1");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao adicionar peça.");
    }
  }

  async function handleAddServico() {
    if (!ordem) return;
    try {
      await adicionarServicoNaOrdem({
        ordem_id: ordem.id,
        tipo_servico_id: srvTipo || null,
        descricao: srvDesc || null,
        quantidade_horas: Number(srvHoras),
        valor_hora: 0,
      });
      setSrvTipo("");
      setSrvDesc("");
      setSrvHoras("1");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao adicionar serviço.");
    }
  }

  async function handleFinalizar() {
    if (!ordem) return;
    if (!confirm("Finalizar esta ordem de serviço?")) return;
    try {
      await finalizarOrdem({
        ordem_id: ordem.id,
        solucao_aplicada: solucao || null,
        km_saida: ordem.km_saida ?? null,
      });
      await loadData();
      alert("OS finalizada com sucesso!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao finalizar ordem.");
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;
  if (!ordem) return <div className="p-8 text-center text-slate-500">Ordem não encontrada.</div>;

  const abas: { key: Aba; label: string }[] = [
    { key: "dados", label: "Dados Gerais" },
    { key: "diagnostico", label: "Diagnóstico" },
    { key: "pecas", label: "Peças" },
    { key: "servicos", label: "Serviços" },
    { key: "checklist", label: "Checklist" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`OS Manutenção #${ordem.id.slice(0, 8)}`}
        description={`${ordem.veiculos?.placa ?? "—"} • ${ordem.tipo} • ${ordem.categoria ?? "Sem categoria"}`}
        actions={
          <div className="flex gap-2">
            <Link href="/manutencao/ordens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">Voltar</Link>
            {ordem.status !== "finalizada" && (
              <button onClick={handleFinalizar} className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-500 text-sm">Finalizar OS</button>
            )}
          </div>
        }
      />

      {/* Status e Prioridade */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 text-sm rounded-full border ${STATUS_COLORS[ordem.status]}`}>{STATUS_LABELS[ordem.status]}</span>
        <span className={`px-3 py-1 text-sm rounded-full ${PRIORIDADE_COLORS[ordem.prioridade]}`}>{PRIORIDADE_LABELS[ordem.prioridade]}</span>
        <span className="text-sm text-slate-500">Aberta em {dataBR(ordem.created_at)}</span>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-slate-200">
        {abas.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${aba === a.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Dados Gerais */}
      {aba === "dados" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-500">Veículo</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={ordem.veiculo_id} onChange={async e => {
                const { supabase } = await import("@/lib/supabase/client");
                await supabase.from("manutencao_ordens").update({ veiculo_id: e.target.value }).eq("id", ordem.id);
                await loadData();
              }}>
                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-500">Motorista</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={ordem.motorista_id ?? ""} onChange={async e => {
                const { supabase } = await import("@/lib/supabase/client");
                await supabase.from("manutencao_ordens").update({ motorista_id: e.target.value || null }).eq("id", ordem.id);
                await loadData();
              }}>
                <option value="">Sem motorista</option>
                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-500">Status</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={ordem.status} onChange={async e => {
                const { supabase } = await import("@/lib/supabase/client");
                await supabase.from("manutencao_ordens").update({ status: e.target.value }).eq("id", ordem.id);
                await loadData();
              }}>
                {Object.keys(STATUS_LABELS).map(s => <option key={s} value={s}>{STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-500">KM Entrada</label>
              <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={ordem.km_entrada ?? ""} onChange={async e => {
                const { supabase } = await import("@/lib/supabase/client");
                await supabase.from("manutencao_ordens").update({ km_entrada: e.target.value ? Number(e.target.value) : null }).eq("id", ordem.id);
                await loadData();
              }} />
            </div>
            <div>
              <label className="text-sm text-slate-500">KM Saída</label>
              <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={ordem.km_saida ?? ""} onChange={async e => {
                const { supabase } = await import("@/lib/supabase/client");
                await supabase.from("manutencao_ordens").update({ km_saida: e.target.value ? Number(e.target.value) : null }).eq("id", ordem.id);
                await loadData();
              }} />
            </div>
            <div>
              <label className="text-sm text-slate-500">Oficina/Fornecedor</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" value={ordem.fornecedor_id ?? ""} onChange={async e => {
                const { supabase } = await import("@/lib/supabase/client");
                await supabase.from("manutencao_ordens").update({ fornecedor_id: e.target.value || null }).eq("id", ordem.id);
                await loadData();
              }}>
                <option value="">Oficina interna</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Diagnóstico */}
      {aba === "diagnostico" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Diagnóstico</label>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" rows={3} value={diagnostico} onChange={e => setDiagnostico(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Causa Raiz</label>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" rows={2} value={causaRaiz} onChange={e => setCausaRaiz(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Solução Aplicada</label>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 mt-1 text-sm" rows={3} value={solucao} onChange={e => setSolucao(e.target.value)} />
          </div>
          <button onClick={handleSalvarDiagnostico} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">Salvar Diagnóstico</button>
        </div>
      )}

      {/* Peças */}
      {aba === "pecas" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={pecaProduto} onChange={e => setPecaProduto(e.target.value)}>
              <option value="">Produto</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={pecaLocal} onChange={e => setPecaLocal(e.target.value)}>
              <option value="">Local estoque</option>
              {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <input type="number" className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Qtd" value={pecaQtd} onChange={e => setPecaQtd(e.target.value)} min="1" />
            <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={pecaOrigem} onChange={e => setPecaOrigem(e.target.value)}>
              <option value="estoque">Estoque</option>
              <option value="compra_direta">Compra direta</option>
            </select>
          </div>
          <button onClick={handleAddPeca} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">Adicionar Peça</button>

          {pecas.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 bg-slate-50">
                  <th className="py-2 px-3">Produto</th>
                  <th className="py-2 px-3">Qtd</th>
                  <th className="py-2 px-3">Origem</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map(p => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 px-3">{p.produtos?.nome ?? "—"}</td>
                    <td className="py-2 px-3">{p.quantidade}</td>
                    <td className="py-2 px-3">{p.origem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Serviços */}
      {aba === "servicos" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={srvTipo} onChange={e => setSrvTipo(e.target.value)}>
              <option value="">Tipo de serviço</option>
              {tiposServico.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Descrição" value={srvDesc} onChange={e => setSrvDesc(e.target.value)} />
            <input type="number" className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Horas" value={srvHoras} onChange={e => setSrvHoras(e.target.value)} min="0.5" step="0.5" />
          </div>
          <button onClick={handleAddServico} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">Adicionar Serviço</button>

          {servicos.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 bg-slate-50">
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3">Horas</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map(s => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 px-3">{s.tipos_servico?.nome ?? "—"}</td>
                    <td className="py-2 px-3">{s.descricao ?? "—"}</td>
                    <td className="py-2 px-3">{s.quantidade_horas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Checklist */}
      {aba === "checklist" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-500">Checklist de entrada e saída será implementado aqui.</p>
        </div>
      )}
    </div>
  );
}