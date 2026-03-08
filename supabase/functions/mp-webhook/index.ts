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
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") ?? "mercado_pago";
    const empresaId = url.searchParams.get("empresa_id");

    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    try { body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}; } catch { body = {}; }
    const topic = body.type ?? body.topic;

    if (provider === "asaas") {
      const { data: asaasGateway } = await supabase
        .from("gateway_configs")
        .select("webhook_secret")
        .eq("provider", "asaas")
        .maybeSingle();

      const asaasSecret = asaasGateway?.webhook_secret ?? Deno.env.get("ASAAS_WEBHOOK_SECRET") ?? null;
      const asaasHeaderSecret = req.headers.get("asaas-access-token") || req.headers.get("x-asaas-signature");
      if (asaasSecret && asaasHeaderSecret && asaasHeaderSecret !== asaasSecret) {
        return new Response(JSON.stringify({ error: "asaas signature mismatch" }), { status: 401, headers: CORS });
      }

      await supabase.from("webhook_logs").insert({
        source: "asaas",
        provider: "asaas",
        empresa_id: empresaId,
        payload: body,
      });

      const event = String(body.event ?? "");
      const payment = (body.payment as Record<string, unknown> | undefined) ?? {};
      const paymentId = String(payment.id ?? "");
      const externalReference = String(payment.externalReference ?? "");

      if (!externalReference) {
        return new Response(JSON.stringify({ ok: true, msg: "sem externalReference" }), { headers: CORS });
      }

      const { data: fatura } = await supabase
        .from("faturas")
        .select("id, empresa_id, assinatura_id")
        .eq("id", externalReference)
        .maybeSingle();

      if (!fatura) {
        return new Response(JSON.stringify({ ok: true, msg: "fatura não encontrada" }), { headers: CORS });
      }

      if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
        await supabase
          .from("faturas")
          .update({
            status: "paga",
            payment_provider: "asaas",
            provider_payment_id: paymentId || null,
            provider_external_reference: externalReference,
            provider_payload: body,
          })
          .eq("id", fatura.id);

        const proxCobranca = new Date();
        proxCobranca.setMonth(proxCobranca.getMonth() + 1);

        await supabase.from("assinaturas").update({
          status: "ativa",
          proxima_cobranca: proxCobranca.toISOString().slice(0, 10),
        }).eq("id", fatura.assinatura_id);

        return new Response(JSON.stringify({ ok: true, liberado: true, provider: "asaas" }), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      if (event === "PAYMENT_OVERDUE") {
        await supabase
          .from("faturas")
          .update({
            payment_provider: "asaas",
            provider_payment_id: paymentId || null,
            provider_external_reference: externalReference,
            provider_payload: body,
          })
          .eq("id", fatura.id);
      }

      return new Response(JSON.stringify({ ok: true, msg: `evento asaas: ${event}` }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Optional webhook signature verification
    let webhookSecret = null as string | null;
    if (empresaId) {
      const { data: empSecret } = await supabase
        .from("empresas")
        .select("mp_webhook_secret")
        .eq("id", empresaId)
        .maybeSingle();
      webhookSecret = empSecret?.mp_webhook_secret ?? null;
    }
    if (!webhookSecret) {
      const { data: gateway } = await supabase
        .from("gateway_configs")
        .select("webhook_secret")
        .eq("provider", "mercado_pago")
        .maybeSingle();
      webhookSecret = gateway?.webhook_secret ?? null;
    }
    webhookSecret = webhookSecret ?? Deno.env.get("MP_WEBHOOK_SECRET") ?? null;
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
    await supabase.from("webhook_logs").insert({
      source: "mercadopago",
      provider,
      empresa_id: empresaId,
      payload: body,
    });

    if (topic !== "payment") {
      return new Response(JSON.stringify({ ok: true, msg: "topic ignorado" }), { headers: CORS });
    }

    const paymentData = (body.data as { id?: string | number } | undefined) ?? undefined;
    const paymentId = paymentData?.id ?? body.id;
    if (!paymentId) return new Response(JSON.stringify({ error: "payment id não encontrado" }), { status: 400, headers: CORS });

    let MP_ACCESS_TOKEN = null as string | null;
    if (empresaId) {
      const { data: empMp } = await supabase
        .from("empresas")
        .select("mp_access_token")
        .eq("id", empresaId)
        .maybeSingle();
      MP_ACCESS_TOKEN = empMp?.mp_access_token ?? null;
    }
    if (!MP_ACCESS_TOKEN) {
      const { data: gateway } = await supabase
        .from("gateway_configs")
        .select("access_token")
        .eq("provider", "mercado_pago")
        .maybeSingle();
      MP_ACCESS_TOKEN = gateway?.access_token ?? null;
    }
    MP_ACCESS_TOKEN = MP_ACCESS_TOKEN ?? Deno.env.get("MP_ACCESS_TOKEN") ?? null;
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "MP_ACCESS_TOKEN não configurado" }), { status: 500, headers: CORS });
    }

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

    await supabase
      .from("faturas")
      .update({
        status: "paga",
        mp_payment_id: String(paymentId),
        payment_provider: "mercado_pago",
        provider_payment_id: String(paymentId),
        provider_external_reference: String(fatura_id),
        provider_payload: payment,
      })
      .eq("id", fatura_id);

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
