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
    try {
      body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }

    await supabase.from("webhook_logs").insert({
      source: provider === "asaas" ? "asaas" : "mercadopago",
      provider,
      empresa_id: empresaId,
      payload: body,
    });

    if (provider === "asaas") {
      const event = String(body.event ?? "");
      const payment = (body.payment as Record<string, unknown> | undefined) ?? {};
      const providerPaymentId = String(payment.id ?? "");
      const pagamentoId = String(payment.externalReference ?? "");

      if (!pagamentoId) {
        return new Response(JSON.stringify({ ok: true, msg: "sem externalReference" }), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const { data: pag } = await supabase
        .from("pagamentos_viagem")
        .select("id")
        .eq("id", pagamentoId)
        .maybeSingle();

      if (!pag) {
        return new Response(JSON.stringify({ ok: true, msg: "pagamento não encontrado" }), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
        await supabase.rpc("rpc_viagens_marcar_pagamento_aprovado", {
          p_pagamento_id: pagamentoId,
          p_provider_payment_id: providerPaymentId || null,
          p_provider_payload: body,
          p_pago_em: new Date().toISOString(),
        });
      } else if (
        event === "PAYMENT_REFUSED" ||
        event === "PAYMENT_OVERDUE" ||
        event === "PAYMENT_DELETED"
      ) {
        await supabase.rpc("rpc_viagens_marcar_pagamento_recusado", {
          p_pagamento_id: pagamentoId,
          p_provider_payment_id: providerPaymentId || null,
          p_provider_payload: body,
        });
      }

      return new Response(JSON.stringify({ ok: true, provider: "asaas", event }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Mercado Pago
    const topic = body.type ?? body.topic;
    if (topic !== "payment") {
      return new Response(JSON.stringify({ ok: true, msg: "topic ignorado" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const paymentData = (body.data as { id?: string | number } | undefined) ?? undefined;
    const providerPaymentId = paymentData?.id ?? body.id;
    if (!providerPaymentId) {
      return new Response(JSON.stringify({ error: "payment id não encontrado" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let mpAccessToken: string | null = null;
    if (empresaId) {
      const { data: empMp } = await supabase
        .from("empresas")
        .select("mp_access_token")
        .eq("id", empresaId)
        .maybeSingle();
      mpAccessToken = empMp?.mp_access_token ?? null;
    }
    if (!mpAccessToken) {
      const { data: gatewayGlobal } = await supabase
        .from("gateway_configs")
        .select("access_token")
        .eq("provider", "mercado_pago")
        .maybeSingle();
      mpAccessToken = gatewayGlobal?.access_token ?? null;
    }
    mpAccessToken = mpAccessToken ?? Deno.env.get("MP_ACCESS_TOKEN") ?? null;

    if (!mpAccessToken) {
      return new Response(JSON.stringify({ error: "MP access token não configurado" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    const payment = await mpRes.json();

    if (!mpRes.ok) {
      return new Response(JSON.stringify({ error: "erro ao consultar pagamento no MP" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const pagamentoId = String(payment.external_reference ?? "");
    if (!pagamentoId) {
      return new Response(JSON.stringify({ ok: true, msg: "sem external_reference" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "approved") {
      await supabase.rpc("rpc_viagens_marcar_pagamento_aprovado", {
        p_pagamento_id: pagamentoId,
        p_provider_payment_id: String(providerPaymentId),
        p_provider_payload: payment,
        p_pago_em: new Date().toISOString(),
      });
    } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(String(payment.status))) {
      await supabase.rpc("rpc_viagens_marcar_pagamento_recusado", {
        p_pagamento_id: pagamentoId,
        p_provider_payment_id: String(providerPaymentId),
        p_provider_payload: payment,
      });
    }

    return new Response(JSON.stringify({ ok: true, provider: "mercado_pago", status: payment.status }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
