import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const rawBody = await req.text();
    let body: any = {};
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (e) { body = {}; }
    const topic = body.type ?? body.topic;

    // Optional webhook signature verification
    const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET");
    const sigHeader = req.headers.get("x-hub-signature") || req.headers.get("x-hub-signature-256") || req.headers.get("x-meli-signature");
    if (webhookSecret && sigHeader) {
      try {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", enc.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
        const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
        const sigB64 = typeof btoa === "function" ? btoa(String.fromCharCode(...new Uint8Array(signature))) : Buffer.from(new Uint8Array(signature)).toString("base64");
        const normalized = sigHeader.replace(/^sha256=|^sha256:/i, "");
        if (!(normalized === sigHex || normalized === sigB64)) {
          return new Response(JSON.stringify({ error: "signature mismatch" }), { status: 401, headers: CORS });
        }
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response(JSON.stringify({ error: "signature verification error" }), { status: 401, headers: CORS });
      }
    }

    // Log do webhook
    await supabase.from("webhook_logs").insert({ source: "mercadopago", payload: body });

    if (topic !== "payment") {
      return new Response(JSON.stringify({ ok: true, msg: "topic ignorado" }), { headers: CORS });
    }

    const paymentId = body.data?.id ?? body.id;
    if (!paymentId) return new Response(JSON.stringify({ error: "payment id não encontrado" }), { status: 400, headers: CORS });

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;

    // Consulta o pagamento no MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (!mpRes.ok) {
      return new Response(JSON.stringify({ error: "Erro ao consultar MP" }), { status: 500, headers: CORS });
    }

    const fatura_id = payment.external_reference;
    if (!fatura_id) return new Response(JSON.stringify({ ok: true, msg: "sem external_reference" }), { headers: CORS });

    if (payment.status !== "approved") {
      return new Response(JSON.stringify({ ok: true, msg: `status: ${payment.status}` }), { headers: CORS });
    }

    // Marca fatura como paga
    const { data: fatura } = await supabase.from("faturas").select("empresa_id, assinatura_id").eq("id", fatura_id).maybeSingle();
    if (!fatura) return new Response(JSON.stringify({ error: "fatura não encontrada" }), { status: 404, headers: CORS });

    await supabase.from("faturas").update({ status: "paga", mp_payment_id: String(paymentId) }).eq("id", fatura_id);

    // Libera/renova a assinatura
    const proxCobranca = new Date();
    proxCobranca.setMonth(proxCobranca.getMonth() + 1);

    await supabase.from("assinaturas").update({
      status: "ativa",
      proxima_cobranca: proxCobranca.toISOString().slice(0, 10),
    }).eq("id", fatura.assinatura_id);

    return new Response(JSON.stringify({ ok: true, liberado: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
