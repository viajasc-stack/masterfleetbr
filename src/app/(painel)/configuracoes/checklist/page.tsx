"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CHECKLIST_ETAPA_LABEL,
  MOTORISTA_CHECKLIST_ITENS_PADRAO,
  type ChecklistEtapa,
  type MotoristaChecklistConfigItem,
} from "@/lib/motoristaChecklistConfig";
import { supabase } from "@/lib/supabase/client";

type DbChecklistRow = {
  etapa: ChecklistEtapa;
  item_codigo: string;
  item_label: string;
  ativo: boolean;
};

export default function ConfiguracoesChecklistPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [items, setItems] = useState<MotoristaChecklistConfigItem[]>(
    MOTORISTA_CHECKLIST_ITENS_PADRAO.map((i) => ({ ...i, ativo: true }))
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg("");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileError || !profile?.empresa_id) {
        setMsg(profileError?.message ?? "Empresa não encontrada para este usuário.");
        setLoading(false);
        return;
      }

      const currentEmpresaId = String(profile.empresa_id);
      setEmpresaId(currentEmpresaId);

      const { data, error } = await supabase
        .from("motorista_checklist_config")
        .select("etapa,item_codigo,item_label,ativo")
        .eq("empresa_id", currentEmpresaId)
        .order("etapa", { ascending: true });

      if (error) {
        setMsg(`Erro ao carregar checklist: ${error.message}`);
        setLoading(false);
        return;
      }

      const dbRows = ((data ?? []) as DbChecklistRow[]) || [];
      const byKey = new Map<string, DbChecklistRow>();
      dbRows.forEach((r) => byKey.set(`${r.etapa}:${r.item_codigo}`, r));

      const merged = MOTORISTA_CHECKLIST_ITENS_PADRAO.map((base) => {
        const found = byKey.get(`${base.etapa}:${base.item_codigo}`);
        return {
          etapa: base.etapa,
          item_codigo: base.item_codigo,
          item_label: found?.item_label ?? base.item_label,
          ativo: found?.ativo ?? true,
        };
      });

      setItems(merged);
      setLoading(false);
    }

    void load();
  }, []);

  function toggle(etapa: ChecklistEtapa, itemCodigo: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.etapa === etapa && item.item_codigo === itemCodigo
          ? { ...item, ativo: !item.ativo }
          : item
      )
    );
  }

  async function salvar() {
    if (!empresaId) return;
    setSaving(true);
    setMsg("");

    const payload = items.map((item) => ({
      empresa_id: empresaId,
      etapa: item.etapa,
      item_codigo: item.item_codigo,
      item_label: item.item_label,
      ativo: item.ativo,
    }));

    const { error } = await supabase
      .from("motorista_checklist_config")
      .upsert(payload, { onConflict: "empresa_id,etapa,item_codigo" });

    setSaving(false);
    if (error) {
      setMsg(`Erro: ${error.message}`);
      return;
    }

    setMsg("Checklist do app motorista salvo com sucesso.");
  }

  const grouped = useMemo(() => {
    return {
      pre_partida: items.filter((i) => i.etapa === "pre_partida"),
      embarque: items.filter((i) => i.etapa === "embarque"),
      pos_servico: items.filter((i) => i.etapa === "pos_servico"),
    };
  }, [items]);

  if (loading) return <div className="text-slate-400 text-sm">Carregando checklist...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Configurações • Checklist</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Ative/desative os itens obrigatórios do checklist no app motorista.
        </p>
      </div>

      {msg ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.startsWith("Erro")
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-green-500/30 bg-green-500/10 text-green-300"
          }`}
        >
          {msg}
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        {(["pre_partida", "embarque", "pos_servico"] as ChecklistEtapa[]).map((etapa) => {
          const etapaItems = grouped[etapa];
          return (
            <div key={etapa} className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">{CHECKLIST_ETAPA_LABEL[etapa]}</h2>
              <div className="space-y-2">
                {etapaItems.map((item) => (
                  <div
                    key={`${item.etapa}:${item.item_codigo}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">{item.item_label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Código: {item.item_codigo}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggle(item.etapa, item.item_codigo)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        item.ativo ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                      aria-label={`${item.ativo ? "Desativar" : "Ativar"} ${item.item_label}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          item.ativo ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={salvar}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}
