import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const usuarioId = String(body?.usuario_id ?? "").trim();
    if (!usuarioId) {
      return new Response(JSON.stringify({ error: "usuario_id é obrigatório" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: usuario, error: usuarioErr } = await supabase
      .from("usuarios")
      .select("id, empresa_id, auth_user_id")
      .eq("id", usuarioId)
      .maybeSingle();

    if (usuarioErr || !usuario) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (usuario.empresa_id !== callerProfile.empresa_id) {
      return new Response(JSON.stringify({ error: "Usuário não pertence à sua empresa" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const authUserId = usuario.auth_user_id;

    const { error: delUsuarioErr } = await supabase.from("usuarios").delete().eq("id", usuarioId);
    if (delUsuarioErr) {
      return new Response(JSON.stringify({ error: delUsuarioErr.message }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (authUserId) {
      await supabase.from("profiles").delete().eq("user_id", authUserId);
      await supabase.auth.admin.deleteUser(authUserId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
