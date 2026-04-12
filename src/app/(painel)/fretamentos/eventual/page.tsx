"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { supabase } from "@/lib/supabase/client";
import { logError, logInfo } from "@/lib/observability";

type FretamentoRow = {
  id: string;
  numero: number | null;
  contrato_id: string | null;
  status: "pendente" | "em_execucao" | "concluida" | "cancelada";
  cliente_id: string | null;
  veiculo_id: string | null;
  motorista_id: string | null;
  destino: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  origem: string | null;
  roteiro: string | null;
  observacoes: string | null;
  local_saida: string | null;
  local_chegada: string | null;
  valor_total: number | null;
  valor_sinal: number | null;
  forma_pagamento: string | null;
  status_pagamento: string | null;
  rota_referencia_lat: number | null;
  rota_referencia_lng: number | null;
  raio_desvio_m: number | null;
  aprovado_em: string | null;
  aprovado_por: string | null;
  created_at: string;
  updated_at: string | null;
  clientes?: { nome: string }[] | { nome: string } | null;
  veiculos?: { placa: string | null; marca: string | null; modelo: string | null }[] | { placa: string | null; marca: string | null; modelo: string | null } | null;
  motoristas?: { nome: string }[] | { nome: string } | null;
};

type Cliente = { id: string; nome: string };
type StatusFiltro = "pendente" | "em_execucao" | "concluida" | "cancelada" | "todos";

