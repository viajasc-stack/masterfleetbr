"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { logError, logInfo } from "@/lib/observability";

type Billing = {
  status: string;
  plano_nome?: string | null;
  trial_ate?: string | null;
  proxima_cobranca?: string | null;
};

type OsRow = {
  id: string;
  numero: number | null;
  tipo: string;
  status: string;

  inicio_em: string | null;
  fim_em: string | null;

  origem: string | null;
  destino: string | null;

  valor_total: number | null;
  status_pagamento: string | null;

  cliente_id: string | null;
  veiculo_id: string | null;
  motorista_id: string | null;

  created_at: string;

  clientes?: { nome: string } | null;
  veiculos?: { placa: string } | null;
  motoristas?: { nome: string } | null;
};

type FiltroStatus =
  | "pendente"
  | "em_execucao"
  | "concluida"
  | "cancelada"
  | "todas";

function formatNumeroOS(numero: number | null, createdAt: string) {
  if (!numero) return "Sem número";

  const ano = new Date(createdAt).getFullYear();
  const seq = String(numero).padStart(4, "0");

  return `OS-${ano}-${seq}`;
}

function ehMesmoDia(dataIso: string | null, ref: Date) {
  if (!dataIso) return false;
  const d = new Date(dataIso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function ehStatusPausadaOuEmAndamento(status: string) {
  const s = (status || "").toLowerCase();
  return (
    s === "em_execucao" ||
    s === "em_andamento" ||
    s === "pausada" ||
    s === "pausado"
  );
}

export default function OrdensServicoPage() {
  const searchParams = useSearchParams();
  const statusParam = String(searchParams?.get("status") || "").toLowerCase();
  const filtroInicial: FiltroStatus =
    statusParam === "pendente" ||
    statusParam === "em_execucao" ||
    statusParam === "concluida" ||
    statusParam === "cancelada"
      ? (statusParam as FiltroStatus)
      : "todas";
  const [osList, setOsList] = useState<OsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OsRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [diaReferencia, setDiaReferencia] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [busca, setBusca] = useState(() => searchParams?.get("q") || "");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>(filtroInicial);

  async function carregarOS() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ordens_servico")
      .select(
        `
        id, numero, tipo, status, inicio_em, fim_em, origem, destino,
        valor_total, status_pagamento, cliente_id, veiculo_id, motorista_id, created_at,
        clientes:cliente_id ( nome ),
        veiculos:veiculo_id ( placa ),
        motoristas:motorista_id ( nome )
      `
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      const lista = data as unknown as OsRow[];
      setOsList(lista);
      setSelectedIds((prev) => prev.filter((id) => lista.some((o) => o.id === id)));
    } else {
      logError("operacao.ordens_servico", "Falha ao carregar lista de OS", error);
      setOsList([]);
    }

    const { data: bill } = await supabase.rpc("get_billing_current");
    if (bill) {
      setBilling({
        status: bill.status ?? "trial",
        plano_nome: bill.plano_nome ?? null,
        trial_ate: bill.trial_ate ?? null,
        proxima_cobranca: bill.proxima_cobranca ?? null,
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarOS(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const q = busca.trim().toLowerCase();

  const filtradas = useMemo(
    () =>
      osList
        .filter((o) => ehMesmoDia(o.inicio_em, diaReferencia) || ehStatusPausadaOuEmAndamento(o.status))
        .filter((o) => {
          if (filtroStatus === "todas") return true;
          return (o.status || "").toLowerCase() === filtroStatus;
        })
        .filter((o) => {
          if (!q) return true;

          const alvo = [
            o.numero ? String(o.numero) : "",
            o.tipo ?? "",
            o.status ?? "",
            o.origem ?? "",
            o.destino ?? "",
            o.clientes?.nome ?? "",
            o.veiculos?.placa ?? "",
            o.motoristas?.nome ?? "",
            o.status_pagamento ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return alvo.includes(q);
        }),
    [osList, diaReferencia, filtroStatus, q]
  );

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  const tituloDia =
    diaReferencia.getTime() === hoje.getTime()
      ? "Hoje"
      : diaReferencia.getTime() === amanha.getTime()
        ? "Amanhã"
        : diaReferencia.getTime() === ontem.getTime()
          ? "Ontem"
          : diaReferencia.toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });

  const allFilteredSelected =
    filtradas.length > 0 && filtradas.every((o) => selectedIds.includes(o.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...filtradas.map((o) => o.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !filtradas.some((o) => o.id === id)));
  }

  function somarDias(base: Date, dias: number) {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function badgeStatus(status: string) {
    const s = (status || "").toLowerCase();
    if (s === "pendente") return "border-amber-200 text-amber-800 bg-amber-50";
    if (s === "em_execucao")
      return "border-indigo-200 text-indigo-800 bg-indigo-50";
    if (s === "concluida") return "border-green-200 text-green-700 bg-green-50";
    return "border-red-200 text-red-700 bg-red-50";
  }

  function labelStatus(status: string) {
    const s = (status || "").toLowerCase();
    if (s === "pendente") return "Pendente";
    if (s === "em_execucao") return "Em execução";
    if (s === "concluida") return "Concluída";
    if (s === "cancelada") return "Cancelada";
    return status || "—";
  }

  function labelPagamento(status: string | null) {
    const s = (status || "").toLowerCase();
    if (s === "pago") return "Pago";
    if (s === "parcial") return "Parcial";
    if (s === "cancelado") return "Cancelado";
    return "Pendente";
  }

  function formatMoney(v: number | null) {
    const n = typeof v === "number" ? v : 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR");
  }

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
      logError("operacao.ordens_servico", "Falha ao cancelar OS individual", error, {
        os_id: deleteTarget.id,
      });
      setErro(`Não foi possível cancelar a OS: ${error.message}`);
      return;
    }

    logInfo("operacao.ordens_servico", "OS cancelada", { os_id: deleteTarget.id });
    setDeleteTarget(null);
    setOkMsg("OS cancelada com sucesso.");
    await carregarOS();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    setErro("");
    setOkMsg("");
    const { error } = await supabase
      .from("ordens_servico")
      .update({ status: "cancelada" })
      .in("id", selectedIds);
    setDeleting(false);

    if (error) {
      logError("operacao.ordens_servico", "Falha ao cancelar OS em lote", error, {
        total_ids: selectedIds.length,
      });
      setErro(`Não foi possível cancelar OS selecionadas: ${error.message}`);
      return;
    }

    logInfo("operacao.ordens_servico", "OS canceladas em lote", {
      total_ids: selectedIds.length,
    });
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    setOkMsg("OS selecionadas canceladas com sucesso.");
    await carregarOS();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Serviço"
        description="Crie, gerencie e acompanhe suas OS."
        actions={
          <>
            <Link
              href="/ordens-servico/nova"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Nova OS
            </Link>

            <button
              onClick={carregarOS}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Recarregar
            </button>
          </>
        }
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      {billing && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-600">Assinatura</span>
            <span className={`ml-2 text-xs px-2 py-1 rounded border ${
              billing.status === "ativa" ? "border-green-200 text-green-700 bg-green-50"
              : billing.status === "trial" ? "border-blue-200 text-blue-700 bg-blue-50"
              : billing.status === "past_due" ? "border-amber-200 text-amber-700 bg-amber-50"
              : "border-red-200 text-red-700 bg-red-50"
            }`}>{billing.status}</span>
            {billing.plano_nome && <span className="ml-2 text-slate-600">Plano: <span className="text-slate-900 font-medium">{billing.plano_nome}</span></span>}
            {billing.proxima_cobranca && <span className="ml-2 text-slate-600">Próx.: <span className="text-slate-900">{new Date(billing.proxima_cobranca).toLocaleDateString("pt-BR")}</span></span>}
            {billing.trial_ate && <span className="ml-2 text-slate-600">Trial: <span className="text-slate-900">{new Date(billing.trial_ate).toLocaleDateString("pt-BR")}</span></span>}
          </div>
          {(billing.status === "past_due" || billing.status === "bloqueada") && (
            <Link href="/bloqueado" className="text-xs text-amber-700 hover:underline">Regularizar</Link>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <div className="text-xs text-slate-500">Navegação diária</div>
            <div className="text-sm font-medium text-slate-900">{tituloDia}</div>
            <div className="text-xs text-slate-500">
              Exibe OS do dia selecionado + OS pausadas e em andamento.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiaReferencia((prev) => somarDias(prev, -1))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white"
            >
              ← Dia anterior
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setDiaReferencia(d);
              }}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setDiaReferencia((prev) => somarDias(prev, 1))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white"
            >
              Próximo dia →
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº OS, cliente, veículo, motorista, origem..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            >
              <option value="todas">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="em_execucao">Em execução</option>
              <option value="concluida">Concluídas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Selecionadas: {selectedIds.length}</span>
          <span className="text-xs text-slate-500">Listadas: {filtradas.length}</span>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
            className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Cancelar selecionadas
          </button>
        </div>

        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-slate-600">Nenhuma OS encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => toggleSelecionarTodosFiltrados(e.target.checked)}
                      aria-label="Selecionar todas"
                    />
                  </th>
                  <th className="py-2 pr-4">OS</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Motorista</th>
                  <th className="py-2 pr-4">Início</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Pagamento</th>
                  <th className="py-2 pr-0">Valor</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o.id)}
                        onChange={(e) => toggleSelecionado(o.id, e.target.checked)}
                        aria-label={`Selecionar OS ${formatNumeroOS(o.numero, o.created_at)}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/ordens-servico/${o.id}`}
                        className="hover:underline"
                      >
                        {formatNumeroOS(o.numero, o.created_at)}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {o.tipo === "recorrente" ? "Recorrente" : "Eventual"}
                      </div>
                    </td>

                    <td className="py-2 pr-4">{o.clientes?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{o.veiculos?.placa ?? "—"}</td>
                    <td className="py-2 pr-4">{o.motoristas?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{formatDt(o.inicio_em)}</td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${badgeStatus(
                          o.status
                        )}`}
                      >
                        {labelStatus(o.status)}
                      </span>
                    </td>

                    <td className="py-2 pr-4">
                      {labelPagamento(o.status_pagamento)}
                    </td>

                    <td className="py-2 pr-0">
                      {formatMoney(o.valor_total)}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/ordens-servico/${o.id}`}
                          className="px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50"
                          title="Ver detalhes e editar OS"
                        >
                          Editar
                        </Link>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(o)}
                          className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                          title="Cancelar OS"
                        >
                          Cancelar
                        </button>
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
        title="Cancelar OS"
        description={`Deseja cancelar a OS "${deleteTarget ? formatNumeroOS(deleteTarget.numero, deleteTarget.created_at) : ""}"?`}
        confirmLabel="Cancelar OS"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Cancelar OS selecionadas"
        description={`Deseja cancelar ${selectedIds.length} OS selecionada(s)?`}
        confirmLabel="Cancelar selecionadas"
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />
    </div>
  );
}
