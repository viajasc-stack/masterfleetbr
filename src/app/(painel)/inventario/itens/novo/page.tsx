"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage, loadOptions, SelectOption } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

export default function NovoItemEstoquePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [categorias, setCategorias] = useState<SelectOption[]>([]);
  const [fornecedores, setFornecedores] = useState<SelectOption[]>([]);

  const [nome, setNome] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [categoriaId, setCategoriaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [estoqueIdeal, setEstoqueIdeal] = useState("");
  const [custoCompra, setCustoCompra] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        try {
          const [cats, forns] = await Promise.all([
            loadOptions("categorias_estoque"),
            loadOptions("fornecedores"),
          ]);
          setCategorias(cats);
          setFornecedores(forns);
        } catch (e) {
          setErro(errorMessage(e, "Falha ao carregar opções."));
        }
      })();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) {
      setErro("Informe o nome do item.");
      return;
    }

    if (Number(estoqueMinimo || 0) < 0) {
      setErro("Estoque mínimo não pode ser negativo.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("itens_estoque")
      .insert({
        nome: nome.trim(),
        codigo_interno: codigoInterno.trim() || null,
        unidade_medida: unidade.trim() || "un",
        categoria_id: categoriaId || null,
        fornecedor_principal_id: fornecedorId || null,
        estoque_minimo: Number(estoqueMinimo || 0),
        estoque_ideal: estoqueIdeal ? Number(estoqueIdeal) : null,
        custo_compra: custoCompra ? Number(custoCompra) : null,
        custo_medio: custoCompra ? Number(custoCompra) : null,
        observacoes: observacoes.trim() || null,
        ativo: true,
      })
      .select("id")
      .maybeSingle();

    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }

    if (data?.id) {
      router.push(`/inventario/itens/${data.id}`);
      return;
    }
    router.push("/inventario/itens");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Novo item"
        description="Cadastre um novo item de estoque com parâmetros mínimos para operação e reposição."
        actions={<Link href="/inventario/itens" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Voltar</Link>}
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-5 grid md:grid-cols-3 gap-3">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome do item" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Código interno" value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Unidade (ex.: un, l, kg)" value={unidade} onChange={(e) => setUnidade(e.target.value)} />

        <select className="border border-slate-300 rounded-md px-3 py-2" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Categoria (opcional)</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        <select className="border border-slate-300 rounded-md px-3 py-2" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
          <option value="">Fornecedor principal (opcional)</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>

        <input type="number" step="0.001" min="0" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Estoque mínimo" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} />
        <input type="number" step="0.001" min="0" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Estoque ideal" value={estoqueIdeal} onChange={(e) => setEstoqueIdeal(e.target.value)} />
        <input type="number" step="0.01" min="0" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Custo compra" value={custoCompra} onChange={(e) => setCustoCompra(e.target.value)} />

        <input className="md:col-span-3 border border-slate-300 rounded-md px-3 py-2" placeholder="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

        <button disabled={saving} className="md:col-span-3 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar item"}
        </button>
      </form>
    </div>
  );
}
