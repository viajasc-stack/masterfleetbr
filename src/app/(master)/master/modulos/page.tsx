"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type ModuloSistema = {
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  ativo: boolean;
  updated_at: string;
};

export default function MasterModulosPage() {
  const [loading, setLoading] = useState(true);
  const [savingCodigo, setSavingCodigo] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);

  async function carregar() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase
      .from("modulos_globais")
      .select("codigo, nome, descricao, preco_centavos, ativo, updated_at")
      .not("codigo", "in", "(dashboard,ordens_servico,clientes,veiculos,motoristas)")
      .order("ordem")
      .order("nome");

    if (error) {
      setMsg(error.message);
      setModulos([]);
      setLoading(false);
      return;
    }
    setModulos((data ?? []) as ModuloSistema[]);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function toggleModulo(m: ModuloSistema) {
    setSavingCodigo(m.codigo);
    setMsg("");

    const { error } = await supabase
      .from("modulos_globais")
      .update({ ativo: !m.ativo })
      .eq("codigo", m.codigo);

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
        <h1 className="text-2xl font-semibold text-slate-900">Módulos do sistema</h1>
        <p className="text-slate-600 text-sm mt-1">
          Catálogo de módulos exibido no painel e preparado para uso na Central de Negócios.
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
              <tr className="border-b border-slate-200 text-left bg-slate-50">
                <th className="px-4 py-3 text-slate-500">Nome</th>
                <th className="px-4 py-3 text-slate-500">Status</th>
                <th className="px-4 py-3 text-slate-500">Valor</th>
                <th className="px-4 py-3 text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {modulos.map((m) => (
                <tr key={m.codigo} className="border-b border-slate-200 last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/master/modulos/${m.codigo}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                      {m.nome}
                    </Link>
                    <div className="text-xs text-slate-500">{m.codigo}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded border ${m.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-rose-200 text-rose-700 bg-rose-50"}`}>
                      {m.ativo ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {(Number(m.preco_centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleModulo(m)}
                        disabled={savingCodigo === m.codigo}
                        className={`px-3 py-1.5 rounded-md text-xs border ${m.ativo ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"} disabled:opacity-60`}
                      >
                        {savingCodigo === m.codigo ? "Salvando..." : m.ativo ? "Inativar" : "Ativar"}
                      </button>
                      <Link
                        href={`/master/modulos/${m.codigo}`}
                        className="px-3 py-1.5 rounded-md text-xs border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </Link>
                    </div>
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
