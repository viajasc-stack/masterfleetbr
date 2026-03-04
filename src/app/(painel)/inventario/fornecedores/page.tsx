"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";

type Fornecedor = {
  id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
};

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"ativos" | "inativos" | "todos">("ativos");

  const [novoOpen, setNovoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome: "", documento: "", email: "", telefone: "", observacoes: "", ativo: true });
  const [editTarget, setEditTarget] = useState<Fornecedor | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Fornecedor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
    if (error) setErro(error.message);
    setFornecedores((data as Fornecedor[]) ?? []);
    setSelectedIds((prev) => prev.filter((id) => (data as Fornecedor[] | null)?.some((f) => f.id === id)));
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return fornecedores
      .filter((f) => filtroAtivo === "todos" ? true : filtroAtivo === "ativos" ? f.ativo : !f.ativo)
      .filter((f) => !q || [f.nome, f.documento ?? "", f.email ?? "", f.telefone ?? ""].join(" ").toLowerCase().includes(q));
  }, [fornecedores, busca, filtroAtivo]);

  const allFilteredSelected =
    filtrados.length > 0 && filtrados.every((f) => selectedIds.includes(f.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...filtrados.map((f) => f.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !filtrados.some((f) => f.id === id)));
  }

  async function salvarNovo(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("fornecedores").insert({
      nome: form.nome.trim(),
      documento: form.documento.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      observacoes: form.observacoes.trim() || null,
      ativo: form.ativo,
    });
    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNovoOpen(false);
    setForm({ nome: "", documento: "", email: "", telefone: "", observacoes: "", ativo: true });
    await carregar();
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !form.nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("fornecedores").update({
      nome: form.nome.trim(),
      documento: form.documento.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      observacoes: form.observacoes.trim() || null,
      ativo: form.ativo,
    }).eq("id", editTarget.id);
    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEditTarget(null);
    setForm({ nome: "", documento: "", email: "", telefone: "", observacoes: "", ativo: true });
    await carregar();
  }

  async function toggleAtivo(item: Fornecedor) {
    const { error } = await supabase.from("fornecedores").update({ ativo: !item.ativo }).eq("id", item.id);
    if (error) {
      setErro(error.message);
      return;
    }
    await carregar();
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("fornecedores").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setDeleteTarget(null);
    await carregar();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("fornecedores").delete().in("id", selectedIds);
    setDeleting(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores para compras e entradas de estoque."
        actions={
          <>
            <button onClick={() => setNovoOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Novo Fornecedor
            </button>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </>
        }
      />

      {erro ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div> : null}

      {novoOpen && (
        <form onSubmit={salvarNovo} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
          <h2 className="font-semibold">Novo fornecedor</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Nome *</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
            </div>
            <div>
              <label className="block font-medium mb-1">Documento</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.documento} onChange={(e) => set("documento", e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">E-mail</label>
              <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">Telefone</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Observações</label>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
            <span>Fornecedor ativo</span>
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={() => setNovoOpen(false)} className="border border-slate-300 px-5 py-2 rounded-md hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {editTarget && (
        <form onSubmit={salvarEdicao} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
          <h2 className="font-semibold">Editar fornecedor</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Nome *</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
            </div>
            <div>
              <label className="block font-medium mb-1">Documento</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.documento} onChange={(e) => set("documento", e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">E-mail</label>
              <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">Telefone</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Observações</label>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
            <span>Fornecedor ativo</span>
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button type="button" onClick={() => setEditTarget(null)} className="border border-slate-300 px-5 py-2 rounded-md hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, documento, e-mail..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroAtivo} onChange={(e) => setFiltroAtivo(e.target.value as "ativos" | "inativos" | "todos")}>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Selecionados: {selectedIds.length}</span>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
            className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Excluir selecionados
          </button>
        </div>

        {loading ? (
          <div className="text-slate-600 text-sm">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-slate-600 text-sm">Nenhum fornecedor encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => toggleSelecionarTodosFiltrados(e.target.checked)}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Documento</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(f.id)}
                        onChange={(e) => toggleSelecionado(f.id, e.target.checked)}
                        aria-label={`Selecionar fornecedor ${f.nome}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">{f.nome}</td>
                    <td className="py-2 pr-4 text-slate-500">{f.documento ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{f.email || f.telefone || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs border ${f.ativo ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-600 bg-slate-50"}`}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditTarget(f);
                          setForm({
                            nome: f.nome,
                            documento: f.documento ?? "",
                            email: f.email ?? "",
                            telefone: f.telefone ?? "",
                            observacoes: f.observacoes ?? "",
                            ativo: f.ativo,
                          });
                        }}
                        className="px-2 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button onClick={() => toggleAtivo(f)} className="px-2 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50">
                        {f.ativo ? "Desativar" : "Ativar"}
                      </button>
                      <button onClick={() => setDeleteTarget(f)} className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50">
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link href="/inventario" className="text-sm text-slate-400 hover:text-white">← Voltar ao Inventário</Link>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={`Deseja excluir o fornecedor "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir fornecedores selecionados"
        description={`Deseja excluir ${selectedIds.length} fornecedor(es) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />
    </div>
  );
}
