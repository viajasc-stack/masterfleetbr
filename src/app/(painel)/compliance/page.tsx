"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Documento = {
  id: string;
  tipo_entidade: string;
  categoria: string;
  numero: string | null;
  validade: string | null;
  status: string;
};

export default function CompliancePage() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    tipo_entidade: "veiculo",
    entidade_id: "",
    categoria: "ANTT",
    numero: "",
    validade: "",
  });

  async function load() {
    const { data, error } = await supabase
      .from("compliance_documentos")
      .select("id, tipo_entidade, categoria, numero, validade, status")
      .order("validade", { ascending: true })
      .limit(200);
    if (error) setErro(error.message);
    setDocs((data ?? []) as Documento[]);
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
    if (!userId) {
      setErro("Sessão inválida.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.empresa_id) {
      setErro("Empresa não identificada.");
      return;
    }

    const { error } = await supabase.from("compliance_documentos").insert({
      empresa_id: profile.empresa_id,
      tipo_entidade: form.tipo_entidade,
      entidade_id: form.entidade_id,
      categoria: form.categoria,
      numero: form.numero || null,
      validade: form.validade || null,
      status: "valido",
    });
    if (error) {
      setErro(error.message);
      return;
    }
    setForm((f) => ({ ...f, entidade_id: "", numero: "", validade: "" }));
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Compliance" description="Controle documental (CNH, ANTT, seguros e vencimentos) com visão preventiva." />
      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-4 grid gap-3 md:grid-cols-5">
        <select className="border rounded px-2 py-2 text-sm" value={form.tipo_entidade} onChange={(e) => setForm((f) => ({ ...f, tipo_entidade: e.target.value }))}>
          <option value="veiculo">Veículo</option>
          <option value="motorista">Motorista</option>
          <option value="empresa">Empresa</option>
        </select>
        <input className="border rounded px-2 py-2 text-sm" placeholder="ID da entidade" value={form.entidade_id} onChange={(e) => setForm((f) => ({ ...f, entidade_id: e.target.value }))} required />
        <input className="border rounded px-2 py-2 text-sm" placeholder="Categoria (ex: ANTT)" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} required />
        <input className="border rounded px-2 py-2 text-sm" placeholder="Número" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} />
        <div className="flex gap-2">
          <input type="date" className="border rounded px-2 py-2 text-sm w-full" value={form.validade} onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))} />
          <button className="rounded bg-indigo-600 text-white px-4 py-2 text-sm">Salvar</button>
        </div>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-600">
              <th className="py-2 pr-3">Entidade</th><th className="py-2 pr-3">Categoria</th><th className="py-2 pr-3">Número</th><th className="py-2 pr-3">Validade</th><th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3">{d.tipo_entidade}</td>
                <td className="py-2 pr-3">{d.categoria}</td>
                <td className="py-2 pr-3">{d.numero ?? "-"}</td>
                <td className="py-2 pr-3">{d.validade ? new Date(d.validade).toLocaleDateString("pt-BR") : "-"}</td>
                <td className="py-2 pr-3">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
