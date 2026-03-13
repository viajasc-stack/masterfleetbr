import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureValidGoogleAccessToken,
  getGoogleWebhookUrl,
  getAuthContextFromBearer,
  getSupabaseServiceClient,
} from "../../_lib";

async function stopGoogleWatchChannel(accessToken: string, channelId: string, resourceId: string) {
  await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: channelId,
      resourceId,
    }),
  }).catch(() => null);
}

export async function POST(req: NextRequest) {
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    const supabase = getSupabaseServiceClient();

    const { data: integration, error: integrationError } = await supabase
      .from("google_calendar_integrations")
      .select(
        "ativo,calendar_id,google_access_token,google_refresh_token,google_token_expires_at,google_watch_channel_id,google_watch_resource_id"
      )
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (integrationError) return NextResponse.json({ error: integrationError.message }, { status: 500 });
    if (!integration?.ativo) return NextResponse.json({ error: "integration_inactive" }, { status: 400 });

    const access = await ensureValidGoogleAccessToken(empresaId, {
      accessToken: integration.google_access_token ?? "",
      refreshToken: integration.google_refresh_token ?? null,
      accessTokenExpiresAt: integration.google_token_expires_at ?? null,
    });

    if (integration.google_watch_channel_id && integration.google_watch_resource_id) {
      await stopGoogleWatchChannel(access.accessToken, integration.google_watch_channel_id, integration.google_watch_resource_id);
    }

    const calendarId = integration.calendar_id || "primary";
    const webhookUrl = await getGoogleWebhookUrl();
    const channelId = randomUUID();
    const watchToken = randomUUID();

    const watchRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          token: watchToken,
        }),
      }
    );

    if (!watchRes.ok) {
      const txt = await watchRes.text();
      return NextResponse.json({ error: `google_watch_start_failed: ${txt}` }, { status: 500 });
    }

    const watchData = (await watchRes.json()) as {
      id?: string;
      resourceId?: string;
      expiration?: string;
    };

    const expirationIso = watchData.expiration
      ? new Date(Number(watchData.expiration)).toISOString()
      : null;

    const { error: updateError } = await supabase
      .from("google_calendar_integrations")
      .update({
        google_watch_channel_id: watchData.id ?? channelId,
        google_watch_resource_id: watchData.resourceId ?? null,
        google_watch_expiration: expirationIso,
        google_watch_token: watchToken,
        last_sync_status: "watch_started",
        last_sync_message: "Sincronização automática ativada.",
      })
      .eq("empresa_id", empresaId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, expiration: expirationIso });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "server_error";
    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
