"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadOptions, SelectOption, transferirEstoque } from "@/lib/estoque";

type Transferencia = {
  id: string;
  data: string;
  quantidade: number;
  itens_estoque?: { nome?: string } | null;
  local_origem?: { nome?: string } | null;
  local_destino?: { nome?: string } | null;
};

export default function TransferenciasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Transferencia[]>([]);
  const [itens, setItens] = useState<SelectOption[]>([]);
  const [locais, setLocais] = useState<SelectOption[]>([]);

  const [itemId, setItemId] = useState("");
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");

    const [itensResp, locaisResp, transfResp] = await Promise.all([
      loadOptions("itens_estoque"),
      loadOptions("locais_estoque"),
      supabase
        .from("transferencias_estoque")
        .select("id, data, quantidade, itens_estoque(nome), local_origem:locais_estoque!transferencias_estoque_local_origem_id_fkey(nome), local_destino:locais_estoque!transferencias_estoque_local_destino_id_fkey(nome)")
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    setItens(itensResp);
    setLocais(locaisResp);
    if (transfResp.error) setErro(transfResp.error.message);
    setLista((transfResp.data as Transferencia[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criarTransferencia(e: FormEvent) {
    e.preventDefault();
    if (!itemId || !origemId || !destinoId || !quantidade) return;
    if (origemId === destinoId) return setErro("Origem e destino não podem ser iguais.");

    setSaving(true);
    setErro("");

    const { data, error } = await supabase
      .from("transferencias_estoque")
      .insert({
        item_id: itemId,
        local_origem_id: origemId,
        local_destino_id: destinoId,
        quantidade: Number(quantidade),
        observacao: observacao || null,
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
        await transferirEstoque(String(data.id));
      } catch (rpcError) {
        setErro(rpcError instanceof Error ? rpcError.message : "Falha ao executar transferência.");
      }
    }

    setSaving(false);
    setQuantidade("");
    setObservacao("");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque · Transferências" description="Transferência entre locais com baixa na origem e entrada no destino." />
      {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <form onSubmit={criarTransferencia} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-5 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">Item</option>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={origemId} onChange={(e) => setOrigemId(e.target.value)}>
          <option value="">Local origem</option>
          {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
          <option value="">Local destino</option>
          {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <input type="number" min="0.001" step="0.001" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Quantidade" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        <button disabled={saving} className="md:col-span-5 bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">{saving ? "Salvando..." : "Transferir"}</button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-500">Carregando transferências...</div> : null}
        {!loading && lista.length === 0 ? <div className="text-sm text-slate-500">Nenhuma transferência registrada.</div> : null}
        {!loading && lista.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Origem</th>
                <th className="py-2 pr-4">Destino</th>
                <th className="py-2">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(t.data).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 font-medium">{t.itens_estoque?.nome ?? "—"}</td>
                  <td className="py-2 pr-4">{t.local_origem?.nome ?? "—"}</td>
                  <td className="py-2 pr-4">{t.local_destino?.nome ?? "—"}</td>
                  <td className="py-2">{Number(t.quantidade).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
