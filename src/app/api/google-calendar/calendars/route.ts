import { NextRequest, NextResponse } from "next/server";
import {
  ensureValidGoogleAccessToken,
  getAuthContextFromBearer,
  getSupabaseServiceClient,
} from "../_lib";

type GoogleCalendarItem = {
  id?: string;
  summary?: string;
  primary?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    const supabase = getSupabaseServiceClient();

    const { data: integration, error: integrationError } = await supabase
      .from("google_calendar_integrations")
      .select("calendar_id,google_access_token,google_refresh_token,google_token_expires_at")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (integrationError) return NextResponse.json({ error: integrationError.message }, { status: 500 });
    if (!integration) return NextResponse.json({ calendars: [], selected_calendar_id: "primary" });

    const access = await ensureValidGoogleAccessToken(empresaId, {
      accessToken: integration.google_access_token ?? "",
      refreshToken: integration.google_refresh_token ?? null,
      accessTokenExpiresAt: integration.google_token_expires_at ?? null,
    });

    const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `google_calendar_list_failed: ${txt}` }, { status: 500 });
    }

    const data = (await res.json()) as { items?: GoogleCalendarItem[] };
    const calendars = (data.items ?? [])
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id as string,
        summary: c.summary ?? c.id,
        primary: Boolean(c.primary),
      }));

    return NextResponse.json({
      calendars,
      selected_calendar_id: integration.calendar_id || "primary",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "server_error";
    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
