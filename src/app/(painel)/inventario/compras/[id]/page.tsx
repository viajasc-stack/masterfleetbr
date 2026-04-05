"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { money } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type Option = { id: string; nome: string };

type Pedido = {
  id: string;
  fornecedor_id: string | null;
  data: string;
  numero_nota: string | null;
  valor_total: number | null;
  forma_pagamento: string | null;
};

type PedidoItem = {
  id: string | null;
  item_id: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

export default function EditarCompraPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [canUseFinanceiro, setCanUseFinanceiro] = useState(false);

  const [fornecedores, setFornecedores] = useState<Option[]>([]);
  const [itensOptions, setItensOptions] = useState<Option[]>([]);
  const [itens, setItens] = useState<PedidoItem[]>([]);

  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [valorTotalNota, setValorTotalNota] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("boleto");

  const totalItens = useMemo(() => itens.reduce((acc, item) => acc + Number(item.valor_total || 0), 0), [itens]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");

      const access = await loadEmpresaModuleAccess();
      setCanUseFinanceiro(access.canUseAllModules || access.allowedModules.includes("financeiro"));

      const [fornResp, itensResp, pedidoResp, pedidoItensResp] = await Promise.all([
        supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("itens_estoque").select("id, nome").eq("ativo", true).order("nome"),
        supabase
          .from("pedidos_compra")
          .select("id, fornecedor_id, data, numero_nota, valor_total, forma_pagamento")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("pedidos_compra_itens")
          .select("id, item_id, quantidade, valor_unitario, valor_total")
          .eq("pedido_compra_id", id)
          .order("created_at", { ascending: true }),
      ]);

      setFornecedores((fornResp.data as Option[] | null) ?? []);
      setItensOptions((itensResp.data as Option[] | null) ?? []);

      if (pedidoResp.error || !pedidoResp.data) {
        setErro(pedidoResp.error?.message ?? "Compra não encontrada.");
        setLoading(false);
        return;
      }

      const pedido = pedidoResp.data as Pedido;
      setFornecedorId(pedido.fornecedor_id ?? "");
      setNumeroNota(pedido.numero_nota ?? "");
      setDataCompra(new Date(pedido.data).toISOString().slice(0, 10));
      setValorTotalNota(String(Number(pedido.valor_total ?? 0)));
      setFormaPagamento(pedido.forma_pagamento ?? "boleto");

      const linhas = ((pedidoItensResp.data as PedidoItem[] | null) ?? []).map((item) => ({
        id: item.id,
        item_id: item.item_id,
        quantidade: Number(item.quantidade ?? 0),
        valor_unitario: Number(item.valor_unitario ?? 0),
        valor_total: Number(item.valor_total ?? 0),
      }));

      setItens(linhas.length > 0 ? linhas : [{ id: null, item_id: "", quantidade: 0, valor_unitario: 0, valor_total: 0 }]);
      setLoading(false);
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [id]);

  function setLinha(index: number, field: keyof PedidoItem, value: string | number | null) {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value } as PedidoItem;
        const qtd = Number(next.quantidade || 0);
        const vu = Number(next.valor_unitario || 0);
        next.valor_total = qtd * vu;
        return next;
      })
    );
  }

  function addLinha() {
    setItens((prev) => [...prev, { id: null, item_id: "", quantidade: 0, valor_unitario: 0, valor_total: 0 }]);
  }

  function removeLinha(index: number) {
    setItens((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!fornecedorId) return setErro("Selecione o fornecedor.");
    if (!numeroNota.trim()) return setErro("Informe o número da nota.");

    const linhasValidas = itens
      .map((item) => ({ ...item, quantidadeNum: Number(item.quantidade || 0), valorUnitarioNum: Number(item.valor_unitario || 0) }))
      .filter((item) => item.item_id && item.quantidadeNum > 0);

    if (linhasValidas.length === 0) return setErro("Adicione pelo menos 1 item válido.");

    setSaving(true);
    setErro("");

    const { error: pedidoErr } = await supabase
      .from("pedidos_compra")
      .update({
        fornecedor_id: fornecedorId,
        data: `${dataCompra}T12:00:00.000Z`,
        numero_nota: numeroNota.trim(),
        valor_total: Number(valorTotalNota || 0),
        forma_pagamento: canUseFinanceiro ? formaPagamento : null,
      })
      .eq("id", id);

    if (pedidoErr) {
      setSaving(false);
      setErro(pedidoErr.message);
      return;
    }

    const idsMantidos = linhasValidas.map((item) => item.id).filter((x): x is string => Boolean(x));

    if (idsMantidos.length === 0) {
      const { error: delAllErr } = await supabase
        .from("pedidos_compra_itens")
        .delete()
        .eq("pedido_compra_id", id);
      if (delAllErr) {
        setSaving(false);
        setErro(delAllErr.message);
        return;
      }
    } else {
      const { data: existentes, error: existentesErr } = await supabase
        .from("pedidos_compra_itens")
        .select("id")
        .eq("pedido_compra_id", id);

      if (existentesErr) {
        setSaving(false);
        setErro(existentesErr.message);
        return;
      }

      const idsRemover = ((existentes ?? []) as Array<{ id: string }>)
        .map((x) => x.id)
        .filter((existingId) => !idsMantidos.includes(existingId));

      if (idsRemover.length > 0) {
        const { error: delMissingErr } = await supabase
          .from("pedidos_compra_itens")
          .delete()
          .in("id", idsRemover);
        if (delMissingErr) {
          setSaving(false);
          setErro(delMissingErr.message);
          return;
        }
      }
    }

    for (const item of linhasValidas) {
      const payload = {
        item_id: item.item_id,
        quantidade: item.quantidadeNum,
        valor_unitario: item.valorUnitarioNum,
        valor_total: item.quantidadeNum * item.valorUnitarioNum,
      };

      if (item.id) {
        const { error: updErr } = await supabase.from("pedidos_compra_itens").update(payload).eq("id", item.id);
        if (updErr) {
          setSaving(false);
          setErro(updErr.message);
          return;
        }
      } else {
        const { error: insErr } = await supabase.from("pedidos_compra_itens").insert({
          pedido_compra_id: id,
          ...payload,
          recebido_quantidade: item.quantidadeNum,
        });
        if (insErr) {
          setSaving(false);
          setErro(insErr.message);
          return;
        }
      }
    }

    setSaving(false);
    router.push("/inventario/compras");
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/compras" className="text-sm text-slate-400 hover:text-white">← Compras</Link>
        <h1 className="text-xl font-semibold text-white">Editar compra</h1>
      </div>

      {loading ? <div className="text-sm text-slate-500">Carregando compra...</div> : null}

      {!loading ? (
        <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

          <div className="grid md:grid-cols-2 gap-3">
            <select className="border border-slate-300 rounded-md px-3 py-2" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="">Fornecedor</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Número da nota" value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} />
            <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
            <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Valor total da nota" value={valorTotalNota} onChange={(e) => setValorTotalNota(e.target.value)} />
            {canUseFinanceiro ? (
              <select className="border border-slate-300 rounded-md px-3 py-2" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
                <option value="avista">À vista</option>
                <option value="cartao">Cartão</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            ) : (
              <div className="text-xs rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">Módulo Financeiro inativo para esta empresa.</div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left border-b">
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3 text-right">Quantidade</th>
                  <th className="py-2 px-3 text-right">Vlr. unitário</th>
                  <th className="py-2 px-3 text-right">Vlr. total</th>
                  <th className="py-2 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-slate-500">Sem itens vinculados a esta compra.</td>
                  </tr>
                ) : (
                  itens.map((item, index) => (
                    <tr key={item.id ?? `novo-${index}`} className="border-b last:border-0">
                      <td className="py-2 px-3">
                        <select
                          className="w-full border border-slate-300 rounded-md px-2 py-1.5"
                          value={item.item_id}
                          onChange={(e) => setLinha(index, "item_id", e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {itensOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.nome}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          className="w-28 ml-auto border border-slate-300 rounded-md px-2 py-1.5 text-right"
                          value={String(item.quantidade ?? "")}
                          onChange={(e) => setLinha(index, "quantidade", Number(e.target.value || 0))}
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          className="w-32 ml-auto border border-slate-300 rounded-md px-2 py-1.5 text-right"
                          value={String(item.valor_unitario ?? "")}
                          onChange={(e) => setLinha(index, "valor_unitario", Number(e.target.value || 0))}
                        />
                      </td>
                      <td className="py-2 px-3 text-right">{money(item.valor_total)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeLinha(index)}
                          className="text-xs border border-rose-300 text-rose-700 rounded px-2 py-1 hover:bg-rose-50"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right font-semibold">Total dos itens</td>
                  <td className="py-2 px-3 text-right font-semibold">{money(totalItens)}</td>
                  <td className="py-2 px-3 text-right">
                    <button type="button" onClick={addLinha} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">
                      + Item
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <button type="submit" disabled={saving} className="bg-indigo-600 text-white rounded-md px-5 py-2 hover:bg-indigo-500 disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <Link href="/inventario/compras" className="border border-slate-300 rounded-md px-5 py-2 hover:bg-slate-50">Cancelar</Link>
          </div>
        </form>
      ) : null}
    </div>
  );
}
