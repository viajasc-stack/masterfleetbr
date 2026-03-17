"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Cliente = { id: string; nome: string };
type Contrato = {
  id: string;
  cliente_id: string;
  nome: string;
  descricao: string | null;
  forma_cobranca: "km" | "dia" | "mensal";
  valor_cobranca: number;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  dias_semana: number[];
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  contrato_fisico_url?: string | null;
};

const DIAS = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
];

function parseMoney(v: string, fallback = 0) {
  const n = Number(v.replace(".", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isBucketNotFoundError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("bucket not found");
}

export default function ContratoDetalhePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const contratoId = String(params?.id || "");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [valorCobranca, setValorCobranca] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadWarning, setUploadWarning] = useState("");
  const [contratoFisicoFile, setContratoFisicoFile] = useState<File | null>(null);

  async function uploadContratoFisico(empresa: string, file: File) {
    const path = `${empresa}/contratos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from("contratos").upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("contratos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function carregarTudo() {
    setLoading(true);
    const { data: clientesData } = await supabase.from("clientes").select("id, nome").order("nome", { ascending: true });
    setClientes((clientesData ?? []) as Cliente[]);

    const { data: contratoData, error } = await supabase
      .from("contratos")
      .select("id, cliente_id, nome, descricao, forma_cobranca, valor_cobranca, dia_fechamento, dia_vencimento, dias_semana, data_inicio, data_fim, ativo, contrato_fisico_url")
      .eq("id", contratoId)
      .single();

    if (error || !contratoData) {
      router.push("/contratos");
      return;
    }

    setContrato(contratoData as Contrato);
    setValorCobranca(String((contratoData as Contrato).valor_cobranca ?? 0));
    setLoading(false);
  }

  useEffect(() => {
    void carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  function toggleDia(v: number) {
    if (!contrato) return;
    const has = contrato.dias_semana.includes(v);
    setContrato({
      ...contrato,
      dias_semana: has ? contrato.dias_semana.filter((x) => x !== v) : [...contrato.dias_semana, v].sort((a, b) => a - b),
    });
  }

  async function salvar() {
    if (!contrato) return;
    if (!contrato.cliente_id) return alert("Selecione um cliente.");
    if (!contrato.nome.trim()) return alert("Informe o nome do contrato.");
    if ((contrato.dias_semana?.length ?? 0) === 0) return alert("Selecione ao menos 1 dia da semana.");

    const valor = parseMoney(valorCobranca, NaN);
    if (!Number.isFinite(valor) || valor < 0) return alert("Valor inválido.");

    setSaving(true);
    setUploadWarning("");

    let contratoFisicoUrl = contrato.contrato_fisico_url ?? null;
    if (contratoFisicoFile) {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      const { data: prof } = await supabase.from("profiles").select("empresa_id").eq("user_id", userId).maybeSingle();
      if (!prof?.empresa_id) {
        setSaving(false);
        return alert("Não foi possível identificar sua empresa.");
      }

      try {
        contratoFisicoUrl = await uploadContratoFisico(prof.empresa_id, contratoFisicoFile);
      } catch (uploadError) {
        if (isBucketNotFoundError(uploadError)) {
          setUploadWarning("Upload ignorado porque o bucket 'contratos' ainda não existe.");
        } else {
          setSaving(false);
          return alert(`Erro no upload: ${uploadError instanceof Error ? uploadError.message : "erro desconhecido"}`);
        }
      }
    }

    const payload = {
      cliente_id: contrato.cliente_id,
      nome: contrato.nome.trim(),
      descricao: contrato.descricao?.trim() || null,
      forma_cobranca: contrato.forma_cobranca,
      valor_cobranca: valor,
      dia_fechamento: contrato.dia_fechamento,
      dia_vencimento: contrato.dia_vencimento,
      dias_semana: contrato.dias_semana,
      data_inicio: contrato.data_inicio || null,
      data_fim: contrato.data_fim || null,
      ativo: contrato.ativo,
    };

    let errMsg: string | null = null;
    const tentativaComArquivo = await supabase.from("contratos").update({ ...payload, contrato_fisico_url: contratoFisicoUrl }).eq("id", contrato.id);
    if (tentativaComArquivo.error?.message?.toLowerCase().includes("contrato_fisico_url")) {
      const fallback = await supabase.from("contratos").update(payload).eq("id", contrato.id);
      errMsg = fallback.error?.message ?? null;
      if (contratoFisicoUrl) setUploadWarning("Contrato salvo sem vínculo do arquivo físico (coluna ainda não criada no banco).");
    } else {
      errMsg = tentativaComArquivo.error?.message ?? null;
    }

    setSaving(false);
    if (errMsg) return alert("Erro ao salvar contrato: " + errMsg);
    router.push("/contratos?ok=" + encodeURIComponent("Contrato salvo com sucesso."));
  }

  async function excluirContrato() {
    const ok = confirm("Excluir este contrato?");
    if (!ok) return;
    const { error } = await supabase.from("contratos").delete().eq("id", contratoId);
    if (error) return alert("Erro ao excluir: " + error.message);
    router.push("/contratos?ok=" + encodeURIComponent("Contrato excluído."));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrato"
        description="Edite somente os dados principais do contrato."
        actions={
          <>
            <button onClick={() => router.push("/contratos")} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition" disabled={saving}>Voltar</button>
            <button onClick={salvar} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60" disabled={saving || loading}>{saving ? "Salvando..." : "Salvar"}</button>
            <button onClick={excluirContrato} className="border border-red-300 text-red-700 px-4 py-2 rounded-md hover:bg-red-50 transition" disabled={saving || loading}>Excluir</button>
          </>
        }
      />

      {uploadWarning ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{uploadWarning}</div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading || !contrato ? (
          <div className="text-slate-600">Carregando...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Cliente</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={contrato.cliente_id} onChange={(e) => setContrato({ ...contrato, cliente_id: e.target.value })}>
                <option value="">Selecione...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome do contrato</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={contrato.nome} onChange={(e) => setContrato({ ...contrato, nome: e.target.value })} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]" value={contrato.descricao ?? ""} onChange={(e) => setContrato({ ...contrato, descricao: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={contrato.ativo} onChange={(e) => setContrato({ ...contrato, ativo: e.target.checked })} />
                <span className="text-sm">{contrato.ativo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dias da semana</label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => {
                  const active = contrato.dias_semana.includes(d.v);
                  return (
                    <button key={d.v} type="button" onClick={() => toggleDia(d.v)} className={`px-3 py-1 rounded-md border text-sm transition ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Vigência início</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={contrato.data_inicio ?? ""} onChange={(e) => setContrato({ ...contrato, data_inicio: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Vigência fim</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={contrato.data_fim ?? ""} onChange={(e) => setContrato({ ...contrato, data_fim: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Forma de cobrança</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={contrato.forma_cobranca} onChange={(e) => setContrato({ ...contrato, forma_cobranca: e.target.value as "km" | "dia" | "mensal" })}>
                <option value="km">Por KM</option>
                <option value="dia">Por dia</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Valor</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={valorCobranca} onChange={(e) => setValorCobranca(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dia padrão fechamento</label>
              <input type="number" min={1} max={31} className="w-full border border-slate-300 rounded-md px-3 py-2" value={contrato.dia_fechamento ?? ""} onChange={(e) => setContrato({ ...contrato, dia_fechamento: e.target.value ? Number(e.target.value) : null })} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dia padrão cobrança</label>
              <input type="number" min={1} max={31} className="w-full border border-slate-300 rounded-md px-3 py-2" value={contrato.dia_vencimento ?? ""} onChange={(e) => setContrato({ ...contrato, dia_vencimento: e.target.value ? Number(e.target.value) : null })} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Contrato físico (PDF/arquivo)</label>
              <input type="file" className="w-full border border-slate-300 rounded-md px-3 py-2" onChange={(e) => setContratoFisicoFile(e.target.files?.[0] ?? null)} />
              {contrato.contrato_fisico_url ? (
                <a href={contrato.contrato_fisico_url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline mt-2 inline-block">
                  Ver arquivo atual
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
