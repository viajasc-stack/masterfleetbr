"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function CadastroPage() {
  const router = useRouter();
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");

    try {
      // 1) Cria usuário no Auth
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
      });

      if (authError) {
        setErro(authError.message);
        setLoading(false);
        return;
      }

      // 2) Garante que existe sessão (alguns projetos exigem login após signUp)
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      // 3) Cria empresa + profile + assinatura trial 7 dias
      const { error: rpcError } = await supabase.rpc(
        "criar_empresa_e_profile",
        {
          p_nome_empresa: nomeEmpresa.trim(),
          p_nome_usuario: nomeUsuario.trim(),
        }
      );

      if (rpcError) {
        setErro("Erro ao criar empresa: " + rpcError.message);
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">
          ← Voltar
        </Link>

        <form
          onSubmit={handleCadastro}
          className="mt-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-white"
        >
          <h1 className="text-xl font-bold">Teste grátis por 7 dias</h1>
          <p className="text-sm text-slate-400 mt-1">
            Crie sua conta e comece a usar o MasterFleetBR
          </p>

          {erro && (
            <div className="mt-4 text-sm bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-400">
              {erro}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-xs text-slate-400">Nome da empresa</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                type="text"
                placeholder="Minha Transportadora"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Seu nome</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
                value={nomeUsuario}
                onChange={(e) => setNomeUsuario(e.target.value)}
                type="text"
                placeholder="João Silva"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">E-mail</label>
              <input
                className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="seuemail@empresa.com"
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
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-emerald-600 text-white font-semibold py-2 text-sm disabled:opacity-60 hover:bg-emerald-500 transition"
              type="submit"
            >
              {loading ? "Criando conta..." : "Começar teste grátis"}
            </button>
          </div>

          <p className="mt-4 text-center text-sm text-slate-500">
            Já tem conta?{" "}
            <Link href="/login" className="text-sky-400 hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
