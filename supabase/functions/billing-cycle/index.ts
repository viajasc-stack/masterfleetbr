import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * billing-cycle — chamada por cron externo (ex.: UptimeRobot GET mensal)
 *
 * O que faz:
 * 0. Ativa com vencimento em até 5 dias → gera fatura antecipada (sem mudar status)
 * 1. Trial expirado  → past_due + gera fatura
 * 2. past_due +7 dias → bloqueada
 * 3. Ativa com proxima_cobranca vencida → past_due + gera fatura
 */
serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const billingPolicy = await loadBillingPolicy(supabase);
  const graceDays = Math.max(Number(billingPolicy.grace_days ?? 5), 0);
  const autoBlock = Boolean(billingPolicy.auto_block ?? true);

  const hoje = new Date().toISOString().slice(0, 10);
  const dMais5 = new Date();
  dMais5.setDate(dMais5.getDate() + graceDays);
  const dataMais5 = dMais5.toISOString().slice(0, 10);

  let preFaturasGeradas = 0;
  let cobrançasVencidasGeradas = 0;

  // ── 0. Ativa com vencimento em até 5 dias → fatura antecipada ───────────
  const { data: preVencimento } = await supabase
    .from("assinaturas")
    .select("id, empresa_id, plano_id, proxima_cobranca, planos(valor_centavos)")
    .eq("status", "ativa")
    .gte("proxima_cobranca", hoje)
    .lte("proxima_cobranca", dataMais5);

  for (const a of preVencimento ?? []) {
    const gerou = await gerarFatura(supabase, a, { graceDays }, a.proxima_cobranca ?? undefined);
    if (gerou) preFaturasGeradas += 1;
  }

  // ── 1. Trial expirado → past_due ──────────────────────────────────────
  const { data: trialsExpirados } = await supabase
    .from("assinaturas")
    .select("id, empresa_id, plano_id, planos(valor_centavos)")
    .eq("status", "trial")
    .lte("trial_ate", hoje);

  for (const a of trialsExpirados ?? []) {
    await supabase.from("assinaturas").update({ status: "past_due" }).eq("id", a.id);
    await gerarFatura(supabase, a, { graceDays });
  }

  // ── 2. past_due há mais de graceDays → bloqueada (se auto_block ligado)
  let pastDues: Array<{ id: string; updated_at: string }> = [];
  if (autoBlock) {
    const limite = new Date();
    limite.setDate(limite.getDate() - graceDays);

    const { data } = await supabase
      .from("assinaturas")
      .select("id, updated_at")
      .eq("status", "past_due")
      .lte("updated_at", limite.toISOString());

    pastDues = (data as Array<{ id: string; updated_at: string }> | null) ?? [];

    for (const a of pastDues) {
      await supabase.from("assinaturas").update({ status: "bloqueada" }).eq("id", a.id);
    }
  }

  // ── 3. Ativa com cobrança vencida → past_due + nova fatura ───────────
  const { data: vencidas } = await supabase
    .from("assinaturas")
    .select("id, empresa_id, plano_id, planos(valor_centavos)")
    .eq("status", "ativa")
    .lte("proxima_cobranca", hoje);

  for (const a of vencidas ?? []) {
    await supabase.from("assinaturas").update({ status: "past_due" }).eq("id", a.id);
    const gerou = await gerarFatura(supabase, a, { graceDays });
    if (gerou) cobrançasVencidasGeradas += 1;
  }

  const resumo = {
    pre_faturas_d5_alvo: preVencimento?.length ?? 0,
    pre_faturas_d5_geradas: preFaturasGeradas,
    trials_expirados: trialsExpirados?.length ?? 0,
    bloqueados: pastDues.length,
    grace_days: graceDays,
    auto_block: autoBlock,
    cobrancas_vencidas_alvo: vencidas?.length ?? 0,
    cobrancas_vencidas_geradas: cobrançasVencidasGeradas,
  };

  console.log("billing-cycle concluído:", resumo);

  return new Response(JSON.stringify({ ok: true, ...resumo }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function gerarFatura(supabase: ReturnType<typeof createClient>, assinatura: {
  id: string;
  empresa_id: string;
  plano_id?: string | null;
  proxima_cobranca?: string | null;
  planos?: { valor_centavos: number } | null;
}, policy: { graceDays: number }, vencimentoPreferencial?: string) {
  const valor = (assinatura.planos as { valor_centavos: number } | null)?.valor_centavos ?? 9900;

  const vencimento = vencimentoPreferencial
    ? String(vencimentoPreferencial).slice(0, 10)
    : (() => {
        const graceDays = Math.max(Number(policy.graceDays ?? 5), 0);
        const d = new Date();
        d.setDate(d.getDate() + graceDays);
        return d.toISOString().slice(0, 10);
      })();

  const { data: existente } = await supabase
    .from("faturas")
    .select("id")
    .eq("empresa_id", assinatura.empresa_id)
    .eq("assinatura_id", assinatura.id)
    .eq("status", "aberta")
    .eq("vencimento", vencimento)
    .maybeSingle();

  if (existente) return false;

  await supabase.from("faturas").insert({
    empresa_id: assinatura.empresa_id,
    assinatura_id: assinatura.id,
    valor_centavos: valor,
    status: "aberta",
    vencimento,
  });

  return true;
}

async function loadBillingPolicy(supabase: ReturnType<typeof createClient>): Promise<{ grace_days: number; auto_block: boolean }> {
  const defaults = { grace_days: 5, auto_block: true };

  const { data } = await supabase.rpc("get_billing_policy");
  const payload = (data ?? {}) as { grace_days?: number; auto_block?: boolean };

  return {
    grace_days: Number.isFinite(Number(payload.grace_days)) ? Number(payload.grace_days) : defaults.grace_days,
    auto_block: typeof payload.auto_block === "boolean" ? payload.auto_block : defaults.auto_block,
  };
}
