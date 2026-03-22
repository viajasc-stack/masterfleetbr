"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Empresa = { id: string; nome: string };
type Risco = { empresa_id: string; empresa_nome: string; score: number; status_assinatura: string; faturas_vencidas: number; tickets_abertos: number; tickets_criticos: number };
type Audit = { id: string; empresa_nome: string; action: string; created_at: string };
type Pipeline = { id: string; empresa_id: string; empresa_nome: string; stage: string; owner: string | null; next_action: string | null; updated_at: string };
type Broadcast = { id: string; title: string; status: string; created_at: string };
type Rollout = { id: string; feature_code: string; rollout_percent: number; status: string; updated_at: string };
type Negotiation = { id: string; empresa_nome: string; status: string; acordo_valor_centavos: number; updated_at: string };
type Lgpd = { id: string; empresa_nome: string; tipo: string; status: string; updated_at: string };
type Onboarding = { id: string; empresa_nome: string; score: number; status: string; updated_at: string };
type Kb = { id: string; categoria: string; titulo: string; ativo: boolean; updated_at: string };
type Macro = { id: string; titulo: string; ativo: boolean; updated_at: string };

export default function MasterGovernancaPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("bloquear");
  const [bulkPlanoId, setBulkPlanoId] = useState("");
  const [bulkCouponId, setBulkCouponId] = useState("");

  const [health, setHealth] = useState<Record<string, unknown>>({});
  const [dataRoom, setDataRoom] = useState<Record<string, unknown>>({});
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [rollouts, setRollouts] = useState<Rollout[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [lgpds, setLgpds] = useState<Lgpd[]>([]);
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [kbs, setKbs] = useState<Kb[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);

  const [pipelineForm, setPipelineForm] = useState({ empresa_id: "", stage: "trial", owner: "", next_action: "", notes: "" });
  const [broadcastForm, setBroadcastForm] = useState({ title: "", content: "" });
  const [rolloutForm, setRolloutForm] = useState({ feature_code: "", rollout_percent: "10", status: "draft" });
  const [negotiationForm, setNegotiationForm] = useState({ empresa_id: "", acordo_valor_centavos: "0", observacao: "" });
  const [lgpdForm, setLgpdForm] = useState({ empresa_id: "", tipo: "acesso", status: "aberta", detalhes: "" });
  const [onboardingForm, setOnboardingForm] = useState({ empresa_id: "", score: "0", status: "inicial" });
  const [kbForm, setKbForm] = useState({ categoria: "geral", titulo: "", conteudo: "" });
  const [macroForm, setMacroForm] = useState({ titulo: "", conteudo: "" });
  const [filtroRisco, setFiltroRisco] = useState("todos");
  const [filtroAuditAction, setFiltroAuditAction] = useState("");
  const [filtroPipelineStage, setFiltroPipelineStage] = useState("todos");

  async function carregarTudo() {
    setLoading(true);
    setErro("");
    const [
      empresasRes,
      healthRes,
      dataRoomRes,
      riscoRes,
      auditRes,
      pipelineRes,
      broadcastRes,
      rolloutRes,
      negotiationRes,
      lgpdRes,
      onboardingRes,
      kbRes,
      macroRes,
    ] = await Promise.all([
      supabase.rpc("master_list_empresas"),
      supabase.rpc("master_platform_health", { p_limit: 50 }),
      supabase.rpc("master_data_room_metrics"),
      supabase.rpc("master_risco_empresas", { p_limit: 100 }),
      supabase.rpc("master_list_empresa_audit", { p_empresa_id: null, p_limit: 100 }),
      supabase.rpc("master_list_pipeline"),
      supabase.rpc("master_list_broadcasts"),
      supabase.rpc("master_list_release_rollouts"),
      supabase.rpc("master_list_billing_negotiations"),
      supabase.rpc("master_list_lgpd_requests"),
      supabase.rpc("master_list_onboarding_scores"),
      supabase.rpc("master_list_kb_articles"),
      supabase.rpc("master_list_support_macros"),
    ]);

    const firstError = [empresasRes, healthRes, dataRoomRes, riscoRes, auditRes, pipelineRes, broadcastRes, rolloutRes, negotiationRes, lgpdRes, onboardingRes, kbRes, macroRes]
      .find((r) => r.error)?.error;

    if (firstError) {
      setErro(firstError.message);
      setLoading(false);
      return;
    }

    setEmpresas(((empresasRes.data ?? []) as Array<{ id: string; nome: string }>).map((e) => ({ id: e.id, nome: e.nome })));
    setHealth((healthRes.data as Record<string, unknown>) ?? {});
    setDataRoom((dataRoomRes.data as Record<string, unknown>) ?? {});
    setRiscos((riscoRes.data ?? []) as Risco[]);
    setAudits((auditRes.data ?? []) as Audit[]);
    setPipelines((pipelineRes.data ?? []) as Pipeline[]);
    setBroadcasts((broadcastRes.data ?? []) as Broadcast[]);
    setRollouts((rolloutRes.data ?? []) as Rollout[]);
    setNegotiations((negotiationRes.data ?? []) as Negotiation[]);
    setLgpds((lgpdRes.data ?? []) as Lgpd[]);
    setOnboardings((onboardingRes.data ?? []) as Onboarding[]);
    setKbs((kbRes.data ?? []) as Kb[]);
    setMacros((macroRes.data ?? []) as Macro[]);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregarTudo();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const dinheiro = (v: number) => (Number(v || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function executarAcaoMassa() {
    setMsg("");
    setErro("");
    const payload: Record<string, string> = {};
    if (bulkPlanoId) payload.plano_id = bulkPlanoId;
    if (bulkCouponId) payload.coupon_id = bulkCouponId;

    const { data, error } = await supabase.rpc("master_bulk_empresa_action", {
      p_ids: selectedEmpresas,
      p_action: bulkAction,
      p_payload: payload,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    setMsg(`Ação executada em ${Number(data ?? 0)} empresa(s).`);
    await carregarTudo();
  }

  async function salvarPipeline(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_upsert_pipeline", pipelineForm);
    if (error) return setErro(error.message);
    setPipelineForm({ empresa_id: "", stage: "trial", owner: "", next_action: "", notes: "" });
    setMsg("Pipeline salvo.");
    await carregarTudo();
  }

  async function salvarBroadcast(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_create_broadcast", {
      p_title: broadcastForm.title,
      p_content: broadcastForm.content,
      p_segment: {},
      p_channels: ["in_app"],
      p_status: "draft",
    });
    if (error) return setErro(error.message);
    setBroadcastForm({ title: "", content: "" });
    setMsg("Broadcast criado.");
    await carregarTudo();
  }

  async function salvarRollout(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_upsert_release_rollout", {
      p_feature_code: rolloutForm.feature_code,
      p_target_segment: {},
      p_rollout_percent: Number(rolloutForm.rollout_percent || 0),
      p_status: rolloutForm.status,
    });
    if (error) return setErro(error.message);
    setRolloutForm({ feature_code: "", rollout_percent: "10", status: "draft" });
    setMsg("Rollout salvo.");
    await carregarTudo();
  }

  async function salvarNegotiation(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_upsert_billing_negotiation", {
      p_empresa_id: negotiationForm.empresa_id,
      p_acordo_valor_centavos: Number(negotiationForm.acordo_valor_centavos || 0),
      p_observacao: negotiationForm.observacao || null,
      p_status: "aberta",
    });
    if (error) return setErro(error.message);
    setNegotiationForm({ empresa_id: "", acordo_valor_centavos: "0", observacao: "" });
    setMsg("Negociação criada.");
    await carregarTudo();
  }

  async function salvarLgpd(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_upsert_lgpd_request", {
      p_empresa_id: lgpdForm.empresa_id,
      p_tipo: lgpdForm.tipo,
      p_status: lgpdForm.status,
      p_detalhes: lgpdForm.detalhes || null,
    });
    if (error) return setErro(error.message);
    setLgpdForm({ empresa_id: "", tipo: "acesso", status: "aberta", detalhes: "" });
    setMsg("Solicitação LGPD criada.");
    await carregarTudo();
  }

  async function salvarOnboarding(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_upsert_onboarding_score", {
      p_empresa_id: onboardingForm.empresa_id,
      p_score: Number(onboardingForm.score || 0),
      p_status: onboardingForm.status,
      p_checklist: {},
    });
    if (error) return setErro(error.message);
    setOnboardingForm({ empresa_id: "", score: "0", status: "inicial" });
    setMsg("Onboarding score salvo.");
    await carregarTudo();
  }

  async function salvarKb(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_upsert_kb_article", {
      p_categoria: kbForm.categoria,
      p_titulo: kbForm.titulo,
      p_conteudo: kbForm.conteudo,
      p_ativo: true,
    });
    if (error) return setErro(error.message);
    setKbForm({ categoria: "geral", titulo: "", conteudo: "" });
    setMsg("Artigo KB salvo.");
    await carregarTudo();
  }

  async function salvarMacro(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("master_upsert_support_macro", {
      p_titulo: macroForm.titulo,
      p_conteudo: macroForm.conteudo,
      p_ativo: true,
    });
    if (error) return setErro(error.message);
    setMacroForm({ titulo: "", conteudo: "" });
    setMsg("Macro salva.");
    await carregarTudo();
  }

  const topEmpresas = useMemo(() => empresas.slice(0, 20), [empresas]);
  const riscosFiltrados = useMemo(() => {
    if (filtroRisco === "todos") return riscos;
    if (filtroRisco === "alto") return riscos.filter((r) => r.score >= 60);
    if (filtroRisco === "medio") return riscos.filter((r) => r.score >= 30 && r.score < 60);
    return riscos.filter((r) => r.score < 30);
  }, [riscos, filtroRisco]);

  const auditsFiltrados = useMemo(() => {
    const q = filtroAuditAction.trim().toLowerCase();
    if (!q) return audits;
    return audits.filter((a) => a.action.toLowerCase().includes(q) || a.empresa_nome.toLowerCase().includes(q));
  }, [audits, filtroAuditAction]);

  const pipelinesFiltrados = useMemo(() => {
    if (filtroPipelineStage === "todos") return pipelines;
    return pipelines.filter((p) => p.stage === filtroPipelineStage);
  }, [pipelines, filtroPipelineStage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Governança Master</h1>
          <p className="text-sm text-slate-600 mt-1">Hub executivo com saúde, risco, auditoria, CRM, comunicação, rollout, cobrança, LGPD e onboarding.</p>
        </div>
        <button onClick={carregarTudo} className="border border-slate-300 rounded px-3 py-2 text-sm hover:bg-slate-50">Recarregar</button>
      </div>

      {erro ? <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {msg ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}

      {loading ? <div className="text-sm text-slate-500">Carregando governança...</div> : null}

      <section className="grid md:grid-cols-4 gap-3">
        <Card title="Webhooks (24h)" value={String(health.webhooks_24h ?? 0)} />
        <Card title="Tickets críticos" value={String(health.support_criticos ?? 0)} />
        <Card title="MRR" value={dinheiro(Number(dataRoom.mrr_centavos ?? 0))} />
        <Card title="Receita 30d" value={dinheiro(Number(dataRoom.receita_30d_centavos ?? 0))} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-slate-900">Ações em massa (P0)</h2>
        <div className="grid md:grid-cols-4 gap-2">
          <select className="border rounded px-2 py-2 text-sm" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
            <option value="bloquear">Bloquear</option>
            <option value="ativar">Ativar</option>
            <option value="trial_plus_7">Extender trial +7</option>
            <option value="trocar_plano">Trocar plano</option>
            <option value="aplicar_cupom">Aplicar cupom</option>
          </select>
          <input className="border rounded px-2 py-2 text-sm" placeholder="plano_id (quando trocar_plano)" value={bulkPlanoId} onChange={(e) => setBulkPlanoId(e.target.value)} />
          <input className="border rounded px-2 py-2 text-sm" placeholder="coupon_id (quando aplicar_cupom)" value={bulkCouponId} onChange={(e) => setBulkCouponId(e.target.value)} />
          <button onClick={executarAcaoMassa} className="bg-indigo-600 text-white rounded px-3 py-2 text-sm">Executar ação</button>
        </div>
        <div className="grid md:grid-cols-5 gap-2 text-xs">
          {topEmpresas.map((e) => (
            <label key={e.id} className="flex gap-2 items-center border rounded px-2 py-1.5">
              <input
                type="checkbox"
                checked={selectedEmpresas.includes(e.id)}
                onChange={(ev) =>
                  setSelectedEmpresas((prev) =>
                    ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id),
                  )
                }
              />
              <span className="truncate">{e.nome}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Panel title="Risco de churn (P0)">
          <div className="flex gap-2 mb-2">
            <select className="border rounded px-2 py-1 text-xs" value={filtroRisco} onChange={(e) => setFiltroRisco(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="alto">Alto (score 60 ou mais)</option>
              <option value="medio">Médio (score entre 30 e 59)</option>
              <option value="baixo">Baixo (score abaixo de 30)</option>
            </select>
          </div>
          {riscosFiltrados.slice(0, 8).map((r) => (
            <Row key={r.empresa_id} left={`${r.empresa_nome} • score ${r.score}`} right={`${r.status_assinatura} • vencidas ${r.faturas_vencidas}`} />
          ))}
        </Panel>
        <Panel title="Auditoria por empresa (P0)">
          <input className="w-full border rounded px-2 py-1 text-xs mb-2" placeholder="Filtrar por ação/empresa" value={filtroAuditAction} onChange={(e) => setFiltroAuditAction(e.target.value)} />
          {auditsFiltrados.slice(0, 8).map((a) => (
            <Row key={a.id} left={`${a.empresa_nome} • ${a.action}`} right={new Date(a.created_at).toLocaleString("pt-BR")} />
          ))}
        </Panel>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Panel title="CRM de contas (P1)">
          <form onSubmit={salvarPipeline} className="space-y-2 mb-3">
            <select className="w-full border rounded px-2 py-2 text-sm" value={pipelineForm.empresa_id} onChange={(e) => setPipelineForm((p) => ({ ...p, empresa_id: e.target.value }))}>
              <option value="">Empresa...</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Stage (trial/ativacao/expansao/risco)" value={pipelineForm.stage} onChange={(e) => setPipelineForm((p) => ({ ...p, stage: e.target.value }))} />
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Próxima ação" value={pipelineForm.next_action} onChange={(e) => setPipelineForm((p) => ({ ...p, next_action: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Salvar pipeline</button>
          </form>
          <select className="w-full border rounded px-2 py-1 text-xs mb-2" value={filtroPipelineStage} onChange={(e) => setFiltroPipelineStage(e.target.value)}>
            <option value="todos">Todos os stages</option>
            <option value="trial">trial</option>
            <option value="ativacao">ativacao</option>
            <option value="expansao">expansao</option>
            <option value="risco">risco</option>
          </select>
          {pipelinesFiltrados.slice(0, 6).map((p) => <Row key={p.id} left={`${p.empresa_nome} • ${p.stage}`} right={p.next_action ?? "-"} />)}
        </Panel>

        <Panel title="Comunicação e rollout (P1)">
          <form onSubmit={salvarBroadcast} className="space-y-2 mb-3">
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Título comunicado" value={broadcastForm.title} onChange={(e) => setBroadcastForm((p) => ({ ...p, title: e.target.value }))} />
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Conteúdo" value={broadcastForm.content} onChange={(e) => setBroadcastForm((p) => ({ ...p, content: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Criar broadcast</button>
          </form>
          <form onSubmit={salvarRollout} className="space-y-2 mb-3">
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="feature_code" value={rolloutForm.feature_code} onChange={(e) => setRolloutForm((p) => ({ ...p, feature_code: e.target.value }))} />
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="percentual" value={rolloutForm.rollout_percent} onChange={(e) => setRolloutForm((p) => ({ ...p, rollout_percent: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Salvar rollout</button>
          </form>
          {broadcasts.slice(0, 3).map((b) => <Row key={b.id} left={`Broadcast: ${b.title}`} right={b.status} />)}
          {rollouts.slice(0, 3).map((r) => <Row key={r.id} left={`Rollout: ${r.feature_code}`} right={`${r.rollout_percent}% • ${r.status}`} />)}
        </Panel>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Panel title="Cobrança avançada e Data Room (P1/P2)">
          <form onSubmit={salvarNegotiation} className="space-y-2 mb-3">
            <select className="w-full border rounded px-2 py-2 text-sm" value={negotiationForm.empresa_id} onChange={(e) => setNegotiationForm((p) => ({ ...p, empresa_id: e.target.value }))}>
              <option value="">Empresa...</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="valor acordo (centavos)" value={negotiationForm.acordo_valor_centavos} onChange={(e) => setNegotiationForm((p) => ({ ...p, acordo_valor_centavos: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Salvar negociação</button>
          </form>
          {negotiations.slice(0, 6).map((n) => <Row key={n.id} left={n.empresa_nome} right={`${dinheiro(n.acordo_valor_centavos)} • ${n.status}`} />)}
          <div className="mt-3 text-xs text-slate-600">Churn proxy: {String(dataRoom.churn_proxy_pct ?? 0)}%</div>
        </Panel>

        <Panel title="LGPD + Onboarding score (P2)">
          <form onSubmit={salvarLgpd} className="space-y-2 mb-3">
            <select className="w-full border rounded px-2 py-2 text-sm" value={lgpdForm.empresa_id} onChange={(e) => setLgpdForm((p) => ({ ...p, empresa_id: e.target.value }))}>
              <option value="">Empresa...</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="tipo (acesso/anonimizacao/exclusao)" value={lgpdForm.tipo} onChange={(e) => setLgpdForm((p) => ({ ...p, tipo: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Abrir solicitação LGPD</button>
          </form>
          <form onSubmit={salvarOnboarding} className="space-y-2 mb-3">
            <select className="w-full border rounded px-2 py-2 text-sm" value={onboardingForm.empresa_id} onChange={(e) => setOnboardingForm((p) => ({ ...p, empresa_id: e.target.value }))}>
              <option value="">Empresa...</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="score (0-100)" value={onboardingForm.score} onChange={(e) => setOnboardingForm((p) => ({ ...p, score: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Salvar score</button>
          </form>
          {lgpds.slice(0, 3).map((l) => <Row key={l.id} left={`${l.empresa_nome} • ${l.tipo}`} right={l.status} />)}
          {onboardings.slice(0, 3).map((o) => <Row key={o.id} left={`${o.empresa_nome} • ${o.status}`} right={`score ${o.score}`} />)}
        </Panel>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Panel title="Base de conhecimento (P2)">
          <form onSubmit={salvarKb} className="space-y-2 mb-3">
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Categoria" value={kbForm.categoria} onChange={(e) => setKbForm((p) => ({ ...p, categoria: e.target.value }))} />
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Título" value={kbForm.titulo} onChange={(e) => setKbForm((p) => ({ ...p, titulo: e.target.value }))} />
            <textarea className="w-full border rounded px-2 py-2 text-sm" placeholder="Conteúdo" value={kbForm.conteudo} onChange={(e) => setKbForm((p) => ({ ...p, conteudo: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Salvar artigo</button>
          </form>
          {kbs.slice(0, 5).map((k) => <Row key={k.id} left={`${k.categoria} • ${k.titulo}`} right={k.ativo ? "ativo" : "inativo"} />)}
        </Panel>

        <Panel title="Macros de suporte (P2)">
          <form onSubmit={salvarMacro} className="space-y-2 mb-3">
            <input className="w-full border rounded px-2 py-2 text-sm" placeholder="Título" value={macroForm.titulo} onChange={(e) => setMacroForm((p) => ({ ...p, titulo: e.target.value }))} />
            <textarea className="w-full border rounded px-2 py-2 text-sm" placeholder="Conteúdo" value={macroForm.conteudo} onChange={(e) => setMacroForm((p) => ({ ...p, conteudo: e.target.value }))} />
            <button className="bg-slate-900 text-white rounded px-3 py-2 text-xs">Salvar macro</button>
          </form>
          {macros.slice(0, 5).map((m) => <Row key={m.id} left={m.titulo} right={m.ativo ? "ativo" : "inativo"} />)}
        </Panel>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border rounded px-2 py-1.5 text-xs">
      <span className="text-slate-700 truncate">{left}</span>
      <span className="text-slate-500 whitespace-nowrap">{right}</span>
    </div>
  );
}
