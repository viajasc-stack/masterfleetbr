import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromBearer, getMasterIAConfig, getSupabaseServiceClient } from "../_lib";

type ConflictRow = {
  empresa_id: string;
  veiculo_id: string;
  os_id_1: string;
  os_numero_1: number | null;
  os_inicio_1: string;
  os_fim_1: string;
  os_id_2: string;
  os_numero_2: number | null;
  os_inicio_2: string;
  os_fim_2: string;
};

type AlertaRow = {
  id: string;
  meta: { signature?: string } | null;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContextFromBearer(req);
    if (!auth.empresaId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const config = await getMasterIAConfig();
    if (!config.enabled || !config.auto_scan_enabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: "masteria_disabled_or_scan_disabled" });
    }

    const supabase = getSupabaseServiceClient();

    const [{ data: conflitosData, error: conflitosErr }, { data: alertasAbertos, error: alertasErr }] = await Promise.all([
      supabase.rpc("masteria_list_os_conflicts", {
        p_empresa_id: auth.empresaId,
        p_days_ahead: 7,
      }),
      supabase
        .from("masteria_alertas")
        .select("id, meta")
        .eq("empresa_id", auth.empresaId)
        .eq("tipo", "conflito_veiculo_os")
        .eq("status", "aberto"),
    ]);

    if (conflitosErr) throw conflitosErr;
    if (alertasErr) throw alertasErr;

    const conflitos = ((conflitosData ?? []) as ConflictRow[]).map((c) => {
      const sorted = [c.os_id_1, c.os_id_2].sort();
      return {
        ...c,
        signature: `${c.veiculo_id}:${sorted[0]}:${sorted[1]}`,
      };
    });

    const existentes = (alertasAbertos ?? []) as AlertaRow[];
    const existingMap = new Map<string, string>();
    for (const a of existentes) {
      const signature = String(a.meta?.signature ?? "");
      if (signature) existingMap.set(signature, a.id);
    }

    const signaturesAtuais = new Set(conflitos.map((c) => c.signature));

    const inserts = conflitos
      .filter((c) => !existingMap.has(c.signature))
      .map((c) => ({
        empresa_id: auth.empresaId,
        tipo: "conflito_veiculo_os",
        severidade: "alta",
        titulo: "Conflito de OS no mesmo veículo",
        descricao: `OS ${c.os_numero_1 ?? "s/n"} e OS ${c.os_numero_2 ?? "s/n"} estão sobrepostas no veículo.`,
        meta: {
          signature: c.signature,
          veiculo_id: c.veiculo_id,
          os_1: {
            id: c.os_id_1,
            numero: c.os_numero_1,
            inicio_em: c.os_inicio_1,
            fim_em: c.os_fim_1,
          },
          os_2: {
            id: c.os_id_2,
            numero: c.os_numero_2,
            inicio_em: c.os_inicio_2,
            fim_em: c.os_fim_2,
          },
        },
        origem: "masteria_scan",
      }));

    if (inserts.length > 0) {
      const { error: insertErr } = await supabase.from("masteria_alertas").insert(inserts);
      if (insertErr) throw insertErr;
    }

    const toResolveIds = existentes
      .filter((a) => {
        const sig = String(a.meta?.signature ?? "");
        return sig && !signaturesAtuais.has(sig);
      })
      .map((a) => a.id);

    if (toResolveIds.length > 0) {
      const { error: resolveErr } = await supabase
        .from("masteria_alertas")
        .update({ status: "resolvido", resolvido_em: new Date().toISOString(), resolvido_por: auth.userId, updated_at: new Date().toISOString() })
        .in("id", toResolveIds);
      if (resolveErr) {
        await supabase
          .from("masteria_alertas")
          .update({ status: "resolvido", resolvido_em: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in("id", toResolveIds);
      }
    }

    return NextResponse.json({
      ok: true,
      conflitos_detectados: conflitos.length,
      alertas_novos: inserts.length,
      alertas_resolvidos: toResolveIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
