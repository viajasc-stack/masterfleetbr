import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, getAuthContextFromBearer, getSupabaseServiceClient } from "../_lib";

export async function POST(req: NextRequest) {
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    const supabase = getSupabaseServiceClient();

    const state = randomUUID();
    const stateExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase.from("google_calendar_integrations").upsert(
      {
        empresa_id: empresaId,
        oauth_state: state,
        oauth_state_expires_at: stateExpiresAt,
      },
      { onConflict: "empresa_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ authUrl: buildGoogleAuthUrl(state) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "server_error";
    if (msg.startsWith("Missing env:")) {
      const missingEnv = msg.replace("Missing env:", "").trim();
      return NextResponse.json({ error: "google_not_configured", missing_env: missingEnv }, { status: 503 });
    }
    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
