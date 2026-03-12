import { NextRequest, NextResponse } from "next/server";
import {
  ensureValidGoogleAccessToken,
  getAuthContextFromBearer,
  getSupabaseServiceClient,
} from "../../_lib";

export async function POST(req: NextRequest) {
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    const supabase = getSupabaseServiceClient();

    const { data: integration, error: integrationError } = await supabase
      .from("google_calendar_integrations")
      .select(
        "google_watch_channel_id,google_watch_resource_id,google_access_token,google_refresh_token,google_token_expires_at"
      )
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (integrationError) return NextResponse.json({ error: integrationError.message }, { status: 500 });

    if (integration?.google_watch_channel_id && integration?.google_watch_resource_id) {
      const access = await ensureValidGoogleAccessToken(empresaId, {
        accessToken: integration.google_access_token ?? "",
        refreshToken: integration.google_refresh_token ?? null,
        accessTokenExpiresAt: integration.google_token_expires_at ?? null,
      });

      await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: integration.google_watch_channel_id,
          resourceId: integration.google_watch_resource_id,
        }),
      }).catch(() => null);
    }

    const { error: updateError } = await supabase
      .from("google_calendar_integrations")
      .update({
        google_watch_channel_id: null,
        google_watch_resource_id: null,
        google_watch_expiration: null,
        google_watch_token: null,
        last_sync_status: "watch_stopped",
        last_sync_message: "Sincronização automática desativada.",
      })
      .eq("empresa_id", empresaId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "server_error";
    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
