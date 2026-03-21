"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage, loadOptions, money, numberBR, SelectOption } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type ItemForm = {
  nome: string;
  codigo_interno: string;
  unidade_medida: string;
  categoria_id: string;
  fornecedor_principal_id: string;
  estoque_minimo: string;
  estoque_ideal: string;
  custo_compra: string;
  custo_medio: string;
  observacoes: string;
  ativo: boolean;
};

type SaldoLocal = {
  id: string;
  quantidade: number;
  custo_medio: number | null;
  locais_estoque?: { nome?: string } | null;
};

export default function ItemEstoqueDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [categorias, setCategorias] = useState<SelectOption[]>([]);
  const [fornecedores, setFornecedores] = useState<SelectOption[]>([]);
  const [saldos, setSaldos] = useState<SaldoLocal[]>([]);

  const [form, setForm] = useState<ItemForm>({
    nome: "",
    codigo_interno: "",
    unidade_medida: "un",
    categoria_id: "",
    fornecedor_principal_id: "",
    estoque_minimo: "0",
    estoque_ideal: "",
    custo_compra: "",
    custo_medio: "",
    observacoes: "",
    ativo: true,
  });

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      setErro("");

      try {
        const [{ data: item, error: itemErr }, cats, forns, { data: saldosData, error: saldosErr }] = await Promise.all([
          supabase.from("itens_estoque").select("*").eq("id", id).maybeSingle(),
          loadOptions("categorias_estoque"),
          loadOptions("fornecedores"),
          supabase
            .from("estoques")
            .select("id, quantidade, custo_medio, locais_estoque(nome)")
            .eq("item_id", id)
            .order("created_at", { ascending: true }),
        ]);

        if (itemErr) throw itemErr;
        if (!item) throw new Error("Item não encontrado.");
        if (saldosErr) throw saldosErr;

        setCategorias(cats);
        setFornecedores(forns);
        setSaldos((saldosData as SaldoLocal[] | null) ?? []);

        setForm({
          nome: String(item.nome ?? ""),
          codigo_interno: String(item.codigo_interno ?? ""),
          unidade_medida: String(item.unidade_medida ?? "un"),
          categoria_id: String(item.categoria_id ?? ""),
          fornecedor_principal_id: String(item.fornecedor_principal_id ?? ""),
          estoque_minimo: String(item.estoque_minimo ?? 0),
          estoque_ideal: item.estoque_ideal != null ? String(item.estoque_ideal) : "",
          custo_compra: item.custo_compra != null ? String(item.custo_compra) : "",
          custo_medio: item.custo_medio != null ? String(item.custo_medio) : "",
          observacoes: String(item.observacoes ?? ""),
          ativo: Boolean(item.ativo),
        });
      } catch (e) {
        setErro(errorMessage(e, "Falha ao carregar item."));
      } finally {
        setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [id]);

  function set<K extends keyof ItemForm>(key: K, value: ItemForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setErro("");
    setOkMsg("");

    const { error } = await supabase
      .from("itens_estoque")
      .update({
        nome: form.nome.trim(),
        codigo_interno: form.codigo_interno.trim() || null,
        unidade_medida: form.unidade_medida.trim() || "un",
        categoria_id: form.categoria_id || null,
        fornecedor_principal_id: form.fornecedor_principal_id || null,
        estoque_minimo: Number(form.estoque_minimo || 0),
        estoque_ideal: form.estoque_ideal ? Number(form.estoque_ideal) : null,
        custo_compra: form.custo_compra ? Number(form.custo_compra) : null,
        custo_medio: form.custo_medio ? Number(form.custo_medio) : null,
        observacoes: form.observacoes.trim() || null,
        ativo: form.ativo,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setOkMsg("Item atualizado com sucesso.");
  }

  const saldoTotal = saldos.reduce((acc, s) => acc + Number(s.quantidade ?? 0), 0);
  const valorTotal = saldos.reduce((acc, s) => acc + Number(s.quantidade ?? 0) * Number(s.custo_medio ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Detalhe do item"
        description="Edição de cadastro e visão de saldo distribuído por local de estoque."
        actions={<Link href="/inventario/itens" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Voltar</Link>}
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      {loading ? <div className="text-sm text-slate-500">Carregando item...</div> : null}

      {!loading ? (
        <>
          <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-5 grid md:grid-cols-3 gap-3">
            <input className="border border-slate-300 rounded-md px-3 py-2" value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome" />
            <input className="border border-slate-300 rounded-md px-3 py-2" value={form.codigo_interno} onChange={(e) => set("codigo_interno", e.target.value)} placeholder="Código interno" />
            <input className="border border-slate-300 rounded-md px-3 py-2" value={form.unidade_medida} onChange={(e) => set("unidade_medida", e.target.value)} placeholder="Unidade" />

            <select className="border border-slate-300 rounded-md px-3 py-2" value={form.categoria_id} onChange={(e) => set("categoria_id", e.target.value)}>
              <option value="">Categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select className="border border-slate-300 rounded-md px-3 py-2" value={form.fornecedor_principal_id} onChange={(e) => set("fornecedor_principal_id", e.target.value)}>
              <option value="">Fornecedor principal</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
              Item ativo
            </label>

            <input type="number" step="0.001" min="0" className="border border-slate-300 rounded-md px-3 py-2" value={form.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} placeholder="Estoque mínimo" />
            <input type="number" step="0.001" min="0" className="border border-slate-300 rounded-md px-3 py-2" value={form.estoque_ideal} onChange={(e) => set("estoque_ideal", e.target.value)} placeholder="Estoque ideal" />
            <input type="number" step="0.01" min="0" className="border border-slate-300 rounded-md px-3 py-2" value={form.custo_compra} onChange={(e) => set("custo_compra", e.target.value)} placeholder="Custo compra" />

            <input type="number" step="0.01" min="0" className="border border-slate-300 rounded-md px-3 py-2" value={form.custo_medio} onChange={(e) => set("custo_medio", e.target.value)} placeholder="Custo médio" />
            <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Observações" />

            <button disabled={saving} className="md:col-span-3 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Saldo por local</h2>
            <div className="mt-2 text-sm text-slate-600">
              Saldo total: <strong>{numberBR(saldoTotal, 3)}</strong> · Valor estimado: <strong>{money(valorTotal)}</strong>
            </div>
            <div className="mt-4 overflow-x-auto">
              {saldos.length === 0 ? (
                <div className="text-sm text-slate-500">Sem saldo registrado em locais de estoque.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4">Local</th>
                      <th className="py-2 pr-4">Quantidade</th>
                      <th className="py-2 pr-4">Custo médio</th>
                      <th className="py-2 pr-4">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saldos.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{s.locais_estoque?.nome ?? "—"}</td>
                        <td className="py-2 pr-4">{numberBR(s.quantidade, 3)}</td>
                        <td className="py-2 pr-4">{money(s.custo_medio)}</td>
                        <td className="py-2 pr-4 font-medium">{money(Number(s.quantidade ?? 0) * Number(s.custo_medio ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
