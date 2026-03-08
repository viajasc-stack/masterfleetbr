"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AnyRow = Record<string, any>;

function money(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function inRange(iso: string | null | undefined, ini: string, fim: string) {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= ini && d <= fim;
}

function sumBy<T>(arr: T[], pick: (v: T) => number) {
  return arr.reduce((s, x) => s + (pick(x) || 0), 0);
}

function exportSectionToPdf(sectionId: string, title: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  const w = window.open("", "_blank", "width=1200,height=900");
  if (!w) return;

  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h2 { margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background: #f1f5f9; }
          .grid { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${el.innerHTML}
      </body>
    </html>
  `);
  w.document.close();
  w.focus();
  w.print();
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <div className="flex gap-2">
          <button onClick={() => exportSectionToPdf(id, title)} className="text-xs border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-50">
            Baixar PDF
          </button>
          <button onClick={() => window.print()} className="text-xs border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-50">
            Imprimir
          </button>
        </div>
      </div>
      <div id={id}>{children}</div>
    </section>
  );
}

export default function RelatoriosPage() {
  const now = new Date();
  const [inicio, setInicio] = useState(dateOnly(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [fim, setFim] = useState(dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0)));

  const [clienteId, setClienteId] = useState("todos");
  const [veiculoId, setVeiculoId] = useState("todos");
  const [motoristaId, setMotoristaId] = useState("todos");
  const [statusOs, setStatusOs] = useState("todos");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string>("");

  const [ordensServico, setOrdensServico] = useState<AnyRow[]>([]);
  const [contratos, setContratos] = useState<AnyRow[]>([]);
  const [clientes, setClientes] = useState<AnyRow[]>([]);
  const [veiculos, setVeiculos] = useState<AnyRow[]>([]);
  const [motoristas, setMotoristas] = useState<AnyRow[]>([]);
  const [financeiro, setFinanceiro] = useState<AnyRow[]>([]);
  const [manutencoes, setManutencoes] = useState<AnyRow[]>([]);
  const [orcamentos, setOrcamentos] = useState<AnyRow[]>([]);
  const [produtos, setProdutos] = useState<AnyRow[]>([]);
  const [movimentosEstoque, setMovimentosEstoque] = useState<AnyRow[]>([]);
  const [entradasEstoque, setEntradasEstoque] = useState<AnyRow[]>([]);
  const [fornecedores, setFornecedores] = useState<AnyRow[]>([]);
  const [fechamentos, setFechamentos] = useState<AnyRow[]>([]);
  const [motoristaExtras, setMotoristaExtras] = useState<AnyRow[]>([]);

  const loadTable = useCallback(async (table: string, select: string, dateField?: string) => {
    let q = supabase.from(table).select(select);
    if (dateField) {
      q = q.gte(dateField, `${inicio}T00:00:00`).lte(dateField, `${fim}T23:59:59`);
    }
    const { data, error } = await q;
    if (error) return [] as AnyRow[];
    return (data || []) as AnyRow[];
  }, [inicio, fim]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const [
          os,
          ct,
          cl,
          ve,
          mo,
          fi,
          ma,
          or,
          pr,
          mv,
          en,
          fo,
          fc,
          me,
        ] = await Promise.all([
          loadTable("ordens_servico", "id,status,valor_total,cliente_id,veiculo_id,motorista_id,contrato_id,created_at,inicio_em,fim_em,km_inicio,km_fim,status_pagamento", "created_at"),
          loadTable("contratos", "id,nome,cliente_id,forma_cobranca,valor_cobranca,ativo,data_inicio,data_fim,dia_fechamento,dia_vencimento,created_at"),
          loadTable("clientes", "id,nome,ativo,created_at"),
          loadTable("veiculos", "id,placa,modelo,status,created_at"),
          loadTable("motoristas", "id,nome,ativo,created_at"),
          loadTable("contas_financeiras", "id,descricao,tipo,valor,status,categoria,contrato_id,data_vencimento,data_pagamento,created_at", "created_at"),
          loadTable("manutencoes", "id,veiculo_id,tipo,status,custo,data_prevista,data_realizada,created_at", "created_at"),
          loadTable("orcamentos", "id,cliente_id,status,valor_centavos,created_at,negociacao", "created_at"),
          loadTable("produtos", "id,nome,ativo,estoque_minimo,estoque_maximo,preco_custo,created_at"),
          loadTable("movimentos_estoque", "id,produto_id,tipo,quantidade,valor_total,created_at", "created_at"),
          loadTable("entradas_estoque", "id,status,valor_total,created_at,data_entrada", "created_at"),
          loadTable("fornecedores", "id,nome,ativo,created_at"),
          loadTable("contrato_fechamentos", "id,contrato_id,data_fechamento,periodo_inicio,periodo_fim,forma_cobranca,quantidade_base,valor_total,status,created_at", "created_at"),
          loadTable("motorista_extras", "id,motorista_id,ordem_servico_id,tipo,descricao,valor,status,competencia,created_at", "created_at"),
        ]);

        setOrdensServico(os);
        setContratos(ct);
        setClientes(cl);
        setVeiculos(ve);
        setMotoristas(mo);
        setFinanceiro(fi);
        setManutencoes(ma);
        setOrcamentos(or);
        setProdutos(pr);
        setMovimentosEstoque(mv);
        setEntradasEstoque(en);
        setFornecedores(fo);
        setFechamentos(fc);
        setMotoristaExtras(me);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erro ao carregar relatórios";
        setErro(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loadTable]);

  const clienteMap = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c.nome])), [clientes]);
  const veiculoMap = useMemo(() => Object.fromEntries(veiculos.map((v) => [v.id, [v.placa, v.modelo].filter(Boolean).join(" • ") || v.id])), [veiculos]);
  const motoristaMap = useMemo(() => Object.fromEntries(motoristas.map((m) => [m.id, m.nome])), [motoristas]);
  const contratoMap = useMemo(() => Object.fromEntries(contratos.map((c) => [c.id, c.nome])), [contratos]);

  const osFiltradas = useMemo(() => {
    return ordensServico.filter((o) => {
      const created = o.created_at || o.inicio_em;
      if (!inRange(created, inicio, fim)) return false;
      if (clienteId !== "todos" && o.cliente_id !== clienteId) return false;
      if (veiculoId !== "todos" && o.veiculo_id !== veiculoId) return false;
      if (motoristaId !== "todos" && o.motorista_id !== motoristaId) return false;
      if (statusOs !== "todos" && o.status !== statusOs) return false;
      return true;
    });
  }, [ordensServico, inicio, fim, clienteId, veiculoId, motoristaId, statusOs]);

  const kpis = useMemo(() => {
    const receitaOS = sumBy(osFiltradas, (o) => Number(o.valor_total || 0));
    const contasReceber = financeiro.filter((f) => f.tipo === "receber");
    const contasPagar = financeiro.filter((f) => f.tipo === "pagar");
    const receberPendente = sumBy(contasReceber.filter((f) => f.status === "pendente"), (f) => Number(f.valor || 0));
    const pagarPendente = sumBy(contasPagar.filter((f) => f.status === "pendente"), (f) => Number(f.valor || 0));
    const margem = receitaOS - pagarPendente;

    return {
      os: osFiltradas.length,
      receitaOS,
      receberPendente,
      pagarPendente,
      margem,
      contratosAtivos: contratos.filter((c) => c.ativo).length,
      clientesAtivos: clientes.filter((c) => c.ativo).length,
      veiculosAtivos: veiculos.filter((v) => (v.status || "").toLowerCase() === "ativo").length,
    };
  }, [osFiltradas, financeiro, contratos, clientes, veiculos]);

  const osPorCliente = useMemo(() => {
    const acc: Record<string, { total: number; valor: number }> = {};
    osFiltradas.forEach((o) => {
      const key = o.cliente_id || "sem-cliente";
      acc[key] = acc[key] || { total: 0, valor: 0 };
      acc[key].total += 1;
      acc[key].valor += Number(o.valor_total || 0);
    });
    return Object.entries(acc).map(([id, v]) => ({ nome: clienteMap[id] || "Sem cliente", ...v })).sort((a, b) => b.valor - a.valor).slice(0, 12);
  }, [osFiltradas, clienteMap]);

  const osPorVeiculo = useMemo(() => {
    const acc: Record<string, number> = {};
    osFiltradas.forEach((o) => {
      const key = o.veiculo_id || "sem-veiculo";
      acc[key] = (acc[key] || 0) + 1;
    });
    return Object.entries(acc).map(([id, total]) => ({ nome: veiculoMap[id] || "Sem veículo", total })).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [osFiltradas, veiculoMap]);

  const financeiroResumo = useMemo(() => {
    const receber = financeiro.filter((f) => f.tipo === "receber");
    const pagar = financeiro.filter((f) => f.tipo === "pagar");
    const vencidas = receber.filter((f) => f.status === "pendente" && f.data_vencimento && f.data_vencimento.slice(0, 10) < dateOnly(new Date()));
    return {
      receberTotal: sumBy(receber, (f) => Number(f.valor || 0)),
      pagarTotal: sumBy(pagar, (f) => Number(f.valor || 0)),
      receberPendente: sumBy(receber.filter((f) => f.status === "pendente"), (f) => Number(f.valor || 0)),
      pagarPendente: sumBy(pagar.filter((f) => f.status === "pendente"), (f) => Number(f.valor || 0)),
      inadimplencia: sumBy(vencidas, (f) => Number(f.valor || 0)),
    };
  }, [financeiro]);

  const estoqueResumo = useMemo(() => {
    const entradas = entradasEstoque.filter((e) => e.status !== "cancelada");
    const valorEntradas = sumBy(entradas, (e) => Number(e.valor_total || 0));
    const saidas = movimentosEstoque.filter((m) => m.tipo === "saida");
    const valorSaidas = sumBy(saidas, (m) => Number(m.valor_total || 0));
    return {
      produtosAtivos: produtos.filter((p) => p.ativo).length,
      fornecedoresAtivos: fornecedores.filter((f) => f.ativo).length,
      entradas: entradas.length,
      valorEntradas,
      saidas: saidas.length,
      valorSaidas,
    };
  }, [entradasEstoque, movimentosEstoque, produtos, fornecedores]);

  const extrasFiltrados = useMemo(() => {
    return motoristaExtras.filter((x) => {
      const created = String(x.created_at || "");
      if (!inRange(created, inicio, fim)) return false;
      if (motoristaId !== "todos" && x.motorista_id !== motoristaId) return false;
      return true;
    });
  }, [motoristaExtras, inicio, fim, motoristaId]);

  const extrasResumoMotorista = useMemo(() => {
    const acc: Record<string, { total: number; valor: number; pendente: number }> = {};
    extrasFiltrados.forEach((x) => {
      const mid = String(x.motorista_id || "sem-motorista");
      acc[mid] = acc[mid] || { total: 0, valor: 0, pendente: 0 };
      acc[mid].total += 1;
      const valor = Number(x.valor || 0);
      acc[mid].valor += valor;
      if (String(x.status || "") === "pendente") acc[mid].pendente += valor;
    });
    return Object.entries(acc)
      .map(([motorista_id, d]) => ({
        motorista_id,
        motorista_nome: String(motoristaMap[motorista_id] || "Sem motorista"),
        ...d,
      }))
      .sort((a, b) => b.pendente - a.pendente);
  }, [extrasFiltrados, motoristaMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white">Central de Relatórios</h1>
          <p className="text-slate-400 text-sm">Visão completa do negócio com exportação em PDF e impressão em todos os blocos.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportSectionToPdf("relatorio-geral", "Relatório Geral")}
            className="border border-slate-300 bg-white px-3 py-2 rounded-md text-sm hover:bg-slate-50">
            Baixar PDF Geral
          </button>
          <button onClick={() => window.print()} className="border border-slate-300 bg-white px-3 py-2 rounded-md text-sm hover:bg-slate-50">
            Imprimir Geral
          </button>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Filtros Globais</h2>
        <div className="grid md:grid-cols-6 gap-3 text-sm">
          <div>
            <label className="block mb-1 text-slate-600">De</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block mb-1 text-slate-600">Até</label>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block mb-1 text-slate-600">Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2">
              <option value="todos">Todos</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-slate-600">Veículo</label>
            <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2">
              <option value="todos">Todos</option>
              {veiculos.map((v) => <option key={v.id} value={v.id}>{[v.placa, v.modelo].filter(Boolean).join(" • ") || v.id}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-slate-600">Motorista</label>
            <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2">
              <option value="todos">Todos</option>
              {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-slate-600">Status OS</label>
            <select value={statusOs} onChange={(e) => setStatusOs(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2">
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="em_execucao">Em execução</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>
      </section>

      {loading ? <div className="text-slate-300 text-sm">Carregando relatórios...</div> : null}
      {erro ? <div className="text-red-300 text-sm">{erro}</div> : null}

      <div id="relatorio-geral" className="space-y-6">
        <Section id="r-visao-geral" title="1) Visão Geral Executiva">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">OS no período</div><div className="text-xl font-semibold mt-1">{kpis.os}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Receita operacional</div><div className="text-xl font-semibold mt-1">{money(kpis.receitaOS)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">A receber pendente</div><div className="text-xl font-semibold mt-1">{money(kpis.receberPendente)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">A pagar pendente</div><div className="text-xl font-semibold mt-1">{money(kpis.pagarPendente)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Margem estimada</div><div className="text-xl font-semibold mt-1">{money(kpis.margem)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Contratos ativos</div><div className="text-xl font-semibold mt-1">{kpis.contratosAtivos}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Clientes ativos</div><div className="text-xl font-semibold mt-1">{kpis.clientesAtivos}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Veículos ativos</div><div className="text-xl font-semibold mt-1">{kpis.veiculosAtivos}</div></div>
          </div>
        </Section>

        <Section id="r-operacao" title="2) Operação (OS)">
          <div className="grid md:grid-cols-2 gap-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-slate-500"><th className="py-2 text-left">Cliente</th><th className="py-2 text-left">OS</th><th className="py-2 text-left">Valor</th></tr></thead>
              <tbody>{osPorCliente.map((r) => <tr key={r.nome} className="border-b"><td className="py-2">{r.nome}</td><td>{r.total}</td><td>{money(r.valor)}</td></tr>)}</tbody>
            </table>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-slate-500"><th className="py-2 text-left">Veículo</th><th className="py-2 text-left">OS</th></tr></thead>
              <tbody>{osPorVeiculo.map((r) => <tr key={r.nome} className="border-b"><td className="py-2">{r.nome}</td><td>{r.total}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>

        <Section id="r-contratos" title="3) Contratos e Fechamentos">
          <div className="grid md:grid-cols-3 gap-3 text-sm mb-3">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Contratos totais</div><div className="font-semibold mt-1">{contratos.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Fechamentos no período</div><div className="font-semibold mt-1">{fechamentos.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Valor fechado</div><div className="font-semibold mt-1">{money(sumBy(fechamentos, (f) => Number(f.valor_total || 0)))}</div></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-slate-500"><th className="py-2 text-left">Contrato</th><th className="py-2 text-left">Forma</th><th className="py-2 text-left">Período</th><th className="py-2 text-left">Base</th><th className="py-2 text-left">Valor</th></tr></thead>
            <tbody>
              {fechamentos.slice(0, 50).map((f) => (
                <tr key={f.id} className="border-b">
                  <td className="py-2">{contratoMap[f.contrato_id] || f.contrato_id}</td>
                  <td>{f.forma_cobranca}</td>
                  <td>{f.periodo_inicio} a {f.periodo_fim}</td>
                  <td>{Number(f.quantidade_base || 0).toLocaleString("pt-BR")}</td>
                  <td>{money(Number(f.valor_total || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="r-financeiro" title="4) Financeiro">
          <div className="grid md:grid-cols-5 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Receber total</div><div className="font-semibold mt-1">{money(financeiroResumo.receberTotal)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Pagar total</div><div className="font-semibold mt-1">{money(financeiroResumo.pagarTotal)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Receber pendente</div><div className="font-semibold mt-1">{money(financeiroResumo.receberPendente)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Pagar pendente</div><div className="font-semibold mt-1">{money(financeiroResumo.pagarPendente)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Inadimplência</div><div className="font-semibold mt-1">{money(financeiroResumo.inadimplencia)}</div></div>
          </div>
        </Section>

        <Section id="r-frota" title="5) Frota e Manutenção">
          <div className="grid md:grid-cols-3 gap-3 text-sm mb-3">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Manutenções no período</div><div className="font-semibold mt-1">{manutencoes.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Custo manutenção</div><div className="font-semibold mt-1">{money(sumBy(manutencoes, (m) => Number(m.custo || 0)))}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">OS por veículo</div><div className="font-semibold mt-1">{osPorVeiculo[0]?.nome || "-"}</div></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-slate-500"><th className="py-2 text-left">Veículo</th><th className="py-2 text-left">Tipo</th><th className="py-2 text-left">Status</th><th className="py-2 text-left">Custo</th></tr></thead>
            <tbody>
              {manutencoes.slice(0, 40).map((m) => (
                <tr key={m.id} className="border-b"><td className="py-2">{veiculoMap[m.veiculo_id] || "-"}</td><td>{m.tipo || "-"}</td><td>{m.status || "-"}</td><td>{money(Number(m.custo || 0))}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="r-estoque" title="6) Estoque e Compras">
          <div className="grid md:grid-cols-6 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Produtos ativos</div><div className="font-semibold mt-1">{estoqueResumo.produtosAtivos}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Fornecedores ativos</div><div className="font-semibold mt-1">{estoqueResumo.fornecedoresAtivos}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Entradas</div><div className="font-semibold mt-1">{estoqueResumo.entradas}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Valor entradas</div><div className="font-semibold mt-1">{money(estoqueResumo.valorEntradas)}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Saídas</div><div className="font-semibold mt-1">{estoqueResumo.saidas}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Valor saídas</div><div className="font-semibold mt-1">{money(estoqueResumo.valorSaidas)}</div></div>
          </div>
        </Section>

        <Section id="r-comercial" title="7) Comercial (Orçamentos)">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Orçamentos</div><div className="font-semibold mt-1">{orcamentos.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Valor total</div><div className="font-semibold mt-1">{money(sumBy(orcamentos, (o) => Number(o.valor_centavos || 0) / 100))}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Taxa negociação</div><div className="font-semibold mt-1">{orcamentos.length ? `${Math.round((orcamentos.filter((o) => o.negociacao).length / orcamentos.length) * 100)}%` : "0%"}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Status mais comum</div><div className="font-semibold mt-1">{(() => {
              const m: Record<string, number> = {};
              orcamentos.forEach((o) => { m[o.status || "sem_status"] = (m[o.status || "sem_status"] || 0) + 1; });
              return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
            })()}</div></div>
          </div>
        </Section>

        <Section id="r-cadastros" title="8) Cadastros e Pessoas">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Clientes</div><div className="font-semibold mt-1">{clientes.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Motoristas</div><div className="font-semibold mt-1">{motoristas.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Veículos</div><div className="font-semibold mt-1">{veiculos.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500">Contratos</div><div className="font-semibold mt-1">{contratos.length}</div></div>
          </div>
        </Section>

        <Section id="r-extras-motoristas" title="9) Extras de Motoristas">
          <div className="grid md:grid-cols-3 gap-3 text-sm mb-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-slate-500">Registros de extra</div>
              <div className="font-semibold mt-1">{extrasFiltrados.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-slate-500">Total de extras</div>
              <div className="font-semibold mt-1">{money(sumBy(extrasFiltrados, (x) => Number(x.valor || 0)))}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-slate-500">Total a pagar (pendente)</div>
              <div className="font-semibold mt-1">{money(sumBy(extrasFiltrados.filter((x) => String(x.status || "") === "pendente"), (x) => Number(x.valor || 0)))}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Resumo por motorista (total a pagar)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-left">Motorista</th>
                    <th className="py-2 text-left">Qtd extras</th>
                    <th className="py-2 text-left">Total extras</th>
                    <th className="py-2 text-left">Pendente</th>
                  </tr>
                </thead>
                <tbody>
                  {extrasResumoMotorista.map((r) => (
                    <tr key={r.motorista_id} className="border-b">
                      <td className="py-2">{r.motorista_nome}</td>
                      <td>{r.total}</td>
                      <td>{money(r.valor)}</td>
                      <td>{money(r.pendente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Detalhado por extra</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-left">Motorista</th>
                    <th className="py-2 text-left">OS</th>
                    <th className="py-2 text-left">Tipo</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {extrasFiltrados.slice(0, 100).map((x) => (
                    <tr key={String(x.id)} className="border-b">
                      <td className="py-2">{String(motoristaMap[String(x.motorista_id || "")] || "Sem motorista")}</td>
                      <td>{x.ordem_servico_id ? String(x.ordem_servico_id).slice(0, 8) : "-"}</td>
                      <td>{String(x.tipo || "-")}</td>
                      <td>{String(x.status || "-")}</td>
                      <td>{money(Number(x.valor || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
