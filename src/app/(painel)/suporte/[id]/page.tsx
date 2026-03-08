"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  assunto: string;
  categoria: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: "aberto" | "em_andamento" | "aguardando_cliente" | "resolvido" | "fechado";
  created_at: string;
  updated_at: string;
};

type Msg = {
  id: string;
  autor_tipo: "empresa" | "master" | "sistema";
  mensagem: string;
  created_at: string;
};

export default function SuporteDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");

  async function carregar() {
    if (!id) return;
    setLoading(true);
    setErro("");

    const [tRes, mRes] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("id, assunto, categoria, prioridade, status, created_at, updated_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("support_messages")
        .select("id, autor_tipo, mensagem, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (tRes.error) {
      setErro(tRes.error.message);
      setTicket(null);
      setMsgs([]);
      setLoading(false);
      return;
    }

    if (mRes.error) {
      setErro(mRes.error.message);
      setMsgs([]);
    }

    setTicket((tRes.data as Ticket) ?? null);
    setMsgs((mRes.data as Msg[]) ?? []);

    await supabase.rpc("support_mark_ticket_read", { p_ticket_id: id });
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function enviarMensagem(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !texto.trim() || ticket?.status === "fechado") return;

    setSending(true);
    setErro("");
    const { error } = await supabase.rpc("support_add_message", {
      p_ticket_id: id,
      p_mensagem: texto.trim(),
    });
    setSending(false);

    if (error) {
      if (error.message?.includes("ticket_closed")) {
        setErro("Este ticket está fechado. Abra um novo chamado para continuar.");
      } else {
        setErro(error.message);
      }
      return;
    }

    setTexto("");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ticket de suporte</h1>
          <p className="text-sm text-slate-500 mt-0.5">Acompanhe as respostas e continue a conversa.</p>
        </div>
        <Link href="/suporte" className="text-sm border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-50">
          Voltar
        </Link>
      </div>

      {erro && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando...</div>
      ) : !ticket ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Ticket não encontrado.</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">{ticket.assunto}</div>
            <div className="text-xs text-slate-500 mt-1">
              #{ticket.id.slice(0, 8)} • {ticket.categoria} • {ticket.prioridade} • {ticket.status}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            {msgs.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não há mensagens.</p>
            ) : (
              msgs.map((m) => {
                const isEmpresa = m.autor_tipo === "empresa";
                return (
                  <div key={m.id} className={`flex ${isEmpresa ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isEmpresa ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                      <div className="whitespace-pre-wrap">{m.mensagem}</div>
                      <div className={`text-[11px] mt-1 ${isEmpresa ? "text-indigo-100" : "text-slate-500"}`}>
                        {m.autor_tipo} • {new Date(m.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={enviarMensagem} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <label className="block text-sm font-medium text-slate-700">Responder ticket</label>
            {ticket.status === "fechado" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Este ticket está fechado. Para continuar o atendimento, abra um novo chamado.
              </div>
            ) : null}
            <textarea
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-28"
              placeholder="Escreva sua mensagem..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={ticket.status === "fechado"}
              required
            />
            <button
              type="submit"
              disabled={sending || !texto.trim() || ticket.status === "fechado"}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60"
            >
              {sending ? "Enviando..." : "Enviar mensagem"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
