"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Passageiro = {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  status: string;
  cidade: string | null;
  uf: string | null;
  created_at: string;
};

type Contrato = {
  id: string;
  nome: string;
  ativo: boolean;
};

type ContratoPassageiro = {
  id: string;
  contrato_id: string;
  passageiro_id: string;
  status: "ATIVO" | "INATIVO";
  tipo_pagante: "PARTICULAR" | "EMPRESA";
  tipo_cobranca: "DIARIA" | "MENSAL";
  valor: number;
  data_inicio: string | null;
  data_fim: string | null;
};

function toMoney(v: string, fallback = 0) {
  const n = Number(v.replace(".", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : fallback;
}

export default function PassageirosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [passageiros, setPassageiros] = useState<Passageiro[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [vinculos, setVinculos] = useState<ContratoPassageiro[]>([]);

  const [busca, setBusca] = useState("");

  const [passageiroSel, setPassageiroSel] = useState("");
  const [contratoSel, setContratoSel] = useState("");
  const [tipoPagante, setTipoPagante] = useState<"PARTICULAR" | "EMPRESA">("PARTICULAR");
  const [tipoCobranca, setTipoCobranca] = useState<"DIARIA" | "MENSAL">("DIARIA");
  const [valor, setValor] = useState("0");
  const [statusVinculo, setStatusVinculo] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  async function carregarTudo() {
    setLoading(true);
    setErro("");

    const [pRes, cRes, cpRes] = await Promise.all([
      supabase
        .from("passageiros")
        .select("id, nome, email, cpf, rg, data_nascimento, telefone, status, cidade, uf, created_at")
        .order("nome", { ascending: true }),
      supabase
        .from("contratos")
        .select("id, nome, ativo")
        .order("nome", { ascending: true }),
      supabase
        .from("contrato_passageiros")
        .select("id, contrato_id, passageiro_id, status, tipo_pagante, tipo_cobranca, valor, data_inicio, data_fim")
        .order("created_at", { ascending: false }),
    ]);

    const firstErr = pRes.error ?? cRes.error ?? cpRes.error;
    if (firstErr) {
      setErro(firstErr.message);
      setLoading(false);
      return;
    }

    setPassageiros((pRes.data ?? []) as Passageiro[]);
    setContratos((cRes.data ?? []) as Contrato[]);
    setVinculos((cpRes.data ?? []) as ContratoPassageiro[]);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregarTudo();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const passageirosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return passageiros;
    return passageiros.filter((p) => {
      const alvo = [
        p.nome,
        p.email ?? "",
        p.cpf ?? "",
        p.rg ?? "",
        p.telefone ?? "",
        p.cidade ?? "",
        p.uf ?? "",
        p.status,
      ]
        .join(" ")
        .toLowerCase();
      return alvo.includes(q);
    });
  }, [passageiros, busca]);

  const contratosMap = useMemo(() => {
    const m: Record<string, Contrato> = {};
    contratos.forEach((c) => {
      m[c.id] = c;
    });
    return m;
  }, [contratos]);

  function vinculosDoPassageiro(passageiroId: string) {
    return vinculos.filter((v) => v.passageiro_id === passageiroId);
  }

  async function vincularPassageiroContrato() {
    if (!passageiroSel || !contratoSel) return;
    if (dataInicio && dataFim && dataFim < dataInicio) {
      setErro("Data fim do vínculo não pode ser menor que data início.");
      return;
    }
    setErro("");
    setOkMsg("");

    const { error } = await supabase.from("contrato_passageiros").insert({
      passageiro_id: passageiroSel,
      contrato_id: contratoSel,
      status: statusVinculo,
      tipo_pagante: tipoPagante,
      tipo_cobranca: tipoCobranca,
      valor: toMoney(valor, 0),
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
    });

    if (error) {
      setErro(error.message);
      return;
    }

    setPassageiroSel("");
    setContratoSel("");
    setValor("0");
    setStatusVinculo("ATIVO");
    setDataInicio("");
    setDataFim("");
    setOkMsg("Passageiro vinculado ao contrato com sucesso.");
    await carregarTudo();
  }

  async function salvarVinculo(v: ContratoPassageiro) {
    if (v.data_inicio && v.data_fim && v.data_fim < v.data_inicio) {
      setErro("Data fim do vínculo não pode ser menor que data início.");
      return;
    }
    setErro("");
    setOkMsg("");

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

    if (error) {
      setErro(error.message);
      return;
    }

    setOkMsg("Vínculo atualizado com sucesso.");
    await carregarTudo();
  }

  function atualizarVinculoLocal(id: string, patch: Partial<ContratoPassageiro>) {
    setVinculos((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function removerVinculo(vinculoId: string) {
    if (!confirm("Remover vínculo deste passageiro com o contrato?")) return;
    setErro("");
    setOkMsg("");

    const { error } = await supabase.from("contrato_passageiros").delete().eq("id", vinculoId);
    if (error) {
      setErro(error.message);
      return;
    }

    setOkMsg("Vínculo removido com sucesso.");
    await carregarTudo();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passageiros"
        description="Módulo exclusivo para cadastro manual de passageiros e vínculo aos contratos."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/passageiros/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Novo Passageiro
            </Link>
            <button onClick={carregarTudo} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </div>
        }
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Vincular passageiro ao contrato</h2>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={passageiroSel}
            onChange={(e) => setPassageiroSel(e.target.value)}
          >
            <option value="">Selecione o passageiro</option>
            {passageiros.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={contratoSel}
            onChange={(e) => setContratoSel(e.target.value)}
          >
            <option value="">Selecione o contrato</option>
            {contratos.filter((c) => c.ativo).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="border border-slate-300 rounded-md px-3 py-2"
              value={tipoPagante}
              onChange={(e) => setTipoPagante(e.target.value as "PARTICULAR" | "EMPRESA")}
            >
              <option value="PARTICULAR">Particular</option>
              <option value="EMPRESA">Empresa</option>
            </select>
            <select
              className="border border-slate-300 rounded-md px-3 py-2"
              value={tipoCobranca}
              onChange={(e) => setTipoCobranca(e.target.value as "DIARIA" | "MENSAL")}
            >
              <option value="DIARIA">Diária</option>
              <option value="MENSAL">Mensal</option>
            </select>
            <input
              className="border border-slate-300 rounded-md px-3 py-2"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Valor"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="border border-slate-300 rounded-md px-3 py-2"
              value={statusVinculo}
              onChange={(e) => setStatusVinculo(e.target.value as "ATIVO" | "INATIVO")}
            >
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
            <input
              type="date"
              className="border border-slate-300 rounded-md px-3 py-2"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <input
              type="date"
              className="border border-slate-300 rounded-md px-3 py-2"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <button
            onClick={vincularPassageiroContrato}
            disabled={!passageiroSel || !contratoSel}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition disabled:opacity-60"
          >
            Vincular ao contrato
          </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Passageiros cadastrados</h2>
          <input
            className="w-full max-w-sm border border-slate-300 rounded-md px-3 py-2"
            placeholder="Buscar passageiro por nome/CPF/telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-sm text-slate-600">Carregando...</div>
        ) : passageirosFiltrados.length === 0 ? (
          <div className="text-sm text-slate-600">Nenhum passageiro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Passageiro</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Localidade</th>
                  <th className="py-2 pr-4">Contratos vinculados</th>
                </tr>
              </thead>
              <tbody>
                {passageirosFiltrados.map((p) => {
                  const vincs = vinculosDoPassageiro(p.id);
                  return (
                    <tr key={p.id} className="border-b last:border-b-0 align-top">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-slate-900">{p.nome}</div>
                        <div className="text-xs text-slate-500">CPF: {p.cpf ?? "—"}</div>
                        <div className="text-xs text-slate-500">E-mail: {p.email ?? "—"}</div>
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        <div>{p.telefone ?? "—"}</div>
                        <div className="mt-1">
                          <Link href={`/passageiros/${p.id}`} className="text-xs text-blue-700 hover:underline">
                            Editar cadastro
                          </Link>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-slate-700">{p.status}</td>
                      <td className="py-2 pr-4 text-slate-700">{[p.cidade, p.uf].filter(Boolean).join("/") || "—"}</td>
                      <td className="py-2 pr-4">
                        {vincs.length === 0 ? (
                          <span className="text-xs text-slate-500">Sem vínculo</span>
                        ) : (
                          <div className="space-y-2">
                            {vincs.map((v) => (
                              <div key={v.id} className="rounded border border-slate-200 px-2 py-1.5 flex items-center justify-between gap-2">
                                <div className="text-xs text-slate-700">
                                  <div className="font-medium">{contratosMap[v.contrato_id]?.nome ?? "Contrato"}</div>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-1 mt-1">
                                    <select
                                      className="border border-slate-300 rounded px-1.5 py-1"
                                      value={v.status}
                                      onChange={(e) => atualizarVinculoLocal(v.id, { status: e.target.value as "ATIVO" | "INATIVO" })}
                                    >
                                      <option value="ATIVO">ATIVO</option>
                                      <option value="INATIVO">INATIVO</option>
                                    </select>
                                    <select
                                      className="border border-slate-300 rounded px-1.5 py-1"
                                      value={v.tipo_pagante}
                                      onChange={(e) => atualizarVinculoLocal(v.id, { tipo_pagante: e.target.value as "PARTICULAR" | "EMPRESA" })}
                                    >
                                      <option value="PARTICULAR">PARTICULAR</option>
                                      <option value="EMPRESA">EMPRESA</option>
                                    </select>
                                    <select
                                      className="border border-slate-300 rounded px-1.5 py-1"
                                      value={v.tipo_cobranca}
                                      onChange={(e) => atualizarVinculoLocal(v.id, { tipo_cobranca: e.target.value as "DIARIA" | "MENSAL" })}
                                    >
                                      <option value="DIARIA">DIARIA</option>
                                      <option value="MENSAL">MENSAL</option>
                                    </select>
                                    <input
                                      className="border border-slate-300 rounded px-1.5 py-1"
                                      value={String(v.valor ?? 0)}
                                      onChange={(e) => atualizarVinculoLocal(v.id, { valor: toMoney(e.target.value, 0) })}
                                    />
                                    <div className="text-[11px] text-slate-500 flex items-center">R$ {Number(v.valor ?? 0).toFixed(2)}</div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 mt-1">
                                    <input
                                      type="date"
                                      className="border border-slate-300 rounded px-1.5 py-1"
                                      value={v.data_inicio ?? ""}
                                      onChange={(e) => atualizarVinculoLocal(v.id, { data_inicio: e.target.value || null })}
                                    />
                                    <input
                                      type="date"
                                      className="border border-slate-300 rounded px-1.5 py-1"
                                      value={v.data_fim ?? ""}
                                      onChange={(e) => atualizarVinculoLocal(v.id, { data_fim: e.target.value || null })}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => salvarVinculo(v)}
                                    className="text-xs border border-emerald-300 text-emerald-700 rounded px-2 py-1 hover:bg-emerald-50"
                                  >
                                    Salvar
                                  </button>
                                  <Link
                                    href={`/contratos/${v.contrato_id}/passageiros`}
                                    className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
                                  >
                                    Gerenciar
                                  </Link>
                                  <button
                                    onClick={() => removerVinculo(v.id)}
                                    className="text-xs border border-rose-300 text-rose-700 rounded px-2 py-1 hover:bg-rose-50"
                                  >
                                    Remover
                                  </button>
                                </div>
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
        )}
      </div>
    </div>
  );
}
