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

    let callerEmpresaId = callerProfile?.empresa_id ?? caller.user_metadata?.empresa_id ?? null;

    let isSuperAdmin = false;
    const { data: superAdminData } = await supabase.rpc("is_super_admin");
    if (typeof superAdminData === "boolean") isSuperAdmin = superAdminData;

    // Fallback para casos legados sem profile, mas com vínculo em public.usuarios
    if (!callerEmpresaId) {
      const { data: callerUsuario } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("auth_user_id", caller.id)
        .maybeSingle();

      callerEmpresaId = callerUsuario?.empresa_id ?? null;
    }

    // Regra prática: membro da empresa pode resetar senha de usuário da mesma empresa.
    // Super admin continua podendo tudo.
    if (!callerEmpresaId && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const usuarioId = String(body?.usuario_id ?? "").trim();
    if (!usuarioId) {
      return new Response(JSON.stringify({ error: "usuario_id é obrigatório" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: usuario, error: usuarioErr } = await supabase
      .from("usuarios")
      .select("id, empresa_id, auth_user_id, cpf, nome")
      .eq("id", usuarioId)
      .maybeSingle();

    if (usuarioErr || !usuario) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!isSuperAdmin && usuario.empresa_id !== callerEmpresaId) {
      return new Response(JSON.stringify({ error: "Usuário não pertence à sua empresa" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!usuario.auth_user_id) {
      return new Response(JSON.stringify({ error: "Usuário sem vínculo no Auth" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const cpfDigits = onlyDigits(usuario.cpf);
    if (cpfDigits.length < 11) {
      return new Response(JSON.stringify({ error: "CPF inválido para reset (mínimo 11 dígitos)" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: authUserData, error: authUserErr } = await supabase.auth.admin.getUserById(usuario.auth_user_id);
    if (authUserErr || !authUserData?.user) {
      return new Response(JSON.stringify({ error: authUserErr?.message ?? "Auth user não encontrado" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const userMetadata = {
      ...(authUserData.user.user_metadata ?? {}),
      must_change_password: true,
    };

    const { error: updateErr } = await supabase.auth.admin.updateUserById(usuario.auth_user_id, {
      password: cpfDigits,
      user_metadata: userMetadata,
    });

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, usuario_id: usuario.id, nome: usuario.nome, senha_padrao: "cpf", primeiro_acesso: true }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
