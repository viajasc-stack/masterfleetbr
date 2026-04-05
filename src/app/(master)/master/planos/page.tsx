"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ModuloCatalogo = {
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  preco_centavos: number;
  ordem: number;
  ativo: boolean;
  venda_ativa: boolean;
};

function slug(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function MasterPlanosPage() {
  const [modulos, setModulos] = useState<ModuloCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);

  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    categoria: "operacional",
    preco: "",
    ordem: "",
    ativo: true,
    venda_ativa: true,
  });

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase.rpc("master_list_modulos_catalogo");
    if (error) {
      setMsg(error.message);
      setModulos([]);
      setLoading(false);
      return;
    }
    setModulos((data as ModuloCatalogo[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const resumo = useMemo(() => ({
    total: modulos.length,
    ativos: modulos.filter((m) => m.ativo).length,
    vendaAtiva: modulos.filter((m) => m.venda_ativa).length,
  }), [modulos]);

  async function salvarModulo() {
    if (!form.nome.trim()) return;
    setSaving(true);
    setMsg("");

    const { error } = await supabase.rpc("master_save_modulo_catalogo", {
      p_codigo: slug(form.codigo || form.nome),
      p_nome: form.nome.trim(),
      p_descricao: form.descricao.trim() || null,
      p_categoria: form.categoria.trim() || "operacional",
      p_preco_centavos: form.preco ? Math.round(Number(form.preco) * 100) : 0,
      p_ordem: form.ordem ? Math.trunc(Number(form.ordem)) : 0,
      p_ativo: form.ativo,
      p_venda_ativa: form.venda_ativa,
    });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(editingCodigo ? "Módulo atualizado com sucesso." : "Módulo salvo com sucesso.");
    setEditingCodigo(null);
    setForm({ codigo: "", nome: "", descricao: "", categoria: "operacional", preco: "", ordem: "", ativo: true, venda_ativa: true });
    await carregar();
  }

  async function toggleFlag(modulo: ModuloCatalogo, field: "ativo" | "venda_ativa") {
    const { error } = await supabase.rpc("master_save_modulo_catalogo", {
      p_codigo: modulo.codigo,
      p_nome: modulo.nome,
      p_descricao: modulo.descricao,
      p_categoria: modulo.categoria,
      p_preco_centavos: modulo.preco_centavos,
      p_ordem: modulo.ordem,
      p_ativo: field === "ativo" ? !modulo.ativo : modulo.ativo,
      p_venda_ativa: field === "venda_ativa" ? !modulo.venda_ativa : modulo.venda_ativa,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    await carregar();
  }

  function editarModulo(modulo: ModuloCatalogo) {
    setEditingCodigo(modulo.codigo);
    setForm({
      codigo: modulo.codigo,
      nome: modulo.nome,
      descricao: modulo.descricao ?? "",
      categoria: modulo.categoria ?? "operacional",
      preco: String((modulo.preco_centavos ?? 0) / 100),
      ordem: String(modulo.ordem ?? 0),
      ativo: modulo.ativo,
      venda_ativa: modulo.venda_ativa,
    });
    setMsg("");
  }

  const moeda = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Catálogo comercial de módulos</h1>
        <p className="text-slate-600 text-sm mt-0.5">Gerencie preços, categorias e disponibilidade dos módulos vendidos individualmente.</p>
        <p className="text-slate-500 text-sm mt-2">
          Use <strong>Operacional</strong> como módulo padrão da operação e trate estoque, financeiro, manutenção, oficina, agenda e demais recursos como módulos avulsos com preços próprios.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Total de módulos</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{resumo.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-xs text-emerald-700">Ativos</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{resumo.ativos}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-xs text-amber-700">Vendáveis</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{resumo.vendaAtiva}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Código</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="basico" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome *</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Básico" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Categoria</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} placeholder="operacional" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Preço mensal (R$)</label>
            <input type="number" step="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.preco} onChange={(e) => setForm((p) => ({ ...p, preco: e.target.value }))} placeholder="99.00" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Descrição</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Plano ideal para começar" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Ordem</label>
            <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.ordem} onChange={(e) => setForm((p) => ({ ...p, ordem: e.target.value }))} placeholder="10" />
          </div>
          <div className="flex items-center gap-6 md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} />
              Ativo globalmente
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.venda_ativa} onChange={(e) => setForm((p) => ({ ...p, venda_ativa: e.target.checked }))} />
              Disponível para venda
            </label>
          </div>
        </div>

        <div>
          <button onClick={salvarModulo} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Salvando..." : editingCodigo ? "Atualizar módulo" : "Salvar módulo"}
          </button>
          {editingCodigo ? (
            <button
              onClick={() => {
                setEditingCodigo(null);
                setForm({ codigo: "", nome: "", descricao: "", categoria: "operacional", preco: "", ordem: "", ativo: true, venda_ativa: true });
              }}
              className="ml-2 px-4 py-2 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar edição
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Carregando...</div>
        ) : modulos.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">Nenhum módulo cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 text-slate-500">Módulo</th>
                <th className="px-4 py-3 text-slate-500">Categoria</th>
                <th className="px-4 py-3 text-slate-500">Preço</th>
                <th className="px-4 py-3 text-slate-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {modulos.map((m) => {
                return (
                  <tr key={m.codigo} className="border-b border-slate-200 hover:bg-slate-50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{m.nome}</div>
                      <div className="text-xs text-slate-500">{m.codigo}</div>
                      {m.descricao ? <div className="text-xs text-slate-500 mt-1">{m.descricao}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{m.categoria}</td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{moeda(Number(m.preco_centavos || 0))}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2 items-start">
                        <span className={`text-xs px-2 py-1 rounded border ${m.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                          {m.ativo ? "Ativo global" : "Inativo global"}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded border ${m.venda_ativa ? "border-indigo-200 text-indigo-700 bg-indigo-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                          {m.venda_ativa ? "À venda" : "Fora de venda"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => editarModulo(m)} className="text-xs text-indigo-700 hover:text-indigo-900 underline">
                          Editar
                        </button>
                        <button onClick={() => toggleFlag(m, "ativo")} className="text-xs text-slate-600 hover:text-slate-900 underline">
                          {m.ativo ? "Desativar global" : "Ativar global"}
                        </button>
                        <button onClick={() => toggleFlag(m, "venda_ativa")} className="text-xs text-amber-700 hover:text-amber-900 underline">
                          {m.venda_ativa ? "Retirar da venda" : "Liberar venda"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
