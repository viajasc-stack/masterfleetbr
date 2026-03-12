import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromBearer, getSupabaseServiceClient } from "../_lib";

type Payload = {
  ativo?: boolean;
  sync_direction?: "bidirectional" | "google_to_masterfleet" | "masterfleet_to_google";
  calendar_id?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    const body = (await req.json().catch(() => ({}))) as Payload;
    const supabase = getSupabaseServiceClient();

    const syncDirection =
      body.sync_direction && ["bidirectional", "google_to_masterfleet", "masterfleet_to_google"].includes(body.sync_direction)
        ? body.sync_direction
        : "bidirectional";

    const payload = {
      empresa_id: empresaId,
      ativo: Boolean(body.ativo),
      sync_direction: syncDirection,
      calendar_id: (body.calendar_id || "primary").trim() || "primary",
      last_sync_status: "settings_updated",
      last_sync_message: "Configurações atualizadas.",
    };

    const { error } = await supabase.from("google_calendar_integrations").upsert(payload, { onConflict: "empresa_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "server_error";
    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
