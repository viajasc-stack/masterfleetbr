"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Acesso = {
  id: string;
  token: string;
  ativo: boolean;
  expira_em: string | null;
  clientes: { nome: string | null }[] | null;
};

export default function PortalClientePage() {
  const [clientes, setClientes] = useState<Array<{ id: string; nome: string }>>([]);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [erro, setErro] = useState("");

  async function load() {
    const [{ data: cData }, { data: aData, error: aErr }] = await Promise.all([
      supabase.from("clientes").select("id,nome").order("nome", { ascending: true }),
      supabase
        .from("portal_cliente_acessos")
        .select("id, token, ativo, expira_em, clientes(nome)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (aErr) setErro(aErr.message);
    setClientes((cData ?? []) as Array<{ id: string; nome: string }>);
    setAcessos((aData ?? []) as Acesso[]);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criarAcesso(e: FormEvent) {
    e.preventDefault();
    if (!clienteId) return;
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

    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("portal_cliente_acessos").insert({
      empresa_id: profile.empresa_id,
      cliente_id: clienteId,
      token,
      ativo: true,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    setClienteId("");
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Portal do Cliente" description="Gerencie links/tokens de acesso para clientes acompanharem suas operações." />
      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <form onSubmit={criarAcesso} className="rounded-xl border border-slate-200 bg-white p-4 flex gap-3 items-end">
        <div className="min-w-[260px]">
          <label className="block text-xs text-slate-600 mb-1">Cliente</label>
          <select className="w-full border border-slate-300 rounded px-2 py-2 text-sm" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <button className="rounded bg-indigo-600 text-white px-4 py-2 text-sm">Gerar acesso</button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-600">
              <th className="py-2 pr-3">Cliente</th><th className="py-2 pr-3">Token</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Expira em</th>
            </tr>
          </thead>
          <tbody>
            {acessos.map((a) => (
              <tr key={a.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3">{a.clientes?.[0]?.nome ?? "-"}</td>
                <td className="py-2 pr-3 font-mono text-xs">{a.token}</td>
                <td className="py-2 pr-3">{a.ativo ? "Ativo" : "Inativo"}</td>
                <td className="py-2 pr-3">{a.expira_em ? new Date(a.expira_em).toLocaleDateString("pt-BR") : "Sem expiração"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
