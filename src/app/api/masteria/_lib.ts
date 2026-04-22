import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

type AuthContext = {
  userId: string;
  empresaId: string;
  isSuperAdmin: boolean;
};

export type MasterIAConfig = {
  enabled: boolean;
  openai_model: string;
  temperature: number;
  auto_scan_enabled: boolean;
  scan_interval_min: number;
  alert_channel_inapp: boolean;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function getSupabaseServiceClient() {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export async function getAuthContextFromBearer(req: NextRequest): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) throw new Error("unauthorized");

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("unauthorized");

  const [{ data: profile }, { data: isSuperAdminData }] = await Promise.all([
    supabase.from("profiles").select("empresa_id").eq("user_id", data.user.id).maybeSingle(),
    supabase.rpc("is_super_admin"),
  ]);

  if (!profile?.empresa_id && !isSuperAdminData) throw new Error("forbidden");

  return {
    userId: data.user.id,
    empresaId: profile?.empresa_id ?? "",
    isSuperAdmin: Boolean(isSuperAdminData),
  };
}

export function defaultMasterIAConfig(): MasterIAConfig {
  return {
    enabled: true,
    openai_model: "gpt-4.1-mini",
    temperature: 0.2,
    auto_scan_enabled: true,
    scan_interval_min: 5,
    alert_channel_inapp: true,
  };
}

export async function getMasterIAConfig() {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("master_settings")
    .select("value")
    .eq("key", "masteria_config")
    .maybeSingle();

  const raw = (data?.value ?? {}) as Partial<MasterIAConfig>;
  const defaults = defaultMasterIAConfig();
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaults.enabled,
    openai_model: String(raw.openai_model ?? defaults.openai_model),
    temperature: Number.isFinite(Number(raw.temperature)) ? Number(raw.temperature) : defaults.temperature,
    auto_scan_enabled:
      typeof raw.auto_scan_enabled === "boolean" ? raw.auto_scan_enabled : defaults.auto_scan_enabled,
    scan_interval_min: Number.isFinite(Number(raw.scan_interval_min))
      ? Math.max(1, Number(raw.scan_interval_min))
      : defaults.scan_interval_min,
    alert_channel_inapp:
      typeof raw.alert_channel_inapp === "boolean" ? raw.alert_channel_inapp : defaults.alert_channel_inapp,
  } as MasterIAConfig;
}
