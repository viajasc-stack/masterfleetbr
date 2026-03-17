"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Cliente = { id: string; nome: string };

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
  const raw = v.trim().replace(/\s+/g, "");
  if (!raw) return fallback;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  let normalized = raw;
  if (hasComma && hasDot) {
    normalized =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (hasComma) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

export default function NovoContratoPage() {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadWarning, setUploadWarning] = useState("");

  const [clienteId, setClienteId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [formaCobranca, setFormaCobranca] = useState<"km" | "dia" | "mensal">("dia");
  const [valorCobranca, setValorCobranca] = useState("0");
  const [diaFechamento, setDiaFechamento] = useState("25");
  const [diaVencimento, setDiaVencimento] = useState("5");

  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [contratoFisicoFile, setContratoFisicoFile] = useState<File | null>(null);

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

  async function uploadContratoFisico(empresa: string, file: File) {
    const path = `${empresa}/contratos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from("contratos").upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("contratos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function carregarDados() {
    setLoading(true);

    const { data: clientesData, error: clientesErr } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome", { ascending: true });

    setTimeout(() => {
      if (!clientesErr && clientesData) setClientes(clientesData as Cliente[]);
      else setClientes([]);

      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarDados(); }, 0);
    return () => clearTimeout(id);
  }, []);

  function toggleDia(v: number) {
    setDiasSemana((prev) => {
      const has = prev.includes(v);
      if (has) return prev.filter((x) => x !== v);
      return [...prev, v].sort((a, b) => a - b);
    });
  }

  async function salvar() {
    if (!clienteId) return alert("Selecione um cliente.");
    if (!nome.trim()) return alert("Informe o nome do contrato.");
    if (diasSemana.length === 0) return alert("Selecione pelo menos 1 dia da semana.");
    const valorCobr = parseMoney(valorCobranca, NaN);
    if (!Number.isFinite(valorCobr) || valorCobr < 0) return alert("Informe um valor de cobrança válido.");

    const dFech = Number(diaFechamento || 0);
    const dVenc = Number(diaVencimento || 0);
    if (formaCobranca === "mensal") {
      if (!Number.isInteger(dFech) || dFech < 1 || dFech > 31) return alert("Dia de fechamento inválido (1 a 31).");
      if (!Number.isInteger(dVenc) || dVenc < 1 || dVenc > 31) return alert("Dia de vencimento inválido (1 a 31).");
    }

    setSaving(true);
    setUploadWarning("");

    // empresa_id (multiempresa) via profiles
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      setSaving(false);
      return alert("Sessão inválida. Faça login novamente.");
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profErr || !prof?.empresa_id) {
      console.error(profErr);
      setSaving(false);
      return alert("Não foi possível identificar sua empresa (profiles).");
    }

    let contratoFisicoUrl: string | null = null;
    if (contratoFisicoFile) {
      try {
        contratoFisicoUrl = await uploadContratoFisico(prof.empresa_id, contratoFisicoFile);
      } catch (uploadError) {
        if (isBucketNotFoundError(uploadError)) {
          setUploadWarning("Upload ignorado porque o bucket 'contratos' ainda não existe. O contrato será salvo sem arquivo.");
        } else {
          setSaving(false);
          return alert(`Erro no upload do contrato físico: ${uploadError instanceof Error ? uploadError.message : "erro desconhecido"}`);
        }
      }
    }

    const payloadBase = {
      empresa_id: prof.empresa_id,
      cliente_id: clienteId,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      forma_cobranca: formaCobranca,
      valor_cobranca: valorCobr,
      dia_fechamento: Number.isInteger(dFech) && dFech >= 1 && dFech <= 31 ? dFech : null,
      dia_vencimento: Number.isInteger(dVenc) && dVenc >= 1 && dVenc <= 31 ? dVenc : null,
      dias_semana: diasSemana,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      ativo,
    };

    let contrato: { id: string } | null = null;
    let errContrato: { message?: string } | null = null;

    const tentativaComArquivo = await supabase
      .from("contratos")
      .insert({ ...payloadBase, contrato_fisico_url: contratoFisicoUrl })
      .select("id")
      .single();

    if (tentativaComArquivo.error?.message?.toLowerCase().includes("contrato_fisico_url")) {
      const fallbackSemArquivo = await supabase
        .from("contratos")
        .insert(payloadBase)
        .select("id")
        .single();

      contrato = (fallbackSemArquivo.data as { id: string } | null) ?? null;
      errContrato = (fallbackSemArquivo.error as { message?: string } | null) ?? null;

      if (contratoFisicoUrl) {
        setUploadWarning("Contrato salvo, mas o banco ainda não tem a coluna do arquivo físico. Aplique a migration para habilitar esse recurso.");
      }
    } else {
      contrato = (tentativaComArquivo.data as { id: string } | null) ?? null;
      errContrato = (tentativaComArquivo.error as { message?: string } | null) ?? null;
    }

    if (errContrato || !contrato?.id) {
      console.error(errContrato);
      setSaving(false);
      return alert("Erro ao criar contrato: " + (errContrato?.message ?? "desconhecido"));
    }

    setSaving(false);
    router.push(`/contratos/${contrato.id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Contrato"
        description="Cadastre apenas os dados principais do contrato. A operação de fretamentos será feita em módulo próprio."
        actions={
          <>
            <button
              onClick={() => router.push("/contratos")}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
              disabled={saving}
            >
              Voltar
            </button>

            <button
              onClick={salvar}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      />

      {uploadWarning ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {uploadWarning}
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Cliente</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome do contrato</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder='Ex: "Prefeitura - Rota Morro Grande"'
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição (opcional)</label>
              <textarea
                className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Observação geral do contrato..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                <span className="text-sm">{ativo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dias da semana</label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => {
                  const active = diasSemana.includes(d.v);
                  return (
                    <button
                      type="button"
                      key={d.v}
                      onClick={() => toggleDia(d.v)}
                      className={`px-3 py-1 rounded-md border text-sm transition ${
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data início (opcional)</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data fim (opcional)</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Forma de cobrança</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={formaCobranca}
                onChange={(e) => setFormaCobranca(e.target.value as "km" | "dia" | "mensal")}
              >
                <option value="km">Por KM</option>
                <option value="dia">Por dia</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {formaCobranca === "km" ? "Valor por KM" : formaCobranca === "dia" ? "Valor por dia" : "Valor mensal"}
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={valorCobranca}
                onChange={(e) => setValorCobranca(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dia padrão fechamento</label>
              <input
                type="number"
                min={1}
                max={31}
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={diaFechamento}
                onChange={(e) => setDiaFechamento(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dia padrão vencimento</label>
              <input
                type="number"
                min={1}
                max={31}
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Contrato físico (PDF/arquivo)</label>
              <input
                type="file"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setContratoFisicoFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
