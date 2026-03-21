"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage, loadOptions, numberBR, SelectOption } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type Inventario = {
  id: string;
  nome: string;
  data: string;
  status: "aberto" | "em_contagem" | "concluido" | "ajustado";
  observacoes: string | null;
  local_estoque_id: string;
  locais_estoque?: { nome?: string } | null;
};

type ItemContagem = {
  id: string;
  item_id: string;
  saldo_sistema: number;
  saldo_fisico: number;
  diferenca: number;
  itens_estoque?: { nome?: string; unidade_medida?: string } | null;
};

export default function InventarioFisicoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [locais, setLocais] = useState<SelectOption[]>([]);
  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [selecionadoId, setSelecionadoId] = useState("");
  const [itensSelecionado, setItensSelecionado] = useState<ItemContagem[]>([]);

  const [nome, setNome] = useState("");
  const [localId, setLocalId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const carregarInventarios = useCallback(async () => {
    const [locaisResp, invResp] = await Promise.all([
      loadOptions("locais_estoque"),
      supabase
        .from("inventarios_fisicos")
        .select("id, nome, data, status, observacoes, local_estoque_id, locais_estoque(nome)")
        .order("data", { ascending: false })
        .limit(80),
    ]);

    setLocais(locaisResp);
    if (invResp.error) throw invResp.error;

    const lista = (invResp.data as Inventario[] | null) ?? [];
    setInventarios(lista);

    if (lista.length > 0) {
      setSelecionadoId((prev) => prev || lista[0].id);
    }
  }, []);

  const carregarItensInventario = useCallback(async (id: string) => {
    if (!id) {
      setItensSelecionado([]);
      return;
    }

    const { data, error } = await supabase
      .from("inventarios_fisicos_itens")
      .select("id, item_id, saldo_sistema, saldo_fisico, diferenca, itens_estoque(nome, unidade_medida)")
      .eq("inventario_fisico_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    setItensSelecionado((data as ItemContagem[] | null) ?? []);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        await carregarInventarios();
      } catch (e) {
        setErro(errorMessage(e, "Falha ao carregar inventários físicos."));
      } finally {
        setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [carregarInventarios]);

  useEffect(() => {
    const t = setTimeout(() => {
      void carregarItensInventario(selecionadoId).catch((e) => {
        setErro(errorMessage(e, "Falha ao carregar itens do inventário."));
      });
    }, 0);
    return () => clearTimeout(t);
  }, [selecionadoId, carregarItensInventario]);

  const inventarioSelecionado = useMemo(
    () => inventarios.find((i) => i.id === selecionadoId) ?? null,
    [inventarios, selecionadoId]
  );

  async function criarInventario(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setOkMsg("");

    if (!nome.trim() || !localId) {
      setErro("Informe nome e local para criar o inventário físico.");
      return;
    }

    setSaving(true);
    const { data: inv, error } = await supabase
      .from("inventarios_fisicos")
      .insert({
        nome: nome.trim(),
        local_estoque_id: localId,
        observacoes: observacoes.trim() || null,
        status: "aberto",
      })
      .select("id")
      .maybeSingle();

    if (error || !inv?.id) {
      setSaving(false);
      setErro(error?.message ?? "Falha ao criar inventário físico.");
      return;
    }

    const { data: estoqueData, error: estoqueErr } = await supabase
      .from("estoques")
      .select("item_id, quantidade")
      .eq("local_estoque_id", localId);

    if (estoqueErr) {
      setSaving(false);
      setErro(estoqueErr.message);
      return;
    }

    const rows = ((estoqueData ?? []) as Array<{ item_id: string; quantidade: number | null }>).map((s) => ({
      inventario_fisico_id: String(inv.id),
      item_id: s.item_id,
      saldo_sistema: Number(s.quantidade ?? 0),
      saldo_fisico: Number(s.quantidade ?? 0),
      diferenca: 0,
    }));

    if (rows.length > 0) {
      const { error: itensErr } = await supabase.from("inventarios_fisicos_itens").insert(rows);
      if (itensErr) {
        setSaving(false);
        setErro(itensErr.message);
        return;
      }
    }

    setSaving(false);
    setNome("");
    setObservacoes("");
    setLocalId("");
    setSelecionadoId(String(inv.id));
    setOkMsg("Inventário físico criado e pré-carregado com saldo de sistema.");
    await carregarInventarios();
    await carregarItensInventario(String(inv.id));
  }

  async function atualizarSaldoFisico(item: ItemContagem, saldoFisicoStr: string) {
    const saldoFisico = Number(saldoFisicoStr);
    if (!Number.isFinite(saldoFisico) || saldoFisico < 0) return;

    const diferenca = saldoFisico - Number(item.saldo_sistema ?? 0);
    const { error } = await supabase
      .from("inventarios_fisicos_itens")
      .update({ saldo_fisico: saldoFisico, diferenca })
      .eq("id", item.id);

    if (error) {
      setErro(error.message);
      return;
    }

    setItensSelecionado((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, saldo_fisico: saldoFisico, diferenca } : p))
    );
  }

  async function concluirInventario(status: Inventario["status"]) {
    if (!inventarioSelecionado) return;
    const { error } = await supabase
      .from("inventarios_fisicos")
      .update({ status })
      .eq("id", inventarioSelecionado.id);

    if (error) {
      setErro(error.message);
      return;
    }

    setOkMsg(`Inventário atualizado para status: ${status}.`);
    await carregarInventarios();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Inventário Físico"
        description="Realize contagem física por local, compare com saldo de sistema e acompanhe divergências de inventário."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      <form onSubmit={criarInventario} className="rounded-xl border border-slate-200 bg-white p-5 grid md:grid-cols-4 gap-3">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome do inventário" value={nome} onChange={(e) => setNome(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2" value={localId} onChange={(e) => setLocalId(e.target.value)}>
          <option value="">Selecione o local</option>
          {locais.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" placeholder="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <button disabled={saving} className="md:col-span-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Criando..." : "Criar inventário físico"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Inventários cadastrados</h2>
          {loading ? <div className="text-sm text-slate-500">Carregando...</div> : null}
          {!loading && inventarios.length === 0 ? <div className="text-sm text-slate-500">Nenhum inventário físico criado.</div> : null}
          <div className="space-y-2">
            {inventarios.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => setSelecionadoId(inv.id)}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${selecionadoId === inv.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <div className="font-medium">{inv.nome}</div>
                <div className="text-xs text-slate-500">{new Date(inv.data).toLocaleString("pt-BR")} · {inv.locais_estoque?.nome ?? "—"}</div>
                <div className="mt-1 text-xs text-slate-600">Status: {inv.status}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!inventarioSelecionado ? <div className="text-sm text-slate-500">Selecione um inventário para lançar contagens.</div> : null}

          {inventarioSelecionado ? (
            <>
              <div className="rounded border border-slate-200 p-3 text-sm">
                <div className="font-semibold">{inventarioSelecionado.nome}</div>
                <div className="text-slate-500">Local: {inventarioSelecionado.locais_estoque?.nome ?? "—"}</div>
                <div className="text-slate-500">Status atual: {inventarioSelecionado.status}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void concluirInventario("em_contagem")} className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">Marcar em contagem</button>
                  <button type="button" onClick={() => void concluirInventario("concluido")} className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50">Concluir contagem</button>
                  <button type="button" onClick={() => void concluirInventario("ajustado")} className="rounded border border-indigo-300 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-50">Marcar como ajustado</button>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3">Sistema</th>
                      <th className="py-2 px-3">Físico</th>
                      <th className="py-2 px-3">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensSelecionado.map((it) => (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{it.itens_estoque?.nome ?? "—"}</td>
                        <td className="px-3 py-2">{numberBR(it.saldo_sistema, 3)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            defaultValue={String(it.saldo_fisico ?? 0)}
                            className="w-28 rounded border border-slate-300 px-2 py-1"
                            onBlur={(e) => {
                              void atualizarSaldoFisico(it, e.target.value);
                            }}
                          />
                        </td>
                        <td className={`px-3 py-2 font-medium ${Number(it.diferenca) === 0 ? "text-slate-600" : Number(it.diferenca) > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {numberBR(it.diferenca, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
