"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type TicketPayload = {
  ticket: {
    id: string;
    assunto: string;
    categoria: string;
    prioridade: "baixa" | "media" | "alta" | "critica";
    status: "aberto" | "em_andamento" | "aguardando_cliente" | "resolvido" | "fechado";
    empresa_nome: string;
    empresa_email: string | null;
    created_at: string;
    updated_at: string;
  };
  messages: Array<{
    id: string;
    autor_tipo: "empresa" | "master" | "sistema";
    autor_nome: string;
    mensagem: string;
    interna: boolean;
    created_at: string;
  }>;
};

export default function MasterSuporteDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [payload, setPayload] = useState<TicketPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [status, setStatus] = useState("aberto");
  const [prioridade, setPrioridade] = useState("media");
  const [mensagem, setMensagem] = useState("");
  const [interna, setInterna] = useState(false);

  async function carregar() {
    if (!id) return;
    setLoading(true);
    setErro("");
    const { data, error } = await supabase.rpc("master_support_get_ticket", { p_ticket_id: id });

    if (error || !data) {
      setErro(error?.message ?? "Não foi possível carregar o ticket.");
      setPayload(null);
      setLoading(false);
      return;
    }

    const p = data as TicketPayload;
    setPayload(p);
    setStatus(p.ticket.status);
    setPrioridade(p.ticket.prioridade);

    await supabase.rpc("master_support_mark_ticket_read", { p_ticket_id: id });
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function salvarStatus() {
    if (!id) return;
    setSaving(true);
    setErro("");
    const { error } = await supabase.rpc("master_support_set_status", {
      p_ticket_id: id,
      p_status: status,
      p_prioridade: prioridade,
    });
    setSaving(false);

    if (error) {
      setErro(error.message);
      return;
    }

    await carregar();
  }

  async function responder(e: FormEvent) {
    e.preventDefault();
    if (!id || !mensagem.trim()) return;
    setSaving(true);
    setErro("");

    const { error } = await supabase.rpc("master_support_reply", {
      p_ticket_id: id,
      p_mensagem: mensagem.trim(),
      p_interna: interna,
      p_status: status,
      p_prioridade: prioridade,
    });
    setSaving(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setMensagem("");
    setInterna(false);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Atendimento de ticket</h1>
          <p className="text-sm text-slate-600 mt-0.5">Responder empresa, mudar status e prioridade.</p>
        </div>
        <Link href="/master/suporte" className="text-sm border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50">
          Voltar para fila
        </Link>
      </div>

      {erro && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando...</div>
      ) : !payload ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Ticket não encontrado.</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
            <div className="text-lg font-semibold text-slate-900">{payload.ticket.assunto}</div>
            <div className="text-sm text-slate-600">{payload.ticket.empresa_nome} {payload.ticket.empresa_email ? `• ${payload.ticket.empresa_email}` : ""}</div>
            <div className="text-xs text-slate-500">#{payload.ticket.id.slice(0, 8)} • {payload.ticket.categoria}</div>

            <div className="grid md:grid-cols-3 gap-3 pt-2">
              <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="aberto">Aberto</option>
                <option value="em_andamento">Em andamento</option>
                <option value="aguardando_cliente">Aguardando cliente</option>
                <option value="resolvido">Resolvido</option>
                <option value="fechado">Fechado</option>
              </select>
              <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
              <button
                type="button"
                onClick={salvarStatus}
                disabled={saving}
                className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Salvar status/prioridade
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            {payload.messages.length === 0 ? (
              <p className="text-sm text-slate-500">Sem mensagens neste ticket.</p>
            ) : (
              payload.messages.map((m) => {
                const isMaster = m.autor_tipo === "master";
                return (
                  <div key={m.id} className={`flex ${isMaster ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${isMaster ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-800"}`}>
                      <div className="whitespace-pre-wrap">{m.mensagem}</div>
                      <div className={`text-[11px] mt-1 ${isMaster ? "text-slate-300" : "text-slate-500"}`}>
                        {m.autor_nome} ({m.autor_tipo}){m.interna ? " • interna" : ""} • {new Date(m.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={responder} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <label className="block text-sm font-medium text-slate-700">Responder ticket</label>
            <textarea
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-28"
              placeholder="Digite a resposta para a empresa..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              required
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} />
              Nota interna (não visível para empresa)
            </label>
            <button
              type="submit"
              disabled={saving || !mensagem.trim()}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Enviando..." : "Enviar resposta"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
