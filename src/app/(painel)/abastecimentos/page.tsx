"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";

type Veiculo = { id: string; placa: string; combustivel: string | null };
type ProdutoCombustivel = { id: string; nome: string; unidade: string | null };
type Deposito = { id: string; nome: string };

type Abastecimento = {
  id: string;
  veiculo_id: string | null;
  placa: string | null;
  km: number | null;
  litros: number | null;
  valor: number | null;
  tipo: "interna" | "externa";
  data_abastecimento: string;
  media_km_l: number | null;
};

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const FORMAS_PAGAMENTO = ["avista", "pix", "boleto", "cartao", "dinheiro"] as const;

function traduzirErroAbastecimento(raw: unknown) {
  const err = (raw ?? {}) as SupabaseLikeError;
  const base = [err.message, err.details, err.hint].filter(Boolean).join(" | ") || "Erro ao salvar abastecimento";

  const msg = String(err.message ?? "").toLowerCase();
  if (msg.includes("function") && msg.includes("does not exist")) {
    return "Função de abastecimento ainda não existe no banco. Aplique a migration 20260309061000_abastecimentos_manual_modulo.sql.";
  }
  if (msg.includes("origem_invalida")) return "Origem inválida. Escolha abastecimento interna ou externa.";
  if (msg.includes("km_invalido")) return "KM inválido. Informe um valor maior que zero.";
  if (msg.includes("litros_invalidos")) return "Litros inválidos. Informe um valor maior que zero.";
  if (msg.includes("valor_obrigatorio_externo")) return "Para abastecimento externo, informe o valor total.";
  if (msg.includes("forma_pagamento_invalida")) return "Forma de pagamento inválida para abastecimento externo.";
  if (msg.includes("produto_deposito_obrigatorio_interno")) return "Para abastecimento interno, selecione produto e depósito.";
  if (msg.includes("saldo_insuficiente_estoque")) return "Saldo insuficiente no estoque para abastecimento interno.";
  if (msg.includes("veiculo_not_found")) return "Veículo não encontrado para a sua empresa.";
  if (msg.includes("not_authenticated")) return "Sessão expirada. Faça login novamente e tente salvar.";

  return base;
}

