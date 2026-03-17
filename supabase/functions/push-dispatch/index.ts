import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PushOutboxRow = {
  id: string;
  empresa_id: string;
  expo_push_token: string;
  titulo: string;
  mensagem: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  const normalized = authHeader.trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) return null;
  return normalized.slice(7).trim() || null;
}

function isLikelyExpoToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

function parseBatchLimit(url: URL): number {
  const queryLimit = Number(url.searchParams.get("limit") ?? "");
  const envLimit = Number(Deno.env.get("PUSH_BATCH_LIMIT") ?? "50");
  const value = Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : envLimit;
  return Math.max(1, Math.min(value, 100));
}

function calcRetrySeconds(attempt: number): number {
  const base = 15;
  const exp = Math.min(Math.max(attempt, 1), 7);
  return Math.min(base * 2 ** (exp - 1), 3600);
}

function isDeviceNotRegisteredError(details: unknown): boolean {
  if (!details || typeof details !== "object") return false;
  const detailsObj = details as { error?: string };
  return detailsObj.error === "DeviceNotRegistered";
}

async function sendExpoPush(message: {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(message),
  });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(`expo_push_http_${res.status}:${text || "empty_response"}`);
  }

  return {
    status: res.status,
    bodyText: text,
    bodyJson: json,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const expectedSecret = Deno.env.get("PUSH_DISPATCH_SECRET") ?? "";
  if (expectedSecret) {
    const token = getBearerToken(req);
    if (!token || token !== expectedSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const limit = parseBatchLimit(url);

    const { data: queued, error: fetchError } = await supabase
      .from("motorista_push_outbox")
      .select("id, empresa_id, expo_push_token, titulo, mensagem, payload, attempts, max_attempts")
      .eq("status", "queued")
      .or("next_retry_at.is.null,next_retry_at.lte.now()")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchError) throw fetchError;

    const rows = (queued ?? []) as PushOutboxRow[];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "queue_empty" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const ids = rows.map((r) => r.id);
    const nowIso = new Date().toISOString();

    const { data: lockedRows, error: lockError } = await supabase
      .from("motorista_push_outbox")
      .update({ status: "sending", updated_at: nowIso })
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
    let tokensDeactivated = 0;

    for (const row of lockedQueue) {
      processed += 1;
      const nextAttempt = Number(row.attempts ?? 0) + 1;

      if (!isLikelyExpoToken(row.expo_push_token)) {
        await supabase
          .from("motorista_push_tokens")
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq("empresa_id", row.empresa_id)
          .eq("expo_push_token", row.expo_push_token);

        await supabase
          .from("motorista_push_outbox")
          .update({
            status: "failed",
            attempts: nextAttempt,
            last_error: "invalid_expo_push_token",
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        failed += 1;
        tokensDeactivated += 1;
        continue;
      }

      try {
        const result = await sendExpoPush({
          to: row.expo_push_token,
          title: row.titulo,
          body: row.mensagem ?? "",
          data: {
            ...(row.payload ?? {}),
            outbox_id: row.id,
            empresa_id: row.empresa_id,
          },
        });

        const data = Array.isArray(result.bodyJson?.data)
          ? (result.bodyJson?.data as Array<Record<string, unknown>>)
          : [];
        const first = data[0] ?? null;

        const status = String(first?.status ?? "");
        const ticketId = (first?.id as string | undefined) ?? null;
        const details = first?.details;

        if (status === "error") {
          const errMessage = String(first?.message ?? "expo_push_error");
          const willExhaust = nextAttempt >= Number(row.max_attempts ?? 6);
          const retrySeconds = calcRetrySeconds(nextAttempt);
          const nextRetryAt = new Date(Date.now() + retrySeconds * 1000).toISOString();

          if (isDeviceNotRegisteredError(details)) {
            await supabase
              .from("motorista_push_tokens")
              .update({ ativo: false, updated_at: new Date().toISOString() })
              .eq("empresa_id", row.empresa_id)
              .eq("expo_push_token", row.expo_push_token);
            tokensDeactivated += 1;
          }

          await supabase
            .from("motorista_push_outbox")
            .update({
              status: willExhaust ? "failed" : "queued",
              attempts: nextAttempt,
              last_error: errMessage,
              next_retry_at: willExhaust ? null : nextRetryAt,
              provider_ticket_id: ticketId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          failed += 1;
          continue;
        }

        await supabase
          .from("motorista_push_outbox")
          .update({
            status: "sent",
            attempts: nextAttempt,
            provider_ticket_id: ticketId,
            last_error: null,
            next_retry_at: null,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        sent += 1;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const willExhaust = nextAttempt >= Number(row.max_attempts ?? 6);
        const retrySeconds = calcRetrySeconds(nextAttempt);
        const nextRetryAt = new Date(Date.now() + retrySeconds * 1000).toISOString();

        await supabase
          .from("motorista_push_outbox")
          .update({
            status: willExhaust ? "failed" : "queued",
            attempts: nextAttempt,
            last_error: errMsg,
            next_retry_at: willExhaust ? null : nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        failed += 1;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        sent,
        failed,
        tokens_deactivated: tokensDeactivated,
      }),
      {
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("push-dispatch error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
