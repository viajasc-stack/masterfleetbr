"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type EmpresaRecorrenteConfig = {
  id: string;
  fretamento_recorrente_auto_geracao_ativo: boolean;
  fretamento_recorrente_auto_limiar_dias: number;
  fretamento_recorrente_auto_janela_dias: number;
};

export default function ConfiguracoesFretamentoRecorrentePage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        setMsg("Sessão não encontrada.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const empId = profile?.empresa_id ?? null;
      setEmpresaId(empId);

      if (!empId) {
        setMsg("Usuário sem empresa vinculada.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("empresas")
        .select("id, fretamento_recorrente_auto_geracao_ativo, fretamento_recorrente_auto_limiar_dias, fretamento_recorrente_auto_janela_dias")
        .eq("id", empId)
        .maybeSingle();

      if (error || !data) {
        setMsg(`Erro ao carregar configuração: ${error?.message ?? "empresa não encontrada"}`);
        setLoading(false);
        return;
      }

      const e = data as EmpresaRecorrenteConfig;
      setAtivo(Boolean(e.fretamento_recorrente_auto_geracao_ativo));
      setLoading(false);
    }

    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) return;

    setSaving(true);
    setMsg("");

    const { error } = await supabase
      .from("empresas")
      .update({
        fretamento_recorrente_auto_geracao_ativo: ativo,
        // Mantém regra fixa solicitada (limiar=2, janela=7)
        fretamento_recorrente_auto_limiar_dias: 2,
        fretamento_recorrente_auto_janela_dias: 7,
      })
      .eq("id", empresaId);

    setSaving(false);

    if (error) {
      setMsg(`Erro ao salvar: ${error.message}`);
      return;
    }

    setMsg("Configuração de fretamento recorrente salva com sucesso.");
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando configurações...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configurações • Fretamento Recorrente</h1>
        <p className="text-slate-600 text-sm mt-0.5">
          Controle a geração automática de OS dos contratos recorrentes.
        </p>
      </div>

      {msg ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.startsWith("Erro")
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {msg}
        </div>
      ) : null}

      <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Geração automática de OS</h2>
            <p className="text-sm text-slate-600 mt-1">
              Quando faltar 2 dias para acabar a programação já gerada de um contrato recorrente,
              o sistema gera automaticamente mais 7 dias à frente.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 whitespace-nowrap">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Regras aplicadas: limiar fixo <strong>2 dias</strong>, janela de geração <strong>7 dias</strong>,
          sempre respeitando vigência do contrato e gerando uma OS por horário válido.
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
      </form>
    </div>
  );
}
