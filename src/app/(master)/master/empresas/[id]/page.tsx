"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Empresa = { id: string; nome: string; created_at: string };
type Assinatura = {
  id: string;
  status: string;
  trial_ate: string | null;
  proxima_cobranca: string | null;
  plano_id: string | null;
  planos: { nome: string } | null;
};
type Plano = { id: string; nome: string; valor_centavos: number };
type Fatura = { id: string; valor_centavos: number; status: string; created_at: string; vencimento: string | null; pix_copia_cola?: string | null; pix_qr_code?: string | null };
type Perfil = { user_id: string; nome: string | null; role: string };

const STATUS_OPTIONS = ["trial", "ativa", "past_due", "bloqueada", "cancelada"];

export default function DetalheEmpresaPage() {
  const { id } = useParams<{ id: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      const [
        { data: emp },
        { data: assin },
        { data: pl },
        { data: fat },
        { data: perf },
      ] = await Promise.all([
        supabase.from("empresas").select("*").eq("id", id).maybeSingle(),
        supabase.from("assinaturas").select("*, planos(nome)").eq("empresa_id", id).maybeSingle(),
        supabase.from("planos").select("id, nome, valor_centavos").eq("ativo", true).order("ordem"),
        supabase.from("faturas").select("id, valor_centavos, status, created_at, vencimento").eq("empresa_id", id).order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("user_id, nome, role").eq("empresa_id", id),
      ]);
      setEmpresa(emp as Empresa);
      setAssinatura(assin as unknown as Assinatura);
      setPlanos((pl as Plano[]) ?? []);
      setFaturas((fat as unknown as Fatura[]) ?? []);
      setPerfis((perf as Perfil[]) ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  async function mudarStatus(novoStatus: string) {
    if (!assinatura) return;
    setSaving(true); setMsg("");
    const { error } = await supabase.from("assinaturas").update({ status: novoStatus }).eq("id", assinatura.id);
    if (!error) {
      setAssinatura((prev) => prev ? { ...prev, status: novoStatus } : prev);
      setMsg(`Status atualizado para "${novoStatus}".`);
    }
    setSaving(false);
  }

async function gerarPixFatura(faturaId: string, empresaId: string, setMsg: (s: string) => void, setFaturas: (u: Fatura[]) => void) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-pix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token ?? ANON_KEY}`,
    },
    body: JSON.stringify({ fatura_id: faturaId }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    setMsg(json.error ?? "Erro ao gerar PIX.");
    return;
  }
  setMsg("PIX gerado para a fatura.");
  const { data } = await supabase.from("faturas").select("id, valor_centavos, status, created_at, vencimento")
    .eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(10);
  setFaturas((data as unknown as Fatura[]) ?? []);
}

  async function mudarPlano(planoId: string) {
    if (!assinatura) return;
    setSaving(true); setMsg("");
    const plano = planos.find((p) => p.id === planoId);
    const { error } = await supabase.from("assinaturas").update({ plano_id: planoId }).eq("id", assinatura.id);
    if (!error) {
      setAssinatura((prev) => prev ? { ...prev, plano_id: planoId, planos: plano ? { nome: plano.nome } : null } : prev);
      setMsg("Plano atualizado.");
    }
    setSaving(false);
  }

  async function gerarFatura() {
    if (!assinatura) return;
    setSaving(true); setMsg("");
    const plano = planos.find((p) => p.id === assinatura.plano_id);
    const valor = plano?.valor_centavos ?? 9900;
    const venc = new Date();
    venc.setDate(venc.getDate() + 5);
    const { error } = await supabase.from("faturas").insert({
      empresa_id: id,
      assinatura_id: assinatura.id,
      valor_centavos: valor,
      status: "aberta",
      vencimento: venc.toISOString().slice(0, 10),
    });
    if (!error) {
      setMsg("Fatura gerada com sucesso.");
      const { data } = await supabase.from("faturas").select("id, valor_centavos, status, created_at, vencimento")
        .eq("empresa_id", id).order("created_at", { ascending: false }).limit(10);
      setFaturas((data as unknown as Fatura[]) ?? []);
    }
    setSaving(false);
  }

  async function marcarPago(faturaId: string) {
    await supabase.from("faturas").update({ status: "paga" }).eq("id", faturaId);
    setFaturas((prev) => prev.map((f) => f.id === faturaId ? { ...f, status: "paga" } : f));
    setMsg("Fatura marcada como paga.");
  }
 
  async function copiarCopiaCola(codigo: string | null | undefined) {
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo);
    setMsg("Código PIX copiado.");
    setTimeout(() => setMsg(""), 3000);
  }

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;
  if (!empresa) return <div className="text-slate-400 text-sm">Empresa não encontrada.</div>;

  const fmt = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/master/empresas" className="text-sm text-slate-400 hover:text-white">← Empresas</Link>
        <h1 className="text-xl font-semibold text-white">{empresa.nome}</h1>
      </div>

      {msg && <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{msg}</div>}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-5 text-sm">
        <h2 className="font-semibold text-white">Assinatura</h2>

        {!assinatura ? (
          <p className="text-slate-500">Sem assinatura cadastrada.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500">Status atual</span>
                <div><span className={`text-xs px-2 py-1 rounded border ${
                  assinatura.status === "ativa" ? "border-green-400/40 text-green-300 bg-green-500/10"
                  : assinatura.status === "trial" ? "border-blue-400/40 text-blue-300 bg-blue-500/10"
                  : assinatura.status === "bloqueada" ? "border-red-400/40 text-red-300 bg-red-500/10"
                  : "border-amber-400/40 text-amber-300 bg-amber-500/10"}`}>{assinatura.status}</span></div>
              </div>
              <div>
                <span className="text-slate-500">Plano</span>
                <div className="text-white font-medium">{assinatura.planos?.nome ?? "Sem plano"}</div>
              </div>
              {assinatura.trial_ate && (
                <div><span className="text-slate-500">Trial até</span>
                  <div className="text-white">{new Date(assinatura.trial_ate).toLocaleDateString("pt-BR")}</div></div>
              )}
              {assinatura.proxima_cobranca && (
                <div><span className="text-slate-500">Próx. cobrança</span>
                  <div className="text-white">{new Date(assinatura.proxima_cobranca).toLocaleDateString("pt-BR")}</div></div>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div>
                <label className="block text-slate-400 mb-1">Mudar status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => mudarStatus(s)} disabled={saving || assinatura.status === s}
                      className={`text-xs px-3 py-1.5 rounded border transition ${assinatura.status === s ? "border-slate-600 text-slate-600 cursor-default" : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {planos.length > 0 && (
                <div>
                  <label className="block text-slate-400 mb-1">Mudar plano</label>
                  <div className="flex flex-wrap gap-2">
                    {planos.map((p) => (
                      <button key={p.id} onClick={() => mudarPlano(p.id)} disabled={saving || assinatura.plano_id === p.id}
                        className={`text-xs px-3 py-1.5 rounded border transition ${assinatura.plano_id === p.id ? "border-slate-600 text-slate-600 cursor-default" : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"}`}>
                        {p.nome} ({fmt(p.valor_centavos)}/mês)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={gerarFatura} disabled={saving}
                className="border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 px-4 py-2 rounded-lg text-xs transition disabled:opacity-60">
                Gerar Fatura Manualmente
              </button>
            </div>
          </>
        )}
      </div>

      {perfis.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm">
          <h2 className="font-semibold text-white mb-4">Usuários ({perfis.length})</h2>
          <div className="space-y-2">
            {perfis.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between">
                <span className="text-slate-300">{p.nome ?? p.user_id.slice(0, 8) + "..."}</span>
                <span className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded">{p.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {faturas.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm">
          <h2 className="font-semibold text-white mb-4">Faturas recentes</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-slate-800 text-slate-500">
              <th className="py-2 pr-4">Data</th>
              <th className="py-2 pr-4">Valor</th>
              <th className="py-2 pr-4">Vencimento</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2"></th>
            </tr></thead>
            <tbody>
              {faturas.map((f) => (
                <tr key={f.id} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-2 pr-4 text-slate-400">{new Date(f.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 pr-4 text-white font-medium">{fmt(f.valor_centavos)}</td>
                  <td className="py-2 pr-4 text-slate-400">{f.vencimento ? new Date(f.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-1 rounded border ${f.status === "paga" ? "border-green-500/40 text-green-300" : f.status === "cancelada" ? "border-slate-600 text-slate-500" : "border-amber-500/40 text-amber-300"}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="py-2">
                    {f.status === "aberta" ? (
                      <div className="flex gap-3">
                        <button onClick={() => gerarPixFatura(f.id, id as string, setMsg, setFaturas)} className="text-xs text-emerald-400 hover:underline">
                          Gerar PIX
                        </button>
                        <button onClick={() => marcarPago(f.id)} className="text-xs text-sky-400 hover:underline">
                          Marcar paga
                        </button>
                      </div>
                    ) : (
                      f.pix_copia_cola ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-mono">{f.pix_copia_cola.slice(0, 20)}...</span>
                          <button onClick={() => copiarCopiaCola(f.pix_copia_cola)} className="text-xs text-slate-400 hover:text-white">
                            Copiar
                          </button>
                        </div>
                      ) : null
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
