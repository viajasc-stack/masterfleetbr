"use client";

import { Suspense, useState } from "react";
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

  const msg = searchParams.get("logout") ? "Você saiu do sistema." : null;

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Voltar
        </Link>

        <form
          onSubmit={handleLogin}
          className="mt-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-white"
        >
          <h1 className="text-xl font-bold">Entrar</h1>
          <p className="text-sm text-slate-400 mt-1">
            Acesse o MasterFleetBR
          </p>

          {msg && (
            <div className="mt-4 text-sm bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-3 text-emerald-400">
              {msg}
            </div>
          )}

          {erro && (
            <div className="mt-4 text-sm bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-400">
              {erro}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs text-slate-400">E-mail ou CPF</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                type="text"
                placeholder="seuemail@empresa.com ou CPF"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Senha</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-white text-slate-900 font-semibold py-2 text-sm disabled:opacity-60 hover:bg-slate-100 transition"
              type="submit"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>

          <p className="mt-4 text-center text-sm text-slate-500">
            Não tem conta?{" "}
            <Link href="/cadastro" className="text-sky-400 hover:underline">
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
