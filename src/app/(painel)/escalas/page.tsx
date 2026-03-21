"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Escala = {
  id: string;
  inicio_em: string;
  fim_em: string;
  status: string;
  motoristas: { nome: string | null }[] | null;
};

export default function EscalasPage() {
  const [motoristas, setMotoristas] = useState<Array<{ id: string; nome: string }>>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ motorista_id: "", inicio_em: "", fim_em: "" });

  async function load() {
    const [{ data: mData }, { data: eData, error: eErr }] = await Promise.all([
      supabase.from("motoristas").select("id,nome").order("nome", { ascending: true }),
      supabase
        .from("escalas_motoristas")
        .select("id, inicio_em, fim_em, status, motoristas(nome)")
        .order("inicio_em", { ascending: true })
        .limit(200),
    ]);
    if (eErr) setErro(eErr.message);
    setMotoristas((mData ?? []) as Array<{ id: string; nome: string }>);
    setEscalas((eData ?? []) as Escala[]);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return setErro("Sessão inválida.");

    const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("user_id", userId).maybeSingle();
    if (!profile?.empresa_id) return setErro("Empresa não identificada.");

    const { error } = await supabase.from("escalas_motoristas").insert({
      empresa_id: profile.empresa_id,
      motorista_id: form.motorista_id,
      inicio_em: form.inicio_em,
      fim_em: form.fim_em,
      status: "planejada",
      origem: "manual",
    });
    if (error) return setErro(error.message);

    setForm({ motorista_id: "", inicio_em: "", fim_em: "" });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Escalas" description="Planejamento de jornada e alocação de motoristas por período." />
      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-4 grid gap-3 md:grid-cols-4">
        <select className="border rounded px-2 py-2 text-sm" value={form.motorista_id} onChange={(e) => setForm((f) => ({ ...f, motorista_id: e.target.value }))} required>
          <option value="">Motorista...</option>
          {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <input type="datetime-local" className="border rounded px-2 py-2 text-sm" value={form.inicio_em} onChange={(e) => setForm((f) => ({ ...f, inicio_em: e.target.value }))} required />
        <input type="datetime-local" className="border rounded px-2 py-2 text-sm" value={form.fim_em} onChange={(e) => setForm((f) => ({ ...f, fim_em: e.target.value }))} required />
        <button className="rounded bg-indigo-600 text-white px-4 py-2 text-sm">Criar escala</button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-600">
              <th className="py-2 pr-3">Motorista</th><th className="py-2 pr-3">Início</th><th className="py-2 pr-3">Fim</th><th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {escalas.map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3">{e.motoristas?.[0]?.nome ?? "-"}</td>
                <td className="py-2 pr-3">{new Date(e.inicio_em).toLocaleString("pt-BR")}</td>
                <td className="py-2 pr-3">{new Date(e.fim_em).toLocaleString("pt-BR")}</td>
                <td className="py-2 pr-3">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
