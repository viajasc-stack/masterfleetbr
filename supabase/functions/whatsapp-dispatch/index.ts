import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OutboxRow = {
  id: string;
  empresa_id: string;
  destino_numero: string;
  destino_nome: string | null;
  mensagem: string | null;
  template_codigo: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  provider_message_id: string | null;
  whatsapp_configs: {
    provider: "custom_webhook" | "zapi" | "twilio" | "360dialog" | "evolution" | "meta_cloud_api";
    api_url: string | null;
    api_token: string | null;
    from_number: string | null;
    instance_key: string | null;
  } | null;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseBatchLimit(url: URL): number {
  const queryLimit = Number(url.searchParams.get("limit") ?? "");
  const envLimit = Number(Deno.env.get("WHATSAPP_BATCH_LIMIT") ?? "25");
  const value = Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : envLimit;
  return Math.max(1, Math.min(value, 100));
}

function calcRetrySeconds(attempt: number): number {
  const base = 60;
  const exp = Math.min(Math.max(attempt, 1), 6);
  return Math.min(base * 2 ** (exp - 1), 3600);
}

async function sendViaProvider(row: OutboxRow) {
  const cfg = row.whatsapp_configs;
  if (!cfg || !cfg.api_url) {
    throw new Error("whatsapp_provider_not_configured");
  }

  if (cfg.provider === "meta_cloud_api") {
    if (!cfg.api_token) {
      throw new Error("meta_cloud_api_token_missing");
    }

    const metaTemplateName = typeof row.payload?.meta_template_name === "string"
      ? row.payload.meta_template_name
      : null;
    const metaTemplateLanguage = typeof row.payload?.meta_template_language === "string"
      ? row.payload.meta_template_language
      : "pt_BR";
    const metaTemplateComponents = Array.isArray(row.payload?.meta_template_components)
      ? row.payload?.meta_template_components
      : null;

    const graphPayload = metaTemplateName
      ? {
          messaging_product: "whatsapp",
          to: row.destino_numero,
          type: "template",
          template: {
            name: metaTemplateName,
            language: { code: metaTemplateLanguage },
            ...(metaTemplateComponents ? { components: metaTemplateComponents } : {}),
          },
        }
      : {
          messaging_product: "whatsapp",
          to: row.destino_numero,
          type: "text",
          text: {
            body: row.mensagem ?? "",
          },
        };

    const res = await fetch(cfg.api_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_token}`,
      },
      body: JSON.stringify(graphPayload),
    });

    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      throw new Error(`meta_cloud_api_http_${res.status}:${text || "empty_response"}`);
    }

    const messages = Array.isArray(json?.messages)
      ? (json?.messages as Array<Record<string, unknown>>)
      : [];

    const providerMessageId =
      (messages[0]?.id as string | undefined) ||
      (json?.message_id as string | undefined) ||
      row.provider_message_id ||
      null;

    return {
      httpStatus: res.status,
      responseBody: text,
      providerMessageId,
      providerStatus: metaTemplateName ? "template_accepted" : "accepted",
    };
  }

  const payload = {
    provider: cfg.provider,
    to: row.destino_numero,
    to_name: row.destino_nome,
    message: row.mensagem,
    template_code: row.template_codigo,
    variables: row.payload ?? {},
    from: cfg.from_number,
    instance_key: cfg.instance_key,
    outbox_id: row.id,
    empresa_id: row.empresa_id,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (cfg.api_token) {
    headers.Authorization = `Bearer ${cfg.api_token}`;
  }

  const res = await fetch(cfg.api_url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(`provider_http_${res.status}:${text || "empty_response"}`);
  }

  const providerMessageId =
    (json?.message_id as string | undefined) ||
    (json?.id as string | undefined) ||
    row.provider_message_id ||
    null;

  return {
    httpStatus: res.status,
    responseBody: text,
    providerMessageId,
    providerStatus: (json?.status as string | undefined) ?? "accepted",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const limit = parseBatchLimit(url);

    const { data: queued, error: fetchError } = await supabase
      .from("whatsapp_outbox")
      .select(`
        id,
        empresa_id,
        destino_numero,
        destino_nome,
        mensagem,
        template_codigo,
        payload,
        attempts,
        max_attempts,
        provider_message_id,
        whatsapp_configs!inner(
          provider,
          api_url,
          api_token,
          from_number,
          instance_key
        )
      `)
      .eq("status", "queued")
      .lte("attempts", 100)
      .or("next_retry_at.is.null,next_retry_at.lte.now()")
      .or("scheduled_for.is.null,scheduled_for.lte.now()")
      .eq("whatsapp_configs.ativo", true)
      .order("prioridade", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchError) throw fetchError;

    const rows = (queued ?? []) as OutboxRow[];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "queue_empty" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const ids = rows.map((r) => r.id);

    // lock otimista via status=sending para evitar dupla execução paralela
    const { data: lockedRows, error: lockError } = await supabase
      .from("whatsapp_outbox")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "queued")
      .select("id");

    if (lockError) throw lockError;

    const lockedIds = new Set((lockedRows ?? []).map((row: { id: string }) => row.id));
    const lockedQueue = rows.filter((row) => lockedIds.has(row.id));

    if (lockedQueue.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "already_locked" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const row of lockedQueue) {
      processed += 1;
      const nextAttempt = Number(row.attempts ?? 0) + 1;

      try {
        const result = await sendViaProvider(row);

        const { error: updateSentError } = await supabase
          .from("whatsapp_outbox")
          .update({
            status: "sent",
            provider_status: result.providerStatus,
            attempts: nextAttempt,
            last_error: null,
            next_retry_at: null,
            sent_at: new Date().toISOString(),
            provider_message_id: result.providerMessageId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (updateSentError) throw updateSentError;

        await supabase.from("whatsapp_dispatch_logs").insert({
          outbox_id: row.id,
          empresa_id: row.empresa_id,
          attempt: nextAttempt,
          status: "success",
          http_status: result.httpStatus,
          response_body: JSON.stringify({
            provider_status: result.providerStatus,
            template_codigo: row.template_codigo,
            mensagem: row.mensagem,
            provider_response: result.responseBody,
          }),
        });

        sent += 1;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const willExhaust = nextAttempt >= Number(row.max_attempts ?? 5);
        const retrySeconds = calcRetrySeconds(nextAttempt);
        const nextRetryAt = new Date(Date.now() + retrySeconds * 1000).toISOString();

        await supabase
          .from("whatsapp_outbox")
          .update({
            status: willExhaust ? "failed" : "queued",
            attempts: nextAttempt,
            last_error: errMsg,
            next_retry_at: willExhaust ? null : nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        await supabase.from("whatsapp_dispatch_logs").insert({
          outbox_id: row.id,
          empresa_id: row.empresa_id,
          attempt: nextAttempt,
          status: "error",
          error_message: errMsg,
        });

        failed += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, failed }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-dispatch error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
