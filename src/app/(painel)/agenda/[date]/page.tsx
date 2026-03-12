"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { getFeriadosNacionais } from "@/lib/feriados";

type ContratoRec = {
  id: string;
  nome: string;
  dias_semana: number[] | null;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
};

type OSDia = {
  id: string;
  numero: number | null;
  inicio_em: string | null;
  status: string;
  origem: string | null;
  destino: string | null;
  contrato_id: string | null;
  cliente: { nome: string | null } | null;
  veiculo: { placa: string | null; modelo: string | null } | null;
  motorista: { nome: string | null } | null;
};

type OSDiaRaw = Omit<OSDia, "cliente" | "veiculo" | "motorista"> & {
  cliente: { nome: string | null } | Array<{ nome: string | null }> | null;
  veiculo: { placa: string | null; modelo: string | null } | Array<{ placa: string | null; modelo: string | null }> | null;
  motorista: { nome: string | null } | Array<{ nome: string | null }> | null;
};

type AgendaEvento = {
  id: string;
  data: string;
  horario: string | null;
  titulo: string;
  tipo: "reuniao" | "outro" | "lembrete";
  descricao: string | null;
};

type AgendaFeriado = {
  id: string;
  data: string;
  nome: string;
  cor: string;
  origem?: "nacional" | "empresa";
};

type ContaFin = {
  id: string;
  descricao: string;
  data_vencimento: string;
  status: string;
  valor: number;
};

