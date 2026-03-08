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
    const { fatura_id, method, provider, card, payer } = await req.json();
    if (!fatura_id) return new Response(JSON.stringify({ error: "fatura_id obrigatório" }), { status: 400, headers: CORS });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: fatura, error: fatErr } = await supabase
      .from("faturas")
      .select("*, empresas(nome, email, cnpj, mercado_pago_ativo, mp_access_token)")
      .eq("id", fatura_id)
      .maybeSingle();

    if (fatErr || !fatura) return new Response(JSON.stringify({ error: "Fatura não encontrada" }), { status: 404, headers: CORS });
    if (fatura.status !== "aberta") return new Response(JSON.stringify({ error: "Fatura não está aberta" }), { status: 400, headers: CORS });

    let resolvedProvider = provider as string | undefined;
    if (!resolvedProvider) {
      const { data: asaasActive } = await supabase
        .from("gateway_configs")
        .select("provider, ativo")
        .eq("provider", "asaas")
        .maybeSingle();
      resolvedProvider = asaasActive?.ativo ? "asaas" : "mercado_pago";
    }

    const valor = (fatura.valor_centavos ?? 0) / 100;

    if (resolvedProvider === "asaas") {
      const { data: gateway } = await supabase
        .from("gateway_configs")
        .select("access_token, api_url")
        .eq("provider", "asaas")
        .maybeSingle();

      const apiKey = gateway?.access_token ?? Deno.env.get("ASAAS_API_KEY") ?? null;
      const apiUrl = gateway?.api_url ?? Deno.env.get("ASAAS_API_URL") ?? "https://api.asaas.com/v3";

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurado" }), { status: 500, headers: CORS });
      }

      const customerRes = await fetchWithRetry(`${apiUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: JSON.stringify({
          name: fatura.empresas?.nome ?? "Empresa MasterFleet",
          email: fatura.empresas?.email ?? undefined,
          cpfCnpj: String(payer?.doc_number ?? fatura.empresas?.cnpj ?? "").replace(/\D/g, "") || undefined,
          externalReference: String(fatura.empresa_id),
        }),
      });

      const customerData = await customerRes.json();
      if (!customerRes.ok || !customerData?.id) {
        return new Response(JSON.stringify({ error: customerData?.errors?.[0]?.description ?? "Erro ao criar cliente no Asaas" }), { status: 500, headers: CORS });
      }

      if (method === "boleto") {
        const dueDate = (fatura.vencimento ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
        const payRes = await fetchWithRetry(`${apiUrl}/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: apiKey,
          },
          body: JSON.stringify({
            customer: customerData.id,
            billingType: "BOLETO",
            value: valor,
            dueDate,
            description: "MasterFleetBR - Assinatura",
            externalReference: String(fatura_id),
          }),
        });

        const payData = await payRes.json();
        if (!payRes.ok || !payData?.id) {
          return new Response(JSON.stringify({ error: payData?.errors?.[0]?.description ?? "Erro ao gerar boleto no Asaas" }), { status: 500, headers: CORS });
        }

        await supabase.from("faturas").update({
          payment_provider: "asaas",
          provider_payment_id: String(payData.id),
          provider_external_reference: String(fatura_id),
          provider_payload: payData,
        }).eq("id", fatura_id);

        return new Response(JSON.stringify({
          payment_id: payData.id,
          status: payData.status,
          boleto_url: payData.invoiceUrl ?? null,
          boleto_barcode: payData.identificationField ?? null,
          provider: "asaas",
        }), { headers: { ...CORS, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "Para Asaas, use PIX em mp-create-pix ou BOLETO neste endpoint." }), { status: 400, headers: CORS });
    }

    let MP_ACCESS_TOKEN = fatura.empresas?.mp_access_token ?? null;
    if (!MP_ACCESS_TOKEN) {
      const { data: gateway } = await supabase
        .from("gateway_configs")
        .select("access_token")
        .eq("provider", "mercado_pago")
        .maybeSingle();
      MP_ACCESS_TOKEN = gateway?.access_token ?? null;
    }
    MP_ACCESS_TOKEN = MP_ACCESS_TOKEN ?? Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) return new Response(JSON.stringify({ error: "MP_ACCESS_TOKEN não configurado" }), { status: 500, headers: CORS });

    const empresaNome = fatura.empresas?.nome ?? "Empresa";
    const empresaEmail = fatura.empresas?.email ?? "pagador@masterfleetbr.com.br";
    const docDigits = String(
      payer?.doc_number ?? fatura.empresas?.cnpj ?? "00000000000"
    ).replace(/\D/g, "");
    const identification = {
      type: (payer?.doc_type ?? (docDigits.length === 14 ? "CNPJ" : "CPF")) as string,
      number: docDigits,
    };

    if (method === "pix") {
      const idempotencyKey = `fatura-${fatura_id}`;
      const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: valor,
          description: `MasterFleetBR - Assinatura`,
          payment_method_id: "pix",
          payer: {
            email: fatura.empresas?.email ?? "pagador@masterfleetbr.com.br",
            first_name: fatura.empresas?.nome ?? "Empresa",
            last_name: "MasterFleetBR",
          },
          external_reference: fatura_id,
          date_of_expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      const mpData = await mpRes.json();
      if (!mpRes.ok || mpData.error) {
        return new Response(JSON.stringify({ error: mpData.message ?? "Erro ao criar PIX no Mercado Pago" }), { status: 500, headers: CORS });
      }
      const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
      const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
      const qrImagem = qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null;

      await supabase.from("faturas").update({
        mp_payment_id: String(mpData.id),
        payment_provider: "mercado_pago",
        provider_payment_id: String(mpData.id),
        provider_external_reference: String(fatura_id),
        provider_payload: mpData,
        pix_copia_cola: qrCode ?? null,
        pix_qr_code: qrImagem ?? null,
      }).eq("id", fatura_id);

      return new Response(JSON.stringify({ payment_id: mpData.id, pix_copia_cola: qrCode, pix_qr_code: qrImagem, status: mpData.status, provider: "mercado_pago" }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (method === "boleto") {
      const idempotencyKey = `fatura-${fatura_id}-boleto`;
      const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: valor,
          description: "MasterFleetBR - Assinatura",
          payment_method_id: "bolbradesco",
          payer: {
            email: empresaEmail,
            first_name: empresaNome,
            last_name: "MasterFleetBR",
            identification,
          },
          external_reference: fatura_id,
          notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook?provider=mercado_pago&empresa_id=${fatura.empresa_id}`,
        }),
      });

      const mpData = await mpRes.json();
      if (!mpRes.ok || mpData.error) {
        return new Response(JSON.stringify({ error: mpData.message ?? "Erro ao gerar boleto" }), { status: 500, headers: CORS });
      }

      await supabase.from("faturas").update({
        mp_payment_id: String(mpData.id),
        payment_provider: "mercado_pago",
        provider_payment_id: String(mpData.id),
        provider_external_reference: String(fatura_id),
        provider_payload: mpData,
      }).eq("id", fatura_id);

      return new Response(JSON.stringify({
        payment_id: mpData.id,
        status: mpData.status,
        boleto_url: mpData.transaction_details?.external_resource_url ?? null,
        boleto_barcode: mpData.barcode?.content ?? null,
        provider: "mercado_pago",
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (method === "card" || method === "cartao") {
      if (!card?.number || !card?.name || !card?.exp_month || !card?.exp_year || !card?.cvv) {
        return new Response(JSON.stringify({ error: "Dados do cartão incompletos" }), { status: 400, headers: CORS });
      }

      const tokenRes = await fetch("https://api.mercadopago.com/v1/card_tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          card_number: String(card.number).replace(/\s+/g, ""),
          security_code: String(card.cvv),
          expiration_month: Number(card.exp_month),
          expiration_year: Number(card.exp_year),
          cardholder: {
            name: String(card.name),
            identification,
          },
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error || !tokenData.id) {
        return new Response(JSON.stringify({ error: tokenData.message ?? "Erro ao tokenizar cartão" }), { status: 500, headers: CORS });
      }

      const idempotencyKey = `fatura-${fatura_id}-card`;
      const payRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: valor,
          token: tokenData.id,
          description: "MasterFleetBR - Assinatura",
          installments: Number(card.installments ?? 1),
          payment_method_id: tokenData.payment_method_id ?? "visa",
          payer: {
            email: empresaEmail,
            identification,
          },
          external_reference: fatura_id,
          notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook?provider=mercado_pago&empresa_id=${fatura.empresa_id}`,
        }),
      });

      const paymentData = await payRes.json();
      if (!payRes.ok || paymentData.error) {
        return new Response(JSON.stringify({ error: paymentData.message ?? "Erro ao processar cartão" }), { status: 500, headers: CORS });
      }

      await supabase.from("faturas").update({
        mp_payment_id: String(paymentData.id),
        payment_provider: "mercado_pago",
        provider_payment_id: String(paymentData.id),
        provider_external_reference: String(fatura_id),
        provider_payload: paymentData,
      }).eq("id", fatura_id);

      return new Response(JSON.stringify({
        payment_id: paymentData.id,
        status: paymentData.status,
        status_detail: paymentData.status_detail,
        provider: "mercado_pago",
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const prefRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [{ id: fatura_id, title: `Fatura ${fatura_id}`, description: `Assinatura MasterFleetBR`, quantity: 1, unit_price: valor }],
        external_reference: fatura_id,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook?provider=mercado_pago&empresa_id=${fatura.empresa_id}`,
      }),
    });
    const prefData = await prefRes.json();
    if (!prefRes.ok || prefData.error) {
      return new Response(JSON.stringify({ error: prefData.message ?? "Erro ao criar checkout" }), { status: 500, headers: CORS });
    }
    return new Response(JSON.stringify({ preference_id: prefData.id, init_point: prefData.init_point, provider: "mercado_pago" }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
