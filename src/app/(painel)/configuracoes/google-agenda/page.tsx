"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type IntegrationStatus = {
  ativo: boolean;
  sync_direction: "bidirectional" | "google_to_masterfleet" | "masterfleet_to_google";
  calendar_id: string;
  google_connected_email: string | null;
  google_token_expires_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  updated_at: string | null;
  has_refresh_token: boolean;
  auto_sync_enabled?: boolean;
  google_watch_expiration?: string | null;
};

type CalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
};

export default function ConfiguracoesGoogleAgendaPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [startingAutoSync, setStartingAutoSync] = useState(false);
  const [stoppingAutoSync, setStoppingAutoSync] = useState(false);
  const [msg, setMsg] = useState("");
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  const [ativo, setAtivo] = useState(false);
  const [syncDirection, setSyncDirection] = useState<IntegrationStatus["sync_direction"]>("bidirectional");
  const [calendarId, setCalendarId] = useState("primary");

  const oauthStatusMsg = useMemo(() => {
    const status = searchParams.get("status");
    if (!status) return "";
    if (status === "connected") return "Conta Google conectada com sucesso.";
    if (status === "oauth_error") return "Conexão Google cancelada ou negada.";
    if (status === "invalid_callback") return "Callback Google inválido.";
    if (status === "state_not_found") return "Sessão OAuth expirada ou inválida.";
    if (status === "state_expired") return "Tempo de conexão expirado. Tente novamente.";
    if (status === "save_error") return "Conectou com Google, mas falhou ao salvar internamente.";
    if (status === "oauth_exchange_error") return "Falha ao trocar código OAuth por token.";
    return "";
  }, [searchParams]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function carregarStatus() {
    setLoading(true);
    const token = await getAccessToken();
    if (!token) {
      setMsg("Sessão inválida. Faça login novamente.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/google-calendar/status", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = (await res.json().catch(() => ({}))) as { integration?: IntegrationStatus; error?: string };

    if (!res.ok) {
      setMsg(`Erro ao carregar integração: ${data.error ?? "erro_desconhecido"}`);
      setLoading(false);
      return;
    }

    const current = data.integration ?? null;
    setIntegration(current);
    setAtivo(Boolean(current?.ativo));
    setSyncDirection(current?.sync_direction ?? "bidirectional");
    setCalendarId(current?.calendar_id ?? "primary");
    setLoading(false);
  }

  async function carregarCalendariosGoogle() {
    setLoadingCalendars(true);
    const token = await getAccessToken();
    if (!token) {
      setLoadingCalendars(false);
      return;
    }

    const res = await fetch("/api/google-calendar/calendars", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json().catch(() => ({}))) as {
      calendars?: CalendarOption[];
      selected_calendar_id?: string;
      error?: string;
    };

    if (!res.ok) {
      setLoadingCalendars(false);
      return;
    }

    const options = data.calendars ?? [];
    setCalendars(options);

    if (data.selected_calendar_id) {
      setCalendarId(data.selected_calendar_id);
    } else if (options.length > 0) {
      const primary = options.find((c) => c.primary);
      setCalendarId(primary?.id ?? options[0].id);
    }

    setLoadingCalendars(false);
  }

  useEffect(() => {
    void carregarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (oauthStatusMsg) setMsg(oauthStatusMsg);
  }, [oauthStatusMsg]);

  useEffect(() => {
    if (integration?.google_connected_email) {
      void carregarCalendariosGoogle();
    } else {
      setCalendars([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration?.google_connected_email]);

  async function conectarGoogle() {
    setConnecting(true);
    setMsg("");
    const token = await getAccessToken();
    if (!token) {
      setConnecting(false);
      setMsg("Sessão inválida. Faça login novamente.");
      return;
    }

    const res = await fetch("/api/google-calendar/connect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json().catch(() => ({}))) as {
      authUrl?: string;
      error?: string;
      missing_env?: string;
    };
    setConnecting(false);

    if (!res.ok || !data.authUrl) {
      if (data.error === "google_not_configured") {
        setMsg(
          `Integração Google ainda não configurada no servidor. Variável ausente: ${data.missing_env ?? "desconhecida"}.`
        );
        return;
      }
      setMsg(`Erro ao iniciar conexão: ${data.error ?? "erro_desconhecido"}`);
      return;
    }

    window.location.href = data.authUrl;
  }

  async function desconectarGoogle() {
    setDisconnecting(true);
    setMsg("");
    const token = await getAccessToken();
    if (!token) {
      setDisconnecting(false);
      setMsg("Sessão inválida. Faça login novamente.");
      return;
    }

    const res = await fetch("/api/google-calendar/disconnect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setDisconnecting(false);

    if (!res.ok || !data.ok) {
      setMsg(`Erro ao desconectar: ${data.error ?? "erro_desconhecido"}`);
      return;
    }

    setMsg("Conta Google desconectada.");
    await carregarStatus();
  }

  async function salvarConfiguracoes(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const token = await getAccessToken();
    if (!token) {
      setSaving(false);
      setMsg("Sessão inválida. Faça login novamente.");
      return;
    }

    const res = await fetch("/api/google-calendar/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ativo,
        sync_direction: syncDirection,
        calendar_id: calendarId,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setSaving(false);

    if (!res.ok || !data.ok) {
      setMsg(`Erro ao salvar: ${data.error ?? "erro_desconhecido"}`);
      return;
    }

    setMsg("Configurações da Google Agenda salvas.");
    await carregarStatus();
  }

  async function sincronizarAgora() {
    setSyncing(true);
    setMsg("");

    const token = await getAccessToken();
    if (!token) {
      setSyncing(false);
      setMsg("Sessão inválida. Faça login novamente.");
      return;
    }

    const res = await fetch("/api/google-calendar/sync-now", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      imported?: number;
      exported?: number;
      error?: string;
    };

    setSyncing(false);

    if (!res.ok || !data.ok) {
      setMsg(`Erro na sincronização: ${data.error ?? "erro_desconhecido"}`);
      await carregarStatus();
      return;
    }

    setMsg(`Sincronização concluída. Importados: ${data.imported ?? 0} | Exportados: ${data.exported ?? 0}`);
    await carregarStatus();
  }

  async function ativarAutoSync() {
    setStartingAutoSync(true);
    setMsg("");
    const token = await getAccessToken();
    if (!token) {
      setStartingAutoSync(false);
      setMsg("Sessão inválida. Faça login novamente.");
      return;
    }

    const res = await fetch("/api/google-calendar/watch/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setStartingAutoSync(false);

    if (!res.ok || !data.ok) {
      setMsg(`Erro ao ativar sync automática: ${data.error ?? "erro_desconhecido"}`);
      await carregarStatus();
      return;
    }

    setMsg("Sincronização automática ativada com sucesso.");
    await carregarStatus();
  }

  async function desativarAutoSync() {
    setStoppingAutoSync(true);
    setMsg("");
    const token = await getAccessToken();
    if (!token) {
      setStoppingAutoSync(false);
      setMsg("Sessão inválida. Faça login novamente.");
      return;
    }

    const res = await fetch("/api/google-calendar/watch/stop", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setStoppingAutoSync(false);

    if (!res.ok || !data.ok) {
      setMsg(`Erro ao desativar sync automática: ${data.error ?? "erro_desconhecido"}`);
      await carregarStatus();
      return;
    }

    setMsg("Sincronização automática desativada.");
    await carregarStatus();
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando integração Google Agenda...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Google Agenda</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Integração bidirecional entre Google Calendar e Agenda do MasterFleet (isolada por empresa).
        </p>
      </div>

      {msg ? (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-200 px-4 py-3 text-sm">{msg}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Conexão OAuth</h2>
            <p className="text-xs text-slate-500 mt-0.5">Vincule uma conta Google por empresa.</p>
          </div>
          <div className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700">
            {integration?.google_connected_email ? `Conectado: ${integration.google_connected_email}` : "Não conectado"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={conectarGoogle}
            disabled={connecting}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            {connecting ? "Conectando..." : "Conectar com Google"}
          </button>

          <button
            type="button"
            onClick={desconectarGoogle}
            disabled={disconnecting || !integration?.google_connected_email}
            className="border border-red-200 text-red-700 px-4 py-2 rounded-md hover:bg-red-50 disabled:opacity-60"
          >
            {disconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        </div>

        <div className="text-xs text-slate-600 space-y-1">
          <div>
            As credenciais Google (Client ID/Secret) ficam no servidor e são configuradas pelo desenvolvedor.
          </div>
          <div>
            O administrador só precisa clicar em <em>Conectar com Google</em> e escolher o calendário.
          </div>
          <div>Refresh token disponível: {integration?.has_refresh_token ? "Sim" : "Não"}</div>
          <div>Expiração do access token: {integration?.google_token_expires_at ? new Date(integration.google_token_expires_at).toLocaleString("pt-BR") : "—"}</div>
        </div>
      </section>

      <form onSubmit={salvarConfiguracoes} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Configurações de sincronização</h2>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativar sincronização
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Direção da sincronização</label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={syncDirection}
            onChange={(e) => setSyncDirection(e.target.value as IntegrationStatus["sync_direction"])}
          >
            <option value="bidirectional">Bidirecional (Google ↔ MasterFleet)</option>
            <option value="google_to_masterfleet">Apenas Google → MasterFleet</option>
            <option value="masterfleet_to_google">Apenas MasterFleet → Google</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Calendário do Google</label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            disabled={loadingCalendars || calendars.length === 0}
          >
            {calendars.length === 0 ? <option value="primary">primary (padrão)</option> : null}
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.summary}
                {calendar.primary ? " (principal)" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Ao clicar em conectar, os calendários são buscados automaticamente para evitar erro manual.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="bg-slate-800 text-white px-5 py-2 rounded-md hover:bg-slate-700 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>

          <button
            type="button"
            onClick={sincronizarAgora}
            disabled={syncing || !integration?.google_connected_email || !ativo}
            className="border border-blue-200 text-blue-700 px-5 py-2 rounded-md hover:bg-blue-50 disabled:opacity-60"
          >
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 space-y-1">
        <div>
          <strong>Última sincronização:</strong> {integration?.last_sync_at ? new Date(integration.last_sync_at).toLocaleString("pt-BR") : "—"}
        </div>
        <div>
          <strong>Status:</strong> {integration?.last_sync_status ?? "—"}
        </div>
        <div>
          <strong>Mensagem:</strong> {integration?.last_sync_message ?? "—"}
        </div>
        <div>
          <strong>Sync automática:</strong> {integration?.auto_sync_enabled ? "Ativa" : "Inativa"}
        </div>
        <div>
          <strong>Watch expira em:</strong>{" "}
          {integration?.google_watch_expiration ? new Date(integration.google_watch_expiration).toLocaleString("pt-BR") : "—"}
        </div>
        <div className="pt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={ativarAutoSync}
            disabled={startingAutoSync || !integration?.google_connected_email || !ativo}
            className="border border-emerald-200 text-emerald-700 px-4 py-2 rounded-md hover:bg-emerald-50 disabled:opacity-60"
          >
            {startingAutoSync ? "Ativando..." : "Ativar sync automática"}
          </button>

          <button
            type="button"
            onClick={desativarAutoSync}
            disabled={stoppingAutoSync || !integration?.auto_sync_enabled}
            className="border border-amber-200 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50 disabled:opacity-60"
          >
            {stoppingAutoSync ? "Desativando..." : "Desativar sync automática"}
          </button>
        </div>
      </div>
    </div>
  );
}
