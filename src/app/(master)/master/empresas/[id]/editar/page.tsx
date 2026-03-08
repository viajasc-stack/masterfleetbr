"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Plano = { id: string; nome: string; valor_centavos: number };

type EmpresaPayload = {
  id: string;
  nome: string;
  email?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

type AssinaturaPayload = {
  status?: string | null;
  trial_ate?: string | null;
  proxima_cobranca?: string | null;
  plano_id?: string | null;
};

const STATUS_OPTIONS = ["trial", "ativa", "past_due", "bloqueada", "cancelada"];

export default function MasterEmpresaEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [planos, setPlanos] = useState<Plano[]>([]);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [status, setStatus] = useState("trial");
  const [trialAte, setTrialAte] = useState("");
  const [proximaCobranca, setProximaCobranca] = useState("");
  const [planoId, setPlanoId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg("");

      const { data, error } = await supabase.rpc("master_get_empresa_editor", { p_empresa_id: id });
      if (error || !data) {
        setMsg(error?.message ?? "Erro ao carregar dados da empresa.");
        setLoading(false);
        return;
      }

      const payload = data as {
        empresa: EmpresaPayload;
        assinatura: AssinaturaPayload;
        planos: Plano[];
      };

      const empresa = payload.empresa;
      const assinatura = payload.assinatura ?? {};

      setNome(empresa?.nome ?? "");
      setEmail(empresa?.email ?? "");
      setCnpj(empresa?.cnpj ?? "");
      setTelefone(empresa?.telefone ?? "");
      setEndereco(empresa?.endereco ?? "");
      setCidade(empresa?.cidade ?? "");
      setEstado(empresa?.estado ?? "");

      setStatus(assinatura?.status ?? "trial");
      setTrialAte(assinatura?.trial_ate ? String(assinatura.trial_ate).slice(0, 10) : "");
      setProximaCobranca(assinatura?.proxima_cobranca ? String(assinatura.proxima_cobranca).slice(0, 10) : "");
      setPlanoId(assinatura?.plano_id ?? "");

      setPlanos(payload.planos ?? []);
      setLoading(false);
    }

    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [id]);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg("");

    const { data, error } = await supabase.rpc("master_save_empresa_editor", {
      p_empresa_id: id,
      p_nome: nome.trim(),
      p_email: email.trim() || null,
      p_cnpj: cnpj.trim() || null,
      p_telefone: telefone.trim() || null,
      p_endereco: endereco.trim() || null,
      p_cidade: cidade.trim() || null,
      p_estado: estado.trim() || null,
      p_status: status,
      p_trial_ate: trialAte ? `${trialAte}T00:00:00.000Z` : null,
      p_proxima_cobranca: proximaCobranca ? `${proximaCobranca}T00:00:00.000Z` : null,
      p_plano_id: planoId || null,
    });

    setSaving(false);

    if (error || !data) {
      setMsg(error?.message ?? "Erro ao salvar alterações.");
      return;
    }

    setMsg("Dados atualizados com sucesso.");
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Carregando editor da empresa...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/master/empresas" className="text-xs text-slate-500 hover:text-slate-700">← Voltar para empresas</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Editar empresa</h1>
          <p className="text-sm text-slate-500">Atualize todos os dados cadastrais e de assinatura.</p>
        </div>
        <button
          onClick={() => router.push(`/master/empresas/${id}`)}
          className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm"
        >
          Ver detalhes
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${msg.toLowerCase().includes("erro") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {msg}
        </div>
      )}

      <form onSubmit={salvar} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Dados da empresa</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="md:col-span-2">
              <label className="block text-slate-600 mb-1">Nome *</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Email</label>
              <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Telefone</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">CNPJ</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">UF</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2 uppercase" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Cidade</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-600 mb-1">Endereço</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Assinatura e cobrança</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-slate-600 mb-1">Status</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Plano</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                <option value="">Sem plano</option>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} — {(p.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Trial até</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={trialAte} onChange={(e) => setTrialAte(e.target.value)} />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Próximo vencimento</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={proximaCobranca} onChange={(e) => setProximaCobranca(e.target.value)} />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bg-indigo-600 text-white hover:bg-indigo-500 px-6 py-2 rounded-md text-sm disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
