import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "server_error";
}

type Priority = "low" | "medium" | "high" | "critical";

function classifyPriority(scope: string, message: string, meta: unknown): { priority: Priority; score: number } {
  const criticalScopes = new Set([
    "financeiro.faturas",
    "financeiro.assinatura",
    "operacao.ordens_servico",
    "operacao.agenda_dia",
  ]);

  if (criticalScopes.has(scope)) return { priority: "critical", score: 10 };

  const text = `${scope} ${message}`.toLowerCase();
  if (text.includes("pagamento") || text.includes("fatura") || text.includes("webhook")) {
    return { priority: "high", score: 8 };
  }

  const errorsInWindow =
    meta && typeof meta === "object" && "errors_in_window" in (meta as Record<string, unknown>)
      ? Number((meta as Record<string, unknown>).errors_in_window ?? 0)
      : 0;

  if (errorsInWindow >= 10) return { priority: "critical", score: 10 };
  if (errorsInWindow >= 5) return { priority: "high", score: 8 };

  if (scope.startsWith("financeiro.") || scope.startsWith("operacao.")) {
    return { priority: "medium", score: 6 };
  }

  return { priority: "low", score: 3 };
}

function normalizePhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export async function POST(req: Request) {
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json({ error: "supabase_env_missing" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.scope !== "string" || typeof body.message !== "string") {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRole);
    const { priority, score } = classifyPriority(body.scope, body.message, body.meta ?? null);

    let empresaId: string | null = null;
    const accessToken = req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
    if (accessToken) {
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
      if (!userError && userData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        empresaId = profile?.empresa_id ?? null;
      }
    }

    if (!empresaId && typeof body.empresa_id === "string") {
      empresaId = body.empresa_id;
    }

    const payload = {
      app: "masterfleetbr",
      kind: "observability_alert",
      scope: body.scope,
      message: body.message,
      meta: body.meta ?? null,
      empresa_id: empresaId,
      priority,
      priority_score: score,
      occurred_at: new Date().toISOString(),
    };

    const channelResults: Record<string, string> = {};

    const webhookUrl = process.env.OBSERVABILITY_ALERT_WEBHOOK_URL;
    if (webhookUrl) {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.OBSERVABILITY_ALERT_WEBHOOK_SECRET
            ? { "x-observability-secret": process.env.OBSERVABILITY_ALERT_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify(payload),
      });
      channelResults.webhook = resp.ok ? "sent" : `failed_${resp.status}`;
    } else {
      channelResults.webhook = "skipped_missing_webhook";
    }

    const emailTo = process.env.OBSERVABILITY_ALERT_EMAIL_TO;
    const resendKey = process.env.RESEND_API_KEY;
    if (emailTo && resendKey && score >= 6) {
      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.OBSERVABILITY_ALERT_EMAIL_FROM ?? "onboarding@resend.dev",
          to: emailTo,
          subject: `[Observabilidade][${priority.toUpperCase()}] ${body.scope}`,
          html: `<p><strong>Scope:</strong> ${body.scope}</p><p><strong>Mensagem:</strong> ${body.message}</p><pre>${JSON.stringify(body.meta ?? {}, null, 2)}</pre>`,
        }),
      });
      channelResults.email = emailResp.ok ? "sent" : `failed_${emailResp.status}`;
    } else {
      channelResults.email = "skipped_missing_config_or_low_priority";
    }

    if (empresaId && score >= 8) {
      const [{ data: empresa }, { data: cfg }] = await Promise.all([
        supabase.from("empresas").select("whatsapp").eq("id", empresaId).maybeSingle(),
        supabase.from("whatsapp_configs").select("ativo").eq("empresa_id", empresaId).maybeSingle(),
      ]);

      const destino = normalizePhone(empresa?.whatsapp);
      if (destino && cfg?.ativo) {
        const { error: waError } = await supabase.from("whatsapp_outbox").insert({
          empresa_id: empresaId,
          destino_numero: destino,
          mensagem: `[OBS ${priority.toUpperCase()}] ${body.scope}: ${body.message}`,
          payload: { scope: body.scope, meta: body.meta ?? null },
          prioridade: Math.max(1, Math.min(10, score)),
          status: "queued",
          source_type: "observability_alert",
        });
        channelResults.whatsapp = waError ? `failed_${waError.message}` : "queued";
      } else {
        channelResults.whatsapp = "skipped_missing_phone_or_config";
      }
    } else {
      channelResults.whatsapp = "skipped_low_priority_or_missing_empresa";
    }

    return NextResponse.json({ ok: true, priority, channels: channelResults });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
