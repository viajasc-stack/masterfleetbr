"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type EmpresaRow = {
  id: string;
  nome: string;
  email: string | null;
  created_at: string;
  status: string | null;
  proxima_cobranca: string | null;
  trial_ate: string | null;
  modulos_ativos: string[] | null;
  total_modulos: number | null;
  valor_mensal_centavos: number | null;
};

const MODULE_LABELS: Record<string, string> = {
  operacional: "Operacional",
  configuracoes: "Configurações",
  usuarios: "Usuários",
  suporte: "Suporte",
  inventario: "Estoque",
  financeiro: "Financeiro",
  manutencao: "Manutenção",
  oficina: "Oficina",
  agenda: "Agenda",
  viagens: "Viagens",
  relatorios: "Relatórios",
};

const HIDDEN_MODULE_CODES = new Set(["api_integracoes", "automacoes"]);

function formatModuloLabel(codigo: string) {
  return MODULE_LABELS[codigo] ?? codigo;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M3 21h4l11-11a2.1 2.1 0 0 0-3-3L4 18l-1 3Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function badgeStatus(s: string | null) {
  if (s === "ativa") return "border-green-200 text-green-700 bg-green-50";
  if (s === "trial") return "border-blue-200 text-blue-700 bg-blue-50";
  if (s === "past_due") return "border-amber-200 text-amber-700 bg-amber-50";
  if (s === "bloqueada") return "border-red-200 text-red-700 bg-red-50";
  if (s === "cancelada") return "border-slate-300 text-slate-600 bg-slate-100";
  return "border-slate-200 text-slate-500 bg-white";
}

function formatData(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export default function MasterEmpresasPage() {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("bloquear");
  const [bulkCouponId, setBulkCouponId] = useState("");

  const [creating, setCreating] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    setMsg("");
    const { data, error } = await supabase.rpc("master_list_empresas");
    if (error) {
      setErro(error.message);
      setEmpresas([]);
      setLoading(false);
      return;
    }
    setEmpresas((data as EmpresaRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas
      .filter((e) => (filtroStatus === "todos" ? true : (e.status ?? "sem_assinatura") === filtroStatus))
      .filter((e) => !q || e.nome.toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q));
  }, [empresas, busca, filtroStatus]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllCurrent() {
    const ids = filtradas.map((e) => e.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }

  async function adicionarEmpresa() {
    if (!novoNome.trim()) return;
    setCreating(true);
    setErro("");
    setMsg("");
    const { error } = await supabase.rpc("master_create_empresa", {
      p_nome: novoNome.trim(),
      p_email: novoEmail.trim() || null,
    });
    setCreating(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNovoNome("");
    setNovoEmail("");
    setMsg("Empresa adicionada com sucesso.");
    await carregar();
  }

  async function excluirSelecionadas() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Excluir ${selectedIds.length} empresa(s)? Esta ação não pode ser desfeita.`)) return;
    setErro("");
    setMsg("");
    const { error } = await supabase.rpc("master_delete_empresas", { p_ids: selectedIds });
    if (error) {
      setErro(error.message);
      return;
    }
    setSelectedIds([]);
    setMsg("Empresas excluídas com sucesso.");
    await carregar();
  }

  async function excluirUma(id: string) {
    if (!confirm("Excluir esta empresa? Esta ação não pode ser desfeita.")) return;
    setErro("");
    setMsg("");
    const { error } = await supabase.rpc("master_delete_empresas", { p_ids: [id] });
    if (error) {
      setErro(error.message);
      return;
    }
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setMsg("Empresa excluída com sucesso.");
    await carregar();
  }

  async function executarAcaoMassa() {
    if (selectedIds.length === 0) return;
    setErro("");
    setMsg("");

    const payload: Record<string, string> = {};
    if (bulkCouponId) payload.coupon_id = bulkCouponId;

    const { data, error } = await supabase.rpc("master_bulk_empresa_action", {
      p_ids: selectedIds,
      p_action: bulkAction,
      p_payload: payload,
    });

    if (error) {
      setErro(error.message);
      return;
    }

    const total = Number(data ?? 0);
    setMsg(`Ação "${bulkAction}" executada em ${total} empresa(s).`);
    await carregar();
  }

  async function acessarPainelEmpresa(id: string) {
    setErro("");
    const { data, error } = await supabase.rpc("master_assume_empresa", { p_empresa_id: id });
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível assumir a empresa.");
      return;
    }
    window.location.href = "/dashboard";
  }

  const allCurrentSelected = filtradas.length > 0 && filtradas.every((e) => selectedIds.includes(e.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Empresas</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{empresas.length} empresa(s) cadastrada(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregar} className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition">
            Recarregar
          </button>
          <button
            onClick={excluirSelecionadas}
            disabled={selectedIds.length === 0}
            className="border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
          >
            Excluir em massa ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">Ações em massa</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
            <option value="bloquear">Bloquear</option>
            <option value="ativar">Ativar</option>
            <option value="trial_plus_7">Extender trial +7 dias</option>
            <option value="aplicar_cupom">Aplicar cupom</option>
          </select>
          <input
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={bulkCouponId}
            onChange={(e) => setBulkCouponId(e.target.value)}
            placeholder="coupon_id (aplicar_cupom)"
          />
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex items-center">
            Gerenciamento de módulos é feito na edição individual da empresa.
          </div>
          <button
            onClick={executarAcaoMassa}
            disabled={selectedIds.length === 0}
            className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-md text-sm transition disabled:opacity-60"
          >
            Executar em selecionadas ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Adicionar empresa manualmente</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome da empresa"
          />
          <input
            className="bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400"
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
            placeholder="Email da empresa (opcional)"
          />
          <button
            onClick={adicionarEmpresa}
            disabled={creating || !novoNome.trim()}
            className="bg-indigo-600 text-white hover:bg-indigo-500 px-4 py-2 rounded-md text-sm transition disabled:opacity-60"
          >
            {creating ? "Adicionando..." : "Adicionar empresa"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Buscar</label>
            <input
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou email..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="ativa">Ativa</option>
              <option value="trial">Trial</option>
              <option value="past_due">Past Due</option>
              <option value="bloqueada">Bloqueada</option>
              <option value="cancelada">Cancelada</option>
              <option value="sem_assinatura">Sem assinatura</option>
            </select>
          </div>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {erro}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {msg}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">Nenhuma empresa encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left bg-slate-50">
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allCurrentSelected} onChange={toggleSelectAllCurrent} />
                </th>
                <th className="px-4 py-3 text-slate-600 font-medium">Empresa</th>
                <th className="px-4 py-3 text-slate-600 font-medium">Status</th>
                <th className="px-4 py-3 text-slate-600 font-medium">Módulos</th>
                <th className="px-4 py-3 text-slate-600 font-medium">Valor mensal</th>
                <th className="px-4 py-3 text-slate-600 font-medium">Vencimento</th>
                <th className="px-4 py-3 text-slate-600 font-medium">Cadastro</th>
                <th className="px-4 py-3 text-slate-600 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e) => {
                const isSelected = selectedIds.includes(e.id);
                const vencimento = e.proxima_cobranca ? formatData(e.proxima_cobranca) : (e.trial_ate ? `Trial até ${formatData(e.trial_ate)}` : "—");
                const modulos = (Array.isArray(e.modulos_ativos) ? e.modulos_ativos : []).filter(
                  (codigo) => !HIDDEN_MODULE_CODES.has(codigo),
                );
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(e.id)} />
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <Link href={`/master/empresas/${e.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                          {e.nome}
                        </Link>
                        <div className="text-xs text-slate-500">{e.email ?? "sem email"}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded border ${badgeStatus(e.status ?? null)}`}>
                        {e.status ?? "sem assinatura"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {modulos.length === 0 ? (
                        "—"
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {modulos.slice(0, 3).map((m) => (
                            <span key={m} className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">{formatModuloLabel(m)}</span>
                          ))}
                          {modulos.length > 3 ? <span className="text-[11px] text-slate-500">+{modulos.length - 3}</span> : null}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{((e.valor_mensal_centavos ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="px-4 py-3 text-slate-600">{vencimento}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatData(e.created_at)}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => acessarPainelEmpresa(e.id)}
                          title="Acessar painel da empresa (suporte)"
                          aria-label="Acessar painel da empresa"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        >
                          <EyeIcon />
                        </button>
                        <Link
                          href={`/master/empresas/${e.id}/editar`}
                          title="Editar empresa"
                          aria-label="Editar empresa"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          <PencilIcon />
                        </Link>
                        <button onClick={() => excluirUma(e.id)} title="Excluir empresa" aria-label="Excluir empresa" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50">
                          <TrashIcon />
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
