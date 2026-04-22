"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type ModuloSistema = {
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco_centavos: number;
  ativo: boolean;
  venda_ativa: boolean;
  ordem: number | null;
  metadata: Record<string, unknown> | null;
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
      .select("codigo, nome, descricao, categoria, preco_centavos, ativo, venda_ativa, ordem, metadata, updated_at")
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

  const resumo = useMemo(() => ({
    total: modulos.length,
    ativos: modulos.filter((m) => m.ativo).length,
    vendaAtiva: modulos.filter((m) => m.venda_ativa).length,
  }), [modulos]);

  async function toggleFlag(m: ModuloSistema, field: "ativo" | "venda_ativa") {
    setSavingCodigo(m.codigo);
    setMsg("");

    const { error } = await supabase
      .from("modulos_globais")
      .update({
        [field]: field === "ativo" ? !m.ativo : !m.venda_ativa,
      })
      .eq("codigo", m.codigo);

    setSavingCodigo(null);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      field === "ativo"
        ? `Módulo ${m.nome} ${m.ativo ? "desativado" : "ativado"} globalmente.`
        : `Módulo ${m.nome} ${m.venda_ativa ? "retirado da venda" : "liberado para venda"}.`,
    );
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Módulos do sistema</h1>
        <p className="text-slate-600 text-sm mt-1">
          Listagem completa dos módulos disponíveis no MasterFleetBR.
        </p>
      </div>

      {msg ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      ) : null}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Total de módulos</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{resumo.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-xs text-emerald-700">Ativos globalmente</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{resumo.ativos}</div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="text-xs text-indigo-700">Disponíveis para venda</div>
          <div className="text-2xl font-bold text-indigo-900 mt-1">{resumo.vendaAtiva}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando módulos...</div>
        ) : modulos.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum módulo encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left bg-slate-50">
                <th className="px-4 py-3 text-slate-500">Nome</th>
                <th className="px-4 py-3 text-slate-500">Categoria</th>
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
                    {m.metadata?.descricao_resumida ? (
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2">{String(m.metadata.descricao_resumida)}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700 capitalize">
                    {m.categoria || "geral"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`text-xs px-2 py-1 rounded border ${m.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-rose-200 text-rose-700 bg-rose-50"}`}>
                        {m.ativo ? "Ativo" : "Desativado"}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded border ${m.venda_ativa ? "border-indigo-200 text-indigo-700 bg-indigo-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                        {m.venda_ativa ? "À venda" : "Fora de venda"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {(Number(m.preco_centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFlag(m, "ativo")}
                        disabled={savingCodigo === m.codigo}
                        className={`px-3 py-1.5 rounded-md text-xs border ${m.ativo ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"} disabled:opacity-60`}
                      >
                        {savingCodigo === m.codigo ? "Salvando..." : m.ativo ? "Inativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFlag(m, "venda_ativa")}
                        disabled={savingCodigo === m.codigo}
                        className={`px-3 py-1.5 rounded-md text-xs border ${m.venda_ativa ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"} disabled:opacity-60`}
                      >
                        {savingCodigo === m.codigo ? "Salvando..." : m.venda_ativa ? "Retirar venda" : "Liberar venda"}
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
