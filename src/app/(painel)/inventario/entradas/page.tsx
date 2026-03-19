"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadOptions, registrarEntrada, SelectOption } from "@/lib/estoque";

type Entrada = {
  id: string;
  created_at: string;
  quantidade: number;
  valor_total: number | null;
  status: string;
  tipo_entrada: string | null;
  itens_estoque?: { nome?: string } | null;
  locais_estoque?: { nome?: string } | null;
  fornecedores?: { nome?: string } | null;
};

export default function EntradasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Entrada[]>([]);
  const [itens, setItens] = useState<SelectOption[]>([]);
  const [locais, setLocais] = useState<SelectOption[]>([]);
  const [fornecedores, setFornecedores] = useState<SelectOption[]>([]);

  const [itemId, setItemId] = useState("");
  const [localId, setLocalId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [tipoEntrada, setTipoEntrada] = useState("manual");
  const [quantidade, setQuantidade] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");

    const [itensResp, locaisResp, fornResp, entradasResp] = await Promise.all([
      loadOptions("itens_estoque"),
      loadOptions("locais_estoque"),
      loadOptions("fornecedores"),
      supabase
        .from("entradas_estoque")
        .select("id, created_at, quantidade, valor_total, status, tipo_entrada, itens_estoque(nome), locais_estoque(nome), fornecedores(nome)")
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    setItens(itensResp);
    setLocais(locaisResp);
    setFornecedores(fornResp);
    if (entradasResp.error) setErro(entradasResp.error.message);
    setLista((entradasResp.data as Entrada[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criarEntrada(e: FormEvent) {
    e.preventDefault();
    if (!itemId || !localId || !quantidade) return;

    setSaving(true);
    setErro("");

    const qtd = Number(quantidade);
    const vu = Number(valorUnitario || 0);

    const { data, error } = await supabase
      .from("entradas_estoque")
      .insert({
        item_id: itemId,
        local_estoque_id: localId,
        fornecedor_id: fornecedorId || null,
        tipo_entrada: tipoEntrada,
        quantidade: qtd,
        valor_unitario: vu || null,
        valor_total: vu > 0 ? vu * qtd : null,
        observacoes: observacoes.trim() || null,
        status: "pendente",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      setErro(error.message);
      setSaving(false);
      return;
    }

    if (data?.id) {
      try {
        await registrarEntrada(String(data.id));
      } catch (rpcError) {
        setErro(rpcError instanceof Error ? rpcError.message : "Falha ao aplicar movimentação da entrada.");
      }
    }

    setSaving(false);
    setQuantidade("");
    setValorUnitario("");
    setObservacoes("");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque · Entradas" description="Lançamento de entradas de estoque com atualização de saldo e custo médio." />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <form onSubmit={criarEntrada} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-4 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">Selecione o item</option>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={localId} onChange={(e) => setLocalId(e.target.value)}>
          <option value="">Selecione o local</option>
          {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
          <option value="">Fornecedor (opcional)</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoEntrada} onChange={(e) => setTipoEntrada(e.target.value)}>
          <option value="compra">Compra</option>
          <option value="devolucao">Devolução</option>
          <option value="transferencia_recebida">Transferência recebida</option>
          <option value="ajuste_positivo">Ajuste positivo</option>
          <option value="retorno_nao_utilizado">Retorno não utilizado</option>
          <option value="manual">Entrada manual</option>
        </select>
        <input type="number" step="0.001" min="0.001" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Quantidade" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <input type="number" step="0.01" min="0" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Valor unitário" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} />
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" placeholder="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

        <button disabled={saving} className="md:col-span-4 bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Salvando..." : "Lançar entrada"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-500">Carregando entradas...</div> : null}
        {!loading && lista.length === 0 ? <div className="text-sm text-slate-500">Nenhuma entrada lançada.</div> : null}
        {!loading && lista.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Qtd</th>
                <th className="py-2 pr-4">Local</th>
                <th className="py-2 pr-4">Fornecedor</th>
                <th className="py-2 pr-4">Valor total</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 font-medium">{e.itens_estoque?.nome ?? "—"}</td>
                  <td className="py-2 pr-4 capitalize">{(e.tipo_entrada ?? "manual").replaceAll("_", " ")}</td>
                  <td className="py-2 pr-4">{Number(e.quantidade).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4">{e.locais_estoque?.nome ?? "—"}</td>
                  <td className="py-2 pr-4">{e.fornecedores?.nome ?? "—"}</td>
                  <td className="py-2 pr-4">{Number(e.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="py-2">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
