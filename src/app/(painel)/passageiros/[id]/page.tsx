"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Contrato = { id: string; nome: string; ativo: boolean; cliente_id: string | null };
type Cliente = { id: string; nome: string };
type Rota = { id: string; contrato_id: string; nome: string; ativo: boolean };
type Ponto = { id: string; contrato_rota_id: string; nome: string; ativo: boolean };
type Horario = { id: string; contrato_id: string; contrato_rota_id: string | null; hora: string | null; dias_semana: number[] | null; ativo: boolean };

type Vinculo = {
  id: string;
  contrato_id: string;
  status: "ATIVO" | "INATIVO";
  tipo_pagante: "PARTICULAR" | "EMPRESA";
  empresa_pagante_id: string | null;
  tipo_cobranca: "DIARIA" | "MENSAL";
  valor: number;
  data_inicio: string | null;
  data_fim: string | null;
};

type Participacao = {
  id: string;
  contrato_passageiro_id: string;
  contrato_rota_id: string;
  contrato_horario_id: string | null;
  ponto_embarque_id: string;
  ponto_desembarque_id: string;
  sentido: "IDA" | "VOLTA";
  dias_semana: number[];
  data_inicio: string | null;
  data_fim: string | null;
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

export default function PassageiroOperacaoPage() {
  const params = useParams<{ id: string }>();
  const passageiroId = params?.id;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [nomePassageiro, setNomePassageiro] = useState("");

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [participacoes, setParticipacoes] = useState<Participacao[]>([]);

  const [contratoSel, setContratoSel] = useState("");
  const [tipoPagante, setTipoPagante] = useState<"PARTICULAR" | "EMPRESA">("PARTICULAR");
  const [empresaPaganteId, setEmpresaPaganteId] = useState("");
  const [tipoCobranca, setTipoCobranca] = useState<"DIARIA" | "MENSAL">("DIARIA");
  const [valor, setValor] = useState("0");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [vinculoSel, setVinculoSel] = useState("");
  const [rotaSel, setRotaSel] = useState("");
  const [horarioSel, setHorarioSel] = useState("");
  const [embarqueSel, setEmbarqueSel] = useState("");
  const [desembarqueSel, setDesembarqueSel] = useState("");
  const [sentidoSel, setSentidoSel] = useState<"IDA" | "VOLTA">("IDA");
  const [diasSel, setDiasSel] = useState<number[]>([1, 2, 3, 4, 5]);
  const [partDataInicio, setPartDataInicio] = useState("");
  const [partDataFim, setPartDataFim] = useState("");

  async function carregar() {
    if (!passageiroId) return;
    setLoading(true);
    setErro("");
    const [paxRes, contratosRes, clientesRes, rotasRes, pontosRes, horariosRes, vinculosRes, participacoesRes] = await Promise.all([
      supabase.from("passageiros").select("id,nome").eq("id", passageiroId).maybeSingle(),
      supabase.from("contratos").select("id,nome,ativo,cliente_id").order("nome", { ascending: true }),
      supabase.from("clientes").select("id,nome").order("nome", { ascending: true }),
      supabase.from("contrato_rotas").select("id,contrato_id,nome,ativo").eq("ativo", true),
      supabase.from("contrato_rota_pontos").select("id,contrato_rota_id,nome,ativo").eq("ativo", true),
      supabase.from("contrato_horarios").select("id,contrato_id,contrato_rota_id,hora,dias_semana,ativo").eq("ativo", true),
      supabase
        .from("contrato_passageiros")
        .select("id,contrato_id,status,tipo_pagante,empresa_pagante_id,tipo_cobranca,valor,data_inicio,data_fim")
        .eq("passageiro_id", passageiroId),
      supabase
        .from("contrato_passageiro_participacoes")
        .select("id,contrato_passageiro_id,contrato_rota_id,contrato_horario_id,ponto_embarque_id,ponto_desembarque_id,sentido,dias_semana,data_inicio,data_fim"),
    ]);
    const firstErr =
      paxRes.error ?? contratosRes.error ?? clientesRes.error ?? rotasRes.error ?? pontosRes.error ?? horariosRes.error ?? vinculosRes.error ?? participacoesRes.error;
    if (firstErr) {
      setErro(firstErr.message);
      setLoading(false);
      return;
    }
    if (!paxRes.data) {
      setErro("Passageiro não encontrado.");
      setLoading(false);
      return;
    }

    setNomePassageiro((paxRes.data as { nome: string }).nome);
    setContratos((contratosRes.data ?? []) as Contrato[]);
    setClientes((clientesRes.data ?? []) as Cliente[]);
    setRotas((rotasRes.data ?? []) as Rota[]);
    setPontos((pontosRes.data ?? []) as Ponto[]);
    setHorarios((horariosRes.data ?? []) as Horario[]);
    const vinculosRows = (vinculosRes.data ?? []) as Vinculo[];
    setVinculos(vinculosRows);
    const ids = new Set(vinculosRows.map((v) => v.id));
    setParticipacoes(((participacoesRes.data ?? []) as Participacao[]).filter((p) => ids.has(p.contrato_passageiro_id)));
    setLoading(false);
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageiroId]);

  const contratoById = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);
  const clienteById = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);
  const pontoById = useMemo(() => new Map(pontos.map((p) => [p.id, p.nome])), [pontos]);
  const horariosRota = useMemo(() => horarios.filter((h) => !rotaSel || !h.contrato_rota_id || h.contrato_rota_id === rotaSel), [horarios, rotaSel]);
  const pontosRota = useMemo(() => pontos.filter((p) => p.contrato_rota_id === rotaSel), [pontos, rotaSel]);
  const rotasVinculo = useMemo(() => {
    const v = vinculos.find((x) => x.id === vinculoSel);
    if (!v) return [];
    return rotas.filter((r) => r.contrato_id === v.contrato_id && r.ativo);
  }, [vinculoSel, vinculos, rotas]);

  function preencherEmpresaDoContrato(idContrato: string) {
    const contrato = contratoById.get(idContrato);
    if (contrato?.cliente_id) setEmpresaPaganteId(contrato.cliente_id);
  }

  function toggleDia(dia: number) {
    setDiasSel((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort((a, b) => a - b)));
  }

  async function criarVinculo() {
    if (!passageiroId || !contratoSel) return alert("Selecione o contrato.");
    if (tipoPagante === "EMPRESA" && !empresaPaganteId) return alert("Selecione a empresa pagante.");
    const { error } = await supabase.from("contrato_passageiros").insert({
      passageiro_id: passageiroId,
      contrato_id: contratoSel,
      status: "ATIVO",
      tipo_pagante: tipoPagante,
      empresa_pagante_id: tipoPagante === "EMPRESA" ? empresaPaganteId : null,
      tipo_cobranca: tipoCobranca,
      valor: Number(valor || 0),
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
    });
    if (error) return alert(error.message);
    setMsg("Vínculo criado.");
    await carregar();
    setStep(2);
  }

  async function criarParticipacao() {
    if (!vinculoSel || !rotaSel || !embarqueSel || !desembarqueSel) return alert("Preencha os campos obrigatórios.");
    if (diasSel.length === 0) return alert("Selecione ao menos 1 dia.");
    if (partDataInicio && partDataFim && partDataFim < partDataInicio) return alert("Data fim menor que início.");

    const duplicada = participacoes.some(
      (p) => p.contrato_passageiro_id === vinculoSel && p.contrato_rota_id === rotaSel && (p.contrato_horario_id ?? "") === (horarioSel || "") && p.sentido === sentidoSel,
    );
    if (duplicada) return alert("Já existe participação igual para esse vínculo/rota/horário/sentido.");

    const { error } = await supabase.from("contrato_passageiro_participacoes").insert({
      contrato_passageiro_id: vinculoSel,
      contrato_rota_id: rotaSel,
      contrato_horario_id: horarioSel || null,
      ponto_embarque_id: embarqueSel,
      ponto_desembarque_id: desembarqueSel,
      sentido: sentidoSel,
      dias_semana: diasSel,
      data_inicio: partDataInicio || null,
      data_fim: partDataFim || null,
      ativo: true,
    });
    if (error) return alert(error.message);
    setMsg("Participação criada.");
    await carregar();
    setStep(3);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Operação do passageiro • ${nomePassageiro || "..."}`}
        description="Fluxo em etapas para reduzir erro operacional."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/passageiros/${passageiroId}/cadastro`} className="border border-slate-300 px-3 py-2 rounded-md text-sm hover:bg-slate-50">
              Editar cadastro
            </Link>
            <Link href="/passageiros" className="border border-slate-300 px-3 py-2 rounded-md text-sm hover:bg-slate-50">
              Voltar
            </Link>
          </div>
        }
      />

      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={() => setStep(1)} className={`px-2 py-1 rounded ${step === 1 ? "bg-slate-900 text-white" : "border border-slate-300"}`}>1. Vínculo</button>
        <button type="button" onClick={() => setStep(2)} className={`px-2 py-1 rounded ${step === 2 ? "bg-slate-900 text-white" : "border border-slate-300"}`}>2. Participação</button>
        <button type="button" onClick={() => setStep(3)} className={`px-2 py-1 rounded ${step === 3 ? "bg-slate-900 text-white" : "border border-slate-300"}`}>3. Revisão</button>
      </div>

      {erro ? <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{erro}</div> : null}
      {msg ? <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{msg}</div> : null}
      {loading ? <div className="text-sm text-slate-600">Carregando...</div> : null}

      {!loading && step === 1 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 grid md:grid-cols-7 gap-3">
          <select className="border border-slate-300 rounded-md px-3 py-2" value={contratoSel} onChange={(e) => { setContratoSel(e.target.value); preencherEmpresaDoContrato(e.target.value); }}>
            <option value="">Contrato</option>
            {contratos.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoPagante} onChange={(e) => setTipoPagante(e.target.value as "PARTICULAR" | "EMPRESA")}>
            <option value="PARTICULAR">Particular</option>
            <option value="EMPRESA">Empresa</option>
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={empresaPaganteId} disabled={tipoPagante !== "EMPRESA"} onChange={(e) => setEmpresaPaganteId(e.target.value)}>
            <option value="">Empresa pagante</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoCobranca} onChange={(e) => setTipoCobranca(e.target.value as "DIARIA" | "MENSAL")}>
            <option value="DIARIA">Diária</option>
            <option value="MENSAL">Mensal</option>
          </select>
          <input className="border border-slate-300 rounded-md px-3 py-2" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor" />
          <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <div className="flex gap-2">
            <input type="date" className="flex-1 border border-slate-300 rounded-md px-3 py-2" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            <button onClick={criarVinculo} className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm">Salvar</button>
          </div>
        </div>
      ) : null}

      {!loading && step === 2 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 grid md:grid-cols-7 gap-3">
          <select className="border border-slate-300 rounded-md px-3 py-2" value={vinculoSel} onChange={(e) => setVinculoSel(e.target.value)}>
            <option value="">Vínculo</option>
            {vinculos.map((v) => <option key={v.id} value={v.id}>{contratoById.get(v.contrato_id)?.nome ?? "Contrato"}</option>)}
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={rotaSel} onChange={(e) => setRotaSel(e.target.value)}>
            <option value="">Rota</option>
            {rotasVinculo.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <select
            className="border border-slate-300 rounded-md px-3 py-2"
            value={horarioSel}
            onChange={(e) => {
              const id = e.target.value;
              setHorarioSel(id);
              const h = horarios.find((x) => x.id === id);
              if (h?.dias_semana && h.dias_semana.length > 0) setDiasSel([...h.dias_semana]);
            }}
          >
            <option value="">Horário (opcional)</option>
            {horariosRota.map((h) => <option key={h.id} value={h.id}>{(h.hora ?? "--:--").slice(0, 5)}</option>)}
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={embarqueSel} onChange={(e) => setEmbarqueSel(e.target.value)}>
            <option value="">Embarque</option>
            {pontosRota.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={desembarqueSel} onChange={(e) => setDesembarqueSel(e.target.value)}>
            <option value="">Desembarque</option>
            {pontosRota.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={sentidoSel} onChange={(e) => setSentidoSel(e.target.value as "IDA" | "VOLTA")}>
            <option value="IDA">IDA</option>
            <option value="VOLTA">VOLTA</option>
          </select>
          <button onClick={criarParticipacao} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Salvar</button>

          <div className="md:col-span-5 flex flex-wrap gap-1">
            {DIAS.map((d) => (
              <button key={d.v} type="button" onClick={() => toggleDia(d.v)} className={`px-2 py-1 rounded text-xs border ${diasSel.includes(d.v) ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-2">
            <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={partDataInicio} onChange={(e) => setPartDataInicio(e.target.value)} />
            <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={partDataFim} onChange={(e) => setPartDataFim(e.target.value)} />
          </div>
        </div>
      ) : null}

      {!loading && step === 3 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Contrato</th>
                <th className="py-2 pr-4">Pagante</th>
                <th className="py-2 pr-4">Participações</th>
              </tr>
            </thead>
            <tbody>
              {vinculos.map((v) => {
                const contrato = contratoById.get(v.contrato_id);
                const pagante = v.tipo_pagante === "PARTICULAR" ? "Particular" : clienteById.get(v.empresa_pagante_id ?? "") ?? "Empresa";
                const parts = participacoes.filter((p) => p.contrato_passageiro_id === v.id);
                return (
                  <tr key={v.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-4">{contrato?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{pagante}</td>
                    <td className="py-2 pr-4">
                      {parts.length === 0 ? (
                        <span className="text-slate-500">Sem participação</span>
                      ) : (
                        <div className="space-y-1">
                          {parts.map((p) => (
                            <div key={p.id} className="text-xs border border-slate-200 rounded px-2 py-1">
                              {pontoById.get(p.ponto_embarque_id) ?? "Embarque"} → {pontoById.get(p.ponto_desembarque_id) ?? "Desembarque"}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
