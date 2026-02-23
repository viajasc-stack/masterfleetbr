"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(false);
  const [empresaNome, setEmpresaNome] = useState("Minha Empresa");
  const [usuarioNome, setUsuarioNome] = useState("Administrador");
  const [status, setStatus] = useState<string>("");

  async function carregarStatus() {
    setStatus("Verificando seu vínculo...");
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setStatus("Você não está logado. Vá para /login.");
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("user_id, empresa_id, nome, role")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();

    if (error) {
      setStatus("Erro ao ler profiles: " + error.message);
      return;
    }

    if (!profile) {
      setStatus("✅ Você está logado, mas ainda NÃO tem empresa vinculada.");
      return;
    }

    setStatus(
      `✅ Profile OK. Empresa vinculada: ${profile.empresa_id} | Role: ${profile.role}`
    );
  }

  async function criarEmpresaEProfile() {
    setLoading(true);
    setStatus("Criando empresa + profile (RPC)...");
    try {
      const { data, error } = await supabase.rpc("criar_empresa_e_profile", {
        nome_empresa: empresaNome,
        nome_usuario: usuarioNome,
      });

      if (error) {
        setStatus("Erro na RPC: " + error.message);
        return;
      }

      setStatus("✅ Empresa criada com sucesso! ID: " + data);
      await carregarStatus();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-slate-600 mt-1">
          Teste de multiempresa (RLS + RPC).
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="text-sm text-slate-700 whitespace-pre-wrap">
          {status || "—"}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nome da empresa
            </label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={empresaNome}
              onChange={(e) => setEmpresaNome(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nome do usuário (profile)
            </label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={usuarioNome}
              onChange={(e) => setUsuarioNome(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={criarEmpresaEProfile}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
        >
          {loading ? "Criando..." : "Criar empresa + profile (trial 7 dias)"}
        </button>

        <button
          onClick={carregarStatus}
          className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
        >
          Recarregar status
        </button>
      </div>
    </div>
  );
}