import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromBearer, getMasterIAConfig, getSupabaseServiceClient } from "../_lib";

type Payload = {
  conversa_id?: string | null;
  mensagem?: string;
};

async function callOpenAI(model: string, temperature: number, systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("openai_not_configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openai_error:${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("openai_empty_response");
  return content;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContextFromBearer(req);
    const body = (await req.json().catch(() => ({}))) as Payload;
    const mensagem = String(body.mensagem ?? "").trim();

    if (!mensagem) return NextResponse.json({ error: "mensagem_obrigatoria" }, { status: 400 });

    const config = await getMasterIAConfig();
    if (!config.enabled) {
      return NextResponse.json({ error: "masteria_disabled" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();

    let conversaId = body.conversa_id ?? null;
    if (!conversaId) {
      const { data: novaConversa, error: conversaErr } = await supabase
        .from("masteria_conversas")
        .insert({
          empresa_id: auth.empresaId,
          criado_por: auth.userId,
          titulo: mensagem.slice(0, 80),
        })
        .select("id")
        .single();
      if (conversaErr) throw conversaErr;
      conversaId = novaConversa.id;
    }

    const { error: insertUserErr } = await supabase.from("masteria_mensagens").insert({
      conversa_id: conversaId,
      empresa_id: auth.empresaId,
      autor_tipo: "admin",
      conteudo: mensagem,
      meta: {},
    });
    if (insertUserErr) throw insertUserErr;

    const [{ data: conflitos }, { data: alertas }] = await Promise.all([
      supabase.rpc("masteria_list_os_conflicts", {
        p_empresa_id: auth.empresaId,
        p_days_ahead: 7,
      }),
      supabase
        .from("masteria_alertas")
        .select("tipo, severidade, titulo, descricao, status, detectado_em")
        .eq("empresa_id", auth.empresaId)
        .order("detectado_em", { ascending: false })
        .limit(20),
    ]);

    const systemPrompt = [
      "Você é o MasterIA, copiloto operacional do sistema MasterFleetBR.",
      "Responda em pt-BR, de forma objetiva e prática.",
      "Sempre priorize segurança operacional, clareza e próximos passos acionáveis.",
      "Quando houver conflitos de OS, destaque impacto e sugira sequência de resolução.",
    ].join(" ");

    const userPrompt = [
      `Pergunta do administrador: ${mensagem}`,
      "Contexto de conflitos de OS (último scan):",
      JSON.stringify(conflitos ?? [], null, 2),
      "Alertas recentes:",
      JSON.stringify(alertas ?? [], null, 2),
      "Responda com: 1) diagnóstico, 2) ações recomendadas, 3) prioridade.",
    ].join("\n\n");

    const resposta = await callOpenAI(config.openai_model, config.temperature, systemPrompt, userPrompt);

    const { error: insertIaErr } = await supabase.from("masteria_mensagens").insert({
      conversa_id: conversaId,
      empresa_id: auth.empresaId,
      autor_tipo: "ia",
      conteudo: resposta,
      meta: {
        model: config.openai_model,
      },
    });
    if (insertIaErr) throw insertIaErr;

    return NextResponse.json({ ok: true, conversa_id: conversaId, resposta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
