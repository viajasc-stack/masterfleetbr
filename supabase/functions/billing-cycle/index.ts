import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * billing-cycle — chamada por cron externo (ex.: UptimeRobot GET mensal)
 *
 * O que faz:
 * 1. Trial expirado  → past_due + gera fatura
 * 2. past_due +7 dias → bloqueada
 * 3. Ativa com proxima_cobranca vencida → past_due + gera fatura
 */
serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const hoje = new Date().toISOString().slice(0, 10);

  // ── 1. Trial expirado → past_due ──────────────────────────────────────
  const { data: trialsExpirados } = await supabase
    .from("assinaturas")
    .select("id, empresa_id, plano_id, planos(valor_centavos)")
    .eq("status", "trial")
    .lte("trial_ate", hoje);

  for (const a of trialsExpirados ?? []) {
    await supabase.from("assinaturas").update({ status: "past_due" }).eq("id", a.id);
    await gerarFatura(supabase, a);
  }

  // ── 2. past_due há mais de 7 dias → bloqueada ─────────────────────────
  const limite = new Date();
  limite.setDate(limite.getDate() - 7);

  const { data: pastDues } = await supabase
    .from("assinaturas")
    .select("id, updated_at")
    .eq("status", "past_due")
    .lte("updated_at", limite.toISOString());

  for (const a of pastDues ?? []) {
    await supabase.from("assinaturas").update({ status: "bloqueada" }).eq("id", a.id);
  }

  // ── 3. Ativa com cobrança vencida → past_due + nova fatura ───────────
  const { data: vencidas } = await supabase
    .from("assinaturas")
    .select("id, empresa_id, plano_id, planos(valor_centavos)")
    .eq("status", "ativa")
    .lte("proxima_cobranca", hoje);

  for (const a of vencidas ?? []) {
    await supabase.from("assinaturas").update({ status: "past_due" }).eq("id", a.id);
    await gerarFatura(supabase, a);
  }

  const resumo = {
    trials_expirados: trialsExpirados?.length ?? 0,
    bloqueados: pastDues?.length ?? 0,
    cobrancas_geradas: vencidas?.length ?? 0,
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
  planos?: { valor_centavos: number } | null;
}) {
  const valor = (assinatura.planos as { valor_centavos: number } | null)?.valor_centavos ?? 9900;

  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 5);

  const { data: existente } = await supabase
    .from("faturas")
    .select("id")
    .eq("empresa_id", assinatura.empresa_id)
    .eq("assinatura_id", assinatura.id)
    .eq("status", "aberta")
    .maybeSingle();

  if (existente) return;

  await supabase.from("faturas").insert({
    empresa_id: assinatura.empresa_id,
    assinatura_id: assinatura.id,
    valor_centavos: valor,
    status: "aberta",
    vencimento: vencimento.toISOString().slice(0, 10),
  });
}
