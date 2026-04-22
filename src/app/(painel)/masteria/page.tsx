"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getAccessTokenOrThrow } from "@/lib/financeiro";
import { PageHeader } from "@/components/ui/PageHeader";

type Alerta = {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  descricao: string | null;
  status: string;
  detectado_em: string;
  meta: Record<string, unknown> | null;
};

type Conflito = {
  veiculo_id: string;
  os_id_1: string;
  os_numero_1: number | null;
  os_inicio_1: string;
  os_fim_1: string;
  os_id_2: string;
  os_numero_2: number | null;
  os_inicio_2: string;
  os_fim_2: string;
};

type Mensagem = {
  id: string;
  autor_tipo: "admin" | "ia" | string;
  conteudo: string;
  created_at: string;
};

type StatusResponse = {
  config?: {
    enabled?: boolean;
  };
  alertas?: Alerta[];
  conflitos?: Conflito[];
};

export default function MasterIAPage() {
  const [loading, setLoading] = useState(true);
  const [runningScan, setRunningScan] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  const [enabled, setEnabled] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [conflitos, setConflitos] = useState<Conflito[]>([]);

  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");

  const conflitosResumo = useMemo(() => conflitos.length, [conflitos]);
  const alertasAbertos = useMemo(() => alertas.filter((a) => a.status === "aberto").length, [alertas]);

  async function carregarStatus() {
    setLoading(true);
    setMsg("");
    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch("/api/masteria/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as StatusResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar status do MasterIA.");

      setEnabled(Boolean(data.config?.enabled ?? true));
      setAlertas(data.alertas ?? []);
      setConflitos(data.conflitos ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao carregar status do MasterIA.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarMensagens(conversaIdAlvo: string) {
    const { data, error } = await supabase
      .from("masteria_mensagens")
      .select("id, autor_tipo, conteudo, created_at")
      .eq("conversa_id", conversaIdAlvo)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;
    setMensagens((data ?? []) as Mensagem[]);
  }

  useEffect(() => {
    void carregarStatus();
  }, []);

  async function executarScan() {
    setRunningScan(true);
    setMsg("");
    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch("/api/masteria/scan", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        conflitos_detectados?: number;
        alertas_novos?: number;
        alertas_resolvidos?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Falha ao executar scan do MasterIA.");
      setMsg(
        `Scan concluído. Conflitos: ${data.conflitos_detectados ?? 0} • Novos alertas: ${data.alertas_novos ?? 0} • Resolvidos: ${data.alertas_resolvidos ?? 0}`
      );
      await carregarStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao executar scan do MasterIA.");
    } finally {
      setRunningScan(false);
    }
  }

  async function resolverAlerta(alertaId: string) {
    const { error } = await supabase.rpc("masteria_mark_alert_resolved", { p_alerta_id: alertaId });
    if (error) {
      setMsg(error.message);
      return;
    }
    setAlertas((prev) =>
      prev.map((a) =>
        a.id === alertaId
          ? {
              ...a,
              status: "resolvido",
            }
          : a
      )
    );
  }

  async function enviarPergunta(ev: FormEvent) {
    ev.preventDefault();
    if (!pergunta.trim()) return;

    setSending(true);
    setMsg("");
    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch("/api/masteria/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversa_id: conversaId,
          mensagem: pergunta.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        conversa_id?: string;
      };

      if (!res.ok || !data.ok || !data.conversa_id) {
        throw new Error(data.error ?? "Falha ao enviar mensagem ao MasterIA.");
      }

      setConversaId(data.conversa_id);
      setPergunta("");
      await carregarMensagens(data.conversa_id);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao enviar mensagem ao MasterIA.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MasterIA"
        description="Copiloto operacional com alertas proativos, varredura de conflitos e apoio à decisão."
        actions={
          <button
            type="button"
            onClick={executarScan}
            disabled={runningScan || !enabled}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {runningScan ? "Escaneando..." : "Executar scan agora"}
          </button>
        }
      />

      {msg ? <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div> : null}
      {!enabled ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          MasterIA está desabilitada no painel master. Peça para habilitar em Configurações → MasterIA.
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando MasterIA...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Conflitos OS/Veículo</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{conflitosResumo}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Alertas abertos</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{alertasAbertos}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Total alertas</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{alertas.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Conflitos detectados (OS no mesmo veículo)</h2>
              {conflitos.length === 0 ? (
                <div className="text-sm text-slate-500">Sem conflitos no momento.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {conflitos.map((c, idx) => (
                    <div key={`${c.os_id_1}-${c.os_id_2}-${idx}`} className="rounded-lg border border-slate-200 p-3">
                      <div className="text-slate-900 font-medium">Veículo: {c.veiculo_id}</div>
                      <div className="text-slate-600 mt-1">
                        OS {c.os_numero_1 ?? "s/n"} ({new Date(c.os_inicio_1).toLocaleString("pt-BR")} → {new Date(c.os_fim_1).toLocaleString("pt-BR")})
                      </div>
                      <div className="text-slate-600">
                        OS {c.os_numero_2 ?? "s/n"} ({new Date(c.os_inicio_2).toLocaleString("pt-BR")} → {new Date(c.os_fim_2).toLocaleString("pt-BR")})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Alertas MasterIA</h2>
              {alertas.length === 0 ? (
                <div className="text-sm text-slate-500">Sem alertas registrados.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {alertas.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-slate-900">{a.titulo}</div>
                        <span
                          className={`text-xs px-2 py-1 rounded border ${
                            a.status === "resolvido"
                              ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                              : a.severidade === "alta"
                              ? "border-rose-200 text-rose-700 bg-rose-50"
                              : "border-amber-200 text-amber-700 bg-amber-50"
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <div className="text-slate-600 mt-1">{a.descricao ?? "Sem descrição"}</div>
                      <div className="text-xs text-slate-500 mt-2">
                        {new Date(a.detectado_em).toLocaleString("pt-BR")} • tipo: {a.tipo}
                      </div>
                      {a.status !== "resolvido" ? (
                        <button
                          type="button"
                          onClick={() => resolverAlerta(a.id)}
                          className="mt-2 text-xs border border-slate-300 text-slate-700 px-2 py-1 rounded-md hover:bg-slate-50"
                        >
                          Marcar como resolvido
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <h2 className="font-semibold text-slate-900">Chat com MasterIA</h2>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-[360px] overflow-auto space-y-2">
              {mensagens.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhuma mensagem ainda. Faça uma pergunta para começar.</div>
              ) : (
                mensagens.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.autor_tipo === "ia" ? "bg-indigo-50 border border-indigo-200 text-slate-800" : "bg-white border border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="text-xs text-slate-500 mb-1">
                      {m.autor_tipo === "ia" ? "MasterIA" : "Você"} • {new Date(m.created_at).toLocaleString("pt-BR")}
                    </div>
                    {m.conteudo}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={enviarPergunta} className="flex flex-col md:flex-row gap-2">
              <input
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                placeholder="Ex.: Quais riscos operacionais críticos eu tenho hoje?"
                className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={sending || !enabled}
                className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 disabled:opacity-60"
              >
                {sending ? "Enviando..." : "Perguntar"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
