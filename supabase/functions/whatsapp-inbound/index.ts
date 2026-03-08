import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function extractMessageText(payload: Record<string, unknown>): string {
  const direct = payload.message ?? payload.text ?? payload.body;
  if (typeof direct === "string") return direct;

  const data = payload.data as Record<string, unknown> | undefined;
  if (data) {
    const nested = data.message ?? data.text ?? data.body;
    if (typeof nested === "string") return nested;
  }

  return "";
}

function extractProviderMessageId(payload: Record<string, unknown>): string | null {
  const direct = payload.message_id ?? payload.provider_message_id ?? payload.id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const data = payload.data as Record<string, unknown> | undefined;
  if (data) {
    const nested = data.message_id ?? data.provider_message_id ?? data.id;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }

  return null;
}

function normalizeEventType(raw: string): string {
  const v = (raw || "").toLowerCase();
  if (["message", "messages.upsert", "new_message"].includes(v)) return "message";
  if (v.includes("delivered") || v.includes("delivery")) return "delivered";
  if (v.includes("read") || v.includes("seen")) return "read";
  if (v.includes("fail") || v.includes("error") || v.includes("undelivered")) return "failed";
  return v || "message";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const queryEmpresaId = url.searchParams.get("empresa_id");
    const provider = url.searchParams.get("provider") ?? "custom_webhook";

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const eventTypeRaw = String(body.event_type ?? body.type ?? "message");
    const eventType = normalizeEventType(eventTypeRaw);
    const fromNumber = onlyDigits(String(body.from_number ?? body.from ?? body.sender ?? ""));
    const toNumber = onlyDigits(String(body.to_number ?? body.to ?? body.recipient ?? ""));
    const messageText = extractMessageText(body);
    const providerMessageId = extractProviderMessageId(body);
    const outboxId = typeof body.outbox_id === "string" ? body.outbox_id : null;

    let empresaId: string | null = queryEmpresaId;

    if (!empresaId && toNumber) {
      const { data: byPhone } = await supabase
        .from("empresas")
        .select("id, whatsapp")
        .not("whatsapp", "is", null);

      const found = (byPhone ?? []).find((row: { id: string; whatsapp: string | null }) =>
        onlyDigits(row.whatsapp) === toNumber
      );
      empresaId = found?.id ?? null;
    }

    if (!empresaId && fromNumber) {
      const { data: bySender } = await supabase
        .from("empresas")
        .select("id, whatsapp")
        .not("whatsapp", "is", null);

      const found = (bySender ?? []).find((row: { id: string; whatsapp: string | null }) =>
        onlyDigits(row.whatsapp) === fromNumber
      );
      empresaId = found?.id ?? null;
    }

    // valida secret por empresa (quando configurado)
    const headerSecret = req.headers.get("x-webhook-secret");
    if (empresaId) {
      const { data: cfg } = await supabase
        .from("whatsapp_configs")
        .select("webhook_secret")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      const expected = cfg?.webhook_secret ?? null;
      if (expected && expected !== headerSecret) {
        return new Response(JSON.stringify({ error: "invalid_webhook_secret" }), {
          status: 401,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    const { data: logRow, error: logError } = await supabase
      .from("whatsapp_inbound_logs")
      .insert({
        empresa_id: empresaId,
        provider,
        event_type: eventType,
        from_number: fromNumber || null,
        to_number: toNumber || null,
        message_text: messageText || null,
        payload: body,
      })
      .select("id")
      .single();

    if (logError || !logRow?.id) {
      throw logError ?? new Error("inbound_log_insert_failed");
    }

    let processResult: unknown = { ok: true, mode: "ignored" };
    let processError: { message: string } | null = null;

    if (eventType === "message") {
      const rpcRes = await supabase.rpc("whatsapp_process_inbound", {
        p_inbound_id: logRow.id,
      });
      processResult = rpcRes.data;
      processError = rpcRes.error;
    } else if (empresaId) {
      const deliveryRes = await supabase.rpc("whatsapp_apply_delivery_event", {
        p_empresa_id: empresaId,
        p_provider: provider,
        p_message_id: providerMessageId,
        p_outbox_id: outboxId,
        p_event_type: eventType,
        p_payload: body,
      });

      processResult = {
        ok: !deliveryRes.error,
        mode: "delivery_event",
        matched: deliveryRes.data,
        event_type: eventType,
      };
      processError = deliveryRes.error;

      if (!deliveryRes.error) {
        await supabase
          .from("whatsapp_inbound_logs")
          .update({
            processing_status: "processed",
            processing_error: null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", logRow.id);
      }
    }

    if (processError) {
      return new Response(JSON.stringify({ ok: false, inbound_id: logRow.id, error: processError.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, inbound_id: logRow.id, result: processResult }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-inbound error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
