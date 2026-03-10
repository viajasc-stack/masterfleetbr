"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Manutencao = {
  id: string;
  numero: number | null;
  tipo: string;
  descricao: string;
  status: string;
  urgencia: string | null;
  categoria: string | null;
  data_prevista: string | null;
  custo_total: number | null;
  triagem_notas: string | null;
  diagnostico_tecnico: string | null;
  causa_raiz: string | null;
  previsao_custo: number | null;
  aprovacao_status: string | null;
  veiculos: { placa: string; modelo: string | null } | null;
};

type Item = {
  id: string;
  status: string;
  quantidade_solicitada: number;
  quantidade_reservada: number;
  quantidade_aplicada: number;
  valor_total: number | null;
  produtos: { nome: string; unidade: string } | null;
};

const STATUS_OPTIONS = [
  "pendente",
  "em_triagem",
  "em_analise",
  "analisada",
  "aguardando_aprovacao",
  "aguardando_pecas",
  "pecas_reservadas",
  "programada",
  "em_andamento",
  "pausada",
  "concluida",
  "concluida_observacao",
  "concluida_parcial",
  "sem_solucao_tecnica",
  "cancelada",
];

export default function DetalheManutencaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [m, setM] = useState<Manutencao | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [produtos, setProdutos] = useState<Array<{ id: string; nome: string; unidade: string }>>([]);
  const [depositos, setDepositos] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [statusNovo, setStatusNovo] = useState("em_triagem");
  const [triagemNotas, setTriagemNotas] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [causaRaiz, setCausaRaiz] = useState("");
  const [previsaoCusto, setPrevisaoCusto] = useState("");
  const [aprovacaoStatus, setAprovacaoStatus] = useState("aprovada");

  const [produtoId, setProdutoId] = useState("");
  const [depositoId, setDepositoId] = useState("");
  const [quantidade, setQuantidade] = useState("");

  async function load() {
    setLoading(true);
    const [man, itensResp, produtosResp, depositosResp] = await Promise.all([
      supabase.from("manutencoes").select("*, veiculos(placa, modelo)").eq("id", id).maybeSingle(),
      supabase.from("manutencao_itens").select("id,status,quantidade_solicitada,quantidade_reservada,quantidade_aplicada,valor_total,produtos(nome,unidade)").eq("manutencao_id", id).order("created_at", { ascending: false }),
      supabase.from("produtos").select("id,nome,unidade").eq("ativo", true).order("nome"),
      supabase.from("depositos").select("id,nome").eq("ativo", true).order("nome"),
    ]);

    if (!man.data) {
      router.replace("/manutencao");
      return;
    }

    const manut = man.data as unknown as Manutencao;
    setM(manut);
    setStatusNovo(manut.status || "em_triagem");
    setTriagemNotas(manut.triagem_notas ?? "");
    setDiagnostico(manut.diagnostico_tecnico ?? "");
    setCausaRaiz(manut.causa_raiz ?? "");
    setPrevisaoCusto(manut.previsao_custo != null ? String(manut.previsao_custo) : "");
    setAprovacaoStatus(manut.aprovacao_status === "reprovada" ? "reprovada" : "aprovada");

    setItens((itensResp.data as Item[] | null) ?? []);
    setProdutos((produtosResp.data as Array<{ id: string; nome: string; unidade: string }> | null) ?? []);
    setDepositos((depositosResp.data as Array<{ id: string; nome: string }> | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function atualizarStatus() {
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_atualizar_status", {
      p_manutencao_id: id,
      p_novo_status: statusNovo,
      p_observacoes: null,
    });
    if (error) await supabase.from("manutencoes").update({ status: statusNovo }).eq("id", id);
    await load();
    setSaving(false);
  }

  async function salvarDiagnostico() {
    setSaving(true);
    await supabase
      .from("manutencoes")
      .update({
        triagem_notas: triagemNotas || null,
        diagnostico_tecnico: diagnostico || null,
        causa_raiz: causaRaiz || null,
        previsao_custo: previsaoCusto ? Number(previsaoCusto) : null,
      })
      .eq("id", id);
    await load();
    setSaving(false);
  }

  async function salvarAprovacao() {
    setSaving(true);
    await supabase
      .from("manutencoes")
      .update({
        aprovacao_status: aprovacaoStatus,
        status: aprovacaoStatus === "aprovada" ? "programada" : "reprovada",
      })
      .eq("id", id);
    await load();
    setSaving(false);
  }

  async function reservarItem() {
    if (!produtoId || !depositoId || !quantidade) return;
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_reservar_item", {
      p_manutencao_id: id,
      p_produto_id: produtoId,
      p_deposito_id: depositoId,
      p_quantidade: Number(quantidade),
      p_valor_unitario: null,
      p_observacoes: null,
    });
    if (error) alert(error.message);
    setQuantidade("");
    await load();
    setSaving(false);
  }

  async function aplicarItem(itemId: string) {
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_aplicar_item", {
      p_item_id: itemId,
      p_quantidade: null,
    });
    if (error) alert(error.message);
    await load();
    setSaving(false);
  }

  async function cancelarItem(itemId: string) {
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_cancelar_reserva_item", {
      p_item_id: itemId,
      p_observacao: "Cancelada via painel",
    });
    if (error) alert(error.message);
    await load();
    setSaving(false);
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando...</div>;
  if (!m) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manutencao" className="text-sm text-slate-500 hover:text-slate-900">← Manutenção</Link>
        <h1 className="text-xl font-semibold text-slate-900">
          {m.numero ? `MNT-${String(m.numero).padStart(5, "0")}` : "Manutenção"} • {m.veiculos?.placa ?? "—"}
        </h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm grid md:grid-cols-4 gap-3">
        <div><span className="text-slate-500">Status</span><div className="font-medium">{m.status.replaceAll("_", " ")}</div></div>
        <div><span className="text-slate-500">Urgência</span><div>{m.urgencia ?? "—"}</div></div>
        <div><span className="text-slate-500">Categoria</span><div>{m.categoria ?? "—"}</div></div>
        <div><span className="text-slate-500">Custo total</span><div className="font-semibold">{Number(m.custo_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div></div>
        <div className="md:col-span-4"><span className="text-slate-500">Descrição</span><div>{m.descricao}</div></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-sm">
        <h2 className="font-semibold">Fluxo</h2>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={statusNovo} onChange={(e) => setStatusNovo(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <button onClick={atualizarStatus} disabled={saving} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              Atualizar status
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-sm">
        <h2 className="font-semibold">Triagem / Diagnóstico / Aprovação</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <textarea className="border border-slate-300 rounded-md px-3 py-2" rows={3} placeholder="Notas de triagem" value={triagemNotas} onChange={(e) => setTriagemNotas(e.target.value)} />
          <textarea className="border border-slate-300 rounded-md px-3 py-2" rows={3} placeholder="Diagnóstico técnico" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
          <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Causa raiz" value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} />
          <input type="number" step="0.01" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Previsão de custo" value={previsaoCusto} onChange={(e) => setPrevisaoCusto(e.target.value)} />
          <select className="border border-slate-300 rounded-md px-3 py-2" value={aprovacaoStatus} onChange={(e) => setAprovacaoStatus(e.target.value)}>
            <option value="aprovada">Aprovada</option>
            <option value="reprovada">Reprovada</option>
            <option value="aprovada_parcial">Aprovada parcial</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={salvarDiagnostico} disabled={saving} className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60">Salvar diagnóstico</button>
          <button onClick={salvarAprovacao} disabled={saving} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">Salvar aprovação</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-sm">
        <h2 className="font-semibold">Estoque da manutenção</h2>
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <select className="border border-slate-300 rounded-md px-3 py-2" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
            <option value="">Produto</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={depositoId} onChange={(e) => setDepositoId(e.target.value)}>
            <option value="">Depósito</option>
            {depositos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <input type="number" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Quantidade" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          <button onClick={reservarItem} disabled={saving} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">Reservar item</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Produto</th>
                <th className="py-2 pr-4">Solic.</th>
                <th className="py-2 pr-4">Reserv.</th>
                <th className="py-2 pr-4">Aplic.</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Valor</th>
                <th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{i.produtos?.nome ?? "—"}</td>
                  <td className="py-2 pr-4">{i.quantidade_solicitada}</td>
                  <td className="py-2 pr-4">{i.quantidade_reservada}</td>
                  <td className="py-2 pr-4">{i.quantidade_aplicada}</td>
                  <td className="py-2 pr-4">{i.status}</td>
                  <td className="py-2 pr-4">{Number(i.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="py-2 flex gap-2">
                    {(i.status === "reservado" || i.status === "solicitado") && <button onClick={() => aplicarItem(i.id)} className="px-2 py-1 border border-emerald-300 text-emerald-700 rounded-md hover:bg-emerald-50">Aplicar</button>}
                    {(i.status === "reservado" || i.status === "solicitado") && <button onClick={() => cancelarItem(i.id)} className="px-2 py-1 border border-red-300 text-red-700 rounded-md hover:bg-red-50">Cancelar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
