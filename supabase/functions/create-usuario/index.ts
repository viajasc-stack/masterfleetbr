import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
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

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user: caller },
      error: callerErr,
    } = await supabase.auth.getUser(token);

    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("empresa_id, role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerProfile?.empresa_id || !["admin", "dono"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const nome = String(body?.nome ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const cpfDigits = onlyDigits(body?.cpf);

    if (!nome || !email || cpfDigits.length < 11) {
      return new Response(
        JSON.stringify({ error: "nome, email e cpf válido são obrigatórios" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const empresaId = callerProfile.empresa_id;

    const { data: authCreated, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: cpfDigits,
      email_confirm: true,
      user_metadata: {
        nome,
        role: "usuario",
        empresa_id: empresaId,
        must_change_password: true,
      },
    });

    if (authErr || !authCreated.user) {
      return new Response(JSON.stringify({ error: authErr?.message ?? "Erro ao criar auth user" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const authUserId = authCreated.user.id;

    const { error: profileErr } = await supabase.from("profiles").insert({
      user_id: authUserId,
      empresa_id: empresaId,
      nome,
      role: "usuario",
    });

    if (profileErr) {
      await supabase.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const payload = {
      empresa_id: empresaId,
      auth_user_id: authUserId,

      nome,
      apelido: String(body?.apelido ?? "").trim() || null,
      cpf: cpfDigits,
      rg: String(body?.rg ?? "").trim() || null,
      data_nascimento: body?.data_nascimento || null,

      email,
      telefone: String(body?.telefone ?? "").trim() || null,
      whatsapp: String(body?.whatsapp ?? "").trim() || null,

      cep: String(body?.cep ?? "").trim() || null,
      logradouro: String(body?.logradouro ?? "").trim() || null,
      numero: String(body?.numero ?? "").trim() || null,
      complemento: String(body?.complemento ?? "").trim() || null,
      bairro: String(body?.bairro ?? "").trim() || null,
      cidade: String(body?.cidade ?? "").trim() || null,
      uf: String(body?.uf ?? "").trim().toUpperCase().slice(0, 2) || null,

      status: ["ativo", "ferias", "afastado", "inativo"].includes(String(body?.status ?? ""))
        ? String(body?.status)
        : "ativo",
      data_admissao: body?.data_admissao || null,
      data_demissao: body?.data_demissao || null,

      chave_pix: String(body?.chave_pix ?? "").trim() || null,
      banco: String(body?.banco ?? "").trim() || null,
      agencia: String(body?.agencia ?? "").trim() || null,
      conta: String(body?.conta ?? "").trim() || null,

      observacoes: String(body?.observacoes ?? "").trim() || null,
    };

    const { data: usuario, error: usuarioErr } = await supabase
      .from("usuarios")
      .insert(payload)
      .select("id, nome, email")
      .single();

    if (usuarioErr) {
      await supabase.from("profiles").delete().eq("user_id", authUserId);
      await supabase.auth.admin.deleteUser(authUserId);

      return new Response(JSON.stringify({ error: usuarioErr.message }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, usuario, senha_padrao: "cpf", primeiro_acesso: true }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
