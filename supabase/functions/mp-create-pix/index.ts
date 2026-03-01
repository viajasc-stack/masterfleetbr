import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { fatura_id } = await req.json();
    if (!fatura_id) return new Response(JSON.stringify({ error: "fatura_id obrigatório" }), { status: 400, headers: CORS });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca a fatura
    const { data: fatura, error: fatErr } = await supabase
      .from("faturas")
      .select("*, empresas(nome, email)")
      .eq("id", fatura_id)
      .maybeSingle();

    if (fatErr || !fatura) return new Response(JSON.stringify({ error: "Fatura não encontrada" }), { status: 404, headers: CORS });
    if (fatura.status !== "aberta") return new Response(JSON.stringify({ error: "Fatura não está aberta" }), { status: 400, headers: CORS });

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) return new Response(JSON.stringify({ error: "MP_ACCESS_TOKEN não configurado" }), { status: 500, headers: CORS });

    const valor = fatura.valor_centavos / 100;
    const idempotencyKey = `fatura-${fatura_id}`;

    // Cria pagamento PIX no Mercado Pago
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
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
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

    // Salva dados do PIX na fatura
    await supabase.from("faturas").update({
      mp_payment_id: String(mpData.id),
      pix_copia_cola: qrCode ?? null,
      pix_qr_code: qrImagem ?? null,
    }).eq("id", fatura_id);

    return new Response(JSON.stringify({
      payment_id: mpData.id,
      pix_copia_cola: qrCode,
      pix_qr_code: qrImagem,
      status: mpData.status,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
