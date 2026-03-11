import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 429 && res.status < 500) return res;
      if (i === retries) return res;
    } catch (err) {
      lastError = err;
      if (i === retries) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
  }
  throw lastError ?? new Error("fetch failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { pagamento_id } = await req.json();
    if (!pagamento_id) {
      return new Response(JSON.stringify({ error: "pagamento_id obrigatório" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pagamento, error: pagErr } = await supabase
      .from("pagamentos_viagem")
      .select("*, pedidos_viagem!inner(id,comprador_nome,comprador_email,comprador_cpf), viagens!inner(id,titulo), empresas!inner(id,nome,email,mp_access_token,mp_webhook_secret,asaas_api_key,asaas_webhook_secret,asaas_api_url)")
      .eq("id", pagamento_id)
      .maybeSingle();

    if (pagErr || !pagamento) {
      return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), { status: 404, headers: CORS });
    }

    if (pagamento.status === "aprovado") {
      return new Response(JSON.stringify({
        pagamento_id: pagamento.id,
        status: pagamento.status,
        gateway: pagamento.gateway,
        metodo: pagamento.metodo,
        pix_copia_cola: pagamento.pix_copia_cola,
        pix_qr_code: pagamento.pix_qr_code,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (pagamento.gateway === "manual") {
      return new Response(JSON.stringify({
        pagamento_id: pagamento.id,
        status: pagamento.status,
        gateway: pagamento.gateway,
        metodo: pagamento.metodo,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const empresa = Array.isArray(pagamento.empresas) ? pagamento.empresas[0] : pagamento.empresas;
    const pedido = Array.isArray(pagamento.pedidos_viagem) ? pagamento.pedidos_viagem[0] : pagamento.pedidos_viagem;
    const viagem = Array.isArray(pagamento.viagens) ? pagamento.viagens[0] : pagamento.viagens;
    const valor = Number(pagamento.valor ?? 0);
    const metodo = String(pagamento.metodo ?? "pix");

    if (pagamento.gateway === "asaas") {
      const apiKey = empresa?.asaas_api_key ?? Deno.env.get("ASAAS_API_KEY") ?? null;
      const apiUrl = empresa?.asaas_api_url ?? Deno.env.get("ASAAS_API_URL") ?? "https://api.asaas.com/v3";

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Asaas API Key não configurada" }), { status: 500, headers: CORS });
      }

      const customerRes = await fetchWithRetry(`${apiUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: JSON.stringify({
          name: pedido?.comprador_nome ?? empresa?.nome ?? "Cliente viagem",
          email: pedido?.comprador_email ?? empresa?.email ?? undefined,
          cpfCnpj: String(pedido?.comprador_cpf ?? "").replace(/\D/g, "") || undefined,
          externalReference: String(pagamento.id),
        }),
      });

      const customerData = await customerRes.json();
      if (!customerRes.ok || !customerData?.id) {
        return new Response(JSON.stringify({ error: customerData?.errors?.[0]?.description ?? "Erro ao criar cliente Asaas" }), { status: 500, headers: CORS });
      }

      const billingType = metodo === "pix" ? "PIX" : metodo === "boleto" ? "BOLETO" : "UNDEFINED";
      const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const payRes = await fetchWithRetry(`${apiUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: JSON.stringify({
          customer: customerData.id,
          billingType,
          value: valor,
          dueDate,
          description: `Viagem: ${viagem?.titulo ?? "MasterFleetBR"}`,
          externalReference: String(pagamento.id),
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok || !payData?.id) {
        return new Response(JSON.stringify({ error: payData?.errors?.[0]?.description ?? "Erro ao criar cobrança Asaas" }), { status: 500, headers: CORS });
      }

      let pixCopiaCola: string | null = null;
      let pixQrCode: string | null = null;

      if (metodo === "pix") {
        const pixRes = await fetchWithRetry(`${apiUrl}/payments/${payData.id}/pixQrCode`, {
          headers: { access_token: apiKey },
        });
        const pixData = await pixRes.json();
        if (pixRes.ok) {
          pixCopiaCola = pixData?.payload ?? null;
          pixQrCode = pixData?.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null;
        }
      }

      await supabase.from("pagamentos_viagem").update({
        status: "aguardando_confirmacao",
        provider_payment_id: String(payData.id),
        provider_external_reference: String(pagamento.id),
        provider_payload: {
          customer: customerData,
          payment: payData,
        },
        pix_copia_cola: pixCopiaCola,
        pix_qr_code: pixQrCode,
      }).eq("id", pagamento.id);

      return new Response(JSON.stringify({
        pagamento_id: pagamento.id,
        gateway: "asaas",
        metodo,
        status: "aguardando_confirmacao",
        pix_copia_cola: pixCopiaCola,
        pix_qr_code: pixQrCode,
        boleto_url: payData.invoiceUrl ?? null,
        checkout_url: payData.invoiceUrl ?? null,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Mercado Pago
    let mpAccessToken = empresa?.mp_access_token ?? null;
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
      return new Response(JSON.stringify({ error: "MP access token não configurado" }), { status: 500, headers: CORS });
    }

    if (metodo === "pix") {
      const idempotencyKey = `viagem-pagamento-${pagamento.id}`;
      const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: valor,
          description: `Viagem: ${viagem?.titulo ?? "MasterFleetBR"}`,
          payment_method_id: "pix",
          payer: {
            email: pedido?.comprador_email ?? empresa?.email ?? "cliente@masterfleetbr.com",
            first_name: pedido?.comprador_nome ?? "Cliente",
            last_name: "Viagem",
          },
          external_reference: String(pagamento.id),
          notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/viagem-payment-webhook?provider=mercado_pago&empresa_id=${pagamento.empresa_id}`,
          date_of_expiration: pagamento.expires_at ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }),
      });

      const mpData = await mpRes.json();
      if (!mpRes.ok || mpData.error) {
        return new Response(JSON.stringify({ error: mpData?.message ?? "Erro ao criar PIX Mercado Pago" }), { status: 500, headers: CORS });
      }

      const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code ?? null;
      const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
      const qrImage = qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null;

      await supabase.from("pagamentos_viagem").update({
        status: "aguardando_confirmacao",
        provider_payment_id: String(mpData.id),
        provider_external_reference: String(pagamento.id),
        provider_payload: mpData,
        pix_copia_cola: qrCode,
        pix_qr_code: qrImage,
      }).eq("id", pagamento.id);

      return new Response(JSON.stringify({
        pagamento_id: pagamento.id,
        gateway: "mercado_pago",
        metodo: "pix",
        status: "aguardando_confirmacao",
        pix_copia_cola: qrCode,
        pix_qr_code: qrImage,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (metodo === "boleto") {
      const idempotencyKey = `viagem-pagamento-${pagamento.id}-boleto`;
      const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: valor,
          description: `Viagem: ${viagem?.titulo ?? "MasterFleetBR"}`,
          payment_method_id: "bolbradesco",
          payer: {
            email: pedido?.comprador_email ?? empresa?.email ?? "cliente@masterfleetbr.com",
            first_name: pedido?.comprador_nome ?? "Cliente",
            last_name: "Viagem",
          },
          external_reference: String(pagamento.id),
          notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/viagem-payment-webhook?provider=mercado_pago&empresa_id=${pagamento.empresa_id}`,
        }),
      });

      const mpData = await mpRes.json();
      if (!mpRes.ok || mpData.error) {
        return new Response(JSON.stringify({ error: mpData?.message ?? "Erro ao criar boleto Mercado Pago" }), { status: 500, headers: CORS });
      }

      const boletoUrl = mpData.transaction_details?.external_resource_url ?? null;

      await supabase.from("pagamentos_viagem").update({
        status: "aguardando_confirmacao",
        provider_payment_id: String(mpData.id),
        provider_external_reference: String(pagamento.id),
        provider_payload: mpData,
      }).eq("id", pagamento.id);

      return new Response(JSON.stringify({
        pagamento_id: pagamento.id,
        gateway: "mercado_pago",
        metodo: "boleto",
        status: "aguardando_confirmacao",
        boleto_url: boletoUrl,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // cartão: redireciona para checkout preference
    const prefRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify({
        items: [{
          id: String(pagamento.id),
          title: `Viagem: ${viagem?.titulo ?? "MasterFleetBR"}`,
          quantity: 1,
          unit_price: valor,
        }],
        external_reference: String(pagamento.id),
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/viagem-payment-webhook?provider=mercado_pago&empresa_id=${pagamento.empresa_id}`,
      }),
    });

    const prefData = await prefRes.json();
    if (!prefRes.ok || prefData.error) {
      return new Response(JSON.stringify({ error: prefData?.message ?? "Erro ao criar checkout MP" }), { status: 500, headers: CORS });
    }

    await supabase.from("pagamentos_viagem").update({
      status: "aguardando_confirmacao",
      provider_external_reference: String(pagamento.id),
      provider_payload: prefData,
    }).eq("id", pagamento.id);

    return new Response(JSON.stringify({
      pagamento_id: pagamento.id,
      gateway: "mercado_pago",
      metodo: "cartao",
      status: "aguardando_confirmacao",
      checkout_url: prefData.init_point ?? null,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