export default function AbastecimentosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCombustivel[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [lista, setLista] = useState<Abastecimento[]>([]);

  const hoje = new Date().toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);

  const [form, setForm] = useState({
    origem: "externa" as "interna" | "externa",
    veiculo_id: "",
    km: "",
    litros: "",
    valor: "",
    forma_pagamento: "pix",
    produto_id: "",
    deposito_id: "",
    data_abastecimento: hoje,
    observacao: "",
  });

  const combustivelSelecionado = useMemo(() => {
    const v = veiculos.find((x) => x.id === form.veiculo_id);
    return v?.combustivel ?? null;
  }, [veiculos, form.veiculo_id]);

  async function carregarBase() {
    const [{ data: vData }, { data: pData }, { data: dData }] = await Promise.all([
      supabase.from("veiculos").select("id, placa, combustivel").eq("status", "ativo").order("placa"),
      supabase.from("produtos").select("id, nome, unidade").eq("ativo", true).eq("tipo_item", "combustivel").order("nome"),
      supabase.from("depositos").select("id, nome").eq("ativo", true).order("nome"),
    ]);

    setVeiculos((vData as Veiculo[]) ?? []);
    setProdutos((pData as ProdutoCombustivel[]) ?? []);
    setDepositos((dData as Deposito[]) ?? []);
  }

  async function carregarLista() {
    const { data, error } = await supabase.rpc("listar_abastecimentos", {
      p_data_inicio: dataInicio || null,
      p_data_fim: dataFim || null,
      p_limite: 300,
    });

    if (error) throw error;
    setLista((data as Abastecimento[]) ?? []);
  }

  async function carregarTudo() {
    setLoading(true);
    setErro(null);
    try {
      await Promise.all([carregarBase(), carregarLista()]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function filtrar() {
    setErro(null);
    try {
      await carregarLista();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao filtrar lista");
    }
  }

  async function salvarManual(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);

    try {
      const payload = {
        p_veiculo_id: form.veiculo_id,
        p_origem: form.origem,
        p_km: Number(form.km),
        p_litros: Number(form.litros),
        p_valor: form.origem === "externa" ? Number(form.valor) : null,
        p_forma_pagamento: form.origem === "externa" ? form.forma_pagamento : null,
        p_data_abastecimento: `${form.data_abastecimento}T12:00:00.000Z`,
        p_produto_id: form.origem === "interna" ? form.produto_id : null,
        p_deposito_id: form.origem === "interna" ? form.deposito_id : null,
        p_observacao: form.observacao || null,
      };

      const { error } = await supabase.rpc("registrar_abastecimento_manual", payload);
      if (error) throw error;

      setOpenModal(false);
      setForm((prev) => ({
        ...prev,
        km: "",
        litros: "",
        valor: "",
        observacao: "",
      }));
      await carregarLista();
    } catch (e) {
      setErro(traduzirErroAbastecimento(e));
    } finally {
      setSaving(false);
    }
  }

  const fmtMoeda = (v?: number | null) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abastecimentos"
        description="Lançamentos manuais internos e externos com reflexo em financeiro e estoque."
        actions={
          <button
            onClick={() => setOpenModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + Adicionar manualmente
          </button>
        }
      />

      {erro && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Data inicial</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Data final</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={filtrar} className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50">Filtrar</button>
            <button onClick={() => void carregarTudo()} className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50">Recarregar</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900 mb-3">Últimos abastecimentos</h2>
        {loading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhum abastecimento no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2 pr-4">Placa</th>
                  <th className="py-2 pr-4">KM</th>
                  <th className="py-2 pr-4">Litros</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Média (km/l)</th>
                  <th className="py-2 pr-0">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-900">{a.placa ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-700">{a.km ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-700">{a.litros ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-1 rounded text-xs border ${a.tipo === "interna" ? "border-indigo-200 text-indigo-700 bg-indigo-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                        {a.tipo}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">{new Date(a.data_abastecimento).toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 pr-4 text-slate-700">
                      {a.media_km_l === null ? <span className="text-slate-400">— (primeiro registro)</span> : a.media_km_l}
                    </td>
                    <td className="py-2 pr-0 text-slate-700">{a.tipo === "externa" ? fmtMoeda(a.valor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <form onSubmit={salvarManual} className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Novo abastecimento manual</h3>

            <div className="flex gap-4">
              <label className="text-sm flex items-center gap-2">
                <input type="radio" checked={form.origem === "interna"} onChange={() => setForm((p) => ({ ...p, origem: "interna" }))} />
                Interna
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" checked={form.origem === "externa"} onChange={() => setForm((p) => ({ ...p, origem: "externa" }))} />
                Externa
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Veículo *</label>
                <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.veiculo_id} onChange={(e) => setForm((p) => ({ ...p, veiculo_id: e.target.value }))} required>
                  <option value="">— Selecione —</option>
                  {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Combustível (veículo)</label>
                <div className="w-full border border-slate-200 rounded-md px-3 py-2 bg-slate-50 text-slate-700">
                  {combustivelSelecionado ?? "—"}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">KM *</label>
                <input type="number" min="1" step="1" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.km} onChange={(e) => setForm((p) => ({ ...p, km: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Litros *</label>
                <input type="number" min="0.01" step="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.litros} onChange={(e) => setForm((p) => ({ ...p, litros: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Data *</label>
                <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.data_abastecimento} onChange={(e) => setForm((p) => ({ ...p, data_abastecimento: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Observação</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.observacao} onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} />
              </div>

              {form.origem === "externa" ? (
                <>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Valor *</label>
                    <input type="number" min="0.01" step="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Forma de pagamento *</label>
                    <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.forma_pagamento} onChange={(e) => setForm((p) => ({ ...p, forma_pagamento: e.target.value }))} required>
                      {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Produto combustível *</label>
                    <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.produto_id} onChange={(e) => setForm((p) => ({ ...p, produto_id: e.target.value }))} required>
                      <option value="">— Selecione —</option>
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.unidade ? ` (${p.unidade})` : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Depósito *</label>
                    <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.deposito_id} onChange={(e) => setForm((p) => ({ ...p, deposito_id: e.target.value }))} required>
                      <option value="">— Selecione —</option>
                      {depositos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 rounded-md border border-slate-300" onClick={() => setOpenModal(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar abastecimento"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
