import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const mes = now.getMonth() + 1;
  const dia = now.getDate();

  const [{ data: usuarios }, { data: motoristas }, { data: empresas }] = await Promise.all([
    supabase.from("usuarios").select("id, empresa_id, nome, data_nascimento").not("data_nascimento", "is", null),
    supabase.from("motoristas").select("id, empresa_id, nome, data_nascimento").not("data_nascimento", "is", null),
    supabase.from("empresas").select("id"),
  ]);

  const porEmpresa = new Map<string, string[]>();

  const pushIfToday = (empresaId: string, nome: string, data: string | null) => {
    if (!data) return;
    const d = new Date(`${data}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    if (d.getMonth() + 1 !== mes || d.getDate() !== dia) return;
    porEmpresa.set(empresaId, [...(porEmpresa.get(empresaId) ?? []), nome]);
  };

  (usuarios ?? []).forEach((u: { empresa_id: string; nome: string; data_nascimento: string | null }) =>
    pushIfToday(u.empresa_id, u.nome, u.data_nascimento)
  );
  (motoristas ?? []).forEach((m: { empresa_id: string; nome: string; data_nascimento: string | null }) =>
    pushIfToday(m.empresa_id, m.nome, m.data_nascimento)
  );

  let totalNotifs = 0;
  for (const emp of empresas ?? []) {
    const nomes = porEmpresa.get(emp.id) ?? [];
    if (nomes.length === 0) continue;

    const titulo = nomes.length === 1 ? "Aniversariante de hoje" : "Aniversariantes de hoje";
    const mensagem = nomes.length === 1
      ? `${nomes[0]} faz aniversário hoje.`
      : `${nomes.join(", ")} fazem aniversário hoje.`;

    const meta = {
      tipo: "aniversario",
      data: now.toISOString().slice(0, 10),
      nomes,
    };

    const { data: existente } = await supabase
      .from("notifications")
      .select("id")
      .eq("empresa_id", emp.id)
      .eq("titulo", titulo)
      .contains("meta", { tipo: "aniversario", data: now.toISOString().slice(0, 10) })
      .maybeSingle();

    if (existente) continue;

    await supabase.from("notifications").insert({
      empresa_id: emp.id,
      nivel: "info",
      titulo,
      mensagem,
      meta,
    });
    totalNotifs += 1;
  }

  return new Response(JSON.stringify({ ok: true, empresas_com_notificacao: totalNotifs }), {
    headers: { "Content-Type": "application/json" },
  });
});
