"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type ContratoRow = {
  id: string;
  nome: string;
  cliente_id: string;
  ativo: boolean;
  data_inicio: string | null;
  data_fim: string | null;
};

type HorarioRow = {
  id: string;
  contrato_id: string;
  hora: string | null;
  horario: string | null;
  observacao: string | null;
  dias_semana: number[] | null;
  motorista_id: string | null;
  veiculo_id: string | null;
  ativo: boolean;
  ordem: number | null;
  motorista?: { nome: string | null }[] | { nome: string | null } | null;
  veiculo?: { placa: string | null; modelo: string | null }[] | { placa: string | null; modelo: string | null } | null;
};

type ClienteMini = { id: string; nome: string };
type MotoristaOpt = { id: string; nome: string };
type VeiculoOpt = { id: string; placa: string; modelo: string | null };

type EditDraft = {
  id: string;
  hora: string;
  roteiro: string;
  dias_semana: number[];
  motorista_id: string;
  veiculo_id: string;
  ativo: boolean;
};

const DIAS = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
];

function firstRel<T>(v: T[] | T | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function horaExibicao(h: HorarioRow) {
  return h.hora ?? h.horario ?? "—";
}

function nomeMotorista(h: HorarioRow) {
  return firstRel(h.motorista)?.nome ?? "—";
}

function nomeVeiculo(h: HorarioRow) {
  const v = firstRel(h.veiculo);
  if (!v) return "—";
  return `${v.placa ?? ""}${v.modelo ? ` - ${v.modelo}` : ""}`.trim() || "—";
}

function toYmdLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export default function FretamentoRecorrentePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [gerandoOs, setGerandoOs] = useState(false);

  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [horarios, setHorarios] = useState<HorarioRow[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});

  const [motoristas, setMotoristas] = useState<MotoristaOpt[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);

  const [busca, setBusca] = useState("");
  const [expandedContratoId, setExpandedContratoId] = useState<string | null>(null);

  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HorarioRow | null>(null);

  const [gerarOsContrato, setGerarOsContrato] = useState<ContratoRow | null>(null);

  async function carregar() {
    setLoading(true);

    const [contratosRes, horariosRes, clientesRes, motoristasRes, veiculosRes] = await Promise.all([
      supabase
        .from("contratos")
        .select("id, nome, cliente_id, ativo, data_inicio, data_fim")
        .order("nome", { ascending: true }),
      supabase
        .from("contrato_horarios")
        .select("id, contrato_id, hora, horario, observacao, dias_semana, motorista_id, veiculo_id, ativo, ordem, motorista:motoristas(nome), veiculo:veiculos(placa,modelo)")
        .order("ordem", { ascending: true })
        .order("hora", { ascending: true }),
      supabase.from("clientes").select("id, nome").order("nome", { ascending: true }),
      supabase.from("motoristas").select("id, nome, ativo").order("nome", { ascending: true }),
      supabase.from("veiculos").select("id, placa, modelo, status").order("placa", { ascending: true }),
    ]);

    const map: Record<string, string> = {};
    ((clientesRes.data ?? []) as ClienteMini[]).forEach((c) => {
      map[c.id] = c.nome;
    });

    setClientesMap(map);
    setContratos((contratosRes.data ?? []) as ContratoRow[]);
    setHorarios((horariosRes.data ?? []) as HorarioRow[]);

    setMotoristas(((motoristasRes.data ?? []) as Array<MotoristaOpt & { ativo?: boolean | null }>).filter((m) => m.ativo !== false));
    setVeiculos(
      ((veiculosRes.data ?? []) as Array<VeiculoOpt & { status?: string | null }>).filter(
        (v) => (v.status ?? "").toLowerCase() !== "inativo"
      )
    );

    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const horariosPorContrato = useMemo(() => {
    const map: Record<string, HorarioRow[]> = {};
    horarios.forEach((h) => {
      if (!map[h.contrato_id]) map[h.contrato_id] = [];
      map[h.contrato_id].push(h);
    });
    return map;
  }, [horarios]);

  const contratosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contratos;
    return contratos.filter((c) => {
      const cliente = (clientesMap[c.cliente_id] ?? "").toLowerCase();
      const totalHorarios = horariosPorContrato[c.id]?.length ?? 0;
      return c.nome.toLowerCase().includes(q) || cliente.includes(q) || String(totalHorarios).includes(q);
    });
  }, [contratos, busca, clientesMap, horariosPorContrato]);

  function abrirEdicao(h: HorarioRow) {
    setEditDraft({
      id: h.id,
      hora: h.hora ?? h.horario ?? "",
      roteiro: h.observacao ?? "",
      dias_semana: h.dias_semana ?? [],
      motorista_id: h.motorista_id ?? "",
      veiculo_id: h.veiculo_id ?? "",
      ativo: h.ativo,
    });
  }

  function toggleDiaEdicao(v: number) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const has = prev.dias_semana.includes(v);
      return {
        ...prev,
        dias_semana: has ? prev.dias_semana.filter((x) => x !== v) : [...prev.dias_semana, v].sort((a, b) => a - b),
      };
    });
  }

  async function salvarEdicao() {
    if (!editDraft) return;
    if (!editDraft.hora) return alert("Informe a hora.");
    if (editDraft.dias_semana.length === 0) return alert("Selecione ao menos 1 dia da semana.");

    setSaving(true);
    const { error } = await supabase
      .from("contrato_horarios")
      .update({
        hora: editDraft.hora,
        horario: editDraft.hora,
        observacao: editDraft.roteiro.trim() || null,
        dias_semana: editDraft.dias_semana,
        motorista_id: editDraft.motorista_id || null,
        veiculo_id: editDraft.veiculo_id || null,
        ativo: editDraft.ativo,
      })
      .eq("id", editDraft.id);
    setSaving(false);

    if (error) {
      alert("Erro ao salvar edição: " + error.message);
      return;
    }

    setEditDraft(null);
    await carregar();
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("contrato_horarios").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      alert("Erro ao excluir horário: " + error.message);
      return;
    }
    setDeleteTarget(null);
    await carregar();
  }

  async function gerarOsPeriodo(quantidadeDias: number) {
    if (!gerarOsContrato) return;
    setGerandoOs(true);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const datasValidas: string[] = [];
    for (let i = 0; i < quantidadeDias; i++) {
      const ymd = toYmdLocal(addDays(hoje, i));
      if (gerarOsContrato.data_inicio && ymd < gerarOsContrato.data_inicio) continue;
      if (gerarOsContrato.data_fim && ymd > gerarOsContrato.data_fim) continue;
      datasValidas.push(ymd);
    }

    if (datasValidas.length === 0) {
      setGerandoOs(false);
      alert("Nenhuma data válida dentro da vigência do contrato para geração de OS.");
      return;
    }

    let totalGerado = 0;
    for (const dataRef of datasValidas) {
      const { data, error } = await supabase.rpc("gerar_os_do_contrato", {
        p_contrato_id: gerarOsContrato.id,
        p_data: dataRef,
      });
      if (error) {
        setGerandoOs(false);
        alert(`Erro ao gerar OSs (${dataRef}): ${error.message}`);
        return;
      }
      totalGerado += Number(data ?? 0);
    }

    setGerandoOs(false);

    alert(`OSs geradas: ${totalGerado}`);
    setGerarOsContrato(null);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Fretamentos • Recorrente"
        description="Listagem por contrato, com horários e geração de OS no mesmo padrão do fluxo antigo."
        actions={
          <>
            <Link href="/fretamentos/recorrente/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Novo Fretamento Recorrente
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <label className="block text-sm font-medium mb-1">Buscar contrato/cliente</label>
        <input
          className="w-full md:w-[420px] border border-slate-300 rounded-md px-3 py-2"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite para filtrar..."
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : contratosFiltrados.length === 0 ? (
          <div className="text-slate-600">Nenhum contrato encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Contrato</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Horários</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contratosFiltrados.map((c) => {
                  const itens = horariosPorContrato[c.id] ?? [];
                  const expanded = expandedContratoId === c.id;

                  return (
                    <Fragment key={c.id}>
                      <tr className="border-b hover:bg-slate-50 transition">
                        <td className="py-2 pr-4 font-medium">
                          <Link href={`/fretamentos/recorrente/${c.id}`} className="hover:underline">
                            {c.nome}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{clientesMap[c.cliente_id] ?? "—"}</td>
                        <td className="py-2 pr-4">{itens.length}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${
                              c.ativo ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-700 bg-slate-50"
                            }`}
                          >
                            {c.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-2 pr-0 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setGerarOsContrato(c)}
                              className="px-2 py-1 text-xs border border-emerald-200 text-emerald-700 rounded-md hover:bg-emerald-50"
                              title="Gerar OSs do contrato"
                            >
                              ⚙️
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedContratoId(expanded ? null : c.id)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50"
                              title={expanded ? "Ocultar horários" : "Ver horários"}
                            >
                              {expanded ? "🙈" : "👁️"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expanded ? (
                        <tr className="border-b bg-slate-50/40">
                          <td colSpan={5} className="p-4">
                            {itens.length === 0 ? (
                              <div className="text-sm text-slate-600">Este contrato ainda não possui horários recorrentes.</div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left border-b">
                                      <th className="py-2 pr-4">Hora</th>
                                      <th className="py-2 pr-4">Motorista</th>
                                      <th className="py-2 pr-4">Veículo</th>
                                      <th className="py-2 pr-4">Roteiro</th>
                                      <th className="py-2 pr-4">Dias</th>
                                      <th className="py-2 pr-4">Status</th>
                                      <th className="py-2 pr-0 text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {itens.map((h) => (
                                      <tr key={h.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                                        <td className="py-2 pr-4">{horaExibicao(h)}</td>
                                        <td className="py-2 pr-4">{nomeMotorista(h)}</td>
                                        <td className="py-2 pr-4">{nomeVeiculo(h)}</td>
                                        <td className="py-2 pr-4">
                                          <div className="max-w-[260px] truncate" title={h.observacao ?? ""}>
                                            {h.observacao ?? "—"}
                                          </div>
                                        </td>
                                        <td className="py-2 pr-4">
                                          {(h.dias_semana ?? []).map((d) => DIAS.find((x) => x.v === d)?.label ?? d).join(", ") || "—"}
                                        </td>
                                        <td className="py-2 pr-4">{h.ativo ? "Ativo" : "Inativo"}</td>
                                        <td className="py-2 pr-0 text-right">
                                          <div className="flex items-center justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => abrirEdicao(h)}
                                              className="px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50"
                                              title="Editar"
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDeleteTarget(h)}
                                              className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                                              title="Excluir"
                                            >
                                              🗑
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editDraft ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Editar horário recorrente</h3>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium mb-1">Hora</label>
                <input
                  type="time"
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={editDraft.hora}
                  onChange={(e) => setEditDraft({ ...editDraft, hora: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Motorista</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={editDraft.motorista_id}
                  onChange={(e) => setEditDraft({ ...editDraft, motorista_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Veículo</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={editDraft.veiculo_id}
                  onChange={(e) => setEditDraft({ ...editDraft, veiculo_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} {v.modelo ? `- ${v.modelo}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Roteiro</label>
              <textarea
                className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]"
                value={editDraft.roteiro}
                onChange={(e) => setEditDraft({ ...editDraft, roteiro: e.target.value })}
                placeholder="Instruções para o motorista seguir o roteiro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dias da semana</label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => {
                  const ativo = editDraft.dias_semana.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleDiaEdicao(d.v)}
                      className={`px-3 py-1 rounded-md border text-sm transition ${
                        ativo ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={editDraft.ativo} onChange={(e) => setEditDraft({ ...editDraft, ativo: e.target.checked })} />
                Horário ativo
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gerarOsContrato ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Gerar OSs do contrato</h3>
            <p className="text-sm text-slate-600">
              Contrato: <strong>{gerarOsContrato.nome}</strong>
            </p>

            <p className="text-xs text-slate-500">
              A geração respeita automaticamente a vigência do contrato (início/fim) e cria uma OS para cada horário válido por dia.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => void gerarOsPeriodo(1)}
                className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-60"
                disabled={gerandoOs}
              >
                {gerandoOs ? "Gerando..." : "Gerar hoje"}
              </button>
              <button
                type="button"
                onClick={() => void gerarOsPeriodo(3)}
                className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-60"
                disabled={gerandoOs}
              >
                {gerandoOs ? "Gerando..." : "Gerar 3 dias"}
              </button>
              <button
                type="button"
                onClick={() => void gerarOsPeriodo(7)}
                className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-60"
                disabled={gerandoOs}
              >
                {gerandoOs ? "Gerando..." : "Gerar 7 dias"}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setGerarOsContrato(null)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                disabled={gerandoOs}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={`Deseja excluir o horário ${deleteTarget ? `(${horaExibicao(deleteTarget)})` : ""}?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />
    </section>
  );
}
