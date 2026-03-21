import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function isAlreadyRegisteredError(message: string | undefined) {
  const msg = String(message ?? "").toLowerCase();
  return msg.includes("already") || msg.includes("registered") || msg.includes("exists");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    const nomeEmpresa = String(body?.nome_empresa ?? "").trim();
    const nomeAdmin = String(body?.nome_admin ?? "").trim();
    const emailAdmin = String(body?.email_admin ?? "").trim().toLowerCase();
    const senha = String(body?.senha ?? "");
    const referralCode = String(body?.referral_code ?? "").trim().toLowerCase() || null;
    const billingCouponCode = String(body?.billing_coupon_code ?? "").trim().toUpperCase() || null;

    const cnpj = onlyDigits(body?.cnpj);
    const telefone = String(body?.telefone ?? "").trim() || null;
    const emailEmpresa = String(body?.email_empresa ?? "").trim() || null;
    const endereco = String(body?.endereco ?? "").trim() || null;
    const cidade = String(body?.cidade ?? "").trim() || null;
    const estado = String(body?.estado ?? "").trim().toUpperCase().slice(0, 2) || null;

    if (!nomeEmpresa || !nomeAdmin || !emailAdmin || senha.length < 6 || cnpj.length !== 14) {
      return new Response(JSON.stringify({ error: "Dados inválidos para cadastro" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: authCreated, error: authErr } = await supabase.auth.admin.createUser({
      email: emailAdmin,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: nomeAdmin,
        role: "admin",
      },
    });

    if (authErr || !authCreated.user) {
      const mensagem = isAlreadyRegisteredError(authErr?.message)
        ? "Este e-mail já está cadastrado. Use outro e-mail ou recupere sua senha."
        : (authErr?.message ?? "Erro ao criar usuário administrador");

      return new Response(JSON.stringify({ error: mensagem }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const authUserId = authCreated.user.id;
    let empresaId: string | null = null;

    try {
      let empresaData: { id: string } | null = null;

      const tentativaCompleta = await supabase
        .from("empresas")
        .insert({
          nome: nomeEmpresa,
          cnpj,
          telefone,
          email: emailEmpresa,
          endereco,
          cidade,
          estado,
        })
        .select("id")
        .single();

      if (tentativaCompleta.error) {
        if (!/column .* does not exist/i.test(tentativaCompleta.error.message)) {
          throw new Error(tentativaCompleta.error.message);
        }

        const tentativaLegacy = await supabase
          .from("empresas")
          .insert({ nome: nomeEmpresa })
          .select("id")
          .single();

        if (tentativaLegacy.error || !tentativaLegacy.data) {
          throw new Error(tentativaLegacy.error?.message ?? "Erro ao criar empresa");
        }

        empresaData = tentativaLegacy.data;
      } else {
        empresaData = tentativaCompleta.data;
      }

      empresaId = empresaData?.id ?? null;
      if (!empresaId) throw new Error("Erro ao criar empresa");

      const billingPolicyRes = await supabase
        .from("master_settings")
        .select("value")
        .eq("key", "billing_policy")
        .maybeSingle();

      const trialDays = Number((billingPolicyRes.data?.value as { trial_days?: number } | null)?.trial_days ?? 7);

      let planoId: string | null = null;
      const supremoByCodigo = await supabase
        .from("planos")
        .select("id")
        .ilike("codigo", "supremo")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();

      planoId = supremoByCodigo.data?.id ?? null;

      // fallback por nome para bases onde o código não foi preenchido como "supremo"
      if (!planoId) {
        const supremoByNome = await supabase
          .from("planos")
          .select("id")
          .ilike("nome", "%supremo%")
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();
        planoId = supremoByNome.data?.id ?? null;
      }

      // fallback para plano TOP ativo
      if (!planoId) {
        const topPlano = await supabase
          .from("planos")
          .select("id")
          .ilike("codigo", "top")
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();
        planoId = topPlano.data?.id ?? null;
      }

      // fallback final: primeiro plano ativo disponível
      if (!planoId) {
        const primeiroAtivo = await supabase
          .from("planos")
          .select("id")
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();
        planoId = primeiroAtivo.data?.id ?? null;
      }

      if (!planoId) {
        throw new Error(
          "Nenhum plano ativo encontrado. Cadastre/ative ao menos um plano no painel master."
        );
      }

      const trialAte = new Date();
      trialAte.setDate(trialAte.getDate() + Math.max(Number.isFinite(trialDays) ? trialDays : 7, 0));

      const assinaturaRes = await supabase.from("assinaturas").insert({
        empresa_id: empresaId,
        plano_id: planoId,
        status: "trial",
        trial_ate: trialAte.toISOString(),
      });

      if (assinaturaRes.error) throw new Error(assinaturaRes.error.message);

      if (referralCode) {
        const referralRes = await supabase.rpc("apply_referral_on_signup", {
          p_referral_code: referralCode,
          p_new_empresa_id: empresaId,
          p_new_admin_email: emailAdmin,
        });
        if (referralRes.error) {
          console.warn("apply_referral_on_signup warning:", referralRes.error.message);
        }
      }

      if (billingCouponCode) {
        const couponRes = await supabase.rpc("apply_billing_coupon_on_signup", {
          p_coupon_code: billingCouponCode,
          p_empresa_id: empresaId,
          p_admin_email: emailAdmin,
        });
        if (couponRes.error) {
          console.warn("apply_billing_coupon_on_signup warning:", couponRes.error.message);
        }
      }

      const profileRes = await supabase.from("profiles").insert({
        user_id: authUserId,
        empresa_id: empresaId,
        nome: nomeAdmin,
        role: "admin",
      });

      if (profileRes.error) throw new Error(profileRes.error.message);

      if ((await supabase.from("usuarios").select("id").limit(1)).error === null) {
        const usuariosRes = await supabase.from("usuarios").insert({
          empresa_id: empresaId,
          auth_user_id: authUserId,
          nome: nomeAdmin,
          email: emailAdmin,
          status: "ativo",
        });
        if (usuariosRes.error) throw new Error(usuariosRes.error.message);
      }

      return new Response(JSON.stringify({ ok: true, empresa_id: empresaId }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (err) {
      if (empresaId) {
        await supabase.from("empresas").delete().eq("id", empresaId);
      }
      await supabase.auth.admin.deleteUser(authUserId);

      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Falha no cadastro" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
