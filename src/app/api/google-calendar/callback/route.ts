import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, getGoogleUserEmail, getSupabaseServiceClient } from "../_lib";

const DEFAULT_REDIRECT = "/configuracoes/google-agenda";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL(`${DEFAULT_REDIRECT}?status=oauth_error&detail=${encodeURIComponent(errorParam)}`, req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${DEFAULT_REDIRECT}?status=invalid_callback`, req.url));
  }

  const supabase = getSupabaseServiceClient();

  const { data: integration, error: integrationError } = await supabase
    .from("google_calendar_integrations")
    .select("id, empresa_id, oauth_state_expires_at")
    .eq("oauth_state", state)
    .maybeSingle();

  if (integrationError || !integration?.id || !integration.empresa_id) {
    return NextResponse.redirect(new URL(`${DEFAULT_REDIRECT}?status=state_not_found`, req.url));
  }

  if (!integration.oauth_state_expires_at || new Date(integration.oauth_state_expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(new URL(`${DEFAULT_REDIRECT}?status=state_expired`, req.url));
  }

  try {
    const token = await exchangeGoogleCode(code);
    const connectedEmail = await getGoogleUserEmail(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("google_calendar_integrations")
      .update({
        ativo: true,
        google_access_token: token.access_token,
        google_refresh_token: token.refresh_token ?? null,
        google_token_expires_at: expiresAt,
        google_connected_email: connectedEmail,
        oauth_state: null,
        oauth_state_expires_at: null,
        last_sync_status: "connected",
        last_sync_message: "Conexão OAuth concluída com sucesso.",
      })
      .eq("id", integration.id)
      .eq("empresa_id", integration.empresa_id);

    if (updateError) {
      return NextResponse.redirect(new URL(`${DEFAULT_REDIRECT}?status=save_error`, req.url));
    }

    return NextResponse.redirect(new URL(`${DEFAULT_REDIRECT}?status=connected`, req.url));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "oauth_exchange_failed";
    return NextResponse.redirect(new URL(`${DEFAULT_REDIRECT}?status=oauth_exchange_error&detail=${encodeURIComponent(detail)}`, req.url));
  }
}
