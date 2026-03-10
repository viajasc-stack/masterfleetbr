"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const msg = searchParams.get("logout") ? "Você saiu do sistema." : null;

  useEffect(() => {
    async function carregarBranding() {
      const { data } = await supabase.rpc("get_public_branding");
      const branding = (data ?? null) as { logo_url?: string | null } | null;
      setLogoUrl(branding?.logo_url ?? null);
    }
    const t = setTimeout(() => {
      void carregarBranding();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");

    const entrada = identificador.trim().toLowerCase();
    const cpfDigits = entrada.replace(/\D/g, "");
    const emailParaLogin = entrada.includes("@") ? entrada : `${cpfDigits}@motorista.masterfleet.local`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailParaLogin,
      password: senha,
    });

    setLoading(false);

    if (error) {
      setErro(error.message);
      return;
    }

    if (data.session?.user) {
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
      router.replace(isSuperAdmin ? "/master" : "/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-sm text-slate-300 hover:text-white transition"
        >
          ← Voltar
        </Link>

        <form
          onSubmit={handleLogin}
          className="mt-4 bg-slate-900/80 border border-slate-700 rounded-2xl p-6 text-slate-100 shadow-2xl backdrop-blur"
        >
          <div className="mb-5 flex items-center justify-center min-h-[192px]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="max-h-40 w-auto object-contain" />
            ) : (
              <span className="text-base font-semibold tracking-tight text-slate-200">MasterFleetBR</span>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="text-sm text-slate-300 mt-1">
            Acesse o MasterFleetBR
          </p>

          {msg && (
            <div className="mt-4 text-sm bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-3 text-emerald-400">
              {msg}
            </div>
          )}

          {erro && (
            <div className="mt-4 text-sm bg-red-500/20 border border-red-400/50 rounded-xl p-3 text-red-200">
              {erro}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-200">E-mail ou CPF</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                type="text"
                placeholder="seuemail@empresa.com ou CPF"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-200">Senha</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-sky-500 text-white font-semibold py-2.5 text-sm disabled:opacity-60 hover:bg-sky-400 transition"
              type="submit"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>

          <p className="mt-4 text-center text-sm text-slate-300">
            Não tem conta?{" "}
            <Link href="/cadastro" className="text-sky-300 font-medium hover:underline">
              Cadastre-se grátis
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Carregando…
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
