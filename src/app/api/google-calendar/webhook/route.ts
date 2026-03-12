import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "../_lib";
import { markGoogleCalendarSyncError, runGoogleCalendarSyncForEmpresa } from "../_sync";

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) ?? "";
}

export async function POST(req: NextRequest) {
  const channelId = getHeader(req, "x-goog-channel-id");
  const resourceId = getHeader(req, "x-goog-resource-id");
  const state = getHeader(req, "x-goog-resource-state");
  const token = getHeader(req, "x-goog-channel-token");

  if (!channelId || !resourceId) {
    return NextResponse.json({ ok: true });
  }

  if (state === "sync") {
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseServiceClient();
  const { data: integration, error } = await supabase
    .from("google_calendar_integrations")
    .select("empresa_id,google_watch_token")
    .eq("google_watch_channel_id", channelId)
    .eq("google_watch_resource_id", resourceId)
    .maybeSingle();

  if (error || !integration?.empresa_id) {
    return NextResponse.json({ ok: true });
  }

  if (integration.google_watch_token && token && integration.google_watch_token !== token) {
    return NextResponse.json({ ok: true });
  }

  try {
    await runGoogleCalendarSyncForEmpresa(integration.empresa_id);
  } catch (syncErr) {
    const msg = syncErr instanceof Error ? syncErr.message : "webhook_sync_error";
    await markGoogleCalendarSyncError(integration.empresa_id, msg);
  }

  return NextResponse.json({ ok: true });
}
