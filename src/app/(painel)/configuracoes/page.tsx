"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Empresa = { id: string; nome: string; cnpj: string | null; telefone: string | null; email: string | null; endereco: string | null; cidade: string | null; estado: string | null };
type Profile = { user_id: string; nome: string | null; role: string; empresa_id: string | null };
type Assinatura = { status: string; trial_ate: string | null; proxima_cobranca: string | null; planos: { nome: string } | null };
type CustomDomainInfo = {
  allowed: boolean;
  allowed_subdomain?: boolean;
  allowed_custom_domain?: boolean;
  base_domain: string;
  subdominio_personalizado: string | null;
  dominio_personalizado: string | null;
  dominio_status: "desativado" | "pendente" | "ativo" | "erro";
  dominio_ssl_status: "pendente" | "ativo" | "erro";
  dominio_erro: string | null;
  host_ativo: string | null;
  plano_codigo: string | null;
  plano_nome: string | null;
};

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
  const [domainInfo, setDomainInfo] = useState<CustomDomainInfo | null>(null);
  const [domainMode, setDomainMode] = useState<"subdomain" | "domain">("subdomain");
  const [subdomainInput, setSubdomainInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainMsg, setDomainMsg] = useState("");

  function mapDomainError(errorMessage: string) {
    const msg = (errorMessage || "").toLowerCase();
    if (msg.includes("plano_not_allowed")) return "Recurso disponível apenas para planos elegíveis.";
    if (msg.includes("plano_subdomain_not_allowed")) return "Seu plano não permite subdomínio da plataforma.";
    if (msg.includes("plano_domain_not_allowed")) return "Domínio próprio disponível apenas no plano Supremo.";
    if (msg.includes("subdomain_reserved")) return "Esse subdomínio é reservado pelo sistema.";
    if (msg.includes("subdomain_invalid")) return "Subdomínio inválido. Use apenas letras minúsculas, números e hífen.";
    if (msg.includes("subdomain_unavailable")) return "Subdomínio indisponível. Escolha outro.";
    if (msg.includes("domain_invalid")) return "Domínio inválido. Informe apenas o host (ex.: empresa.com.br).";
    if (msg.includes("domain_unavailable")) return "Domínio indisponível. Ele já está em uso.";
    if (msg.includes("function") && msg.includes("does not exist")) return "Função ainda não disponível. Aplique a migration de URL personalizada.";
    return errorMessage;
  }

  const carregarDominio = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_custom_domain");
    if (error) {
      setDomainInfo(null);
      setDomainMsg(mapDomainError(error.message));
      return;
    }

    const info = (data ?? null) as CustomDomainInfo | null;
    setDomainInfo(info);

    if (info?.dominio_personalizado && info.allowed_custom_domain) {
      setDomainMode("domain");
      setDomainInput(info.dominio_personalizado);
      setSubdomainInput("");
    } else if (info?.subdominio_personalizado && info.allowed_subdomain) {
      setDomainMode("subdomain");
      setSubdomainInput(info.subdominio_personalizado);
      setDomainInput("");
    } else if (info?.allowed_subdomain && !info?.allowed_custom_domain) {
      setDomainMode("subdomain");
      setDomainInput("");
    } else if (info?.allowed_custom_domain && !info?.allowed_subdomain) {
      setDomainMode("domain");
      setSubdomainInput("");
    } else {
      setDomainMode("subdomain");
      setSubdomainInput(info?.subdominio_personalizado ?? "");
      setDomainInput("");
    }
  }, []);

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

        await carregarDominio();
      }
      setLoading(false);
    }
    load();
  }, [carregarDominio]);

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

  async function salvarSubdominio(e: React.FormEvent) {
    e.preventDefault();
    setDomainSaving(true);
    setDomainMsg("");

    const { error } = await supabase.rpc("set_my_custom_subdomain", {
      p_subdomain: subdomainInput.trim().toLowerCase(),
    });

    setDomainSaving(false);

    if (error) {
      setDomainMsg(`Erro: ${mapDomainError(error.message)}`);
      return;
    }

    setDomainMsg("Subdomínio salvo. Aguarde ativação de DNS/SSL para ficar ativo.");
    await carregarDominio();
  }

  async function salvarDominio(e: React.FormEvent) {
    e.preventDefault();
    setDomainSaving(true);
    setDomainMsg("");

    const { error } = await supabase.rpc("set_my_custom_domain", {
      p_domain: domainInput.trim().toLowerCase(),
    });

    setDomainSaving(false);

    if (error) {
      setDomainMsg(`Erro: ${mapDomainError(error.message)}`);
      return;
    }

    setDomainMsg("Domínio salvo. Configure DNS e aguarde ativação de SSL.");
    await carregarDominio();
  }

  async function limparDominio() {
    setDomainSaving(true);
    setDomainMsg("");

    const { error } = await supabase.rpc("clear_my_custom_domain");

    setDomainSaving(false);

    if (error) {
      setDomainMsg(`Erro: ${mapDomainError(error.message)}`);
      return;
    }

    setDomainMsg("Configuração de URL personalizada removida.");
    await carregarDominio();
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
            {assinatura.status === "trial" && assinatura.trial_ate && <span className="text-slate-500">Trial até {new Date(assinatura.trial_ate).toLocaleDateString("pt-BR")}</span>}
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
        <div className="space-y-5">
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

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
            <div>
              <h2 className="font-semibold">URL personalizada</h2>
              <p className="text-slate-500 mt-1">No plano Enterprise/Top: subdomínio da plataforma. No plano Supremo: domínio próprio do cliente.</p>
            </div>

            {domainMsg && (
              <div className={`rounded-md border px-3 py-2 text-sm ${domainMsg.startsWith("Erro") ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                {domainMsg}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500">Plano atual</div>
                <div className="text-slate-900 font-medium mt-1">{domainInfo?.plano_nome ?? assinatura?.planos?.nome ?? "—"}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500">Status do domínio</div>
                <div className="text-slate-900 font-medium mt-1">
                  {domainInfo?.dominio_status ?? "desativado"} / SSL: {domainInfo?.dominio_ssl_status ?? "pendente"}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <div className="text-slate-500">Recursos liberados no plano</div>
                <div className="text-slate-900 font-medium mt-1">
                  {(domainInfo?.allowed_subdomain ? "Subdomínio" : "")}
                  {domainInfo?.allowed_subdomain && domainInfo?.allowed_custom_domain ? " + " : ""}
                  {(domainInfo?.allowed_custom_domain ? "Domínio próprio" : "")}
                  {!domainInfo?.allowed_subdomain && !domainInfo?.allowed_custom_domain ? "Nenhum" : ""}
                </div>
              </div>
            </div>

            {domainInfo?.host_ativo ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-sm">
                Host ativo: <strong>{domainInfo.host_ativo}</strong>
              </div>
            ) : null}

            {!domainInfo?.allowed ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
                Recurso disponível apenas para plano Supremo/Top com assinatura ativa/trial.
              </div>
            ) : (
              <>
                {domainInfo?.allowed_subdomain && domainInfo?.allowed_custom_domain ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDomainMode("subdomain")}
                      className={`px-3 py-1.5 rounded-md border ${domainMode === "subdomain" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}
                    >
                      Subdomínio da plataforma
                    </button>
                    <button
                      type="button"
                      onClick={() => setDomainMode("domain")}
                      className={`px-3 py-1.5 rounded-md border ${domainMode === "domain" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}
                    >
                      Domínio próprio
                    </button>
                  </div>
                ) : null}

                {domainInfo?.allowed_subdomain && domainMode === "subdomain" ? (
                  <form onSubmit={salvarSubdominio} className="space-y-3">
                    <label className="block font-medium">Subdomínio</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full border border-slate-300 rounded-md px-3 py-2"
                        value={subdomainInput}
                        onChange={(e) => setSubdomainInput(e.target.value.toLowerCase())}
                        placeholder="minhaempresa"
                      />
                      <span className="text-slate-500">.{domainInfo?.base_domain ?? "masterfleetbr.com.br"}</span>
                    </div>
                    <button type="submit" disabled={domainSaving} className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 disabled:opacity-60">
                      {domainSaving ? "Salvando..." : "Salvar subdomínio"}
                    </button>
                  </form>
                ) : domainInfo?.allowed_custom_domain ? (
                  <form onSubmit={salvarDominio} className="space-y-3">
                    <label className="block font-medium">Domínio próprio</label>
                    <input
                      className="w-full border border-slate-300 rounded-md px-3 py-2"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value.toLowerCase())}
                      placeholder="app.suaempresa.com.br"
                    />
                    <button type="submit" disabled={domainSaving} className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 disabled:opacity-60">
                      {domainSaving ? "Salvando..." : "Salvar domínio"}
                    </button>
                  </form>
                ) : null}

                <div className="flex items-center gap-3">
                  <button type="button" onClick={limparDominio} disabled={domainSaving} className="text-red-700 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-60">
                    Remover URL personalizada
                  </button>
                  {domainInfo?.dominio_erro ? <span className="text-red-600 text-xs">Último erro: {domainInfo.dominio_erro}</span> : null}
                </div>
              </>
            )}
          </div>

        </div>
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
