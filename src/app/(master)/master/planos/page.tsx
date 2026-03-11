"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Plano = {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  valor_centavos: number;
  ativo: boolean;
  ordem: number;
  modulos: unknown;
};

const MODULOS_CATALOGO = [
  "dashboard",
  "ordens_servico",
  "clientes",
  "veiculos",
  "motoristas",
  "financeiro",
  "inventario",
  "relatorios",
  "manutencao",
  "agenda",
  "viagens",
  "api_integracoes",
  "automacoes",
];

const PRESETS = {
  basico: ["dashboard", "ordens_servico", "clientes", "veiculos", "motoristas"],
  intermediario: ["dashboard", "ordens_servico", "clientes", "veiculos", "motoristas", "financeiro", "inventario", "relatorios"],
  top: ["dashboard", "ordens_servico", "clientes", "veiculos", "motoristas", "financeiro", "inventario", "relatorios", "manutencao", "agenda", "viagens", "api_integracoes", "automacoes"],
} as const;

function parseModulos(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  return [];
}

function slug(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function MasterPlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    valor: "",
    ordem: "",
    modulos: [] as string[],
  });

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase.rpc("master_list_planos");
    if (error) {
      setMsg(error.message);
      setPlanos([]);
      setLoading(false);
      return;
    }
    setPlanos((data as Plano[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const resumo = useMemo(() => ({
    total: planos.length,
    ativos: planos.filter((p) => p.ativo).length,
    inativos: planos.filter((p) => !p.ativo).length,
  }), [planos]);

  function aplicarPreset(preset: keyof typeof PRESETS) {
    setForm((prev) => ({
      ...prev,
      codigo: preset,
      nome: preset === "basico" ? "Básico" : preset === "intermediario" ? "Intermediário" : "Top",
      modulos: [...PRESETS[preset]],
    }));
  }

  function toggleModulo(mod: string) {
    setForm((prev) => ({
      ...prev,
      modulos: prev.modulos.includes(mod)
        ? prev.modulos.filter((m) => m !== mod)
        : [...prev.modulos, mod],
    }));
  }

  async function salvarNovoPlano() {
    if (!form.nome.trim()) return;
    setSaving(true);
    setMsg("");

    const { error } = await supabase.rpc("master_save_plano", {
      p_id: editingId,
      p_codigo: slug(form.codigo || form.nome),
      p_nome: form.nome.trim(),
      p_descricao: form.descricao.trim() || null,
      p_valor_centavos: form.valor ? Math.round(Number(form.valor) * 100) : 0,
      p_ordem: form.ordem ? Math.trunc(Number(form.ordem)) : 0,
      p_ativo: editingId ? null : true,
      p_modulos: form.modulos,
    });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(editingId ? "Plano atualizado com sucesso." : "Plano criado com sucesso.");
    setEditingId(null);
    setForm({ codigo: "", nome: "", descricao: "", valor: "", ordem: "", modulos: [] });
    await carregar();
  }

  async function toggleAtivo(plano: Plano) {
    const { error } = await supabase.rpc("master_toggle_plano_ativo", {
      p_plano_id: plano.id,
      p_ativo: !plano.ativo,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    await carregar();
  }

  function editarPlano(plano: Plano) {
    setEditingId(plano.id);
    setForm({
      codigo: plano.codigo ?? "",
      nome: plano.nome,
      descricao: plano.descricao ?? "",
      valor: String((plano.valor_centavos ?? 0) / 100),
      ordem: String(plano.ordem ?? 0),
      modulos: parseModulos(plano.modulos),
    });
    setMsg("");
  }

  const moeda = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Planos por módulos</h1>
        <p className="text-slate-600 text-sm mt-0.5">Estruture seus planos por pacote de funcionalidades (não por usuário).</p>
      </div>

      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Total de planos</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{resumo.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-xs text-emerald-700">Ativos</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{resumo.ativos}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-xs text-amber-700">Inativos</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{resumo.inativos}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => aplicarPreset("basico")} className="px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50">Preset Básico</button>
          <button onClick={() => aplicarPreset("intermediario")} className="px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50">Preset Intermediário</button>
          <button onClick={() => aplicarPreset("top")} className="px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50">Preset Top</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Código</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="basico" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome *</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Básico" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Valor mensal (R$)</label>
            <input type="number" step="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} placeholder="99.00" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Ordem</label>
            <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.ordem} onChange={(e) => setForm((p) => ({ ...p, ordem: e.target.value }))} placeholder="10" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Descrição</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Plano ideal para começar" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-2">Módulos incluídos</label>
          <div className="flex flex-wrap gap-2">
            {MODULOS_CATALOGO.map((m) => {
              const ativo = form.modulos.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleModulo(m)}
                  className={`px-2.5 py-1.5 rounded-md text-xs border transition ${ativo ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <button onClick={salvarNovoPlano} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Salvando..." : editingId ? "Atualizar plano" : "Salvar plano"}
          </button>
          {editingId ? (
            <button
              onClick={() => {
                setEditingId(null);
                setForm({ codigo: "", nome: "", descricao: "", valor: "", ordem: "", modulos: [] });
              }}
              className="ml-2 px-4 py-2 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar edição
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Carregando...</div>
        ) : planos.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">Nenhum plano cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 text-slate-500">Plano</th>
                <th className="px-4 py-3 text-slate-500">Valor</th>
                <th className="px-4 py-3 text-slate-500">Módulos</th>
                <th className="px-4 py-3 text-slate-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => {
                const modulos = parseModulos(p.modulos);
                return (
                  <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.nome}</div>
                      <div className="text-xs text-slate-500">{p.codigo ?? "sem-codigo"}</div>
                      {p.descricao ? <div className="text-xs text-slate-500 mt-1">{p.descricao}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{moeda(Number(p.valor_centavos || 0))}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 max-w-[420px]">
                        {modulos.length === 0 ? (
                          <span className="text-xs text-slate-400">Sem módulos definidos</span>
                        ) : (
                          modulos.map((m) => (
                            <span key={m} className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">{m}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded border ${p.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => editarPlano(p)} className="text-xs text-indigo-700 hover:text-indigo-900 underline">
                          Editar
                        </button>
                        <button onClick={() => toggleAtivo(p)} className="text-xs text-slate-600 hover:text-slate-900 underline">
                          {p.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
