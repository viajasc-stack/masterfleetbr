"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadOptions, registrarSaida, SelectOption } from "@/lib/estoque";

type Saida = {
  id: string;
  data: string;
  quantidade: number;
  tipo_saida: string;
  motivo: string | null;
  itens_estoque?: { nome?: string } | null;
  locais_estoque?: { nome?: string } | null;
};

export default function SaidasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Saida[]>([]);
  const [itens, setItens] = useState<SelectOption[]>([]);
  const [locais, setLocais] = useState<SelectOption[]>([]);

  const [itemId, setItemId] = useState("");
  const [localId, setLocalId] = useState("");
  const [tipoSaida, setTipoSaida] = useState("consumo_interno");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    const [itensOpts, locaisOpts, saidasResp] = await Promise.all([
      loadOptions("itens_estoque"),
      loadOptions("locais_estoque"),
      supabase
        .from("saidas_estoque")
        .select("id, data, quantidade, tipo_saida, motivo, itens_estoque(nome), locais_estoque(nome)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setItens(itensOpts);
    setLocais(locaisOpts);

    if (saidasResp.error) setErro(saidasResp.error.message);
    setLista((saidasResp.data as Saida[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criarSaida(e: FormEvent) {
    e.preventDefault();
    if (!itemId || !localId || !quantidade) return;
    setSaving(true);
    setErro("");

    const { data, error } = await supabase
      .from("saidas_estoque")
      .insert({
        item_id: itemId,
        local_estoque_id: localId,
        tipo_saida: tipoSaida,
        quantidade: Number(quantidade),
        motivo: motivo.trim() || null,
        observacoes: observacoes.trim() || null,
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
        await registrarSaida(String(data.id));
      } catch (rpcError) {
        setErro(rpcError instanceof Error ? rpcError.message : "Falha ao registrar movimentação de saída.");
      }
    }

    setSaving(false);
    setQuantidade("");
    setMotivo("");
    setObservacoes("");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque · Saídas" description="Lançamento de saídas de estoque com atualização automática de saldo e auditoria." />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <form onSubmit={criarSaida} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-3 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">Selecione o item</option>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={localId} onChange={(e) => setLocalId(e.target.value)}>
          <option value="">Selecione o local</option>
          {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoSaida} onChange={(e) => setTipoSaida(e.target.value)}>
          <option value="manutencao">Uso em manutenção</option>
          <option value="consumo_interno">Consumo interno</option>
          <option value="abastecimento">Abastecimento</option>
          <option value="perda">Perda</option>
          <option value="avaria">Avaria</option>
          <option value="vencimento">Vencimento</option>
          <option value="devolucao_fornecedor">Devolução ao fornecedor</option>
          <option value="transferencia_enviada">Transferência enviada</option>
          <option value="ajuste_negativo">Ajuste negativo</option>
          <option value="manual">Saída manual</option>
        </select>
        <input type="number" step="0.001" min="0.001" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Quantidade" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <button disabled={saving} className="md:col-span-3 bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Salvando..." : "Lançar saída"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-500">Carregando saídas...</div> : null}
        {!loading && lista.length === 0 ? <div className="text-sm text-slate-500">Nenhuma saída lançada.</div> : null}
        {!loading && lista.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Qtd</th>
                <th className="py-2 pr-4">Local</th>
                <th className="py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(s.data).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 font-medium">{s.itens_estoque?.nome ?? "—"}</td>
                  <td className="py-2 pr-4 capitalize">{s.tipo_saida.replaceAll("_", " ")}</td>
                  <td className="py-2 pr-4">{Number(s.quantidade).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4">{s.locais_estoque?.nome ?? "—"}</td>
                  <td className="py-2 text-slate-600">{s.motivo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
