import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServerClient() {
  if (!supabaseUrl || !serviceRole) {
    throw new Error("supabase_env_missing");
  }
  return createClient(supabaseUrl, serviceRole);
}

async function getEmpresaIdFromAuth(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return null;
  const supabase = getServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return profile?.empresa_id ?? null;
}

export async function GET(req: Request) {
  try {
    const empresaId = await getEmpresaIdFromAuth(req);
    if (!empresaId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const supabase = getServerClient();
    const { data, error } = await supabase
      .from("telemetria_eventos")
      .select("id, tipo, severidade, velocidade_kmh, latitude, longitude, ocorrido_em, created_at")
      .eq("empresa_id", empresaId)
      .order("ocorrido_em", { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ eventos: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.tipo !== "string") {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const empresaId = await getEmpresaIdFromAuth(req);
    if (!empresaId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const supabase = getServerClient();
    const { data, error } = await supabase
      .from("telemetria_eventos")
      .insert({
        empresa_id: empresaId,
        veiculo_id: typeof body.veiculo_id === "string" ? body.veiculo_id : null,
        motorista_id: typeof body.motorista_id === "string" ? body.motorista_id : null,
        tipo: body.tipo,
        severidade: typeof body.severidade === "string" ? body.severidade : "info",
        velocidade_kmh: typeof body.velocidade_kmh === "number" ? body.velocidade_kmh : null,
        latitude: typeof body.latitude === "number" ? body.latitude : null,
        longitude: typeof body.longitude === "number" ? body.longitude : null,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
