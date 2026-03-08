"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type MasterTicket = {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  assunto: string;
  categoria: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: "aberto" | "em_andamento" | "aguardando_cliente" | "resolvido" | "fechado";
  created_at: string;
  updated_at: string;
  last_message_at: string;
  total_mensagens: number;
  ultima_mensagem: string | null;
};

function badgeStatus(s: MasterTicket["status"]) {
  if (s === "aberto") return "border-sky-200 text-sky-700 bg-sky-50";
  if (s === "em_andamento") return "border-indigo-200 text-indigo-700 bg-indigo-50";
  if (s === "aguardando_cliente") return "border-amber-200 text-amber-700 bg-amber-50";
  if (s === "resolvido") return "border-emerald-200 text-emerald-700 bg-emerald-50";
  return "border-slate-300 text-slate-600 bg-slate-100";
}

function badgePrio(p: MasterTicket["prioridade"]) {
  if (p === "critica") return "border-rose-200 text-rose-700 bg-rose-50";
  if (p === "alta") return "border-orange-200 text-orange-700 bg-orange-50";
  if (p === "media") return "border-violet-200 text-violet-700 bg-violet-50";
  return "border-slate-200 text-slate-600 bg-slate-50";
}

export default function MasterSuportePage() {
  const [tickets, setTickets] = useState<MasterTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [prioridade, setPrioridade] = useState("todas");

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase.rpc("master_support_list_tickets", {
      p_status: status === "todos" ? null : status,
      p_prioridade: prioridade === "todas" ? null : prioridade,
      p_busca: busca.trim() || null,
      p_limit: 300,
    });

    if (error) {
      setErro(error.message);
      setTickets([]);
      setLoading(false);
      return;
    }

    setTickets((data as MasterTicket[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, prioridade]);

  const resumo = useMemo(() => {
    return {
      total: tickets.length,
      abertos: tickets.filter((t) => t.status === "aberto").length,
      criticos: tickets.filter((t) => t.prioridade === "critica").length,
      aguardando: tickets.filter((t) => t.status === "aguardando_cliente").length,
    };
  }, [tickets]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Suporte</h1>
        <p className="text-sm text-slate-600 mt-0.5">Fila geral de chamados das empresas.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-2xl font-bold text-slate-900">{resumo.total}</div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <div className="text-xs text-sky-700">Abertos</div>
          <div className="text-2xl font-bold text-sky-900">{resumo.abertos}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs text-rose-700">Críticos</div>
          <div className="text-2xl font-bold text-rose-900">{resumo.criticos}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs text-amber-700">Aguardando cliente</div>
          <div className="text-2xl font-bold text-amber-900">{resumo.aguardando}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid md:grid-cols-4 gap-3">
          <input
            className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm"
            placeholder="Buscar por empresa, assunto ou id"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="todos">Todos status</option>
            <option value="aberto">Aberto</option>
            <option value="em_andamento">Em andamento</option>
            <option value="aguardando_cliente">Aguardando cliente</option>
            <option value="resolvido">Resolvido</option>
            <option value="fechado">Fechado</option>
          </select>
          <div className="flex gap-2">
            <select className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
              <option value="todas">Todas prioridades</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
            <button onClick={carregar} className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">Buscar</button>
          </div>
        </div>
      </div>

      {erro && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando...</div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum ticket encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Empresa / Ticket</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Prioridade</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Última mensagem</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/master/suporte/${t.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                      {t.assunto}
                    </Link>
                    <div className="text-xs text-slate-500">{t.empresa_nome} • #{t.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded border ${badgePrio(t.prioridade)}`}>{t.prioridade}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded border ${badgeStatus(t.status)}`}>{t.status}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.last_message_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
