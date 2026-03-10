"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Manutencao = {
  id: string;
  numero: number | null;
  status: string;
  urgencia: string | null;
  tipo: string;
  descricao: string;
  diagnostico_tecnico: string | null;
  causa_raiz: string | null;
  triagem_notas: string | null;
  previsao_custo: number | null;
  custo_total: number | null;
  veiculos: { placa: string | null; modelo: string | null } | null;
};

type EstoqueLinha = {
  produto_id: string;
  deposito_id: string | null;
  quantidade: number;
  produtos: { id: string; nome: string; unidade: string } | null;
  depositos: { id: string; nome: string } | null;
};

type ProdutoBusca = {
  id: string;
  nome: string;
  unidade: string;
};

type ItemManutencao = {
  id: string;
  status: string;
  quantidade_solicitada: number;
  quantidade_reservada: number;
  quantidade_aplicada: number;
  valor_total: number | null;
  produtos: { nome: string; unidade: string } | null;
  depositos: { nome: string } | null;
};

const STATUS_ABERTOS = [
  "pendente",
  "em_triagem",
  "em_analise",
  "analisada",
  "aguardando_aprovacao",
  "aguardando_pecas",
  "programada",
  "em_andamento",
  "pausada",
  "pecas_reservadas",
];

export default function ManutencaoOficinaPage() {
  const [lista, setLista] = useState<Manutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selecionadaId, setSelecionadaId] = useState<string>("");

  const [triagem, setTriagem] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [causa, setCausa] = useState("");
  const [previsao, setPrevisao] = useState("");

  const [buscaPeca, setBuscaPeca] = useState("");
  const [estoque, setEstoque] = useState<EstoqueLinha[]>([]);
  const [produtosBusca, setProdutosBusca] = useState<ProdutoBusca[]>([]);
  const [qtdReservar, setQtdReservar] = useState("");
  const [itensManutencao, setItensManutencao] = useState<ItemManutencao[]>([]);

  const [compraDescricao, setCompraDescricao] = useState("");
  const [compraQtd, setCompraQtd] = useState("");
  const [compraValor, setCompraValor] = useState("");

  const [kmFinal, setKmFinal] = useState("");
  const [custoMaoObra, setCustoMaoObra] = useState("");
  const [custoTerceiros, setCustoTerceiros] = useState("");
  const [custoExtras, setCustoExtras] = useState("");

  function aplicarSelecao(id: string, rows: Manutencao[]) {
    setSelecionadaId(id);
    const item = rows.find((r) => r.id === id) ?? null;
    setTriagem(item?.triagem_notas ?? "");
    setDiagnostico(item?.diagnostico_tecnico ?? "");
    setCausa(item?.causa_raiz ?? "");
    setPrevisao(item?.previsao_custo != null ? String(item.previsao_custo) : "");
  }

  async function carregar() {
    setLoading(true);
    const [{ data }, { data: saldoData }] = await Promise.all([
      supabase
        .from("manutencoes")
        .select("id,numero,status,urgencia,tipo,descricao,diagnostico_tecnico,causa_raiz,triagem_notas,previsao_custo,custo_total,veiculos(placa,modelo)")
        .in("status", STATUS_ABERTOS)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("saldos_estoque")
        .select("produto_id, deposito_id, quantidade, produtos(id,nome,unidade), depositos(id,nome)")
        .gt("quantidade", 0)
        .order("updated_at", { ascending: false })
        .limit(300),
    ]);

    const rows = (data as Manutencao[] | null) ?? [];
    setLista(rows);
    setEstoque((saldoData as EstoqueLinha[] | null) ?? []);

    const fallback = rows[0]?.id ?? "";
    const keep = selecionadaId && rows.some((r) => r.id === selecionadaId) ? selecionadaId : fallback;
    aplicarSelecao(keep, rows);

    if (keep) {
      const { data: itens } = await supabase
        .from("manutencao_itens")
        .select("id,status,quantidade_solicitada,quantidade_reservada,quantidade_aplicada,valor_total,produtos(nome,unidade),depositos(nome)")
        .eq("manutencao_id", keep)
        .order("created_at", { ascending: false });
      setItensManutencao((itens as ItemManutencao[] | null) ?? []);
    } else {
      setItensManutencao([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selecionada = useMemo(
    () => lista.find((l) => l.id === selecionadaId) ?? null,
    [lista, selecionadaId]
  );

  async function mudarStatus(novoStatus: string) {
    if (!selecionada) return;
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_atualizar_status", {
      p_manutencao_id: selecionada.id,
      p_novo_status: novoStatus,
      p_observacoes: null,
    });

    if (error) {
      await supabase.from("manutencoes").update({ status: novoStatus }).eq("id", selecionada.id);
    }

    await carregar();
    setSaving(false);
  }

  async function salvarDiagnostico() {
    if (!selecionada) return;
    setSaving(true);
    await supabase
      .from("manutencoes")
      .update({
        triagem_notas: triagem || null,
        diagnostico_tecnico: diagnostico || null,
        causa_raiz: causa || null,
        previsao_custo: previsao ? Number(previsao) : null,
      })
      .eq("id", selecionada.id);
    await carregar();
    setSaving(false);
  }

  async function concluirImediato() {
    if (!selecionada) return;
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_concluir", {
      p_manutencao_id: selecionada.id,
      p_status_final: "concluida",
      p_km_final: kmFinal ? Number(kmFinal) : null,
      p_custo_mao_obra: custoMaoObra ? Number(custoMaoObra) : null,
      p_custo_terceiros: custoTerceiros ? Number(custoTerceiros) : null,
      p_custo_extras: custoExtras ? Number(custoExtras) : null,
      p_recomendacao: "Conserto imediato executado em painel oficina",
      p_veiculo_liberado: true,
    });
    if (error) alert(error.message);
    await carregar();
    setSaving(false);
  }

  async function reservarNoPdv(linha: EstoqueLinha) {
    if (!selecionada || !qtdReservar || !linha.deposito_id) return;
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_reservar_item", {
      p_manutencao_id: selecionada.id,
      p_produto_id: linha.produto_id,
      p_deposito_id: linha.deposito_id,
      p_quantidade: Number(qtdReservar),
      p_valor_unitario: null,
      p_observacoes: "Reserva via PDV oficina",
    });
    if (error) alert(error.message);
    setQtdReservar("");
    await carregar();
    setSaving(false);
  }

  async function aplicarItem(itemId: string) {
    setSaving(true);
    const { error } = await supabase.rpc("rpc_manutencao_aplicar_item", {
      p_item_id: itemId,
      p_quantidade: null,
    });
    if (error) alert(error.message);
    await carregar();
    setSaving(false);
  }

  async function solicitarCompra() {
    if (!selecionada || !compraDescricao || !compraQtd) return;
    setSaving(true);
    const { error } = await supabase.from("manutencao_requisicoes_compra").insert({
      manutencao_id: selecionada.id,
      item_descricao: compraDescricao,
      quantidade: Number(compraQtd),
      valor_unitario_previsto: compraValor ? Number(compraValor) : null,
      valor_total_previsto: compraValor ? Number(compraValor) * Number(compraQtd) : null,
      status: "solicitada",
      observacoes: "Solicitação criada via PDV oficina",
    });
    if (error) alert(error.message);
    else {
      alert("Requisição de compra criada.");
      setCompraDescricao("");
      setCompraQtd("");
      setCompraValor("");
      await mudarStatus("aguardando_pecas");
    }
    setSaving(false);
  }

  function sugerirCompraProduto(linha: EstoqueLinha) {
    setCompraDescricao(linha.produtos?.nome ?? "Item sem nome");
    if (!compraQtd) setCompraQtd(qtdReservar || "1");
  }

  const estoqueFiltrado = useMemo(() => {
    const q = buscaPeca.trim().toLowerCase();
    if (!q) return estoque;
    return estoque.filter((e) =>
      `${e.produtos?.nome ?? ""} ${e.depositos?.nome ?? ""}`.toLowerCase().includes(q)
    );
  }, [estoque, buscaPeca]);

  useEffect(() => {
    const q = buscaPeca.trim();
    if (q.length < 2) {
      setProdutosBusca([]);
      return;
    }

    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id,nome,unidade")
        .eq("ativo", true)
        .ilike("nome", `%${q}%`)
        .order("nome")
        .limit(30);
      setProdutosBusca((data as ProdutoBusca[] | null) ?? []);
    }, 250);

    return () => clearTimeout(t);
  }, [buscaPeca]);

  const linhasPdv = useMemo(() => {
    const q = buscaPeca.trim();
    if (!q) return estoqueFiltrado;

    const map = new Map<string, EstoqueLinha[]>();
    for (const e of estoque) {
      const arr = map.get(e.produto_id) ?? [];
      arr.push(e);
      map.set(e.produto_id, arr);
    }

    const merged: EstoqueLinha[] = [];
    for (const p of produtosBusca) {
      const linhas = map.get(p.id);
      if (linhas && linhas.length > 0) {
        merged.push(...linhas);
      } else {
        merged.push({
          produto_id: p.id,
          deposito_id: null,
          quantidade: 0,
          produtos: { id: p.id, nome: p.nome, unidade: p.unidade },
          depositos: null,
        });
      }
    }

    return merged;
  }, [buscaPeca, estoqueFiltrado, estoque, produtosBusca]);

  return (
    <div className="min-h-[calc(100vh-120px)] grid grid-cols-12 gap-4">
      <aside className="col-span-12 lg:col-span-4 xl:col-span-3 bg-slate-950 text-slate-100 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-semibold">Oficina • OS manutenção</h1>
          <button onClick={carregar} className="text-xs border border-slate-700 px-2 py-1 rounded hover:bg-slate-800">Recarregar</button>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="text-sm text-slate-400">Sem OS abertas.</div>
        ) : (
          <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            {lista.map((m) => {
              const ativa = m.id === selecionadaId;
              return (
                <button
                  key={m.id}
                  onClick={() => aplicarSelecao(m.id, lista)}
                  className={`w-full text-left p-3 rounded-lg border ${ativa ? "border-cyan-400 bg-slate-800" : "border-slate-800 bg-slate-900 hover:bg-slate-800"}`}
                >
                  <div className="text-xs text-slate-400">{m.numero ? `MNT-${String(m.numero).padStart(5, "0")}` : "Sem nº"}</div>
                  <div className="font-medium">{m.veiculos?.placa ?? "—"} • {m.tipo}</div>
                  <div className="text-xs text-slate-400 truncate">{m.descricao}</div>
                  <div className="mt-1 text-[11px] text-cyan-300">{m.status.replaceAll("_", " ")}</div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <main className="col-span-12 lg:col-span-8 xl:col-span-9 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        {!selecionada ? (
          <div className="text-slate-600">Selecione uma OS de manutenção para iniciar.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">OS selecionada</div>
                <div className="text-xl font-semibold text-slate-900">
                  {selecionada.numero ? `MNT-${String(selecionada.numero).padStart(5, "0")}` : "Manutenção"} • {selecionada.veiculos?.placa ?? "—"}
                </div>
                <div className="text-sm text-slate-600">{selecionada.descricao}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Status atual</div>
                <div className="font-semibold text-cyan-700">{selecionada.status.replaceAll("_", " ")}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <button onClick={() => mudarStatus("em_analise")} disabled={saving} className="px-4 py-3 rounded-md bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 disabled:opacity-60">
                Iniciar diagnóstico
              </button>
              <button onClick={() => mudarStatus("em_andamento")} disabled={saving} className="px-4 py-3 rounded-md bg-blue-100 text-blue-900 border border-blue-200 hover:bg-blue-200 disabled:opacity-60">
                Iniciar manutenção
              </button>
              <button onClick={() => mudarStatus("aguardando_pecas")} disabled={saving} className="px-4 py-3 rounded-md bg-violet-100 text-violet-900 border border-violet-200 hover:bg-violet-200 disabled:opacity-60">
                Marcar aguardando peças
              </button>
              <button onClick={() => mudarStatus("pausada")} disabled={saving} className="px-4 py-3 rounded-md bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200 disabled:opacity-60">
                Pausar manutenção
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Triagem</label>
                <textarea value={triagem} onChange={(e) => setTriagem(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Diagnóstico técnico</label>
                <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Causa raiz</label>
                <input value={causa} onChange={(e) => setCausa(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Previsão de custo (R$)</label>
                <input type="number" step="0.01" value={previsao} onChange={(e) => setPrevisao(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2" />
              </div>
            </div>

            <div className="border rounded-xl border-slate-200 p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Peças e consumíveis (PDV)</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <input
                  value={buscaPeca}
                  onChange={(e) => setBuscaPeca(e.target.value)}
                  placeholder="Buscar peça/consumível..."
                  className="border border-slate-300 rounded-md px-3 py-2 md:col-span-2"
                />
                <input
                  type="number"
                  step="0.01"
                  value={qtdReservar}
                  onChange={(e) => setQtdReservar(e.target.value)}
                  placeholder="Qtd para reservar"
                  className="border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="max-h-56 overflow-auto border border-slate-200 rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b bg-slate-50">
                      <th className="py-2 px-2">Produto</th>
                      <th className="py-2 px-2">Depósito</th>
                      <th className="py-2 px-2">Saldo</th>
                      <th className="py-2 px-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasPdv.map((e) => (
                      <tr key={`${e.produto_id}-${e.deposito_id}`} className="border-b last:border-0">
                        <td className="py-2 px-2">{e.produtos?.nome ?? "—"}</td>
                        <td className="py-2 px-2">{e.depositos?.nome ?? "—"}</td>
                        <td className="py-2 px-2">{e.quantidade} {e.produtos?.unidade ?? ""}</td>
                        <td className="py-2 px-2">
                          {e.quantidade > 0 && e.deposito_id ? (
                            <button
                              onClick={() => reservarNoPdv(e)}
                              disabled={saving || !qtdReservar}
                              className="px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                            >
                              Reservar
                            </button>
                          ) : (
                            <button
                              onClick={() => sugerirCompraProduto(e)}
                              className="px-2 py-1 rounded border border-violet-200 text-violet-700 hover:bg-violet-50"
                            >
                              Sem saldo • solicitar compra
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Itens da OS (reservados/aplicados)</div>
                <div className="max-h-40 overflow-auto border border-slate-200 rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b bg-slate-50">
                        <th className="py-2 px-2">Item</th>
                        <th className="py-2 px-2">Reserv.</th>
                        <th className="py-2 px-2">Aplic.</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensManutencao.map((i) => (
                        <tr key={i.id} className="border-b last:border-0">
                          <td className="py-2 px-2">{i.produtos?.nome ?? "—"}</td>
                          <td className="py-2 px-2">{i.quantidade_reservada}</td>
                          <td className="py-2 px-2">{i.quantidade_aplicada}</td>
                          <td className="py-2 px-2">{i.status}</td>
                          <td className="py-2 px-2">
                            {(i.status === "reservado" || i.status === "solicitado") && (
                              <button
                                onClick={() => aplicarItem(i.id)}
                                disabled={saving}
                                className="px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                Dar baixa
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="border rounded-xl border-slate-200 p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Solicitar compra (se faltar peça)</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <input value={compraDescricao} onChange={(e) => setCompraDescricao(e.target.value)} placeholder="Descrição do item" className="border border-slate-300 rounded-md px-3 py-2" />
                <input type="number" value={compraQtd} onChange={(e) => setCompraQtd(e.target.value)} placeholder="Quantidade" className="border border-slate-300 rounded-md px-3 py-2" />
                <input type="number" step="0.01" value={compraValor} onChange={(e) => setCompraValor(e.target.value)} placeholder="Valor unitário previsto" className="border border-slate-300 rounded-md px-3 py-2" />
              </div>
              <button onClick={solicitarCompra} disabled={saving} className="px-4 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60">
                Gerar requisição de compra
              </button>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <button onClick={salvarDiagnostico} disabled={saving} className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60">
                Salvar diagnóstico
              </button>

              <div>
                <label className="block text-sm font-medium mb-1">KM final (conserto imediato)</label>
                <input type="number" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mão de obra (R$)</label>
                <input type="number" step="0.01" value={custoMaoObra} onChange={(e) => setCustoMaoObra(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Terceiros (R$)</label>
                <input type="number" step="0.01" value={custoTerceiros} onChange={(e) => setCustoTerceiros(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Extras (R$)</label>
                <input type="number" step="0.01" value={custoExtras} onChange={(e) => setCustoExtras(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2" />
              </div>

              <button onClick={concluirImediato} disabled={saving} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
                Concluir conserto imediato
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
