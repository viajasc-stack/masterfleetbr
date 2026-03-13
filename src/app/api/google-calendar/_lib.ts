import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

type AuthContext = {
  userId: string;
  empresaId: string;
};

type GoogleIntegrationTokens = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
};

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function getGoogleOAuthConfig(): Promise<GoogleOAuthConfig> {
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const envRedirectUri = process.env.GOOGLE_REDIRECT_URI;

  const hasAllEnv = Boolean(envClientId && envClientSecret && envRedirectUri);
  if (hasAllEnv) {
    return {
      clientId: envClientId as string,
      clientSecret: envClientSecret as string,
      redirectUri: envRedirectUri as string,
    };
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("master_settings")
    .select("value")
    .eq("key", "google_oauth")
    .maybeSingle();

  if (error) {
    throw new Error(`google_config_load_failed: ${error.message}`);
  }

  const value = (data?.value ?? {}) as {
    client_id?: string;
    client_secret?: string;
    redirect_uri?: string;
  };

  const clientId = value.client_id || envClientId;
  const clientSecret = value.client_secret || envClientSecret;
  const redirectUri = value.redirect_uri || envRedirectUri;

  if (!clientId) throw new Error("Missing env: GOOGLE_CLIENT_ID");
  if (!clientSecret) throw new Error("Missing env: GOOGLE_CLIENT_SECRET");
  if (!redirectUri) throw new Error("Missing env: GOOGLE_REDIRECT_URI");

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function getSupabaseServiceClient() {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export async function getAuthContextFromBearer(req: NextRequest): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!accessToken) {
    throw new Error("unauthorized");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profileError || !profile?.empresa_id) {
    throw new Error("forbidden");
  }

  return {
    userId: data.user.id,
    empresaId: profile.empresa_id,
  };
}

export async function buildGoogleAuthUrl(state: string) {
  const cfg = await getGoogleOAuthConfig();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", "openid email https://www.googleapis.com/auth/calendar");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  const cfg = await getGoogleOAuthConfig();

  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`google_token_exchange_failed: ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return data;
}

export async function getGoogleUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const cfg = await getGoogleOAuthConfig();

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`google_refresh_failed: ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return data;
}

export async function ensureValidGoogleAccessToken(
  empresaId: string,
  tokens: GoogleIntegrationTokens
) {
  const expiresAtMs = tokens.accessTokenExpiresAt ? new Date(tokens.accessTokenExpiresAt).getTime() : 0;
  const stillValid = Boolean(tokens.accessToken) && expiresAtMs - Date.now() > 60_000;
  if (stillValid) {
    return { accessToken: tokens.accessToken, expiresAt: tokens.accessTokenExpiresAt };
  }

  if (!tokens.refreshToken) {
    throw new Error("google_refresh_token_missing");
  }

  const refreshed = await refreshGoogleAccessToken(tokens.refreshToken);
  const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("google_calendar_integrations")
    .update({
      google_access_token: refreshed.access_token,
      google_token_expires_at: nextExpiresAt,
    })
    .eq("empresa_id", empresaId);

  if (error) {
    throw new Error(`google_refresh_persist_failed: ${error.message}`);
  }

  return { accessToken: refreshed.access_token, expiresAt: nextExpiresAt };
}

export async function getGoogleWebhookUrl() {
  const envWebhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL;
  if (envWebhookUrl) return envWebhookUrl;

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("master_settings")
    .select("value")
    .eq("key", "google_oauth")
    .maybeSingle();

  if (error) {
    throw new Error(`google_config_load_failed: ${error.message}`);
  }

  const value = (data?.value ?? {}) as { webhook_url?: string };
  if (!value.webhook_url) throw new Error("Missing env: GOOGLE_CALENDAR_WEBHOOK_URL");
  return value.webhook_url;
}
