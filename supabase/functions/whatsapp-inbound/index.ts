import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function validateMetaSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const appSecret = Deno.env.get("WHATSAPP_META_APP_SECRET") ?? "";
  if (!appSecret) return true; // opcional: se não configurar, não bloqueia
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expectedHex = signatureHeader.slice("sha256=".length).trim().toLowerCase();
  if (!expectedHex) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const gotHex = toHex(new Uint8Array(sig)).toLowerCase();
  return gotHex === expectedHex;
}

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

function parseMetaCloudWebhook(body: Record<string, unknown>) {
  const entry = Array.isArray(body.entry) ? (body.entry[0] as Record<string, unknown> | undefined) : undefined;
  const changes = Array.isArray(entry?.changes) ? (entry?.changes as Array<Record<string, unknown>>) : [];
  const firstChange = changes[0];
  const value = (firstChange?.value ?? {}) as Record<string, unknown>;

  const metadata = (value.metadata ?? {}) as Record<string, unknown>;
  const displayPhoneNumber = String(metadata.display_phone_number ?? "");

  const statuses = Array.isArray(value.statuses) ? (value.statuses as Array<Record<string, unknown>>) : [];
  if (statuses.length > 0) {
    const st = statuses[0];
    const errors = Array.isArray(st.errors) ? (st.errors as Array<Record<string, unknown>>) : [];
    const firstErr = errors[0] ?? null;
    const statusText = String(st.status ?? "status_update");
    const detail = firstErr
      ? `${String(firstErr.code ?? "")}:${String(firstErr.title ?? firstErr.message ?? "")}`
      : "";
    return {
      eventType: normalizeEventType(String(st.status ?? "delivered")),
      fromNumber: onlyDigits(String(st.recipient_id ?? "")),
      toNumber: onlyDigits(displayPhoneNumber),
      messageText: detail ? `${statusText} (${detail})` : statusText,
      providerMessageId: String(st.id ?? "") || null,
    };
  }

  const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : [];
  if (messages.length > 0) {
    const msg = messages[0];
    const textObj = (msg.text ?? {}) as Record<string, unknown>;
    const interactive = (msg.interactive ?? {}) as Record<string, unknown>;
    const buttonReply = (interactive.button_reply ?? {}) as Record<string, unknown>;
    const listReply = (interactive.list_reply ?? {}) as Record<string, unknown>;
    const mediaCaption =
      ((msg.image as Record<string, unknown> | undefined)?.caption as string | undefined) ||
      ((msg.document as Record<string, unknown> | undefined)?.caption as string | undefined) ||
      "";
    const fallbackText =
      String(textObj.body ?? "") ||
      String(buttonReply.title ?? buttonReply.id ?? "") ||
      String(listReply.title ?? listReply.id ?? "") ||
      String(mediaCaption ?? "") ||
      `[${String(msg.type ?? "message")}]`;

    const contacts = Array.isArray(value.contacts) ? (value.contacts as Array<Record<string, unknown>>) : [];
    const contactWaId = String(contacts[0]?.wa_id ?? "");

    return {
      eventType: "message",
      fromNumber: onlyDigits(String(msg.from ?? contactWaId ?? "")),
      toNumber: onlyDigits(displayPhoneNumber),
      messageText: fallbackText,
      providerMessageId: String(msg.id ?? "") || null,
    };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WHATSAPP_META_VERIFY_TOKEN") ?? "";

    if (mode === "subscribe" && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: CORS });
    }

    return new Response("forbidden", { status: 403, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const queryEmpresaId = url.searchParams.get("empresa_id");
    const provider = url.searchParams.get("provider") ?? "custom_webhook";
    const isMetaCloud = provider === "meta_cloud_api";

    const rawBody = await req.text();
    if (isMetaCloud) {
      const signature = req.headers.get("x-hub-signature-256");
      const validSig = await validateMetaSignature(rawBody, signature);
      if (!validSig) {
        return new Response(JSON.stringify({ error: "invalid_meta_signature" }), {
          status: 401,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    const body = (rawBody ? JSON.parse(rawBody) : {}) as Record<string, unknown>;

    const parsedMeta = isMetaCloud ? parseMetaCloudWebhook(body) : null;

    const eventTypeRaw = String(body.event_type ?? body.type ?? parsedMeta?.eventType ?? "message");
    const eventType = normalizeEventType(eventTypeRaw);
    const fromNumber = onlyDigits(String(body.from_number ?? body.from ?? body.sender ?? parsedMeta?.fromNumber ?? ""));
    const toNumber = onlyDigits(String(body.to_number ?? body.to ?? body.recipient ?? parsedMeta?.toNumber ?? ""));
    const messageText = parsedMeta?.messageText ?? extractMessageText(body);
    const providerMessageId = parsedMeta?.providerMessageId ?? extractProviderMessageId(body);
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

    // valida secret por empresa (quando configurado), exceto Meta Cloud API
    const headerSecret = req.headers.get("x-webhook-secret");
    if (empresaId && !isMetaCloud) {
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
