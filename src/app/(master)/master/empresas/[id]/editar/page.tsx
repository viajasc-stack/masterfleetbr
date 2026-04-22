"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ModuloCatalogo = {
  codigo: string;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  preco_centavos: number;
  ativo: boolean;
  venda_ativa: boolean;
};

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
  billing_model?: string | null;
};

const STATUS_OPTIONS = ["trial", "ativa", "past_due", "bloqueada", "cancelada"];

export default function MasterEmpresaEditarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [modulosCatalogo, setModulosCatalogo] = useState<ModuloCatalogo[]>([]);
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([]);

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
        modulos_catalogo: ModuloCatalogo[];
        empresa_modulos: string[];
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

      setModulosCatalogo(payload.modulos_catalogo ?? []);
      setModulosSelecionados(payload.empresa_modulos ?? []);
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
      p_plano_id: null,
      p_modulos: modulosSelecionados,
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

  function toggleModulo(codigo: string) {
    const base = ["operacional"];
    if (base.includes(codigo)) return;
    setModulosSelecionados((prev) => prev.includes(codigo) ? prev.filter((m) => m !== codigo) : [...prev, codigo]);
  }

  const valorMensal = modulosCatalogo
    .filter((m) => modulosSelecionados.includes(m.codigo))
    .reduce((sum, modulo) => sum + (modulo.preco_centavos ?? 0), 0);

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
              <label className="block text-slate-600 mb-1">Modelo comercial</label>
              <div className="w-full border border-slate-200 rounded-md px-3 py-2 bg-slate-50 text-slate-700">Modular</div>
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
          <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            Valor mensal estimado pelos módulos ativos: <strong>{(valorMensal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Módulos da empresa</h2>
          <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            <strong>Operacional</strong> é o módulo padrão e reúne dashboard, OS, veículos, motoristas, fretamentos, contratos e clientes.
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {modulosCatalogo.map((modulo) => {
              const ativo = modulosSelecionados.includes(modulo.codigo);
              const base = ["operacional"].includes(modulo.codigo);
              return (
                <button
                  key={modulo.codigo}
                  type="button"
                  onClick={() => toggleModulo(modulo.codigo)}
                  disabled={base || !modulo.ativo}
                  className={`text-left rounded-lg border px-4 py-3 transition ${ativo ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"} disabled:opacity-70`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{modulo.nome}</div>
                      <div className="text-xs text-slate-500 mt-1">{modulo.descricao ?? modulo.codigo}</div>
                      <div className="text-xs text-slate-500 mt-1">{modulo.categoria} • {(modulo.preco_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês</div>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded border ${ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                      {base ? "Base" : ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </button>
              );
            })}
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
