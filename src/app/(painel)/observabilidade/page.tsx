"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";

type ObservabilityEvent = {
  id: string;
  scope: string;
  level: "warn" | "error";
  message: string;
  event_kind: "log" | "alert";
  meta: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 25;

export default function ObservabilidadePage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState<ObservabilityEvent[]>([]);
  const [total, setTotal] = useState(0);

  const [scope, setScope] = useState("todos");
  const [nivel, setNivel] = useState<"todos" | "warn" | "error">("todos");
  const [tipo, setTipo] = useState<"todos" | "log" | "alert">("todos");
  const [periodo, setPeriodo] = useState<"24h" | "7d" | "30d">("24h");
  const [pagina, setPagina] = useState(1);

  function getPeriodoIso(periodoAtual: "24h" | "7d" | "30d") {
    const d = new Date();
    if (periodoAtual === "24h") d.setHours(d.getHours() - 24);
    if (periodoAtual === "7d") d.setDate(d.getDate() - 7);
    if (periodoAtual === "30d") d.setDate(d.getDate() - 30);
    return d.toISOString();
  }

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const from = (pagina - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("observability_events")
        .select("id, scope, level, message, event_kind, meta, created_at", { count: "exact" })
        .gte("created_at", getPeriodoIso(periodo))
        .order("created_at", { ascending: false })
        .range(from, to);

      if (scope !== "todos") query = query.eq("scope", scope);
      if (nivel !== "todos") query = query.eq("level", nivel);
      if (tipo !== "todos") query = query.eq("event_kind", tipo);

      const { data, error, count } = await query;
      if (error) throw error;

      setEventos(((data ?? []) as ObservabilityEvent[]));
      setTotal(count ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar eventos.";
      setErro(msg);
      setEventos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, nivel, tipo, periodo, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const scopes = useMemo(() => {
    const set = new Set(eventos.map((e) => e.scope));
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [eventos]);

  const cards = useMemo(() => {
    return {
      erros: eventos.filter((e) => e.level === "error").length,
      avisos: eventos.filter((e) => e.level === "warn").length,
      alertas: eventos.filter((e) => e.event_kind === "alert").length,
    };
  }, [eventos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Observabilidade"
        description="Monitoramento de eventos críticos por scope/severidade."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <div className="text-xs text-rose-700">Errors (página)</div>
          <div className="text-2xl font-semibold text-rose-800">{cards.erros}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-xs text-amber-700">Warnings (página)</div>
          <div className="text-2xl font-semibold text-amber-800">{cards.avisos}</div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="text-xs text-indigo-700">Alertas de burst (página)</div>
          <div className="text-2xl font-semibold text-indigo-800">{cards.alertas}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Período</label>
          <select className="w-full border border-slate-300 rounded-md px-2 py-2 text-sm" value={periodo} onChange={(e) => { setPeriodo(e.target.value as "24h" | "7d" | "30d"); setPagina(1); }}>
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Scope</label>
          <select className="w-full border border-slate-300 rounded-md px-2 py-2 text-sm" value={scope} onChange={(e) => { setScope(e.target.value); setPagina(1); }}>
            {scopes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Severidade</label>
          <select className="w-full border border-slate-300 rounded-md px-2 py-2 text-sm" value={nivel} onChange={(e) => { setNivel(e.target.value as "todos" | "warn" | "error"); setPagina(1); }}>
            <option value="todos">Todas</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Tipo de evento</label>
          <select className="w-full border border-slate-300 rounded-md px-2 py-2 text-sm" value={tipo} onChange={(e) => { setTipo(e.target.value as "todos" | "log" | "alert"); setPagina(1); }}>
            <option value="todos">Todos</option>
            <option value="log">Log</option>
            <option value="alert">Alert</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando eventos...</div>
        ) : eventos.length === 0 ? (
          <div className="text-sm text-slate-500">Sem eventos para os filtros selecionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Scope</th>
                  <th className="py-2 pr-3">Nível</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{e.scope}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 text-xs rounded border ${e.level === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        {e.level}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{e.event_kind}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-800">{e.message}</div>
                      {e.meta ? <pre className="mt-1 text-[11px] text-slate-500 whitespace-pre-wrap break-all">{JSON.stringify(e.meta, null, 2)}</pre> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">Total: {total}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded disabled:opacity-50"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
            >
              Anterior
            </button>
            <span className="text-xs text-slate-600">Página {pagina} / {totalPaginas}</span>
            <button
              type="button"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded disabled:opacity-50"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