function shiftDateKey(dateKey: string, deltaDays: number) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isDateInRange(dateKey: string, from: string | null, to: string | null) {
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

export default function AgendaDiaPage() {
  const params = useParams<{ date: string }>();
  const selectedDate = params?.date;
  const prevDate = selectedDate ? shiftDateKey(selectedDate, -1) : "";
  const nextDate = selectedDate ? shiftDateKey(selectedDate, 1) : "";

  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [contratos, setContratos] = useState<ContratoRec[]>([]);
  const [osEventuais, setOsEventuais] = useState<OSDia[]>([]);
  const [osRecorrentes, setOsRecorrentes] = useState<OSDia[]>([]);
  const [agendaEventos, setAgendaEventos] = useState<AgendaEvento[]>([]);
  const [feriados, setFeriados] = useState<AgendaFeriado[]>([]);
  const [contas, setContas] = useState<ContaFin[]>([]);

  const [showRecorrente, setShowRecorrente] = useState(true);
  const [showEventual, setShowEventual] = useState(true);
  const [showOutros, setShowOutros] = useState(true);
  const [showFinanceiro, setShowFinanceiro] = useState(true);

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoTipo, setNovoTipo] = useState<AgendaEvento["tipo"]>("outro");
  const [novoHorario, setNovoHorario] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoFeriadoNome, setNovoFeriadoNome] = useState("");
  const [novoFeriadoCor, setNovoFeriadoCor] = useState("#fef3c7");
  const [novaDataOS, setNovaDataOS] = useState(selectedDate || "");

  function normalizarOS(rows: OSDiaRaw[]): OSDia[] {
    return rows.map((r) => ({
      ...r,
      cliente: Array.isArray(r.cliente) ? (r.cliente[0] ?? null) : r.cliente,
      veiculo: Array.isArray(r.veiculo) ? (r.veiculo[0] ?? null) : r.veiculo,
      motorista: Array.isArray(r.motorista) ? (r.motorista[0] ?? null) : r.motorista,
    }));
  }

  async function carregarEmpresaId() {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      setEmpresaId(null);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();
    setEmpresaId(prof?.empresa_id ?? null);
  }

  async function carregarDia() {
    if (!selectedDate) return;
    setLoading(true);

    const [cRes, osEventualRes, osRecorrenteRes, agendaRes, feriadosRes, financeiroRes] = await Promise.all([
      supabase
        .from("contratos")
        .select("id, nome, dias_semana, data_inicio, data_fim, ativo")
        .eq("ativo", true),
      supabase
        .from("ordens_servico")
        .select("id, numero, inicio_em, status, origem, destino, contrato_id, cliente:clientes(nome), veiculo:veiculos(placa, modelo), motorista:motoristas(nome)")
        .eq("tipo", "eventual")
        .neq("status", "concluida")
        .gte("inicio_em", `${selectedDate}T00:00:00`)
        .lte("inicio_em", `${selectedDate}T23:59:59`),
      supabase
        .from("ordens_servico")
        .select("id, numero, inicio_em, status, origem, destino, contrato_id, cliente:clientes(nome), veiculo:veiculos(placa, modelo), motorista:motoristas(nome)")
        .eq("tipo", "recorrente")
        .neq("status", "concluida")
        .gte("inicio_em", `${selectedDate}T00:00:00`)
        .lte("inicio_em", `${selectedDate}T23:59:59`),
      supabase
        .from("agenda_eventos")
        .select("id, data, horario, titulo, tipo, descricao")
        .eq("data", selectedDate)
        .order("horario"),
      supabase
        .from("agenda_feriados")
        .select("id, data, nome, cor")
        .eq("data", selectedDate),
      supabase
        .from("contas_financeiras")
        .select("id, descricao, data_vencimento, status, valor")
        .eq("data_vencimento", selectedDate)
        .neq("status", "cancelado"),
    ]);

    setContratos((cRes.data ?? []) as ContratoRec[]);
    setOsEventuais(normalizarOS((osEventualRes.data ?? []) as OSDiaRaw[]));
    setOsRecorrentes(normalizarOS((osRecorrenteRes.data ?? []) as OSDiaRaw[]));
    setAgendaEventos((agendaRes.data ?? []) as AgendaEvento[]);
    setFeriados((feriadosRes.data ?? []) as AgendaFeriado[]);
    setContas((financeiroRes.data ?? []) as ContaFin[]);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await carregarEmpresaId();
      await carregarDia();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const diaRecorrentes = useMemo(() => {
    if (!selectedDate) return [];
    const d = new Date(`${selectedDate}T12:00:00`);
    const dow = d.getDay();
    return contratos.filter(
      (c) =>
        c.ativo &&
        (c.dias_semana ?? []).includes(dow) &&
        isDateInRange(selectedDate, c.data_inicio, c.data_fim)
    );
  }, [contratos, selectedDate]);

  const feriadosDoDia = useMemo(() => {
    if (!selectedDate) return feriados;

    const year = Number(selectedDate.slice(0, 4));
    const nacionais = getFeriadosNacionais(year)
      .filter((f) => f.data === selectedDate)
      .map((f) => ({
        id: f.id,
        data: f.data,
        nome: f.nome,
        cor: f.cor,
        origem: "nacional" as const,
      }));

    const empresa = feriados.map((f) => ({ ...f, origem: "empresa" as const }));

    const dedupe = new Map<string, AgendaFeriado>();
    [...nacionais, ...empresa].forEach((f) => {
      const key = `${f.data}-${f.nome.toLowerCase()}`;
      if (!dedupe.has(key)) dedupe.set(key, f);
    });

    return Array.from(dedupe.values());
  }, [feriados, selectedDate]);

  async function criarEvento(e: FormEvent) {
    e.preventDefault();
    if (!empresaId || !selectedDate) return alert("Empresa/data inválida.");
    if (!novoTitulo.trim()) return alert("Informe um título.");

    const { error } = await supabase.from("agenda_eventos").insert({
      empresa_id: empresaId,
      data: selectedDate,
      horario: novoHorario || null,
      titulo: novoTitulo.trim(),
      tipo: novoTipo,
      descricao: novaDescricao.trim() || null,
    });
    if (error) return alert("Erro ao criar compromisso: " + error.message);

    setNovoTitulo("");
    setNovoHorario("");
    setNovaDescricao("");
    await carregarDia();
  }

  async function removerEvento(id: string) {
    const { error } = await supabase.from("agenda_eventos").delete().eq("id", id);
    if (error) return alert("Erro ao remover compromisso: " + error.message);
    await carregarDia();
  }

  async function criarFeriado(e: FormEvent) {
    e.preventDefault();
    if (!empresaId || !selectedDate) return alert("Empresa/data inválida.");
    if (!novoFeriadoNome.trim()) return alert("Informe o nome do feriado.");

    const { error } = await supabase.from("agenda_feriados").insert({
      empresa_id: empresaId,
      data: selectedDate,
      nome: novoFeriadoNome.trim(),
      cor: novoFeriadoCor,
    });
    if (error) return alert("Erro ao criar feriado: " + error.message);

    setNovoFeriadoNome("");
    await carregarDia();
  }

  async function removerFeriado(id: string) {
    const { error } = await supabase.from("agenda_feriados").delete().eq("id", id);
    if (error) return alert("Erro ao remover feriado: " + error.message);
    await carregarDia();
  }

  async function moverOS(id: string) {
    if (!novaDataOS) return alert("Informe a nova data.");
    const { error } = await supabase
      .from("ordens_servico")
      .update({ inicio_em: `${novaDataOS}T08:00:00` })
      .eq("id", id);
    if (error) return alert("Erro ao mover OS: " + error.message);
    await carregarDia();
  }

  async function excluirOS(id: string) {
    const ok = confirm("Excluir apenas esta OS?");
    if (!ok) return;
    const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
    if (error) return alert("Erro ao excluir OS: " + error.message);
    await carregarDia();
  }

  async function moverLoteContrato(contratoId: string) {
    if (!novaDataOS) return alert("Informe a nova data.");
    const ok = confirm("Deseja mover todas as OS deste contrato neste dia?");
    if (!ok) return;

    const alvos = osEventuais.filter((x) => x.contrato_id === contratoId);
    for (const os of alvos) {
      const { error } = await supabase
        .from("ordens_servico")
        .update({ inicio_em: `${novaDataOS}T08:00:00` })
        .eq("id", os.id);
      if (error) return alert("Erro ao mover lote: " + error.message);
    }
    await carregarDia();
  }

  async function excluirLoteContrato(contratoId: string) {
    const ok = confirm("Excluir todas as OS deste contrato neste dia?");
    if (!ok) return;
    const { error } = await supabase
      .from("ordens_servico")
      .delete()
      .eq("contrato_id", contratoId)
      .gte("inicio_em", `${selectedDate}T00:00:00`)
      .lte("inicio_em", `${selectedDate}T23:59:59`);
    if (error) return alert("Erro ao excluir lote: " + error.message);
    await carregarDia();
  }

  const contratosComOSNoDia = useMemo(() => {
    const ids = Array.from(new Set(osEventuais.map((x) => x.contrato_id).filter(Boolean))) as string[];
    return ids
      .map((id) => ({ id, nome: diaRecorrentes.find((c) => c.id === id)?.nome ?? `Contrato ${id.slice(0, 8)}` }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [osEventuais, diaRecorrentes]);

  function veiculoLabel(os: OSDia) {
    if (!os.veiculo?.placa && !os.veiculo?.modelo) return "—";
    return [os.veiculo?.placa, os.veiculo?.modelo].filter(Boolean).join(" • ");
  }

  function motoristaLabel(os: OSDia) {
    return os.motorista?.nome || "—";
  }

  function clienteLabel(os: OSDia) {
    return os.cliente?.nome || "—";
  }

  function rotaLabel(os: OSDia) {
    if (os.origem || os.destino) {
      return [os.origem || "Origem", os.destino || "Destino"].join(" → ");
    }
    const nomeContrato = os.contrato_id
      ? contratos.find((c) => c.id === os.contrato_id)?.nome
      : null;
    return nomeContrato || "Rota não informada";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda do Dia"
        description={selectedDate ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR") : ""}
        actions={
          <div className="flex gap-2">
            <Link href={`/agenda/${prevDate}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              ← Dia anterior
            </Link>
            <Link href={`/agenda/${nextDate}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Próximo dia →
            </Link>
            <Link href="/agenda" className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">
              Voltar para calendário
            </Link>
          </div>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showRecorrente} onChange={(e) => setShowRecorrente(e.target.checked)} /> Recorrentes</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showEventual} onChange={(e) => setShowEventual(e.target.checked)} /> Eventuais</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showOutros} onChange={(e) => setShowOutros(e.target.checked)} /> Outros</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showFinanceiro} onChange={(e) => setShowFinanceiro(e.target.checked)} /> Financeiro</label>
        </div>
      </div>

      {showEventual && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm">OS eventuais do dia</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Nova data:</label>
            <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={novaDataOS} onChange={(e) => setNovaDataOS(e.target.value)} />
          </div>
          {osEventuais.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma OS eventual no dia.</p>
          ) : (
            <div className="space-y-2">
              {osEventuais.map((x) => (
                <div key={x.id} className="border border-blue-200 bg-blue-50/40 rounded-md p-3 flex items-start justify-between gap-3">
                  <div className="text-sm space-y-1">
                    <div className="font-medium">OS {x.numero ? `#${x.numero}` : x.id.slice(0, 8)} <span className="text-slate-500">({x.status})</span></div>
                    <div><span className="text-slate-500">Cliente:</span> {clienteLabel(x)}</div>
                    <div><span className="text-slate-500">Veículo:</span> {veiculoLabel(x)}</div>
                    <div><span className="text-slate-500">Motorista:</span> {motoristaLabel(x)}</div>
                    <div><span className="text-slate-500">Destino:</span> {x.destino || "—"}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => moverOS(x.id)} className="text-xs border border-slate-300 rounded px-2 py-1">Mover data</button>
                    <button onClick={() => excluirOS(x.id)} className="text-xs border border-red-200 text-red-700 rounded px-2 py-1">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {contratosComOSNoDia.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2">Ações em lote por contrato</h4>
              <div className="space-y-2">
                {contratosComOSNoDia.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-md p-3">
                    <span className="text-sm">{c.nome}</span>
                    <div className="flex gap-2">
                      <button onClick={() => moverLoteContrato(c.id)} className="text-xs border border-slate-300 rounded px-2 py-1">Mover todas para nova data</button>
                      <button onClick={() => excluirLoteContrato(c.id)} className="text-xs border border-red-200 text-red-700 rounded px-2 py-1">Excluir todas do dia</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showRecorrente && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">OS recorrentes do dia</h3>
          {osRecorrentes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma OS recorrente no dia.</p>
          ) : (
            <div className="space-y-2">
              {osRecorrentes.map((x) => (
                <div key={x.id} className="border border-green-200 bg-green-50/40 rounded-md p-3 text-sm space-y-1">
                  <div className="font-medium">{rotaLabel(x)}</div>
                  <div><span className="text-slate-500">Veículo:</span> {veiculoLabel(x)}</div>
                  <div><span className="text-slate-500">Motorista:</span> {motoristaLabel(x)}</div>
                  <div><span className="text-slate-500">Status:</span> {x.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showOutros && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">Compromissos do dia</h3>
            {agendaEventos.length === 0 ? <p className="text-sm text-slate-500">Nenhum.</p> : (
              <ul className="text-sm space-y-2">
                {agendaEventos.map((x) => (
                  <li key={x.id} className="flex items-start justify-between gap-3">
                    <span>• {x.horario ? `${x.horario.slice(0, 5)} ` : ""}{x.titulo} <span className="text-slate-500">({x.tipo})</span></span>
                    <button onClick={() => removerEvento(x.id)} className="text-xs border border-red-200 text-red-700 rounded px-2 py-1">Remover</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={criarEvento} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm">
            <h3 className="font-semibold">Adicionar compromisso</h3>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" placeholder="Título" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <select className="border border-slate-300 rounded-md px-3 py-2" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as AgendaEvento["tipo"])}>
                <option value="outro">Outro</option>
                <option value="reuniao">Reunião</option>
                <option value="lembrete">Lembrete</option>
              </select>
              <input className="border border-slate-300 rounded-md px-3 py-2" type="time" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} />
            </div>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[80px]" placeholder="Descrição" value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} />
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Salvar compromisso</button>
          </form>
        </div>
      )}

      {showFinanceiro && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-sm mb-2">Financeiro (vencimentos)</h3>
          {contas.length === 0 ? <p className="text-sm text-slate-500">Nenhum vencimento.</p> : (
            <ul className="text-sm space-y-1">
              {contas.map((x) => <li key={x.id}>• {x.descricao} — {x.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ({x.status})</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">Feriados do dia</h3>
          {feriadosDoDia.length === 0 ? <p className="text-sm text-slate-500">Nenhum.</p> : (
            <ul className="text-sm space-y-2">
              {feriadosDoDia.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border" style={{ backgroundColor: f.cor }} /> {f.nome} {f.origem === "nacional" ? <span className="text-[10px] px-1 rounded bg-amber-100 border border-amber-200 text-amber-700">Nacional</span> : null}</span>
                  {f.origem === "empresa" ? (
                    <button onClick={() => removerFeriado(f.id)} className="text-xs border border-red-200 text-red-700 rounded px-2 py-1">Remover</button>
                  ) : (
                    <span className="text-xs text-slate-500">Automático</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={criarFeriado} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm">
          <h3 className="font-semibold">Adicionar feriado</h3>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" placeholder="Nome do feriado" value={novoFeriadoNome} onChange={(e) => setNovoFeriadoNome(e.target.value)} />
          <div>
            <label className="text-sm text-slate-600">Cor</label>
            <input type="color" className="ml-3" value={novoFeriadoCor} onChange={(e) => setNovoFeriadoCor(e.target.value)} />
          </div>
          <button className="bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600">Salvar feriado</button>
        </form>
      </div>

      {loading ? <div className="text-sm text-slate-500">Carregando...</div> : null}
    </div>
  );
}
