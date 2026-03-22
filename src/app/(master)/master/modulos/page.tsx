"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ModuloGlobal = {
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  updated_at: string;
};

export default function MasterModulosPage() {
  const [loading, setLoading] = useState(true);
  const [savingCodigo, setSavingCodigo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [modulos, setModulos] = useState<ModuloGlobal[]>([]);

  async function carregar() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase.rpc("master_list_modulos_globais");
    if (error) {
      setMsg(error.message);
      setModulos([]);
      setLoading(false);
      return;
    }
    setModulos((data ?? []) as ModuloGlobal[]);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function toggleModulo(m: ModuloGlobal) {
    setSavingCodigo(m.codigo);
    setMsg("");

    const { error } = await supabase.rpc("master_set_modulo_global", {
      p_codigo: m.codigo,
      p_ativo: !m.ativo,
    });

    setSavingCodigo(null);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(`Módulo ${m.nome} ${m.ativo ? "desativado" : "ativado"} globalmente.`);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Módulos globais</h1>
        <p className="text-slate-600 text-sm mt-1">
          Controle mestre: quando desativado aqui, o módulo some para <strong>todas</strong> as empresas, independente do plano.
        </p>
      </div>

      {msg ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando módulos...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 text-slate-500">Módulo</th>
                <th className="px-4 py-3 text-slate-500">Descrição</th>
                <th className="px-4 py-3 text-slate-500">Status global</th>
                <th className="px-4 py-3 text-slate-500">Ação</th>
              </tr>
            </thead>
            <tbody>
              {modulos.map((m) => (
                <tr key={m.codigo} className="border-b border-slate-200 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.nome}</div>
                    <div className="text-xs text-slate-500">{m.codigo}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{m.descricao || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded border ${m.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-rose-200 text-rose-700 bg-rose-50"}`}>
                      {m.ativo ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleModulo(m)}
                      disabled={savingCodigo === m.codigo}
                      className={`px-3 py-1.5 rounded-md text-xs border ${m.ativo ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"} disabled:opacity-60`}
                    >
                      {savingCodigo === m.codigo ? "Salvando..." : m.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
