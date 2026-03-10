"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Provider = "custom_webhook" | "zapi" | "twilio" | "360dialog" | "evolution" | "meta_cloud_api";

type Empresa = {
  id: string;
  nome: string;
  whatsapp: string | null;
};

type WhatsAppConfig = {
  provider: Provider;
  ativo: boolean;
  from_number: string;
  api_url: string;
  api_token: string;
  instance_key: string;
  webhook_secret: string;
  default_country_code: string;
};

type Template = {
  id: string;
  codigo: string;
  categoria: string;
  titulo: string | null;
  template: string;
  ativo: boolean;
  updated_at: string;
};

type OutboxItem = {
  id: string;
  destino_numero: string;
  template_codigo: string | null;
  status: string;
  provider_status: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

type InboundItem = {
  id: string;
  from_number: string | null;
  event_type: string;
  message_text: string | null;
  processing_status: string;
  created_at: string;
};

const PROVIDERS: Provider[] = ["custom_webhook", "meta_cloud_api", "zapi", "twilio", "360dialog", "evolution"];

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "");
}

export default function MasterConfiguracoesWhatsAppPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");

  const [config, setConfig] = useState<WhatsAppConfig>({
    provider: "custom_webhook",
    ativo: false,
    from_number: "",
    api_url: "",
    api_token: "",
    instance_key: "",
    webhook_secret: "",
    default_country_code: "55",
  });

  const [templates, setTemplates] = useState<Template[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [inbound, setInbound] = useState<InboundItem[]>([]);
  const [empresaWhatsapp, setEmpresaWhatsapp] = useState("");

  const [templateForm, setTemplateForm] = useState({
    codigo: "",
    categoria: "sistema",
    titulo: "",
    template: "",
    ativo: true,
  });
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Teste WhatsApp via painel master.");
  const [testMode, setTestMode] = useState<"text" | "template">("text");
  const [metaTemplateName, setMetaTemplateName] = useState("");
  const [metaTemplateLanguage, setMetaTemplateLanguage] = useState("pt_BR");
  const [metaTemplateComponentsJson, setMetaTemplateComponentsJson] = useState("[]");

  const sentCount = useMemo(() => outbox.filter((x) => x.status === "sent").length, [outbox]);
  const deliveredCount = useMemo(() => outbox.filter((x) => x.provider_status === "delivered" || !!x.delivered_at).length, [outbox]);
  const readCount = useMemo(() => outbox.filter((x) => x.provider_status === "read" || !!x.read_at).length, [outbox]);
  const failedCount = useMemo(() => outbox.filter((x) => x.status === "failed").length, [outbox]);

  const loadEmpresas = useCallback(async () => {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, nome, whatsapp")
      .order("nome", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as Empresa[];
    setEmpresas(rows);
    if (!empresaId && rows.length > 0) setEmpresaId(rows[0].id);
  }, [empresaId]);

  const loadEmpresaData = useCallback(async (targetEmpresaId: string) => {
    if (!targetEmpresaId) return;

    const [{ data: emp }, { data: cfg }, { data: tpls }, { data: out }, { data: inboundRows }] = await Promise.all([
      supabase.from("empresas").select("whatsapp").eq("id", targetEmpresaId).maybeSingle(),
      supabase
        .from("whatsapp_configs")
        .select("provider, ativo, from_number, api_url, api_token, instance_key, webhook_secret, default_country_code")
        .eq("empresa_id", targetEmpresaId)
        .maybeSingle(),
      supabase
        .from("whatsapp_templates")
        .select("id, codigo, categoria, titulo, template, ativo, updated_at")
        .eq("empresa_id", targetEmpresaId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("whatsapp_outbox")
        .select("id, destino_numero, template_codigo, status, provider_status, attempts, max_attempts, last_error, delivered_at, read_at, created_at")
        .eq("empresa_id", targetEmpresaId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("whatsapp_inbound_logs")
        .select("id, from_number, event_type, message_text, processing_status, created_at")
        .eq("empresa_id", targetEmpresaId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setEmpresaWhatsapp(emp?.whatsapp ?? "");

    setConfig({
      provider: (cfg?.provider as Provider) ?? "custom_webhook",
      ativo: Boolean(cfg?.ativo),
      from_number: cfg?.from_number ?? "",
      api_url: cfg?.api_url ?? "",
      api_token: cfg?.api_token ?? "",
      instance_key: cfg?.instance_key ?? "",
      webhook_secret: cfg?.webhook_secret ?? "",
      default_country_code: cfg?.default_country_code ?? "55",
    });

    setTemplates((tpls ?? []) as Template[]);
    setOutbox((out ?? []) as OutboxItem[]);
    setInbound((inboundRows ?? []) as InboundItem[]);
  }, []);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setMsg("");
      try {
        await loadEmpresas();
      } catch (e) {
        setMsg(`Erro ao carregar empresas: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    }
    void bootstrap();
  }, [loadEmpresas]);

  useEffect(() => {
    if (!empresaId) return;
    const id = setTimeout(() => {
      void loadEmpresaData(empresaId);
    }, 0);
    return () => clearTimeout(id);
  }, [empresaId, loadEmpresaData]);

  async function salvarConfig(ev: FormEvent) {
    ev.preventDefault();
    if (!empresaId) return;
    setSaving(true);
    setMsg("");

    const [{ error: empError }, { error: cfgError }] = await Promise.all([
      supabase.from("empresas").update({ whatsapp: empresaWhatsapp.trim() || null }).eq("id", empresaId),
      supabase.from("whatsapp_configs").upsert({
        empresa_id: empresaId,
        provider: config.provider,
        ativo: config.ativo,
        from_number: config.from_number.trim() || null,
        api_url: config.api_url.trim() || null,
        api_token: config.api_token.trim() || null,
        instance_key: config.instance_key.trim() || null,
        webhook_secret: config.webhook_secret.trim() || null,
        default_country_code: config.default_country_code.trim() || "55",
      }),
    ]);

    setSaving(false);
    if (empError || cfgError) {
      setMsg(`Erro: ${empError?.message ?? cfgError?.message}`);
      return;
    }
    setMsg("Configuração WhatsApp salva com sucesso.");
    await loadEmpresaData(empresaId);
  }

  async function salvarTemplate(ev: FormEvent) {
    ev.preventDefault();
    if (!empresaId) return;

    setSaving(true);
    setMsg("");

    const { error } = await supabase.from("whatsapp_templates").upsert({
      empresa_id: empresaId,
      codigo: templateForm.codigo.trim(),
      categoria: templateForm.categoria.trim() || "sistema",
      titulo: templateForm.titulo.trim() || null,
      template: templateForm.template.trim(),
      ativo: templateForm.ativo,
      variaveis: [],
    }, { onConflict: "empresa_id,codigo" });

    setSaving(false);
    if (error) {
      setMsg(`Erro ao salvar template: ${error.message}`);
      return;
    }

    setTemplateForm({ codigo: "", categoria: "sistema", titulo: "", template: "", ativo: true });
    setMsg("Template salvo.");
    await loadEmpresaData(empresaId);
  }

  async function enqueueTest(ev: FormEvent) {
    ev.preventDefault();
    if (!empresaId) return;

    let payload: Record<string, unknown> = { kind: "manual_test" };
    let mensagemFinal = testMessage.trim();

    if (testMode === "template") {
      if (!metaTemplateName.trim()) {
        setMsg("Informe o nome do template oficial Meta para teste.");
        return;
      }

      let parsedComponents: unknown = [];
      try {
        parsedComponents = JSON.parse(metaTemplateComponentsJson || "[]");
      } catch {
        setMsg("JSON de components inválido.");
        return;
      }

      payload = {
        ...payload,
        meta_template_name: metaTemplateName.trim(),
        meta_template_language: metaTemplateLanguage.trim() || "pt_BR",
        meta_template_components: Array.isArray(parsedComponents) ? parsedComponents : [],
      };
      mensagemFinal = mensagemFinal || `template:${metaTemplateName.trim()}`;
    }

    setSaving(true);
    setMsg("");

    const { error } = await supabase.from("whatsapp_outbox").insert({
      empresa_id: empresaId,
      destino_numero: normalizePhone(testPhone),
      mensagem: mensagemFinal,
      template_codigo: "manual_test",
      payload,
      prioridade: 6,
      status: "queued",
      source_type: "master_manual_test",
    });

    setSaving(false);
    if (error) {
      setMsg(`Erro no teste: ${error.message}`);
      return;
    }

    setMsg("Mensagem de teste enfileirada.");
    await loadEmpresaData(empresaId);
  }

  async function retryOutbox(id: string) {
    await supabase.from("whatsapp_outbox").update({ status: "queued", next_retry_at: null, last_error: null }).eq("id", id);
    await loadEmpresaData(empresaId);
  }

  async function cancelOutbox(id: string) {
    await supabase.from("whatsapp_outbox").update({ status: "cancelled" }).eq("id", id);
    await loadEmpresaData(empresaId);
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando módulo WhatsApp...</div>;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Configurações Master • WhatsApp</h1>
          <p className="text-sm text-slate-600 mt-0.5">Gerencie a integração por empresa com visão operacional de fila e inbound.</p>
        </div>
        <Link href="/master/configuracoes" className="text-sm text-slate-600 hover:text-slate-900 underline">Voltar</Link>
      </div>

      {msg && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{msg}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <label className="text-xs uppercase tracking-wider text-slate-500">Empresa</label>
        <select
          className="w-full md:w-[420px] border border-slate-300 rounded-md px-3 py-2 text-sm"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Outbox (30 últimas)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{outbox.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Mensagens enviadas</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{sentCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Falhas</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{failedCount}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Entregues (provider)</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{deliveredCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Lidas (provider)</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{readCount}</div>
        </div>
      </div>

      <form onSubmit={salvarConfig} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Conexão da empresa</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">WhatsApp da empresa (destino padrão)</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={empresaWhatsapp} onChange={(e) => setEmpresaWhatsapp(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Provider</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={config.provider} onChange={(e) => setConfig((p) => ({ ...p, provider: e.target.value as Provider }))}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {config.provider === "meta_cloud_api" ? (
              <p className="text-xs text-slate-500 mt-1">
                Use API URL no formato: https://graph.facebook.com/v23.0/&lt;PHONE_NUMBER_ID&gt;/messages
              </p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">API URL</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={config.api_url} onChange={(e) => setConfig((p) => ({ ...p, api_url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">API Token</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={config.api_token} onChange={(e) => setConfig((p) => ({ ...p, api_token: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">From number</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={config.from_number} onChange={(e) => setConfig((p) => ({ ...p, from_number: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Instance key</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={config.instance_key} onChange={(e) => setConfig((p) => ({ ...p, instance_key: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Webhook secret</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={config.webhook_secret} onChange={(e) => setConfig((p) => ({ ...p, webhook_secret: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">DDI padrão</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={config.default_country_code} onChange={(e) => setConfig((p) => ({ ...p, default_country_code: e.target.value }))} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={config.ativo} onChange={(e) => setConfig((p) => ({ ...p, ativo: e.target.checked }))} />
          Ativar integração para esta empresa
        </label>
        <button disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
      </form>

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={salvarTemplate} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900">Templates</h2>
          <div className="grid gap-3">
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Código" value={templateForm.codigo} onChange={(e) => setTemplateForm((p) => ({ ...p, codigo: e.target.value }))} />
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Categoria" value={templateForm.categoria} onChange={(e) => setTemplateForm((p) => ({ ...p, categoria: e.target.value }))} />
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Título" value={templateForm.titulo} onChange={(e) => setTemplateForm((p) => ({ ...p, titulo: e.target.value }))} />
            <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Texto do template" value={templateForm.template} onChange={(e) => setTemplateForm((p) => ({ ...p, template: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={templateForm.ativo} onChange={(e) => setTemplateForm((p) => ({ ...p, ativo: e.target.checked }))} />
              Ativo
            </label>
          </div>
          <button disabled={saving} className="border border-slate-300 px-4 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50">
            Salvar template
          </button>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {templates.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">Nenhum template cadastrado.</div>
            ) : templates.map((t) => (
              <div key={t.id} className="p-3">
                <div className="text-sm font-medium text-slate-900">{t.codigo}</div>
                <div className="text-xs text-slate-500">{t.categoria} • {t.ativo ? "ativo" : "inativo"}</div>
                <div className="text-sm text-slate-700 mt-1">{t.template}</div>
              </div>
            ))}
          </div>
        </form>

        <form onSubmit={enqueueTest} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900">Teste manual</h2>
          <div className="flex gap-2 text-xs">
            <button type="button" className={`px-2 py-1 rounded border ${testMode === "text" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`} onClick={() => setTestMode("text")}>Texto</button>
            <button type="button" className={`px-2 py-1 rounded border ${testMode === "template" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`} onClick={() => setTestMode("template")}>Template Meta</button>
          </div>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Telefone destino" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Mensagem" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
          {testMode === "template" ? (
            <>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="meta template name (ex: hello_world)" value={metaTemplateName} onChange={(e) => setMetaTemplateName(e.target.value)} />
              <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="language code (ex: pt_BR)" value={metaTemplateLanguage} onChange={(e) => setMetaTemplateLanguage(e.target.value)} />
              <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs min-h-[90px] font-mono" placeholder='components JSON (ex: [{"type":"body","parameters":[{"type":"text","text":"João"}]}])' value={metaTemplateComponentsJson} onChange={(e) => setMetaTemplateComponentsJson(e.target.value)} />
            </>
          ) : null}
          <button disabled={saving} className="border border-slate-300 px-4 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50">
            Enfileirar teste
          </button>
        </form>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Outbox</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3">Destino</th>
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Tentativas</th>
                <th className="py-2 pr-3">Entrega/Leitura</th>
                <th className="py-2 pr-3">Criada</th>
                <th className="py-2 pr-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {outbox.length === 0 ? (
                <tr><td className="py-3 text-slate-500" colSpan={8}>Sem registros.</td></tr>
              ) : outbox.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-800">{o.destino_numero}</td>
                  <td className="py-2 pr-3 text-slate-500">{o.template_codigo ?? "manual"}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-2 py-1 rounded border ${o.status === "sent" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : o.status === "failed" ? "border-amber-200 text-amber-700 bg-amber-50" : "border-slate-200 text-slate-600 bg-slate-50"}`}>{o.status}</span>
                    {o.last_error ? <div className="text-xs text-amber-600 mt-1 max-w-xs truncate">{o.last_error}</div> : null}
                  </td>
                  <td className="py-2 pr-3 text-slate-600 text-xs">{o.provider_status ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-600">{o.attempts}/{o.max_attempts}</td>
                  <td className="py-2 pr-3 text-slate-600 text-xs">
                    {o.delivered_at ? <div>Entregue: {new Date(o.delivered_at).toLocaleString("pt-BR")}</div> : null}
                    {o.read_at ? <div>Lida: {new Date(o.read_at).toLocaleString("pt-BR")}</div> : null}
                    {!o.delivered_at && !o.read_at ? "—" : null}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-3 text-xs">
                    {o.status === "failed" || o.status === "cancelled" ? (
                      <button className="text-indigo-700 hover:underline mr-3" onClick={() => retryOutbox(o.id)}>Reenfileirar</button>
                    ) : null}
                    {o.status === "queued" || o.status === "sending" ? (
                      <button className="text-rose-700 hover:underline" onClick={() => cancelOutbox(o.id)}>Cancelar</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Inbound (webhook)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3">De</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Mensagem</th>
                <th className="py-2 pr-3">Processamento</th>
                <th className="py-2 pr-3">Recebido em</th>
              </tr>
            </thead>
            <tbody>
              {inbound.length === 0 ? (
                <tr><td className="py-3 text-slate-500" colSpan={5}>Sem eventos inbound.</td></tr>
              ) : inbound.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-800">{i.from_number ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{i.event_type}</td>
                  <td className="py-2 pr-3 text-slate-700 max-w-md truncate">{i.message_text ?? "—"}</td>
                  <td className="py-2 pr-3 text-slate-600">{i.processing_status}</td>
                  <td className="py-2 pr-3 text-slate-500">{new Date(i.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
