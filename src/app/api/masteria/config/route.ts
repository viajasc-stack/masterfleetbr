import { NextRequest, NextResponse } from "next/server";
import { defaultMasterIAConfig, getAuthContextFromBearer, getMasterIAConfig, getSupabaseServiceClient } from "../_lib";

type Payload = {
  enabled?: boolean;
  openai_model?: string;
  temperature?: number;
  auto_scan_enabled?: boolean;
  scan_interval_min?: number;
  alert_channel_inapp?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContextFromBearer(req);
    if (!auth.isSuperAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const config = await getMasterIAConfig();
    return NextResponse.json({
      config,
      openai_configured: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContextFromBearer(req);
    if (!auth.isSuperAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Payload;
    const defaults = defaultMasterIAConfig();

    const payload = {
      enabled: typeof body.enabled === "boolean" ? body.enabled : defaults.enabled,
      openai_model: String(body.openai_model ?? defaults.openai_model),
      temperature: Number.isFinite(Number(body.temperature)) ? Math.max(0, Math.min(1, Number(body.temperature))) : defaults.temperature,
      auto_scan_enabled: typeof body.auto_scan_enabled === "boolean" ? body.auto_scan_enabled : defaults.auto_scan_enabled,
      scan_interval_min: Number.isFinite(Number(body.scan_interval_min))
        ? Math.max(1, Math.min(60, Number(body.scan_interval_min)))
        : defaults.scan_interval_min,
      alert_channel_inapp:
        typeof body.alert_channel_inapp === "boolean" ? body.alert_channel_inapp : defaults.alert_channel_inapp,
    };

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.rpc("master_upsert_setting", {
      p_key: "masteria_config",
      p_value: payload,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true, config: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
