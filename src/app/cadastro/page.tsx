"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

type CnpjData = {
  cnpj: string;
  nome_empresa: string;
  razao_social: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
};

export default function CadastroPage() {
  const router = useRouter();

  const [cnpj, setCnpj] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [telefoneEmpresa, setTelefoneEmpresa] = useState("");
  const [enderecoEmpresa, setEnderecoEmpresa] = useState("");
  const [cidadeEmpresa, setCidadeEmpresa] = useState("");
  const [estadoEmpresa, setEstadoEmpresa] = useState("");

  const [nomeAdmin, setNomeAdmin] = useState("");
  const [emailAdmin, setEmailAdmin] = useState("");
  const [senha, setSenha] = useState("");

  const [loadingBusca, setLoadingBusca] = useState(false);
  const [loadingCadastro, setLoadingCadastro] = useState(false);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");

  async function buscarCnpj() {
    setErro("");
    setInfo("");

    const digits = onlyDigits(cnpj);
    if (digits.length !== 14) {
      setErro("Informe um CNPJ válido com 14 dígitos.");
      return;
    }

    setLoadingBusca(true);

    try {
      const response = await fetch(`/api/cnpj/${digits}`, { cache: "no-store" });
      const data = (await response.json()) as CnpjData | { error?: string };

      if (!response.ok) {
        setErro((data as { error?: string })?.error ?? "Não foi possível consultar o CNPJ.");
        setLoadingBusca(false);
        return;
      }

      const payload = data as CnpjData;
      setNomeEmpresa(payload.nome_empresa || payload.razao_social || "");
      setEmailEmpresa(payload.email || "");
      setTelefoneEmpresa(payload.telefone || "");
      setEnderecoEmpresa(payload.endereco || "");
      setCidadeEmpresa(payload.cidade || "");
      setEstadoEmpresa(payload.estado || "");

      setInfo("Dados da empresa preenchidos automaticamente. Revise e continue.");
    } catch {
      setErro("Falha ao consultar CNPJ. Tente novamente em instantes.");
    } finally {
      setLoadingBusca(false);
    }
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoadingCadastro(true);
    setErro("");
    setInfo("");

    const cnpjDigits = onlyDigits(cnpj);
    if (cnpjDigits.length !== 14) {
      setErro("Informe um CNPJ válido para continuar.");
      setLoadingCadastro(false);
      return;
    }

    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Configuração do Supabase ausente no frontend");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/public-signup-empresa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          nome_empresa: nomeEmpresa.trim(),
          nome_admin: nomeAdmin.trim(),
          email_admin: emailAdmin.trim().toLowerCase(),
          senha,
          cnpj: cnpjDigits,
          telefone: telefoneEmpresa.trim() || null,
          email_empresa: emailEmpresa.trim() || null,
          endereco: enderecoEmpresa.trim() || null,
          cidade: cidadeEmpresa.trim() || null,
          estado: estadoEmpresa.trim().toUpperCase() || null,
        }),
      });

      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !data?.ok) {
        const mensagem = data?.error ?? `Falha ao concluir cadastro (HTTP ${response.status})`;
        setErro(`Erro ao criar empresa: ${mensagem}`);
        setLoadingCadastro(false);
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: emailAdmin.trim().toLowerCase(),
        password: senha,
      });

      if (loginError) {
        setErro(`Cadastro concluído, mas não foi possível autenticar agora: ${loginError.message}`);
        setLoadingCadastro(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoadingCadastro(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-sm text-slate-300 hover:text-white transition">
          ← Voltar
        </Link>

        <form
          onSubmit={handleCadastro}
          className="mt-4 bg-slate-900/80 border border-slate-700 rounded-2xl p-6 text-slate-100 shadow-2xl"
        >
          <h1 className="text-2xl font-bold tracking-tight">Comece seu teste grátis</h1>
          <p className="text-sm text-slate-300 mt-1">
            Digite o CNPJ para preencher automaticamente os dados da empresa. Sua conta inicia em trial no plano Supremo (conforme política do painel master).
          </p>

          {erro && (
            <div className="mt-4 text-sm bg-red-500/20 border border-red-400/50 rounded-xl p-3 text-red-200">
              {erro}
            </div>
          )}

          {info && (
            <div className="mt-4 text-sm bg-emerald-500/20 border border-emerald-400/50 rounded-xl p-3 text-emerald-200">
              {info}
            </div>
          )}

          <div className="mt-5 space-y-5">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">1) Empresa</h2>

              <div className="grid md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-slate-200">CNPJ</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                    type="text"
                    placeholder="00.000.000/0000-00"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={buscarCnpj}
                  disabled={loadingBusca}
                  className="rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 text-sm disabled:opacity-60 transition"
                >
                  {loadingBusca ? "Buscando..." : "Buscar CNPJ"}
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-200">Nome da empresa</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200">E-mail da empresa</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={emailEmpresa}
                    onChange={(e) => setEmailEmpresa(e.target.value)}
                    type="email"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200">Telefone</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={telefoneEmpresa}
                    onChange={(e) => setTelefoneEmpresa(e.target.value)}
                    type="text"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200">Endereço</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={enderecoEmpresa}
                    onChange={(e) => setEnderecoEmpresa(e.target.value)}
                    type="text"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200">Cidade</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={cidadeEmpresa}
                    onChange={(e) => setCidadeEmpresa(e.target.value)}
                    type="text"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200">UF</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 uppercase"
                    value={estadoEmpresa}
                    onChange={(e) => setEstadoEmpresa(e.target.value.toUpperCase())}
                    maxLength={2}
                    type="text"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">2) Administrador do sistema</h2>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-200">Nome</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={nomeAdmin}
                    onChange={(e) => setNomeAdmin(e.target.value)}
                    type="text"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200">E-mail</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={emailAdmin}
                    onChange={(e) => setEmailAdmin(e.target.value)}
                    type="email"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200">Senha</label>
                  <input
                    className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    type="password"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            </section>

            <button
              disabled={loadingCadastro}
              className="w-full rounded-xl bg-emerald-600 text-white font-semibold py-2.5 text-sm disabled:opacity-60 hover:bg-emerald-500 transition"
              type="submit"
            >
              {loadingCadastro ? "Criando empresa..." : "Criar empresa e iniciar trial"}
            </button>
          </div>

          <p className="mt-4 text-center text-sm text-slate-300">
            Já tem conta?{" "}
            <Link href="/login" className="text-sky-300 font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
