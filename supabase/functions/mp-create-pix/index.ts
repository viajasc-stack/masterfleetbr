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
    const { fatura_id, provider, expected_valor_centavos } = await req.json();
    if (!fatura_id) return new Response(JSON.stringify({ error: "fatura_id obrigatório" }), { status: 400, headers: CORS });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca a fatura
    const { data: fatura, error: fatErr } = await supabase
      .from("faturas")
      .select("*, empresas(nome, email, mercado_pago_ativo, mp_access_token)")
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

    const expectedValorCentavos = Number(expected_valor_centavos ?? NaN);
    const hasExpectedValor = Number.isFinite(expectedValorCentavos) && expectedValorCentavos > 0;

    let valorCentavos = Number(fatura.valor_centavos ?? 0);
    const descontoCentavos = Number(fatura.desconto_centavos ?? 0);
    if (hasExpectedValor) {
      valorCentavos = Math.round(expectedValorCentavos);
      await supabase.from("faturas").update({
        valor_centavos: valorCentavos,
        ...(descontoCentavos <= 0 ? { valor_bruto_centavos: valorCentavos } : {}),
      }).eq("id", fatura_id);
    } else if (descontoCentavos <= 0) {
      const { data: valorAtualAssinatura } = await supabase.rpc("get_assinatura_valor_atual", {
        p_empresa_id: fatura.empresa_id,
      });
      const valorAtualCentavos = Number(valorAtualAssinatura ?? valorCentavos);
      if (Number.isFinite(valorAtualCentavos) && valorAtualCentavos >= 0 && valorAtualCentavos !== valorCentavos) {
        valorCentavos = valorAtualCentavos;
        await supabase.from("faturas").update({
          valor_centavos: valorAtualCentavos,
          valor_bruto_centavos: valorAtualCentavos,
        }).eq("id", fatura_id);
      }
    }

    const valor = valorCentavos / 100;

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
          externalReference: String(fatura.empresa_id),
        }),
      });

      const customerData = await customerRes.json();
      if (!customerRes.ok || !customerData?.id) {
        return new Response(JSON.stringify({ error: customerData?.errors?.[0]?.description ?? "Erro ao criar cliente no Asaas" }), { status: 500, headers: CORS });
      }

      const dueDate = (fatura.vencimento ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      const payRes = await fetchWithRetry(`${apiUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: JSON.stringify({
          customer: customerData.id,
          billingType: "PIX",
          value: valor,
          dueDate,
          description: "MasterFleetBR - Assinatura",
          externalReference: String(fatura_id),
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok || !payData?.id) {
        return new Response(JSON.stringify({ error: payData?.errors?.[0]?.description ?? "Erro ao criar cobrança PIX no Asaas" }), { status: 500, headers: CORS });
      }

      const pixRes = await fetchWithRetry(`${apiUrl}/payments/${payData.id}/pixQrCode`, {
        headers: { access_token: apiKey },
      });
      const pixData = await pixRes.json();
      if (!pixRes.ok) {
        return new Response(JSON.stringify({ error: pixData?.errors?.[0]?.description ?? "Erro ao obter QR Code PIX do Asaas" }), { status: 500, headers: CORS });
      }

      const qrCode = pixData?.payload ?? null;
      const qrImagem = pixData?.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null;

      await supabase.from("faturas").update({
        payment_provider: "asaas",
        provider_payment_id: String(payData.id),
        provider_external_reference: String(fatura_id),
        provider_payload: {
          payment: payData,
          pix: pixData,
        },
        pix_copia_cola: qrCode,
        pix_qr_code: qrImagem,
      }).eq("id", fatura_id);

      return new Response(JSON.stringify({
        payment_id: payData.id,
        pix_copia_cola: qrCode,
        pix_qr_code: qrImagem,
        status: payData.status,
        provider: "asaas",
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
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

    const idempotencyKey = `fatura-${fatura_id}-pix-${valorCentavos}`;
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
          identification: { type: "CNPJ", number: "00000000000000" },
        },
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook?provider=mercado_pago&empresa_id=${fatura.empresa_id}`,
        external_reference: fatura_id,
        date_of_expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok || mpData.error) {
      console.error("MP error:", mpData);
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

    return new Response(JSON.stringify({
      payment_id: mpData.id,
      pix_copia_cola: qrCode,
      pix_qr_code: qrImagem,
      status: mpData.status,
      provider: "mercado_pago",
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
