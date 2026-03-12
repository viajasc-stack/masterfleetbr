import { ensureValidGoogleAccessToken, getSupabaseServiceClient } from "./_lib";

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  etag?: string;
};

function toDateAndTime(ev: GoogleEvent) {
  const raw = ev.start?.dateTime ?? ev.start?.date;
  if (!raw) return { data: null as string | null, horario: null as string | null };
  if (raw.length >= 10 && raw.includes("T")) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return { data: null, horario: null };
    const data = d.toISOString().slice(0, 10);
    const horario = d.toISOString().slice(11, 16);
    return { data, horario };
  }
  return { data: raw.slice(0, 10), horario: null };
}

async function listGoogleEvents(accessToken: string, calendarId: string) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("maxResults", "200");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString());
  url.searchParams.set("timeMax", new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString());

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`google_events_list_failed: ${txt}`);
  }

  const data = (await res.json()) as { items?: GoogleEvent[] };
  return data.items ?? [];
}

async function createGoogleEvent(accessToken: string, calendarId: string, payload: Record<string, unknown>) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`google_event_create_failed: ${txt}`);
  }
  return (await res.json()) as { id?: string; etag?: string };
}

async function updateGoogleEvent(accessToken: string, calendarId: string, eventId: string, payload: Record<string, unknown>) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`google_event_update_failed: ${txt}`);
  }
  return (await res.json()) as { id?: string; etag?: string };
}

export async function runGoogleCalendarSyncForEmpresa(empresaId: string) {
  const startedAt = new Date();
  const supabase = getSupabaseServiceClient();

  const { data: integration, error: integrationError } = await supabase
    .from("google_calendar_integrations")
    .select(
      "ativo,sync_direction,calendar_id,google_access_token,google_refresh_token,google_token_expires_at"
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (integrationError) {
    throw new Error(integrationError.message);
  }

  if (!integration?.ativo) {
    throw new Error("integration_inactive");
  }

  const access = await ensureValidGoogleAccessToken(empresaId, {
    accessToken: integration.google_access_token ?? "",
    refreshToken: integration.google_refresh_token ?? null,
    accessTokenExpiresAt: integration.google_token_expires_at ?? null,
  });

  const calendarId = integration.calendar_id || "primary";
  const direction = integration.sync_direction || "bidirectional";

  let imported = 0;
  let exported = 0;

  if (direction === "bidirectional" || direction === "google_to_masterfleet") {
    const googleEvents = await listGoogleEvents(access.accessToken, calendarId);

    for (const ev of googleEvents) {
      if (!ev.id) continue;
      const { data, horario } = toDateAndTime(ev);
      if (!data || !ev.summary) continue;

      const { error } = await supabase.from("agenda_eventos").upsert(
        {
          empresa_id: empresaId,
          data,
          horario,
          titulo: ev.summary,
          tipo: "outro",
          descricao: ev.description ?? null,
          google_event_id: ev.id,
          google_etag: ev.etag ?? null,
          google_last_synced_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id,google_event_id" }
      );

      if (!error) imported += 1;
    }
  }

  if (direction === "bidirectional" || direction === "masterfleet_to_google") {
    const { data: eventos, error: eventosError } = await supabase
      .from("agenda_eventos")
      .select("id, data, horario, titulo, descricao, google_event_id")
      .eq("empresa_id", empresaId)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (eventosError) {
      throw new Error(`agenda_eventos_load_failed: ${eventosError.message}`);
    }

    for (const evento of eventos ?? []) {
      const startDateTime = `${evento.data}T${evento.horario || "08:00"}:00`;
      const endDateTime = `${evento.data}T${evento.horario || "09:00"}:00`;

      const payload = {
        summary: evento.titulo,
        description: evento.descricao ?? undefined,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
      };

      let googleResult: { id?: string; etag?: string } | null;
      if (evento.google_event_id) {
        googleResult = await updateGoogleEvent(access.accessToken, calendarId, evento.google_event_id, payload);
      } else {
        googleResult = await createGoogleEvent(access.accessToken, calendarId, payload);
      }

      if (googleResult?.id) {
        const { error } = await supabase
          .from("agenda_eventos")
          .update({
            google_event_id: googleResult.id,
            google_etag: googleResult.etag ?? null,
            google_last_synced_at: new Date().toISOString(),
          })
          .eq("empresa_id", empresaId)
          .eq("id", evento.id);

        if (!error) exported += 1;
      }
    }
  }

  const finishedAt = new Date();
  const message = `Sync concluída. Importados: ${imported}. Exportados: ${exported}.`;
  await supabase
    .from("google_calendar_integrations")
    .update({
      last_sync_at: finishedAt.toISOString(),
      last_sync_status: "ok",
      last_sync_message: message,
    })
    .eq("empresa_id", empresaId);

  return {
    imported,
    exported,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

export async function markGoogleCalendarSyncError(empresaId: string, message: string) {
  const supabase = getSupabaseServiceClient();
  await supabase
    .from("google_calendar_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: "error",
      last_sync_message: message,
    })
    .eq("empresa_id", empresaId);
}
