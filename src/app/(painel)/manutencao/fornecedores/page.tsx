"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Fornecedor = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  tipos: string[] | null;
  observacoes: string | null;
  ativo: boolean;
};

type FormFornecedor = {
  nome: string;
  razao_social: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  tipos: string;
  observacoes: string;
  ativo: boolean;
};

const initialForm: FormFornecedor = {
  nome: "",
  razao_social: "",
  cnpj: "",
  telefone: "",
  email: "",
  endereco: "",
  cidade: "",
  estado: "",
  tipos: "",
  observacoes: "",
  ativo: true,
};

export default function FornecedoresManutencaoPage() {
  const [loading, setLoading] = useState(true);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [form, setForm] = useState<FormFornecedor>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("fornecedores")
      .select("id,nome,razao_social,cnpj,telefone,email,cidade,estado,tipos,observacoes,ativo")
      .order("nome");
    setFornecedores((data as Fornecedor[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, []);

  const lista = useMemo(() => {
    if (filtroTipo === "todos") return fornecedores;
    return fornecedores.filter((f) => (f.tipos ?? []).includes(filtroTipo));
  }, [fornecedores, filtroTipo]);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const payload = {
      nome: form.nome,
      razao_social: form.razao_social || null,
      cnpj: form.cnpj || null,
      telefone: form.telefone || null,
      email: form.email || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      tipos: form.tipos
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    };

    if (editingId) {
      await supabase.from("fornecedores").update(payload).eq("id", editingId);
    } else {
      await supabase.from("fornecedores").insert(payload);
    }

    setForm(initialForm);
    setEditingId(null);
    await carregar();
  }

  function editar(f: Fornecedor) {
    setEditingId(f.id);
    setForm({
      nome: f.nome,
      razao_social: f.razao_social ?? "",
      cnpj: f.cnpj ?? "",
      telefone: f.telefone ?? "",
      email: f.email ?? "",
      endereco: "",
      cidade: f.cidade ?? "",
      estado: f.estado ?? "",
      tipos: (f.tipos ?? []).join(", "),
      observacoes: f.observacoes ?? "",
      ativo: f.ativo,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manutenção · Fornecedores" description="Cadastro, edição, filtro por tipo e histórico básico de fornecedores." />

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-4">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome" value={form.nome} onChange={(e) => setForm((v) => ({ ...v, nome: e.target.value }))} required />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Razão social" value={form.razao_social} onChange={(e) => setForm((v) => ({ ...v, razao_social: e.target.value }))} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm((v) => ({ ...v, cnpj: e.target.value }))} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm((v) => ({ ...v, telefone: e.target.value }))} />

        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="E-mail" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Cidade" value={form.cidade} onChange={(e) => setForm((v) => ({ ...v, cidade: e.target.value }))} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Estado" value={form.estado} onChange={(e) => setForm((v) => ({ ...v, estado: e.target.value }))} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Tipos (oficina, autopecas...)" value={form.tipos} onChange={(e) => setForm((v) => ({ ...v, tipos: e.target.value }))} />

        <textarea className="md:col-span-3 border border-slate-300 rounded-md px-3 py-2" rows={2} placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((v) => ({ ...v, observacoes: e.target.value }))} />

        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm((v) => ({ ...v, ativo: e.target.checked }))} /> Ativo</label>
          <button type="submit" className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500">{editingId ? "Salvar" : "Cadastrar"}</button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Filtrar por tipo</label>
          <select className="border border-slate-300 rounded-md px-3 py-2" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="todos">todos</option>
            <option value="oficina">oficina</option>
            <option value="autopecas">autopecas</option>
            <option value="pneus">pneus</option>
            <option value="servicos">servicos</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">CNPJ</th>
                <th className="py-2 pr-4">Contato</th>
                <th className="py-2 pr-4">Cidade/UF</th>
                <th className="py-2 pr-4">Tipos</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-3 text-slate-500">Carregando...</td></tr> : null}
              {!loading && lista.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{f.nome}</td>
                  <td className="py-2 pr-4">{f.cnpj ?? "—"}</td>
                  <td className="py-2 pr-4">{f.telefone ?? f.email ?? "—"}</td>
                  <td className="py-2 pr-4">{[f.cidade, f.estado].filter(Boolean).join("/") || "—"}</td>
                  <td className="py-2 pr-4">{(f.tipos ?? []).join(", ") || "—"}</td>
                  <td className="py-2 pr-4">{f.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => editar(f)} className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
