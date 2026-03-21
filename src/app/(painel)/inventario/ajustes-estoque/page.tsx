"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { aplicarAjuste, errorMessage, loadOptions, SelectOption } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type Ajuste = {
  id: string;
  data: string;
  tipo_ajuste: "positivo" | "negativo";
  quantidade: number;
  motivo: string;
  observacao: string | null;
  itens_estoque?: { nome?: string } | null;
  locais_estoque?: { nome?: string } | null;
};

export default function AjustesEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [itens, setItens] = useState<SelectOption[]>([]);
  const [locais, setLocais] = useState<SelectOption[]>([]);

  const [itemId, setItemId] = useState("");
  const [localId, setLocalId] = useState("");
  const [tipoAjuste, setTipoAjuste] = useState<"positivo" | "negativo">("positivo");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    const [itensResp, locaisResp, ajustesResp] = await Promise.all([
      loadOptions("itens_estoque"),
      loadOptions("locais_estoque"),
      supabase
        .from("ajustes_estoque")
        .select("id, data, tipo_ajuste, quantidade, motivo, observacao, itens_estoque(nome), locais_estoque(nome)")
        .order("data", { ascending: false })
        .limit(120),
    ]);

    setItens(itensResp);
    setLocais(locaisResp);
    if (ajustesResp.error) setErro(errorMessage(ajustesResp.error, "Falha ao carregar ajustes."));
    setAjustes((ajustesResp.data as Ajuste[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criarAjuste(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setOkMsg("");
    if (!itemId || !localId || !motivo.trim()) {
      setErro("Selecione item/local e informe o motivo do ajuste.");
      return;
    }

    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErro("Quantidade inválida.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("ajustes_estoque")
      .insert({
        item_id: itemId,
        local_estoque_id: localId,
        tipo_ajuste: tipoAjuste,
        quantidade: qtd,
        motivo: motivo.trim(),
        observacao: observacao.trim() || null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      setSaving(false);
      setErro(errorMessage(error, "Falha ao criar ajuste."));
      return;
    }

    try {
      if (data?.id) await aplicarAjuste(String(data.id));
      setOkMsg("Ajuste aplicado com sucesso.");
      setQuantidade("");
      setMotivo("");
      setObservacao("");
      await carregar();
    } catch (rpcError) {
      setErro(errorMessage(rpcError, "Falha ao aplicar ajuste."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Ajustes de Estoque"
        description="Corrija divergências de saldo com rastreabilidade completa e impacto imediato no estoque."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      <form onSubmit={criarAjuste} className="rounded-xl border border-slate-200 bg-white p-5 grid md:grid-cols-3 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">Selecione o item</option>
          {itens.map((i) => (
            <option key={i.id} value={i.id}>{i.nome}</option>
          ))}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={localId} onChange={(e) => setLocalId(e.target.value)}>
          <option value="">Selecione o local</option>
          {locais.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={tipoAjuste} onChange={(e) => setTipoAjuste(e.target.value as "positivo" | "negativo") }>
          <option value="positivo">Ajuste positivo (entrada)</option>
          <option value="negativo">Ajuste negativo (saída)</option>
        </select>
        <input type="number" step="0.001" min="0.001" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Quantidade" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Motivo (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

        <button disabled={saving} className="md:col-span-3 bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Aplicando..." : "Aplicar ajuste"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-500">Carregando ajustes...</div> : null}
        {!loading && ajustes.length === 0 ? <div className="text-sm text-slate-500">Nenhum ajuste registrado.</div> : null}
        {!loading && ajustes.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Local</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Qtd</th>
                <th className="py-2 pr-4">Motivo</th>
                <th className="py-2">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {ajustes.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(a.data).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 font-medium">{a.itens_estoque?.nome ?? "—"}</td>
                  <td className="py-2 pr-4">{a.locais_estoque?.nome ?? "—"}</td>
                  <td className="py-2 pr-4 capitalize">{a.tipo_ajuste}</td>
                  <td className="py-2 pr-4">{Number(a.quantidade).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4">{a.motivo}</td>
                  <td className="py-2">{a.observacao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