function formatDataHora(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

function statusLabel(status: StatusFiltro | FretamentoRow["status"]) {
  if (status === "pendente") return "Pendente";
  if (status === "em_execucao") return "Em execução";
  if (status === "concluida") return "Concluída";
  if (status === "cancelada") return "Cancelada";
  return "Todos";
}

function statusClassName(status: FretamentoRow["status"]) {
  if (status === "pendente") return "border-amber-200 text-amber-800 bg-amber-50";
  if (status === "em_execucao") return "border-blue-200 text-blue-700 bg-blue-50";
  if (status === "concluida") return "border-green-200 text-green-700 bg-green-50";
  return "border-slate-200 text-slate-700 bg-slate-50";
}

function formatMoeda(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function clienteNome(row: FretamentoRow) {
  if (!row.clientes) return "—";
  if (Array.isArray(row.clientes)) return row.clientes[0]?.nome ?? "—";
  return row.clientes.nome ?? "—";
}

function motoristaNome(row: FretamentoRow) {
  if (!row.motoristas) return "—";
  if (Array.isArray(row.motoristas)) return row.motoristas[0]?.nome ?? "—";
  return row.motoristas.nome ?? "—";
}

function veiculoNome(row: FretamentoRow) {
  const v = Array.isArray(row.veiculos) ? row.veiculos[0] : row.veiculos;
  if (!v) return "—";
  const placa = v.placa?.trim() ?? "";
  const modelo = [v.marca, v.modelo].filter(Boolean).join(" ").trim();
  if (placa && modelo) return `${placa} • ${modelo}`;
  return placa || modelo || "—";
}

export default function FretamentoEventualPage() {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<FretamentoRow[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [canShowFinanceiro, setCanShowFinanceiro] = useState(false);

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusFiltro>("pendente");
  const [clienteId, setClienteId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<FretamentoRow | null>(null);
  const [quickViewTarget, setQuickViewTarget] = useState<FretamentoRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");

    try {
      const { data: osData, error: osErr } = await supabase
        .from("ordens_servico")
        .select("id, numero, contrato_id, status, cliente_id, veiculo_id, motorista_id, inicio_em, fim_em, origem, destino, roteiro, observacoes, local_saida, local_chegada, valor_total, valor_sinal, forma_pagamento, status_pagamento, rota_referencia_lat, rota_referencia_lng, raio_desvio_m, aprovado_em, aprovado_por, created_at, updated_at, clientes:cliente_id(nome), veiculos:veiculo_id(placa, marca, modelo), motoristas:motorista_id(nome)")
        .eq("tipo", "eventual");

      const { data: clientesData, error: cliErr } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (osErr) throw osErr;
      if (cliErr) throw cliErr;

      setLista((osData ?? []) as FretamentoRow[]);
      setClientes((clientesData ?? []) as Cliente[]);
    } catch (e) {
      logError("operacao.fretamento_eventual", "Falha ao carregar fretamentos", e);
      setErro("Erro ao carregar fretamentos eventuais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const access = await loadEmpresaModuleAccess();
        setCanShowFinanceiro(access.canUseAllModules || access.allowedModules.includes("financeiro"));
      } catch {
        setCanShowFinanceiro(false);
      }
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    let base = lista.filter((i) => {
      if (status !== "todos" && i.status !== status) return false;
      if (clienteId && i.cliente_id !== clienteId) return false;

      if (periodoInicio || periodoFim) {
        const dt = i.inicio_em ? new Date(i.inicio_em) : null;
        if (!dt) return false;

        if (periodoInicio) {
          const ini = new Date(`${periodoInicio}T00:00:00`);
          if (dt < ini) return false;
        }
        if (periodoFim) {
          const fim = new Date(`${periodoFim}T23:59:59`);
          if (dt > fim) return false;
        }
      }

      if (!q) return true;
      return [
        clienteNome(i),
        i.destino ?? "",
        i.status ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const asc = status === "pendente";
    base = [...base].sort((a, b) => {
      const da = new Date(a.inicio_em ?? a.created_at).getTime();
      const db = new Date(b.inicio_em ?? b.created_at).getTime();
      return asc ? da - db : db - da;
    });

    return base;
  }, [lista, busca, status, clienteId, periodoInicio, periodoFim]);

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    setErro("");
    setOkMsg("");
    const { error } = await supabase
      .from("ordens_servico")
      .update({ status: "cancelada" })
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      logError("operacao.fretamento_eventual", "Erro ao cancelar fretamento", error, { os_id: deleteTarget.id });
      setErro("Erro ao cancelar fretamento: " + error.message);
      return;
    }
    logInfo("operacao.fretamento_eventual", "Fretamento cancelado", { os_id: deleteTarget.id });
    setDeleteTarget(null);
    setOkMsg("Fretamento cancelado com sucesso.");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fretamentos • Eventual"
        description="Listagem de fretamentos do tipo eventual."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/fretamentos/eventual/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Novo Fretamento
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </div>
        }
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Busca</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, destino..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as StatusFiltro)}>
            <option value="pendente">{statusLabel("pendente")}</option>
            <option value="em_execucao">{statusLabel("em_execucao")}</option>
            <option value="concluida">{statusLabel("concluida")}</option>
            <option value="cancelada">{statusLabel("cancelada")}</option>
            <option value="todos">{statusLabel("todos")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cliente</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Período inicial</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Período final</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-slate-600">Nenhum fretamento eventual encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Destino</th>
                  <th className="py-2 pr-4">Data início</th>
                  <th className="py-2 pr-4">Data fim</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => setQuickViewTarget(item)}
                        className="text-slate-900 hover:underline"
                        title="Visualização rápida"
                      >
                        {clienteNome(item)}
                      </button>
                    </td>
                    <td className="py-2 pr-4">{item.destino ?? "—"}</td>
                    <td className="py-2 pr-4">{formatDataHora(item.inicio_em)}</td>
                    <td className="py-2 pr-4">{formatDataHora(item.fim_em)}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${statusClassName(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuickViewTarget(item)}
                          className="px-2 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50"
                          title="Visualizar"
                        >
                          👁️
                        </button>
                        <Link href={`/ordens-servico/${item.id}`} className="px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50" title="Editar">✏️</Link>
                        <button type="button" onClick={() => setDeleteTarget(item)} className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50" title="Cancelar">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Cancelar fretamento eventual"
        description="Deseja cancelar este fretamento eventual?"
        confirmLabel="Cancelar"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      {quickViewTarget ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 px-4 py-6 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setQuickViewTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Visualização rápida do fretamento</h3>
              <button
                type="button"
                onClick={() => setQuickViewTarget(null)}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 grid gap-3 text-sm max-h-[70vh] overflow-y-auto">
              <div>
                <div className="text-slate-500">Número</div>
                <div className="font-medium text-slate-900">{quickViewTarget.numero ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Cliente</div>
                <div className="font-medium text-slate-900">{clienteNome(quickViewTarget)}</div>
              </div>
              <div>
                <div className="text-slate-500">Veículo</div>
                <div className="font-medium text-slate-900">{veiculoNome(quickViewTarget)}</div>
              </div>
              <div>
                <div className="text-slate-500">Motorista</div>
                <div className="font-medium text-slate-900">{motoristaNome(quickViewTarget)}</div>
              </div>
              <div>
                <div className="text-slate-500">Destino</div>
                <div className="font-medium text-slate-900">{quickViewTarget.destino ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Origem</div>
                <div className="font-medium text-slate-900">{quickViewTarget.origem ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Local de saída</div>
                <div className="font-medium text-slate-900">{quickViewTarget.local_saida ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Local de chegada</div>
                <div className="font-medium text-slate-900">{quickViewTarget.local_chegada ?? "—"}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-slate-500">Data início</div>
                  <div className="font-medium text-slate-900">{formatDataHora(quickViewTarget.inicio_em)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Data fim</div>
                  <div className="font-medium text-slate-900">{formatDataHora(quickViewTarget.fim_em)}</div>
                </div>
              </div>
              <div>
                <div className="text-slate-500">Status</div>
                <div className="font-medium text-slate-900">{statusLabel(quickViewTarget.status)}</div>
              </div>
              <div>
                <div className="text-slate-500">Roteiro</div>
                <div className="font-medium text-slate-900 whitespace-pre-wrap">{quickViewTarget.roteiro ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Observações internas</div>
                <div className="font-medium text-slate-900 whitespace-pre-wrap">{quickViewTarget.observacoes ?? "—"}</div>
              </div>

              {canShowFinanceiro ? (
                <div className="border-t border-slate-200 pt-3">
                  <div className="text-slate-700 font-semibold mb-2">Financeiro</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-slate-500">Valor total</div>
                      <div className="font-medium text-slate-900">{formatMoeda(quickViewTarget.valor_total)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Valor sinal</div>
                      <div className="font-medium text-slate-900">{formatMoeda(quickViewTarget.valor_sinal)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Forma de pagamento</div>
                      <div className="font-medium text-slate-900">{quickViewTarget.forma_pagamento ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Status pagamento</div>
                      <div className="font-medium text-slate-900">{quickViewTarget.status_pagamento ?? "—"}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="border-t border-slate-200 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-slate-500">Criado em</div>
                  <div className="font-medium text-slate-900">{formatDataHora(quickViewTarget.created_at)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Atualizado em</div>
                  <div className="font-medium text-slate-900">{formatDataHora(quickViewTarget.updated_at)}</div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickViewTarget(null)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Fechar
              </button>
              <Link
                href={`/ordens-servico/${quickViewTarget.id}`}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Abrir detalhe completo
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}