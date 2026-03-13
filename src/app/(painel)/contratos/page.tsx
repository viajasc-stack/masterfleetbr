"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Contrato = {
  id: string;
  nome: string;
  descricao: string | null;
  forma_cobranca: "km" | "dia" | "mensal";
  valor_cobranca: number;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  dias_semana: number[];
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
  cliente_id: string;
};

type ClienteMini = {
  id: string;
  nome: string;
};

type HorarioMini = {
  id: string;
  contrato_id: string;
};

type OSRecorrenteMini = {
  id: string;
  contrato_id: string | null;
  inicio_em: string | null;
  motorista_id: string | null;
  veiculo_id: string | null;
  observacoes: string | null;
};

type FiltroAtivo = "ativos" | "inativos" | "todos";

const DIAS_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

function formatDias(dias: number[] | null | undefined) {
  if (!dias || dias.length === 0) return "—";
  const sorted = [...dias].sort((a, b) => a - b);
  return sorted.map((d) => DIAS_LABEL[d] ?? String(d)).join(", ");
}

function ymdSaoPauloFromISO(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function hmSaoPauloFromISO(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function diffDiasInclusivo(inicioYmd: string, fimYmd: string) {
  const a = new Date(`${inicioYmd}T00:00:00`);
  const b = new Date(`${fimYmd}T00:00:00`);
  const ms = b.getTime() - a.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [horariosCountMap, setHorariosCountMap] = useState<Record<string, number>>({});
  const [osCoberturaMap, setOsCoberturaMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Contrato | null>(null);
  const [gerarTarget, setGerarTarget] = useState<Contrato | null>(null);
  const [gerando, setGerando] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("ativos");

  async function carregarContratos() {
    setLoading(true);

    const { data: contratosData, error: contratosErr } = await supabase
      .from("contratos")
      .select("id, nome, descricao, forma_cobranca, valor_cobranca, dia_fechamento, dia_vencimento, dias_semana, data_inicio, data_fim, ativo, created_at, cliente_id")
      .order("created_at", { ascending: false });

    if (contratosErr || !contratosData) {
      console.error(contratosErr);
      setContratos([]);
      setClientesMap({});
      setHorariosCountMap({});
      setLoading(false);
      return;
    }

    setTimeout(() => {
      setContratos(contratosData as Contrato[]);
      setSelectedIds((prev) => prev.filter((id) => (contratosData as Contrato[]).some((c) => c.id === id)));
    }, 0);

    // Carrega clientes (para exibir nome)
    const { data: clientesData, error: clientesErr } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome", { ascending: true });

    setTimeout(() => {
      if (!clientesErr && clientesData) {
        const map: Record<string, string> = {};
        (clientesData as ClienteMini[]).forEach((c) => (map[c.id] = c.nome));
        setClientesMap(map);
      } else {
        setClientesMap({});
      }
    }, 0);

    // Conta horários por contrato (para exibir quantidade)
    const { data: horariosData, error: horariosErr } = await supabase
      .from("contrato_horarios")
      .select("id, contrato_id");

    setTimeout(() => {
      if (!horariosErr && horariosData) {
        const count: Record<string, number> = {};
        (horariosData as HorarioMini[]).forEach((h) => {
          count[h.contrato_id] = (count[h.contrato_id] ?? 0) + 1;
        });
        setHorariosCountMap(count);
      } else {
        setHorariosCountMap({});
      }
    }, 0);

    const { data: osRecData, error: osRecErr } = await supabase
      .from("ordens_servico")
      .select("id, contrato_id, inicio_em")
      .eq("tipo", "recorrente")
      .not("contrato_id", "is", null)
      .not("inicio_em", "is", null)
      .neq("status", "cancelada")
      .order("inicio_em", { ascending: false });

    setTimeout(() => {
      if (!osRecErr && osRecData) {
        const maxMap: Record<string, string | null> = {};
        (osRecData as Array<{ contrato_id: string; inicio_em: string }>).forEach((os) => {
          const ymd = ymdSaoPauloFromISO(os.inicio_em);
          if (!maxMap[os.contrato_id] || ymd > String(maxMap[os.contrato_id])) {
            maxMap[os.contrato_id] = ymd;
          }
        });
        setOsCoberturaMap(maxMap);
      } else {
        setOsCoberturaMap({});
      }
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarContratos(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const contratosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return contratos
      .filter((c) => {
        if (filtroAtivo === "ativos") return c.ativo === true;
        if (filtroAtivo === "inativos") return c.ativo === false;
        return true;
      })
      .filter((c) => {
        if (!q) return true;

        const clienteNome = clientesMap[c.cliente_id] ?? "";
        const alvo = [
          c.nome,
          c.descricao ?? "",
          clienteNome,
          formatDias(c.dias_semana),
          c.data_inicio ?? "",
          c.data_fim ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [contratos, busca, filtroAtivo, clientesMap]);

  const allFilteredSelected =
    contratosFiltrados.length > 0 && contratosFiltrados.every((c) => selectedIds.includes(c.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...contratosFiltrados.map((c) => c.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !contratosFiltrados.some((c) => c.id === id)));
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("contratos").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir contrato: " + error.message);
      return;
    }

    setDeleteTarget(null);
    await carregarContratos();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("contratos").delete().in("id", selectedIds);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir contratos selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregarContratos();
  }

  async function gerarOS(c: Contrato, dias: 1 | 7 | 30) {
    setGerando(true);
    const hoje = new Date();
    const startYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(hoje);

    const fimCandidato = new Date(`${startYmd}T00:00:00`);
    fimCandidato.setDate(fimCandidato.getDate() + (dias - 1));
    let endYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(fimCandidato);

    if (c.data_fim && c.data_fim < endYmd) endYmd = c.data_fim;
    if (endYmd < startYmd) {
      setGerando(false);
      alert("Este contrato já passou da data final. Não há OS para gerar.");
      return;
    }

    const { data: horariosData, error: hErr } = await supabase
      .from("contrato_horarios")
      .select("id, hora, dias_semana, motorista_id, veiculo_id, observacao, ativo")
      .eq("contrato_id", c.id);

    if (hErr) {
      setGerando(false);
      alert("Erro ao carregar horários do contrato: " + hErr.message);
      return;
    }

    const horariosAtivos = (horariosData ?? []).filter((h: { ativo?: boolean }) => h.ativo !== false) as Array<{
      id: string;
      hora: string;
      dias_semana: number[] | null;
      motorista_id: string | null;
      veiculo_id: string | null;
      observacao: string | null;
    }>;

    if (horariosAtivos.length === 0) {
      setGerando(false);
      alert("Este contrato não possui horários ativos para geração.");
      return;
    }

    const endPlus = new Date(`${endYmd}T00:00:00`);
    endPlus.setDate(endPlus.getDate() + 1);

    const { data: osExistentes, error: osErr } = await supabase
      .from("ordens_servico")
      .select("id, contrato_id, inicio_em, motorista_id, veiculo_id, observacoes")
      .eq("tipo", "recorrente")
      .eq("contrato_id", c.id)
      .gte("inicio_em", `${startYmd}T00:00:00-03:00`)
      .lt("inicio_em", `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(endPlus)}T00:00:00-03:00`)
      .neq("status", "cancelada");

    if (osErr) {
      setGerando(false);
      alert("Erro ao consultar OS existentes: " + osErr.message);
      return;
    }

    const existentesKey = new Set(
      ((osExistentes ?? []) as OSRecorrenteMini[])
        .filter((x) => x.inicio_em)
        .map((x) => {
          const dt = String(x.inicio_em);
          const keyDate = ymdSaoPauloFromISO(dt);
          const keyHora = hmSaoPauloFromISO(dt);
          return `${keyDate}|${keyHora}|${x.motorista_id ?? ""}|${x.veiculo_id ?? ""}|${(x.observacoes ?? "").trim()}`;
        })
    );

    const inserts: Array<Record<string, unknown>> = [];
    const cursor = new Date(`${startYmd}T00:00:00`);
    const endDateObj = new Date(`${endYmd}T00:00:00`);

    while (cursor <= endDateObj) {
      const ymd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(cursor);
      const dow = new Date(`${ymd}T00:00:00`).getDay();

      for (const h of horariosAtivos) {
        const diasHorario = (h.dias_semana && h.dias_semana.length > 0) ? h.dias_semana : c.dias_semana;
        if (!diasHorario.includes(dow)) continue;

        const hhmm = String(h.hora || "").slice(0, 5);
        if (!/^\d{2}:\d{2}$/.test(hhmm)) continue;

        const obs = (h.observacao ?? "").trim();
        const key = `${ymd}|${hhmm}|${h.motorista_id ?? ""}|${h.veiculo_id ?? ""}|${obs}`;
        if (existentesKey.has(key)) continue;

        inserts.push({
          tipo: "recorrente",
          status: "pendente",
          modo_cobranca: c.forma_cobranca === "km" ? "km" : "fixo",
          valor_fixo: c.forma_cobranca === "dia" ? Number(c.valor_cobranca || 0) : null,
          valor_km: c.forma_cobranca === "km" ? Number(c.valor_cobranca || 0) : null,
          valor_total: c.forma_cobranca === "dia" ? Number(c.valor_cobranca || 0) : 0,
          contrato_id: c.id,
          cliente_id: c.cliente_id,
          motorista_id: h.motorista_id,
          veiculo_id: h.veiculo_id,
          inicio_em: `${ymd}T${hhmm}:00-03:00`,
          roteiro: obs || null,
          observacoes: obs || null,
          origem: null,
          destino: null,
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (inserts.length === 0) {
      setGerando(false);
      setGerarTarget(null);
      alert("Nenhuma OS nova para gerar neste período (já existem OS para as combinações previstas).");
      return;
    }

    const { error: insErr } = await supabase.from("ordens_servico").insert(inserts);
    setGerando(false);

    if (insErr) {
      alert("Erro ao gerar OS: " + insErr.message);
      return;
    }

    setGerarTarget(null);
    await carregarContratos();
    alert(`OS geradas com sucesso: ${inserts.length}`);
  }

  const hojeYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Gerencie contratos recorrentes (dias + múltiplos horários com observação por saída)."
        actions={
          <>
            <Link
              href="/contratos/novo"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Novo Contrato
            </Link>

            <button
              onClick={carregarContratos}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Recarregar
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Contrato, cliente, dias, vigência..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value as FiltroAtivo)}
            >
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          Mostrando <span className="font-semibold">{contratosFiltrados.length}</span>{" "}
          de <span className="font-semibold">{contratos.length}</span> contrato(s).
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Selecionados: {selectedIds.length}</span>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
            className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Excluir selecionados
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : contratosFiltrados.length === 0 ? (
          <div className="text-slate-600">Nenhum contrato encontrado com esses filtros.</div>
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
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="py-2 pr-4">Contrato</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Dias</th>
                  <th className="py-2 pr-4">Horários</th>
                  <th className="py-2 pr-4">Cobertura OS</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contratosFiltrados.map((c) => (
                  (() => {
                    const coberturaAte = osCoberturaMap[c.id] ?? null;
                    const diasCobertura = coberturaAte ? diffDiasInclusivo(hojeYmd, coberturaAte) : 0;
                    const precisaRepor =
                      c.ativo &&
                      (c.data_fim ? c.data_fim >= hojeYmd : true) &&
                      (c.data_fim ? c.data_fim > (coberturaAte ?? "0000-00-00") : true) &&
                      diasCobertura <= 3;

                    return (
                  <tr
                    key={c.id}
                    className={`border-b last:border-b-0 transition ${
                      precisaRepor ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={(e) => toggleSelecionado(c.id, e.target.checked)}
                        aria-label={`Selecionar contrato ${c.nome}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/contratos/${c.id}`} className="hover:underline">
                        {c.nome}
                      </Link>
                    </td>

                    <td className="py-2 pr-4">
                      {clientesMap[c.cliente_id] ?? "—"}
                    </td>

                    <td className="py-2 pr-4">{formatDias(c.dias_semana)}</td>

                    <td className="py-2 pr-4">
                      <span className="text-slate-700">
                        {horariosCountMap[c.id] ?? 0}
                      </span>
                    </td>

                    <td className="py-2 pr-4">
                      {coberturaAte ? (
                        <div className="text-xs">
                          <div className="font-medium text-slate-800">
                            até {new Date(`${coberturaAte}T12:00:00`).toLocaleDateString("pt-BR")}
                          </div>
                          <div className={diasCobertura <= 3 ? "text-amber-700" : "text-slate-500"}>
                            {diasCobertura} dia(s)
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-rose-700">Sem OS futura</span>
                      )}
                    </td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${
                          c.ativo
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-slate-200 text-slate-700 bg-slate-50"
                        }`}
                      >
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setGerarTarget(c)}
                          className="px-2 py-1 text-xs border border-sky-200 text-sky-700 rounded-md hover:bg-sky-50"
                          title="Gerar OS do contrato"
                        >
                          📅
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                          title="Excluir contrato"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={`Deseja excluir o contrato "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir contratos selecionados"
        description={`Deseja excluir ${selectedIds.length} contrato(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />

      {gerarTarget ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-lg p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Gerar OS recorrentes</h3>
            <div className="text-sm text-slate-600 space-y-1">
              <div><span className="font-medium text-slate-800">Contrato:</span> {gerarTarget.nome}</div>
              <div><span className="font-medium text-slate-800">Cliente:</span> {clientesMap[gerarTarget.cliente_id] ?? "—"}</div>
              <div><span className="font-medium text-slate-800">Dias:</span> {formatDias(gerarTarget.dias_semana)}</div>
              <div>
                <span className="font-medium text-slate-800">Data final:</span>{" "}
                {gerarTarget.data_fim ? new Date(`${gerarTarget.data_fim}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data final"}
              </div>
              <div>
                <span className="font-medium text-slate-800">Cobertura atual:</span>{" "}
                {osCoberturaMap[gerarTarget.id]
                  ? `até ${new Date(`${osCoberturaMap[gerarTarget.id]}T12:00:00`).toLocaleDateString("pt-BR")}`
                  : "Sem OS futura"}
              </div>
              <div className="text-xs text-amber-700 pt-1">
                Importante: a geração sempre respeita a data final do contrato.
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGerarTarget(null)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                disabled={gerando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => gerarOS(gerarTarget, 1)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                disabled={gerando}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => gerarOS(gerarTarget, 7)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                disabled={gerando}
              >
                7 dias
              </button>
              <button
                type="button"
                onClick={() => gerarOS(gerarTarget, 30)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                disabled={gerando}
              >
                {gerando ? "Gerando..." : "30 dias"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
