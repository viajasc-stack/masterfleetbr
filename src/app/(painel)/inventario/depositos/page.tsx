"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Deposito = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
};

export default function DepositosPage() {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [criando, setCriando] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Deposito | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  async function carregar() {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase.from("depositos").select("*").order("nome");
    setTimeout(() => {
      setDepositos((data as Deposito[]) ?? []);
      setSelectedIds((prev) => prev.filter((id) => (data as Deposito[] | null)?.some((d) => d.id === id)));
      if (error) setLoadError(error.message);
      setLoading(false);
    }, 0);
  }

  const allSelected = depositos.length > 0 && depositos.every((d) => selectedIds.includes(d.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodos(checked: boolean) {
    if (checked) {
      setSelectedIds(depositos.map((d) => d.id));
      return;
    }
    setSelectedIds([]);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  async function criar() {
    if (!formNome.trim()) return;
    setSaving(true);
    await supabase.from("depositos").insert({ nome: formNome.trim(), descricao: formDesc.trim() || null, ativo: true });
    setFormNome(""); setFormDesc(""); setCriando(false); setSaving(false);
    carregar();
  }

  async function salvarEdicao(id: string) {
    if (!novoNome.trim()) return;
    setSaving(true);
    await supabase.from("depositos").update({ nome: novoNome.trim(), descricao: novaDesc.trim() || null }).eq("id", id);
    setEditando(null); setSaving(false);
    carregar();
  }

  async function toggleAtivo(dep: Deposito) {
    await supabase.from("depositos").update({ ativo: !dep.ativo }).eq("id", dep.id);
    carregar();
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("depositos").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir depósito: " + error.message);
      return;
    }

    setDeleteTarget(null);
    await carregar();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("depositos").delete().in("id", selectedIds);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir depósitos selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depósitos"
        description="Locais de armazenagem do estoque."
        actions={
          <button onClick={() => setCriando(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            + Novo Depósito
          </button>
        }
      />

      {criando && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm max-w-lg">
          <h2 className="font-semibold">Novo Depósito</h2>
          <div>
            <label className="block font-medium mb-1">Nome *</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formNome}
              onChange={(e) => setFormNome(e.target.value)} />
          </div>
          <div>
            <label className="block font-medium mb-1">Descrição</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={criar} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setCriando(false)} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleSelecionarTodos(e.target.checked)}
            />
            Selecionar todos
          </label>
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

        {loadError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Erro ao carregar depósitos: {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : depositos.length === 0 ? (
          <div className="text-slate-600">Nenhum depósito cadastrado.</div>
        ) : (
          <div className="space-y-3">
            {depositos.map((d) => (
              <div key={d.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4">
                {editando === d.id ? (
                  <div className="flex-1 flex gap-3">
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm flex-1" value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)} />
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm flex-1" value={novaDesc}
                      onChange={(e) => setNovaDesc(e.target.value)} placeholder="Descrição" />
                    <button onClick={() => salvarEdicao(d.id)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">Salvar</button>
                    <button onClick={() => setEditando(null)} className="text-sm border border-slate-300 px-3 py-1 rounded">Cancelar</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(d.id)}
                        onChange={(e) => toggleSelecionado(d.id, e.target.checked)}
                        aria-label={`Selecionar depósito ${d.nome}`}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm">{d.nome}</div>
                        {d.descricao && <div className="text-xs text-slate-500">{d.descricao}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded border ${d.ativo ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-600 bg-slate-50"}`}>
                        {d.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <button onClick={() => { setEditando(d.id); setNovoNome(d.nome); setNovaDesc(d.descricao ?? ""); }}
                        className="text-xs text-slate-500 hover:text-slate-800 underline">Editar</button>
                      <button onClick={() => toggleAtivo(d)} className="text-xs text-slate-500 hover:text-slate-800 underline">
                        {d.ativo ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(d)}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={`Deseja excluir o depósito "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir depósitos selecionados"
        description={`Deseja excluir ${selectedIds.length} depósito(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />

      <Link href="/inventario" className="text-sm text-slate-400 hover:text-white">← Voltar ao Inventário</Link>
    </div>
  );
}
