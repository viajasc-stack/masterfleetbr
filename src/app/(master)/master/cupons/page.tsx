"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Coupon = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "fixed" | "percent";
  discount_value: number;
  min_invoice_amount_centavos: number;
  max_redemptions: number | null;
  max_redemptions_per_empresa: number;
  stackable: boolean;
  first_invoice_only: boolean;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  total_redemptions: number;
  total_discount_centavos: number;
};

type Empresa = {
  id: string;
  nome: string;
  status: string | null;
};

type Fatura = {
  id: string;
  empresa_id: string;
  empresa_nome: string | null;
  valor_centavos: number;
  status: string;
  vencimento: string | null;
};

type Redemption = {
  id: string;
  coupon_id: string;
  coupon_code: string;
  empresa_id: string;
  empresa_nome: string | null;
  fatura_id: string;
  status: string;
  discount_centavos: number;
  created_at: string;
  created_by?: string | null;
};

function moneyFromCentavos(v: number) {
  return (Number(v || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function datetimeLocalFromIso(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoFromDatetimeLocal(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function MasterCuponsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    discountType: "fixed" as "fixed" | "percent",
    discountValue: "",
    minInvoice: "0",
    maxRedemptions: "",
    maxPerEmpresa: "1",
    stackable: false,
    firstInvoiceOnly: false,
    active: true,
    validFrom: "",
    validUntil: "",
  });

  const [applyCouponId, setApplyCouponId] = useState("");
  const [applyEmpresaId, setApplyEmpresaId] = useState("");
  const [applyFaturaId, setApplyFaturaId] = useState("");
  const [applyObservacao, setApplyObservacao] = useState("");
  const [reversalReason, setReversalReason] = useState("");

  const openInvoices = useMemo(
    () => faturas.filter((f) => f.empresa_id === applyEmpresaId && f.status === "aberta"),
    [faturas, applyEmpresaId],
  );

  async function carregarTudo() {
    setLoading(true);
    setError("");

    const [couponsRes, empresasRes, faturasRes, redemptionsRes] = await Promise.all([
      supabase.rpc("master_list_billing_coupons"),
      supabase.rpc("master_list_empresas"),
      supabase.rpc("master_list_faturas", { p_limit: 500 }),
      supabase.rpc("master_list_billing_coupon_redemptions", { p_limit: 200 }),
    ]);

    if (couponsRes.error || empresasRes.error || faturasRes.error || redemptionsRes.error) {
      setError(
        couponsRes.error?.message ||
          empresasRes.error?.message ||
          faturasRes.error?.message ||
          redemptionsRes.error?.message ||
          "Erro ao carregar dados de cupons.",
      );
      setLoading(false);
      return;
    }

    setCoupons(((couponsRes.data as Coupon[] | null) ?? []).map((c) => ({ ...c, discount_value: Number(c.discount_value || 0) })));
    setEmpresas((((empresasRes.data as Array<{ id: string; nome: string; status: string | null }> | null) ?? []).map((e) => ({ id: e.id, nome: e.nome, status: e.status }))));
    setFaturas((faturasRes.data as Fatura[] | null) ?? []);
    setRedemptions((redemptionsRes.data as Redemption[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregarTudo();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function salvarCupom(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg("");
    setError("");

    const { error: upsertError } = await supabase.rpc("master_upsert_billing_coupon", {
      p_id: editingId,
      p_code: form.code,
      p_title: form.title,
      p_description: form.description || null,
      p_discount_type: form.discountType,
      p_discount_value: Number(form.discountValue || 0),
      p_min_invoice_amount_centavos: Math.round(Number(form.minInvoice || 0) * 100),
      p_max_redemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      p_max_redemptions_per_empresa: Math.max(Number(form.maxPerEmpresa || 1), 1),
      p_stackable: form.stackable,
      p_first_invoice_only: form.firstInvoiceOnly,
      p_active: form.active,
      p_valid_from: isoFromDatetimeLocal(form.validFrom),
      p_valid_until: isoFromDatetimeLocal(form.validUntil),
      p_metadata: {},
    });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setMsg(editingId ? "Cupom atualizado com sucesso." : "Cupom criado com sucesso.");
    setEditingId(null);
    setForm({
      code: "",
      title: "",
      description: "",
      discountType: "fixed",
      discountValue: "",
      minInvoice: "0",
      maxRedemptions: "",
      maxPerEmpresa: "1",
      stackable: false,
      firstInvoiceOnly: false,
      active: true,
      validFrom: "",
      validUntil: "",
    });
    await carregarTudo();
  }

  function editarCupom(c: Coupon) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      title: c.title,
      description: c.description ?? "",
      discountType: c.discount_type,
      discountValue: String(c.discount_value),
      minInvoice: String((c.min_invoice_amount_centavos || 0) / 100),
      maxRedemptions: c.max_redemptions ? String(c.max_redemptions) : "",
      maxPerEmpresa: String(c.max_redemptions_per_empresa || 1),
      stackable: c.stackable,
      firstInvoiceOnly: c.first_invoice_only,
      active: c.active,
      validFrom: datetimeLocalFromIso(c.valid_from),
      validUntil: datetimeLocalFromIso(c.valid_until),
    });
    setMsg("");
    setError("");
  }

  async function excluirCupom(couponId: string) {
    if (!confirm("Excluir este cupom? Esta ação não poderá ser desfeita.")) return;
    setError("");
    setMsg("");
    const { error: deleteError } = await supabase.rpc("master_delete_billing_coupon", { p_coupon_id: couponId });
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (editingId === couponId) {
      setEditingId(null);
    }
    setMsg("Cupom excluído com sucesso.");
    await carregarTudo();
  }

  async function aplicarCupom(ev: FormEvent) {
    ev.preventDefault();
    if (!applyCouponId || !applyEmpresaId) {
      setError("Selecione cupom e empresa para aplicar.");
      return;
    }
    setSaving(true);
    setError("");
    setMsg("");

    const { error: applyError } = await supabase.rpc("master_apply_billing_coupon_to_empresa", {
      p_coupon_id: applyCouponId,
      p_empresa_id: applyEmpresaId,
      p_fatura_id: applyFaturaId || null,
      p_observacao: applyObservacao || null,
    });

    setSaving(false);
    if (applyError) {
      setError(applyError.message);
      return;
    }

    setMsg("Cupom aplicado com sucesso na fatura.");
    setApplyFaturaId("");
    setApplyObservacao("");
    await carregarTudo();
  }

  async function estornarAplicacao(redemptionId: string) {
    if (!confirm("Estornar esta aplicação de cupom?")) return;
    setSaving(true);
    setError("");
    setMsg("");

    const { error: reverseError } = await supabase.rpc("master_reverse_billing_coupon_redemption", {
      p_redemption_id: redemptionId,
      p_reason: reversalReason.trim() || null,
    });

    setSaving(false);
    if (reverseError) {
      setError(reverseError.message);
      return;
    }

    setMsg("Aplicação estornada com sucesso.");
    setReversalReason("");
    await carregarTudo();
  }

  const resumo = useMemo(() => {
    const ativos = coupons.filter((c) => c.active).length;
    const totalEconomia = coupons.reduce((acc, c) => acc + Number(c.total_discount_centavos || 0), 0);
    const totalUsos = coupons.reduce((acc, c) => acc + Number(c.total_redemptions || 0), 0);
    return { total: coupons.length, ativos, totalEconomia, totalUsos };
  }, [coupons]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Cupons de Desconto</h1>
        <p className="text-sm text-slate-600 mt-0.5">Gestão profissional de cupons para billing SaaS (criação, aplicação e auditoria).</p>
      </div>

      {(msg || error) && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || msg}
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <Card label="Cupons cadastrados" value={String(resumo.total)} />
        <Card label="Cupons ativos" value={String(resumo.ativos)} />
        <Card label="Usos aplicados" value={String(resumo.totalUsos)} />
        <Card label="Desconto concedido" value={moneyFromCentavos(resumo.totalEconomia)} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Cadastro de cupom</h2>
        <form onSubmit={salvarCupom} className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <Input label="Código *" value={form.code} onChange={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))} placeholder="EX: BOASVINDAS50" />
            <Input label="Título *" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} placeholder="Campanha de boas-vindas" />
            <Input label="Desconto" type="number" step="0.01" value={form.discountValue} onChange={(v) => setForm((p) => ({ ...p, discountValue: v }))} placeholder="50" />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo de desconto</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as "fixed" | "percent" }))}>
                <option value="fixed">Fixo (R$)</option>
                <option value="percent">Percentual (%)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Input label="Descrição" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Condição comercial e observações" />
            </div>
            <Input label="Valor mínimo da fatura (R$)" type="number" step="0.01" value={form.minInvoice} onChange={(v) => setForm((p) => ({ ...p, minInvoice: v }))} placeholder="0" />
            <Input label="Limite total de usos" type="number" value={form.maxRedemptions} onChange={(v) => setForm((p) => ({ ...p, maxRedemptions: v }))} placeholder="vazio = ilimitado" />
            <Input label="Máx. por empresa" type="number" value={form.maxPerEmpresa} onChange={(v) => setForm((p) => ({ ...p, maxPerEmpresa: v }))} placeholder="1" />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Válido de</label>
              <input type="datetime-local" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.validFrom} onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Válido até</label>
              <input type="datetime-local" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.validUntil} onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.stackable} onChange={(e) => setForm((p) => ({ ...p, stackable: e.target.checked }))} /> Permitir empilhar com outros descontos</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.firstInvoiceOnly} onChange={(e) => setForm((p) => ({ ...p, firstInvoiceOnly: e.target.checked }))} /> Somente primeira fatura paga</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} /> Cupom ativo</label>
          </div>

          <div className="flex gap-2">
            <button disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Salvando..." : editingId ? "Atualizar cupom" : "Criar cupom"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ code: "", title: "", description: "", discountType: "fixed", discountValue: "", minInvoice: "0", maxRedemptions: "", maxPerEmpresa: "1", stackable: false, firstInvoiceOnly: false, active: true, validFrom: "", validUntil: "" });
                }}
                className="border border-slate-300 px-4 py-2 rounded-md text-sm hover:bg-slate-50"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Aplicar cupom em empresa</h2>
        <form onSubmit={aplicarCupom} className="grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cupom</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={applyCouponId} onChange={(e) => setApplyCouponId(e.target.value)}>
              <option value="">Selecione...</option>
              {coupons.map((c) => <option key={c.id} value={c.id}>{c.code} • {c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Empresa</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={applyEmpresaId} onChange={(e) => { setApplyEmpresaId(e.target.value); setApplyFaturaId(""); }}>
              <option value="">Selecione...</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fatura aberta (opcional)</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={applyFaturaId} onChange={(e) => setApplyFaturaId(e.target.value)}>
              <option value="">Escolher automaticamente</option>
              {openInvoices.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id.slice(0, 8)} • {moneyFromCentavos(f.valor_centavos)} • {f.vencimento ? new Date(f.vencimento).toLocaleDateString("pt-BR") : "sem venc."}
                </option>
              ))}
            </select>
          </div>
          <Input label="Observação" value={applyObservacao} onChange={setApplyObservacao} placeholder="Ex: negociação comercial Q2" />
          <div className="md:col-span-4">
            <button disabled={saving} className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-700 disabled:opacity-60">
              Aplicar cupom
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Catálogo de cupons</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando cupons...</div>
        ) : coupons.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum cupom cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left bg-slate-50">
                <th className="px-4 py-3">Cupom</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Regras</th>
                <th className="px-4 py-3">Uso</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.code}</div>
                    <div className="text-xs text-slate-500">{c.title}</div>
                    {c.description ? <div className="text-xs text-slate-500 mt-1">{c.description}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.discount_type === "percent" ? `${c.discount_value}%` : `R$ ${Number(c.discount_value || 0).toFixed(2)}`}
                    <div className="text-xs text-slate-500 mt-1">Mínimo: {moneyFromCentavos(c.min_invoice_amount_centavos || 0)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>Empilhável: {c.stackable ? "Sim" : "Não"}</div>
                    <div>1ª fatura: {c.first_invoice_only ? "Sim" : "Não"}</div>
                    <div>Máx/empresa: {c.max_redemptions_per_empresa}</div>
                    <div>Máx total: {c.max_redemptions ?? "Ilimitado"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{c.total_redemptions} uso(s)</div>
                    <div className="text-xs text-slate-500">{moneyFromCentavos(c.total_discount_centavos || 0)} concedidos</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded border ${c.active ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-slate-50"}`}>
                      {c.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => editarCupom(c)} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-100">Editar</button>
                      <button onClick={() => excluirCupom(c.id)} className="text-xs border border-rose-300 text-rose-700 rounded px-2 py-1 hover:bg-rose-50">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Auditoria de aplicações</h2>
          <div className="mt-3 max-w-md">
            <Input label="Motivo padrão do estorno (opcional)" value={reversalReason} onChange={setReversalReason} placeholder="Ex: cortesia aprovada pela diretoria" />
          </div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando auditoria...</div>
        ) : redemptions.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhuma aplicação encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left bg-slate-50">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cupom</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Fatura</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.coupon_code}</td>
                  <td className="px-4 py-3 text-slate-700">{r.empresa_nome ?? r.empresa_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{r.fatura_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700">{moneyFromCentavos(r.discount_centavos || 0)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.status}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "applied" ? (
                      <button
                        disabled={saving}
                        onClick={() => void estornarAplicacao(r.id)}
                        className="text-xs border border-rose-300 text-rose-700 rounded px-2 py-1 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Estornar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
