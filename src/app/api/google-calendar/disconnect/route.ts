import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromBearer, getSupabaseServiceClient } from "../_lib";

export async function POST(req: NextRequest) {
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from("google_calendar_integrations")
      .update({
        ativo: false,
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        google_connected_email: null,
        oauth_state: null,
        oauth_state_expires_at: null,
        last_sync_status: "disconnected",
        last_sync_message: "Integração desconectada pelo usuário.",
      })
      .eq("empresa_id", empresaId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "server_error";
    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
