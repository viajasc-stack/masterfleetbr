import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromBearer, getSupabaseServiceClient } from "../_lib";

export async function GET(req: NextRequest) {
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from("google_calendar_integrations")
      .select(
        "ativo,sync_direction,calendar_id,google_connected_email,google_token_expires_at,last_sync_at,last_sync_status,last_sync_message,updated_at,google_refresh_token,google_watch_channel_id,google_watch_resource_id,google_watch_expiration"
      )
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const integration = data
      ? {
          ativo: Boolean(data.ativo),
          sync_direction: data.sync_direction,
          calendar_id: data.calendar_id,
          google_connected_email: data.google_connected_email,
          google_token_expires_at: data.google_token_expires_at,
          last_sync_at: data.last_sync_at,
          last_sync_status: data.last_sync_status,
          last_sync_message: data.last_sync_message,
          updated_at: data.updated_at,
          has_refresh_token: Boolean(data.google_refresh_token),
          auto_sync_enabled: Boolean(data.google_watch_channel_id && data.google_watch_resource_id),
          google_watch_expiration: data.google_watch_expiration,
        }
      : null;

    return NextResponse.json({ integration });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "server_error";
    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
