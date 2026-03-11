"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Passageiro = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  status: string;
};

type ContratoPassageiro = {
  id: string;
  passageiro_id: string;
  status: "ATIVO" | "INATIVO";
  tipo_pagante: "PARTICULAR" | "EMPRESA";
  tipo_cobranca: "DIARIA" | "MENSAL";
  valor: number;
  data_inicio: string | null;
  data_fim: string | null;
};

type Rota = { id: string; nome: string };
type Ponto = { id: string; contrato_rota_id: string; nome: string };
type Horario = { id: string; contrato_rota_id: string | null; hora: string };

type Participacao = {
  id: string;
  contrato_passageiro_id: string;
  contrato_rota_id: string;
  contrato_horario_id: string | null;
  ponto_embarque_id: string;
  ponto_desembarque_id: string;
  ativo: boolean;
};

type ContaResumo = {
  id: string;
  descricao: string;
  valor: number;
  status: string;
  data_vencimento: string;
};

export default function ContratoPassageirosPage() {
  const params = useParams<{ id: string }>();
  const contratoId = params?.id;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const [tituloContrato, setTituloContrato] = useState("");
  const [passageiros, setPassageiros] = useState<Passageiro[]>([]);
  const [vinculos, setVinculos] = useState<ContratoPassageiro[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [participacoes, setParticipacoes] = useState<Participacao[]>([]);
  const [contas, setContas] = useState<ContaResumo[]>([]);

  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");
  const [novoTel, setNovoTel] = useState("");

  const [passageiroSel, setPassageiroSel] = useState("");
  const [tipoPagante, setTipoPagante] = useState<"PARTICULAR" | "EMPRESA">("PARTICULAR");
  const [tipoCobranca, setTipoCobranca] = useState<"DIARIA" | "MENSAL">("DIARIA");
  const [valor, setValor] = useState("0");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [vinculoSel, setVinculoSel] = useState("");
  const [rotaSel, setRotaSel] = useState("");
  const [horarioSel, setHorarioSel] = useState("");
  const [embarqueSel, setEmbarqueSel] = useState("");
  const [desembarqueSel, setDesembarqueSel] = useState("");

  async function carregar() {
    if (!contratoId) return;
    setLoading(true);
    setErro("");

    const [
      { data: ct, error: errCt },
      { data: pax, error: errPax },
      { data: cp, error: errCp },
      { data: rt, error: errRt },
      { data: pt, error: errPt },
      { data: hr, error: errHr },
      { data: part, error: errPart },
      { data: contasData, error: errContas },
    ] = await Promise.all([
      supabase.from("contratos").select("nome").eq("id", contratoId).maybeSingle(),
      supabase.from("passageiros").select("id,nome,cpf,telefone,status").order("nome", { ascending: true }),
      supabase
        .from("contrato_passageiros")
        .select("id,passageiro_id,status,tipo_pagante,tipo_cobranca,valor,data_inicio,data_fim")
        .eq("contrato_id", contratoId)
        .order("created_at", { ascending: false }),
      supabase.from("contrato_rotas").select("id,nome").eq("contrato_id", contratoId).eq("ativo", true).order("ordem", { ascending: true }),
      supabase.from("contrato_rota_pontos").select("id,contrato_rota_id,nome").order("ordem", { ascending: true }),
      supabase.from("contrato_horarios").select("id,contrato_rota_id,hora").eq("contrato_id", contratoId).eq("ativo", true).order("hora", { ascending: true }),
      supabase
        .from("contrato_passageiro_participacoes")
        .select("id,contrato_passageiro_id,contrato_rota_id,contrato_horario_id,ponto_embarque_id,ponto_desembarque_id,ativo")
        .order("created_at", { ascending: false }),
      supabase
        .from("contas_financeiras")
        .select("id,descricao,valor,status,data_vencimento")
        .eq("contrato_id", contratoId)
        .eq("tipo", "receber")
        .eq("categoria", "fretamento_passageiro")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const firstErr = errCt ?? errPax ?? errCp ?? errRt ?? errPt ?? errHr ?? errPart ?? errContas;
    if (firstErr) {
      setErro(firstErr.message);
      setLoading(false);
      return;
    }

    setTituloContrato((ct?.nome as string) ?? "Contrato");
    setPassageiros((pax ?? []) as Passageiro[]);
    setVinculos((cp ?? []) as ContratoPassageiro[]);
    setRotas((rt ?? []) as Rota[]);
    setPontos((pt ?? []) as Ponto[]);
    setHorarios((hr ?? []) as Horario[]);
    setParticipacoes((part ?? []) as Participacao[]);
    setContas((contasData ?? []) as ContaResumo[]);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  const passageirosLivres = useMemo(() => {
    const used = new Set(vinculos.map((v) => v.passageiro_id));
    return passageiros.filter((p) => !used.has(p.id));
  }, [passageiros, vinculos]);

  const pontosDaRota = useMemo(() => pontos.filter((p) => p.contrato_rota_id === rotaSel), [pontos, rotaSel]);
  const horariosDaRota = useMemo(() => horarios.filter((h) => (h.contrato_rota_id ?? "") === rotaSel), [horarios, rotaSel]);

  async function criarPassageiro() {
    if (!novoNome.trim()) return alert("Informe o nome do passageiro.");
    const { error } = await supabase.from("passageiros").insert({
      nome: novoNome.trim(),
      cpf: novoCpf.trim() || null,
      telefone: novoTel.trim() || null,
    });
    if (error) return alert(error.message);
    setNovoNome("");
    setNovoCpf("");
    setNovoTel("");
    setMsg("Passageiro cadastrado.");
    await carregar();
  }

  async function vincularPassageiro() {
    if (!passageiroSel) return alert("Selecione o passageiro.");
    const { error } = await supabase.from("contrato_passageiros").insert({
      contrato_id: contratoId,
      passageiro_id: passageiroSel,
      status: "ATIVO",
      tipo_pagante: tipoPagante,
      tipo_cobranca: tipoCobranca,
      valor: Number(valor || 0),
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
    });
    if (error) return alert(error.message);
    setPassageiroSel("");
    setValor("0");
    setDataInicio("");
    setDataFim("");
    setMsg("Passageiro vinculado ao contrato.");
    await carregar();
  }

  async function adicionarParticipacao() {
    if (!vinculoSel || !rotaSel || !embarqueSel || !desembarqueSel) {
      return alert("Selecione vínculo, rota, embarque e desembarque.");
    }
    const { error } = await supabase.from("contrato_passageiro_participacoes").insert({
      contrato_passageiro_id: vinculoSel,
      contrato_rota_id: rotaSel,
      contrato_horario_id: horarioSel || null,
      ponto_embarque_id: embarqueSel,
      ponto_desembarque_id: desembarqueSel,
      ativo: true,
    });
    if (error) return alert(error.message);
    setHorarioSel("");
    setEmbarqueSel("");
    setDesembarqueSel("");
    setMsg("Participação adicionada.");
    await carregar();
  }

  async function atualizarVinculo(v: ContratoPassageiro) {
    const { error } = await supabase
      .from("contrato_passageiros")
      .update({
        status: v.status,
        tipo_pagante: v.tipo_pagante,
        tipo_cobranca: v.tipo_cobranca,
        valor: v.valor,
        data_inicio: v.data_inicio,
        data_fim: v.data_fim,
      })
      .eq("id", v.id);
    if (error) return alert(error.message);
    setMsg("Vínculo atualizado.");
    await carregar();
  }

  async function removerVinculo(v: ContratoPassageiro) {
    if (!confirm("Remover vínculo do passageiro com este contrato?")) return;
    const { error } = await supabase.from("contrato_passageiros").delete().eq("id", v.id);
    if (error) return alert(error.message);
    setMsg("Vínculo removido.");
    await carregar();
  }

  async function removerParticipacao(id: string) {
    if (!confirm("Remover participação?")) return;
    const { error } = await supabase.from("contrato_passageiro_participacoes").delete().eq("id", id);
    if (error) return alert(error.message);
    setMsg("Participação removida.");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Passageiros do Contrato</h1>
          <p className="text-sm text-slate-600">{tituloContrato}</p>
        </div>
        <Link href={`/contratos/${contratoId}`} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
          Voltar
        </Link>
      </div>

      {erro ? <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</div> : null}
      {msg ? <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{msg}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid md:grid-cols-3 gap-3">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome do passageiro" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="CPF" value={novoCpf} onChange={(e) => setNovoCpf(e.target.value)} />
        <div className="flex gap-2">
          <input className="flex-1 border border-slate-300 rounded-md px-3 py-2" placeholder="Telefone" value={novoTel} onChange={(e) => setNovoTel(e.target.value)} />
          <button onClick={criarPassageiro} className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700">Cadastrar</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid md:grid-cols-6 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={passageiroSel} onChange={(e) => setPassageiroSel(e.target.value)}>
          <option value="">Passageiro</option>
          {passageirosLivres.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoPagante} onChange={(e) => setTipoPagante(e.target.value as "PARTICULAR" | "EMPRESA")}>
          <option value="PARTICULAR">Particular</option>
          <option value="EMPRESA">Empresa</option>
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoCobranca} onChange={(e) => setTipoCobranca(e.target.value as "DIARIA" | "MENSAL")}>
          <option value="DIARIA">Diária</option>
          <option value="MENSAL">Mensal</option>
        </select>
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
        <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <div className="flex gap-2">
          <input type="date" className="flex-1 border border-slate-300 rounded-md px-3 py-2" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          <button onClick={vincularPassageiro} className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700">Vincular</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid md:grid-cols-5 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={vinculoSel} onChange={(e) => setVinculoSel(e.target.value)}>
          <option value="">Vínculo passageiro</option>
          {vinculos.map((v) => {
            const p = passageiros.find((x) => x.id === v.passageiro_id);
            return <option key={v.id} value={v.id}>{p?.nome ?? v.id.slice(0, 8)}</option>;
          })}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={rotaSel} onChange={(e) => setRotaSel(e.target.value)}>
          <option value="">Rota</option>
          {rotas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={horarioSel} onChange={(e) => setHorarioSel(e.target.value)}>
          <option value="">Horário (opcional)</option>
          {horariosDaRota.map((h) => <option key={h.id} value={h.id}>{h.hora}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={embarqueSel} onChange={(e) => setEmbarqueSel(e.target.value)}>
          <option value="">Ponto embarque</option>
          {pontosDaRota.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <div className="flex gap-2">
          <select className="flex-1 border border-slate-300 rounded-md px-3 py-2" value={desembarqueSel} onChange={(e) => setDesembarqueSel(e.target.value)}>
            <option value="">Ponto desembarque</option>
            {pontosDaRota.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <button onClick={adicionarParticipacao} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">+</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? <div className="text-slate-600">Carregando...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Passageiro</th>
                  <th className="py-2 pr-4">Vínculo</th>
                  <th className="py-2 pr-4">Participações</th>
                </tr>
              </thead>
              <tbody>
                {vinculos.map((v) => {
                  const p = passageiros.find((x) => x.id === v.passageiro_id);
                  const parts = participacoes.filter((x) => x.contrato_passageiro_id === v.id);
                  return (
                    <tr key={v.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{p?.nome ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <div className="grid md:grid-cols-5 gap-2">
                          <select className="border border-slate-300 rounded px-2 py-1 text-xs" value={v.status} onChange={(e) => setVinculos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: e.target.value as "ATIVO" | "INATIVO" } : x))}>
                            <option value="ATIVO">ATIVO</option>
                            <option value="INATIVO">INATIVO</option>
                          </select>
                          <select className="border border-slate-300 rounded px-2 py-1 text-xs" value={v.tipo_pagante} onChange={(e) => setVinculos((prev) => prev.map((x) => x.id === v.id ? { ...x, tipo_pagante: e.target.value as "PARTICULAR" | "EMPRESA" } : x))}>
                            <option value="PARTICULAR">PARTICULAR</option>
                            <option value="EMPRESA">EMPRESA</option>
                          </select>
                          <select className="border border-slate-300 rounded px-2 py-1 text-xs" value={v.tipo_cobranca} onChange={(e) => setVinculos((prev) => prev.map((x) => x.id === v.id ? { ...x, tipo_cobranca: e.target.value as "DIARIA" | "MENSAL" } : x))}>
                            <option value="DIARIA">DIARIA</option>
                            <option value="MENSAL">MENSAL</option>
                          </select>
                          <input className="border border-slate-300 rounded px-2 py-1 text-xs" value={String(v.valor ?? 0)} onChange={(e) => setVinculos((prev) => prev.map((x) => x.id === v.id ? { ...x, valor: Number(e.target.value || 0) } : x))} />
                          <div className="flex gap-1 justify-end">
                            <button className="px-2 py-1 text-xs border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50" onClick={() => atualizarVinculo(v)}>Salvar</button>
                            <button className="px-2 py-1 text-xs border border-rose-300 text-rose-700 rounded hover:bg-rose-50" onClick={() => removerVinculo(v)}>Remover</button>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-600">
                        <div>{parts.length} participação(ões)</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {parts.map((pt) => (
                            <button key={pt.id} className="px-2 py-0.5 text-[10px] border border-rose-300 text-rose-700 rounded" onClick={() => removerParticipacao(pt.id)}>
                              remover participação
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Financeiro por passageiros (últimos lançamentos)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Descrição</th>
                <th className="py-2 pr-4">Vencimento</th>
                <th className="py-2 pr-4">Valor</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{c.descricao}</td>
                  <td className="py-2 pr-4">{new Date(`${c.data_vencimento}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 pr-4">{Number(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="py-2 pr-4">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
