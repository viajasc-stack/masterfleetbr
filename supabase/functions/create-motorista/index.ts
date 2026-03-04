import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function getSenhaPadraoDoCpf(cpf: string) {
  return cpf.slice(0, 6);
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
    const bodyEmpresaId = String(body?.empresa_id ?? "").trim() || null;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    let callerEmpresaId: string | null = bodyEmpresaId;

    // tenta validar usuário logado; se token estiver inválido, segue com empresa_id do body
    if (token) {
      const {
        data: { user: caller },
        error: callerErr,
      } = await supabase.auth.getUser(token);

      if (!callerErr && caller) {
        const { data: callerProfile } = await supabase
          .from("profiles")
          .select("empresa_id, role")
          .eq("user_id", caller.id)
          .maybeSingle();

        callerEmpresaId = callerProfile?.empresa_id ?? caller.user_metadata?.empresa_id ?? callerEmpresaId;

        // fallback legado: vínculo pela tabela usuarios
        if (!callerEmpresaId) {
          const { data: callerUsuario } = await supabase
            .from("usuarios")
            .select("empresa_id")
            .eq("auth_user_id", caller.id)
            .maybeSingle();
          callerEmpresaId = callerUsuario?.empresa_id ?? null;
        }
      }
    }

    if (!callerEmpresaId) {
      return new Response(JSON.stringify({ error: "empresa_id obrigatório" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const nome = String(body?.nome ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const cpfDigits = onlyDigits(body?.cpf);
    const telefone = String(body?.telefone ?? "").trim() || null;

    if (!nome || !email || cpfDigits.length < 11) {
      return new Response(JSON.stringify({ error: "nome, email e cpf válido são obrigatórios" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const empresaId = callerEmpresaId;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "empresa_id não resolvido" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const loginEmail = `${cpfDigits}@motorista.masterfleet.local`;
    const senhaPadrao = getSenhaPadraoDoCpf(cpfDigits);

    // Idempotência: evita duplicar motorista por cpf dentro da empresa
    const { data: existMotorista } = await supabase
      .from("motoristas")
      .select("id, nome, cpf")
      .eq("empresa_id", empresaId)
      .eq("cpf", cpfDigits)
      .maybeSingle();

    if (existMotorista) {
      return new Response(JSON.stringify({ ok: true, message: "motorista_exists", motorista: existMotorista }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const desiredMetadata = {
      nome,
      cpf: cpfDigits,
      telefone,
      email_contato: email,
      role: "motorista",
      empresa_id: empresaId,
      must_change_password: true,
    };

    const { data: authCreated, error: authErr } = await supabase.auth.admin.createUser({
      email: loginEmail,
      password: senhaPadrao,
      email_confirm: true,
      user_metadata: desiredMetadata,
    });

    let authUserId: string | null = authCreated?.user?.id ?? null;

    if ((authErr || !authUserId) && isAlreadyRegisteredError(authErr?.message)) {
      // Recupera auth user existente pelo e-mail de login sintético do CPF
      const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const existing = listed?.users?.find((u) => String(u.email ?? "").toLowerCase() === loginEmail);
      authUserId = existing?.id ?? null;

      if (!authUserId) {
        return new Response(JSON.stringify({ error: authErr?.message ?? "Erro ao criar auth user" }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      await supabase.auth.admin.updateUserById(authUserId, {
        password: senhaPadrao,
        user_metadata: {
          ...(existing?.user_metadata ?? {}),
          ...desiredMetadata,
        },
      });
    }

    if (authErr && !isAlreadyRegisteredError(authErr.message)) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Erro ao criar auth user" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { error: profileErr } = await supabase.from("profiles").upsert({
      user_id: authUserId,
      empresa_id: empresaId,
      nome,
      role: "motorista",
    }, { onConflict: "user_id" });

    if (profileErr) {
      await supabase.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const insertObj = {
      empresa_id: empresaId,
      auth_user_id: authUserId,
      nome,
      cpf: cpfDigits,
      telefone,
      email,
      apelido: String(body?.apelido ?? "").trim() || null,
      rg: String(body?.rg ?? "").trim() || null,
      data_nascimento: body?.data_nascimento || null,
      whatsapp: String(body?.whatsapp ?? "").trim() || null,
      cep: String(body?.cep ?? "").trim() || null,
      logradouro: String(body?.logradouro ?? "").trim() || null,
      numero: String(body?.numero ?? "").trim() || null,
      complemento: String(body?.complemento ?? "").trim() || null,
      bairro: String(body?.bairro ?? "").trim() || null,
      cidade: String(body?.cidade ?? "").trim() || null,
      uf: String(body?.uf ?? "").trim().toUpperCase().slice(0, 2) || null,
      cnh_numero: String(body?.cnh_numero ?? "").trim() || null,
      cnh_categoria: String(body?.cnh_categoria ?? "").trim() || null,
      cnh_validade: body?.cnh_validade || null,
      cnh_observacoes: String(body?.cnh_observacoes ?? "").trim() || null,
      status: ["ativo", "ferias", "afastado", "inativo"].includes(String(body?.status ?? ""))
        ? String(body?.status)
        : "ativo",
      data_admissao: body?.data_admissao || null,
      data_demissao: body?.data_demissao || null,
      chave_pix: String(body?.chave_pix ?? "").trim() || null,
      banco: String(body?.banco ?? "").trim() || null,
      agencia: String(body?.agencia ?? "").trim() || null,
      conta: String(body?.conta ?? "").trim() || null,
      vinculo_trabalho: ["freelancer", "contratado"].includes(String(body?.vinculo_trabalho ?? ""))
        ? String(body?.vinculo_trabalho)
        : null,
      tipo_remuneracao: ["fixo_extra", "fixo_banco_horas", "por_os_executada", "por_diaria"].includes(String(body?.tipo_remuneracao ?? ""))
        ? String(body?.tipo_remuneracao)
        : null,
      salario_base: body?.salario_base ?? null,
      valor_hora_extra: body?.valor_hora_extra ?? null,
      banco_horas_saldo: body?.banco_horas_saldo ?? null,
      valor_por_os: body?.valor_por_os ?? null,
      valor_diaria: body?.valor_diaria ?? null,
      observacoes_remuneracao: String(body?.observacoes_remuneracao ?? "").trim() || null,
      cnh_arquivo_url: String(body?.cnh_arquivo_url ?? "").trim() || null,
      cursos_urls: Array.isArray(body?.cursos_urls)
        ? (body.cursos_urls as unknown[]).map((x) => String(x)).filter(Boolean)
        : [],
      observacoes: String(body?.observacoes ?? "").trim() || null,
    };

    const { data, error } = await supabase
      .from("motoristas")
      .insert(insertObj)
      .select("id, empresa_id, nome, cpf, email")
      .single();

    // Compatibilidade com schema antigo (sem colunas novas)
    if (error && /column .* does not exist/i.test(error.message)) {
      const legacyInsertObj = {
        empresa_id: empresaId,
        nome,
        cpf: cpfDigits,
        cnh: String(body?.cnh_numero ?? "").trim() || null,
        categoria_cnh: String(body?.cnh_categoria ?? "").trim() || null,
        validade_cnh: body?.cnh_validade || null,
        telefone,
        whatsapp: String(body?.whatsapp ?? "").trim() || null,
        email,
        endereco: [
          String(body?.logradouro ?? "").trim(),
          String(body?.numero ?? "").trim(),
          String(body?.bairro ?? "").trim(),
          String(body?.cidade ?? "").trim(),
          String(body?.uf ?? "").trim(),
        ].filter(Boolean).join(" - ") || null,
        observacoes: String(body?.observacoes ?? "").trim() || null,
        ativo: String(body?.status ?? "ativo") !== "inativo",
      };

      const { data: legacyData, error: legacyErr } = await supabase
        .from("motoristas")
        .insert(legacyInsertObj)
        .select("id, empresa_id, nome, cpf, email")
        .single();

      if (legacyErr) {
        await supabase.from("profiles").delete().eq("user_id", authUserId);
        await supabase.auth.admin.deleteUser(authUserId);

        return new Response(JSON.stringify({ error: legacyErr.message }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          motorista: legacyData,
          auth_user_id: authUserId,
          login: "cpf",
          senha_padrao: "6_primeiros_digitos_cpf",
          primeiro_acesso: true,
          warning: "motoristas_legacy_schema",
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (error) {
      await supabase.from("profiles").delete().eq("user_id", authUserId);
      await supabase.auth.admin.deleteUser(authUserId);

      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        motorista: data,
        auth_user_id: authUserId,
        login: "cpf",
        senha_padrao: "6_primeiros_digitos_cpf",
        primeiro_acesso: true,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
