"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type TicketRow = {
  id: string;
  assunto: string;
  categoria: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: "aberto" | "em_andamento" | "aguardando_cliente" | "resolvido" | "fechado";
  created_at: string;
  last_message_at: string;
};

function badgeStatus(status: TicketRow["status"]) {
  if (status === "aberto") return "border-sky-200 text-sky-700 bg-sky-50";
  if (status === "em_andamento") return "border-indigo-200 text-indigo-700 bg-indigo-50";
  if (status === "aguardando_cliente") return "border-amber-200 text-amber-700 bg-amber-50";
  if (status === "resolvido") return "border-emerald-200 text-emerald-700 bg-emerald-50";
  return "border-slate-300 text-slate-600 bg-slate-100";
}

function badgePrioridade(prio: TicketRow["prioridade"]) {
  if (prio === "critica") return "border-rose-200 text-rose-700 bg-rose-50";
  if (prio === "alta") return "border-orange-200 text-orange-700 bg-orange-50";
  if (prio === "media") return "border-violet-200 text-violet-700 bg-violet-50";
  return "border-slate-200 text-slate-600 bg-slate-50";
}

export default function SuportePage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [prioridade, setPrioridade] = useState<TicketRow["prioridade"]>("media");
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, assunto, categoria, prioridade, status, created_at, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (error) {
      setErro(error.message);
      setTickets([]);
      setLoading(false);
      return;
    }

    setTickets((data as TicketRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tickets
      .filter((t) => (filtroStatus === "todos" ? true : t.status === filtroStatus))
      .filter((t) => !q || t.assunto.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
  }, [tickets, busca, filtroStatus]);

  async function criarTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!assunto.trim()) return;

    setCreating(true);
    setErro("");
    const { data, error } = await supabase.rpc("support_create_ticket", {
      p_assunto: assunto.trim(),
      p_categoria: categoria,
      p_mensagem: mensagem.trim() || null,
      p_prioridade: prioridade,
    });
    setCreating(false);

    if (error || !data) {
      setErro(error?.message ?? "Não foi possível abrir o ticket.");
      return;
    }

    setAssunto("");
    setCategoria("geral");
    setPrioridade("media");
    setMensagem("");
    router.push(`/suporte/${String(data)}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Suporte</h1>
        <p className="text-sm text-slate-500 mt-0.5">Abra chamados e acompanhe respostas do time master.</p>
      </div>

      {erro && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}

      <form onSubmit={criarTicket} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">Novo chamado</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm"
            placeholder="Assunto do chamado"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            required
          />
          <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="geral">Geral</option>
            <option value="financeiro">Financeiro</option>
            <option value="tecnico">Técnico</option>
            <option value="operacional">Operacional</option>
          </select>
          <select
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as TicketRow["prioridade"])}
          >
            <option value="baixa">Prioridade baixa</option>
            <option value="media">Prioridade média</option>
            <option value="alta">Prioridade alta</option>
            <option value="critica">Prioridade crítica</option>
          </select>
          <textarea
            className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm min-h-24"
            placeholder="Descreva o que aconteceu (opcional, mas recomendado)"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={creating || !assunto.trim()}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {creating ? "Abrindo chamado..." : "Abrir chamado"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm"
            placeholder="Buscar por assunto ou ID"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="em_andamento">Em andamento</option>
            <option value="aguardando_cliente">Aguardando cliente</option>
            <option value="resolvido">Resolvido</option>
            <option value="fechado">Fechado</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum chamado encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Assunto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Prioridade</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Última atualização</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/suporte/${t.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                      {t.assunto}
                    </Link>
                    <div className="text-xs text-slate-500">#{t.id.slice(0, 8)} • {t.categoria}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded border ${badgePrioridade(t.prioridade)}`}>{t.prioridade}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded border ${badgeStatus(t.status)}`}>{t.status}</span>
                  </td>
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
