import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromBearer, getMasterIAConfig, getSupabaseServiceClient } from "../_lib";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContextFromBearer(req);
    const supabase = getSupabaseServiceClient();

    const config = await getMasterIAConfig();

    const [{ data: alertas, error: alertasErr }, { data: conflitos, error: conflitosErr }] = await Promise.all([
      supabase
        .from("masteria_alertas")
        .select("id, tipo, severidade, titulo, descricao, meta, status, detectado_em")
        .eq("empresa_id", auth.empresaId)
        .order("detectado_em", { ascending: false })
        .limit(30),
      supabase.rpc("masteria_list_os_conflicts", {
        p_empresa_id: auth.empresaId,
        p_days_ahead: 7,
      }),
    ]);

    if (alertasErr) throw alertasErr;
    if (conflitosErr) throw conflitosErr;

    return NextResponse.json({
      config,
      alertas: alertas ?? [],
      conflitos: conflitos ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "unauthorized" || message === "forbidden" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
