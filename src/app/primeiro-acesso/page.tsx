"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function PrimeiroAcessoPage() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (senha.length < 6) {
      setErro("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
        data: { must_change_password: false },
      });

      if (error) {
        setErro(error.message);
        return;
      }

      // Garante sessão atualizada para o AuthGate não manter metadado antigo em cache
      await supabase.auth.refreshSession();

      // Redirecionamento imediato sem depender do ciclo do router
      if (typeof window !== "undefined") {
        window.location.replace("/dashboard");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao atualizar senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <form
        onSubmit={salvar}
        className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-white"
      >
        <h1 className="text-xl font-bold">Primeiro acesso</h1>
        <p className="text-sm text-slate-400 mt-1">
          Para continuar, você precisa definir uma nova senha.
        </p>

        {erro && (
          <div className="mt-4 text-sm bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-400">
            {erro}
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs text-slate-400">Nova senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">Confirmar nova senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-white text-slate-900 font-semibold py-2 text-sm disabled:opacity-60 hover:bg-slate-100 transition"
          >
            {loading ? "Salvando..." : "Alterar senha e continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
