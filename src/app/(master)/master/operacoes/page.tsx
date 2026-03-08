"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type LogWebhook = {
  id: string;
  source: string | null;
  created_at: string;
};

type NotificationAudit = {
  id: string;
  action: string;
  created_at: string;
};

export default function MasterOperacoesPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogWebhook[]>([]);
  const [audits, setAudits] = useState<NotificationAudit[]>([]);
  const [agoraRef] = useState(() => Date.now());
  const [erro, setErro] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase.rpc("master_operacoes_dashboard", { p_limit: 100 });
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível carregar operações.");
      setLogs([]);
      setAudits([]);
      setLoading(false);
      return;
    }

    const payload = data as { logs?: LogWebhook[]; audits?: NotificationAudit[] };
    setLogs(payload.logs ?? []);
    setAudits(payload.audits ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const resumo = useMemo(() => {
    const h24 = 24 * 60 * 60 * 1000;
    const webhooks24h = logs.filter((l) => agoraRef - new Date(l.created_at).getTime() <= h24).length;
    const audit24h = audits.filter((a) => agoraRef - new Date(a.created_at).getTime() <= h24).length;
    return { webhooks24h, audit24h };
  }, [logs, audits, agoraRef]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Operações</h1>
        <p className="text-slate-600 text-sm mt-0.5">Saúde operacional da plataforma (logs e auditorias)</p>
      </div>

      <div className="flex justify-end">
        <button onClick={carregar} className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition">
          Recarregar
        </button>
      </div>

      {erro && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <div className="text-xs text-sky-700">Webhooks (24h)</div>
          <div className="text-2xl font-bold text-sky-900 mt-1">{resumo.webhooks24h}</div>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <div className="text-xs text-purple-700">Auditorias (24h)</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">{resumo.audit24h}</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando...</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 text-sm text-slate-900 font-semibold">Últimos Webhook Logs</div>
            {logs.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Sem logs encontrados.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {logs.map((l) => (
                  <div key={l.id} className="px-4 py-3 flex items-center justify-between text-xs">
                    <span className="text-slate-700">{l.source ?? "(sem source)"}</span>
                    <span className="text-slate-500">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 text-sm text-slate-900 font-semibold">Últimas Auditorias</div>
            {audits.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Sem auditorias encontradas.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {audits.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-center justify-between text-xs">
                    <span className="text-slate-700">{a.action}</span>
                    <span className="text-slate-500">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
