"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Empresa = { id: string; nome: string; cnpj: string | null; telefone: string | null; email: string | null; endereco: string | null; cidade: string | null; estado: string | null };
type Profile = { user_id: string; nome: string | null; role: string; empresa_id: string | null };
type Assinatura = { status: string; trial_ate: string | null; proxima_cobranca: string | null; planos: { nome: string } | null };

export default function ConfiguracoesPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"empresa" | "conta">("empresa");
  const [formEmpresa, setFormEmpresa] = useState({ nome: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", estado: "" });
  const [formPerfil, setFormPerfil] = useState({ nome: "" });
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: p } = await supabase.from("profiles").select("user_id, nome, role, empresa_id").eq("user_id", session.user.id).maybeSingle();
      setProfile(p as Profile);
      setFormPerfil({ nome: p?.nome ?? "" });
      if (p?.empresa_id) {
        const [{ data: emp }, { data: billing }] = await Promise.all([
          supabase.from("empresas").select("id, nome, cnpj, telefone, email, endereco, cidade, estado").eq("id", p.empresa_id).maybeSingle(),
          supabase.rpc("get_billing_current"),
        ]);
        if (emp) {
          const e = emp as Empresa;
          setEmpresa(e);
          setFormEmpresa({ nome: e.nome ?? "", cnpj: e.cnpj ?? "", telefone: e.telefone ?? "", email: e.email ?? "", endereco: e.endereco ?? "", cidade: e.cidade ?? "", estado: e.estado ?? "" });
        }
        if (billing) {
          setAssinatura({
            status: billing.status ?? "trial",
            trial_ate: billing.trial_ate ?? null,
            proxima_cobranca: billing.proxima_cobranca ?? null,
            planos: billing.plano_nome ? { nome: billing.plano_nome } : null,
          });
        } else {
          const { data: assin } = await supabase
            .from("assinaturas")
            .select("status, trial_ate, proxima_cobranca, planos(nome)")
            .eq("empresa_id", p.empresa_id)
            .maybeSingle();
          setAssinatura(assin as unknown as Assinatura);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function salvarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    if (!empresa) return;
    setSaving(true); setMsg("");
    const { error } = await supabase.from("empresas").update({ nome: formEmpresa.nome.trim(), cnpj: formEmpresa.cnpj.trim() || null, telefone: formEmpresa.telefone.trim() || null, email: formEmpresa.email.trim() || null, endereco: formEmpresa.endereco.trim() || null, cidade: formEmpresa.cidade.trim() || null, estado: formEmpresa.estado.trim() || null }).eq("id", empresa.id);
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Dados da empresa salvos.");
  }

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true); setMsg("");
    const { error } = await supabase.from("profiles").update({ nome: formPerfil.nome.trim() }).eq("user_id", profile.user_id);
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Perfil atualizado.");
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senhaNova !== senhaConf) { setMsg("As senhas não coincidem."); return; }
    if (senhaNova.length < 6) { setMsg("Senha precisa ter ao menos 6 caracteres."); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password: senhaNova });
    setSaving(false);
    if (error) { setMsg(`Erro: ${error.message}`); return; }
    setMsg("Senha alterada com sucesso.");
    setSenhaNova(""); setSenhaConf("");
  }

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Configurações</h1>
        <p className="text-slate-400 text-sm mt-0.5">Dados da empresa e conta do usuário</p>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${msg.startsWith("Erro") ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-green-500/30 bg-green-500/10 text-green-300"}`}>
          {msg}
        </div>
      )}

      {assinatura && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 flex items-center justify-between text-sm">
          <div>
            <span className="text-slate-400">Plano: </span>
            <span className="text-white font-medium">{assinatura.planos?.nome ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded border ${assinatura.status === "ativa" ? "border-green-500/40 text-green-300" : assinatura.status === "trial" ? "border-blue-500/40 text-blue-300" : "border-amber-500/40 text-amber-300"}`}>{assinatura.status}</span>
            {assinatura.trial_ate && <span className="text-slate-500">Trial até {new Date(assinatura.trial_ate).toLocaleDateString("pt-BR")}</span>}
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-slate-900/40 border border-slate-800 rounded-lg p-1 w-fit">
        {(["empresa", "conta"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm transition ${tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
            {t === "empresa" ? "Empresa" : "Minha Conta"}
          </button>
        ))}
      </div>

      {tab === "empresa" && empresa && (
        <form onSubmit={salvarEmpresa} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
          <h2 className="font-semibold">Dados da Empresa</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-medium mb-1">Nome *</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formEmpresa.nome} onChange={(e) => setFormEmpresa((p) => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div>
              <label className="block font-medium mb-1">CNPJ</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formEmpresa.cnpj} onChange={(e) => setFormEmpresa((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className="block font-medium mb-1">Telefone</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formEmpresa.telefone} onChange={(e) => setFormEmpresa((p) => ({ ...p, telefone: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block font-medium mb-1">E-mail</label>
              <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2" value={formEmpresa.email} onChange={(e) => setFormEmpresa((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block font-medium mb-1">Endereço</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formEmpresa.endereco} onChange={(e) => setFormEmpresa((p) => ({ ...p, endereco: e.target.value }))} />
            </div>
            <div>
              <label className="block font-medium mb-1">Cidade</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formEmpresa.cidade} onChange={(e) => setFormEmpresa((p) => ({ ...p, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="block font-medium mb-1">UF</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2 uppercase" maxLength={2} value={formEmpresa.estado} onChange={(e) => setFormEmpresa((p) => ({ ...p, estado: e.target.value.toUpperCase() }))} placeholder="SP" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
            {saving ? "Salvando..." : "Salvar dados da empresa"}
          </button>
        </form>
      )}

      {tab === "conta" && (
        <div className="space-y-5">
          <form onSubmit={salvarPerfil} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
            <h2 className="font-semibold">Meu Perfil</h2>
            <div>
              <label className="block font-medium mb-1">Nome</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formPerfil.nome} onChange={(e) => setFormPerfil({ nome: e.target.value })} />
            </div>
            <div>
              <label className="block font-medium mb-1">Papel</label>
              <div className="text-slate-600 border border-slate-200 rounded-md px-3 py-2 bg-slate-50">{profile?.role ?? "—"}</div>
            </div>
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
              {saving ? "Salvando..." : "Salvar perfil"}
            </button>
          </form>

          <form onSubmit={alterarSenha} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
            <h2 className="font-semibold">Alterar Senha</h2>
            <div>
              <label className="block font-medium mb-1">Nova senha *</label>
              <input type="password" className="w-full border border-slate-300 rounded-md px-3 py-2" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="block font-medium mb-1">Confirmar *</label>
              <input type="password" className="w-full border border-slate-300 rounded-md px-3 py-2" value={senhaConf} onChange={(e) => setSenhaConf(e.target.value)} required />
            </div>
            <button type="submit" disabled={saving} className="bg-slate-800 text-white px-6 py-2 rounded-md hover:bg-slate-700 disabled:opacity-60 transition">
              {saving ? "Alterando..." : "Alterar senha"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
