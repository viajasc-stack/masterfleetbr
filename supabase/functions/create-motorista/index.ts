import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

    const body = await req.json();
    const { empresa_id, nome, cpf, email, telefone, create_auth_user = true } = body;

    if (!empresa_id || !nome) return new Response(JSON.stringify({ error: "empresa_id and nome are required" }), { status: 400, headers: CORS });

    // Idempotency: avoid duplicate motorista by cpf per empresa
    if (cpf) {
      const { data: exist } = await supabase.from("motoristas").select("*").eq("empresa_id", empresa_id).eq("cpf", cpf).maybeSingle();
      if (exist) return new Response(JSON.stringify({ ok: true, message: "motorista_exists", motorista: exist }), { headers: CORS });
    }

    let authUser: any = null;
    if (create_auth_user && email) {
      // create auth user (service role)
      try {
        const pw = Math.random().toString(36).slice(-10) + "A1!";
        const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
          email: String(email),
          password: pw,
          user_metadata: { nome, telefone, cpf, role: "motorista" },
        } as any);
        if (userErr) {
          console.error("createUser error", userErr);
        } else {
          authUser = userData;
          // create profile row
          await supabase.from("profiles").insert({ user_id: authUser.id, nome, role: "motorista", empresa_id });
        }
      } catch (err) {
        console.error("auth create error", err);
      }
    }

    const insertObj: any = { empresa_id, nome, cpf: cpf ?? null, telefone: telefone ?? null, email: email ?? null };
    const { data, error } = await supabase.from("motoristas").insert(insertObj).maybeSingle();
    if (error) {
      console.error("insert motorista error", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true, motorista: data, authUser }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
