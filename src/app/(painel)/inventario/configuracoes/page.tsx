"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureConfiguracoesInventario, errorMessage, getEmpresaIdFromSession } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type ConfigInventario = {
  id: string;
  permitir_estoque_negativo: boolean;
  exigir_motivo_ajuste: boolean;
  exigir_aprovacao_compras: boolean;
  habilitar_controle_lote: boolean;
  habilitar_controle_validade: boolean;
  habilitar_multiplos_locais: boolean;
  habilitar_reserva_estoque: boolean;
};

export default function ConfiguracoesInventarioPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [configId, setConfigId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ConfigInventario, "id">>({
    permitir_estoque_negativo: false,
    exigir_motivo_ajuste: true,
    exigir_aprovacao_compras: false,
    habilitar_controle_lote: false,
    habilitar_controle_validade: false,
    habilitar_multiplos_locais: true,
    habilitar_reserva_estoque: false,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const empresaId = await getEmpresaIdFromSession();
        if (!empresaId) throw new Error("Não foi possível identificar a empresa da sessão.");

        const id = await ensureConfiguracoesInventario(empresaId);
        if (!id) throw new Error("Falha ao inicializar configurações do inventário.");

        const { data, error } = await supabase
          .from("configuracoes_inventario")
          .select("id, permitir_estoque_negativo, exigir_motivo_ajuste, exigir_aprovacao_compras, habilitar_controle_lote, habilitar_controle_validade, habilitar_multiplos_locais, habilitar_reserva_estoque")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Configuração do inventário não encontrada.");

        setConfigId(String(data.id));
        setForm({
          permitir_estoque_negativo: Boolean(data.permitir_estoque_negativo),
          exigir_motivo_ajuste: Boolean(data.exigir_motivo_ajuste),
          exigir_aprovacao_compras: Boolean(data.exigir_aprovacao_compras),
          habilitar_controle_lote: Boolean(data.habilitar_controle_lote),
          habilitar_controle_validade: Boolean(data.habilitar_controle_validade),
          habilitar_multiplos_locais: Boolean(data.habilitar_multiplos_locais),
          habilitar_reserva_estoque: Boolean(data.habilitar_reserva_estoque),
        });
      } catch (e) {
        setErro(errorMessage(e, "Falha ao carregar configurações."));
      } finally {
        setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function setBool<K extends keyof Omit<ConfigInventario, "id">>(key: K, value: boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!configId) return;

    setSaving(true);
    setErro("");
    setOkMsg("");

    const { error } = await supabase
      .from("configuracoes_inventario")
      .update(form)
      .eq("id", configId);

    setSaving(false);
    if (error) {
      setErro(errorMessage(error, "Falha ao salvar configurações."));
      return;
    }

    setOkMsg("Configurações salvas com sucesso.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Configurações"
        description="Parâmetros gerais que controlam o comportamento operacional do módulo de inventário."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        {loading ? <div className="text-sm text-slate-500">Carregando configurações...</div> : null}

        {!loading ? (
          <>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.permitir_estoque_negativo} onChange={(e) => setBool("permitir_estoque_negativo", e.target.checked)} />
              <span>
                <strong>Permitir estoque negativo</strong>
                <div className="text-slate-500">Quando habilitado, saídas/ajustes negativos podem ultrapassar o saldo atual.</div>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.exigir_motivo_ajuste} onChange={(e) => setBool("exigir_motivo_ajuste", e.target.checked)} />
              <span>
                <strong>Exigir motivo em ajustes</strong>
                <div className="text-slate-500">Mantém rastreabilidade e auditoria obrigatória para divergências.</div>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.exigir_aprovacao_compras} onChange={(e) => setBool("exigir_aprovacao_compras", e.target.checked)} />
              <span>
                <strong>Exigir aprovação de compras</strong>
                <div className="text-slate-500">Pedidos de compra devem passar por etapa de aprovação antes do envio.</div>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.habilitar_controle_lote} onChange={(e) => setBool("habilitar_controle_lote", e.target.checked)} />
              <span>
                <strong>Habilitar controle por lote</strong>
                <div className="text-slate-500">Ativa campos e regras de lote nos itens que utilizam rastreio.</div>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.habilitar_controle_validade} onChange={(e) => setBool("habilitar_controle_validade", e.target.checked)} />
              <span>
                <strong>Habilitar controle de validade</strong>
                <div className="text-slate-500">Permite monitorar vencimento para itens perecíveis e insumos críticos.</div>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.habilitar_multiplos_locais} onChange={(e) => setBool("habilitar_multiplos_locais", e.target.checked)} />
              <span>
                <strong>Habilitar múltiplos locais</strong>
                <div className="text-slate-500">Permite estoque distribuído em almoxarifados/depostos diferentes.</div>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.habilitar_reserva_estoque} onChange={(e) => setBool("habilitar_reserva_estoque", e.target.checked)} />
              <span>
                <strong>Habilitar reserva de estoque</strong>
                <div className="text-slate-500">Ativa estratégia de bloqueio de saldo para ordens ou demandas futuras.</div>
              </span>
            </label>

            <div>
              <button disabled={saving} className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar configurações"}
              </button>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}
