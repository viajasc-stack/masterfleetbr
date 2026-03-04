"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type ClienteDb = {
  id: string;

  tipo: "empresa" | "pessoa";
  nome: string;
  nome_fantasia: string | null;
  documento: string | null;
  inscricao_estadual: string | null;

  email: string | null;
  telefone: string | null;
  whatsapp: string | null;

  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;

  observacoes: string | null;
  limite_credito: number | null;
  prazo_pagamento_dias: number | null;
  ativo: boolean;

  created_at: string;
  updated_at: string;
};

export default function EditarClientePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [cliente, setCliente] = useState<ClienteDb | null>(null);

  // Campos
  const [tipo, setTipo] = useState<"empresa" | "pessoa">("empresa");
  const [nome, setNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [documento, setDocumento] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");

  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  const [observacoes, setObservacoes] = useState("");
  const [limiteCredito, setLimiteCredito] = useState<string>("0");
  const [prazoPagamentoDias, setPrazoPagamentoDias] = useState<string>("0");
  const [ativo, setAtivo] = useState(true);

  async function carregar() {
    if (!id) return;

    setLoading(true);
    setStatus("Carregando cliente...");

    const { data, error } = await supabase
      .from("clientes")
      .select(
        "id, tipo, nome, nome_fantasia, documento, inscricao_estadual, email, telefone, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes, limite_credito, prazo_pagamento_dias, ativo, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      setStatus("❌ Erro ao carregar: " + error.message);
      setCliente(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setStatus("⚠️ Cliente não encontrado (ou você não tem acesso).");
      setCliente(null);
      setLoading(false);
      return;
    }

    const c = data as ClienteDb;
    setCliente(c);

    setTipo(c.tipo);
    setNome(c.nome);
    setNomeFantasia(c.nome_fantasia ?? "");
    setDocumento(c.documento ?? "");
    setInscricaoEstadual(c.inscricao_estadual ?? "");

    setEmail(c.email ?? "");
    setTelefone(c.telefone ?? "");
    setWhatsapp(c.whatsapp ?? "");

    setCep(c.cep ?? "");
    setLogradouro(c.logradouro ?? "");
    setNumero(c.numero ?? "");
    setComplemento(c.complemento ?? "");
    setBairro(c.bairro ?? "");
    setCidade(c.cidade ?? "");
    setUf(c.uf ?? "");

    setObservacoes(c.observacoes ?? "");
    setLimiteCredito(
      typeof c.limite_credito === "number" ? String(c.limite_credito) : "0"
    );
    setPrazoPagamentoDias(
      typeof c.prazo_pagamento_dias === "number"
        ? String(c.prazo_pagamento_dias)
        : "0"
    );
    setAtivo(!!c.ativo);

    setStatus("");
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function toNumberOrNull(v: string) {
    const normalized = v.replace(",", ".").trim();
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    if (nome.trim().length < 2) {
      alert("Informe o nome do cliente.");
      return;
    }

    setSaving(true);
    setStatus("Salvando...");

    const payload = {
      tipo,
      nome: nome.trim(),
      nome_fantasia: nomeFantasia.trim() ? nomeFantasia.trim() : null,
      documento: documento.trim() ? documento.trim() : null,
      inscricao_estadual: inscricaoEstadual.trim()
        ? inscricaoEstadual.trim()
        : null,

      email: email.trim() ? email.trim() : null,
      telefone: telefone.trim() ? telefone.trim() : null,
      whatsapp: whatsapp.trim() ? whatsapp.trim() : null,

      cep: cep.trim() ? cep.trim() : null,
      logradouro: logradouro.trim() ? logradouro.trim() : null,
      numero: numero.trim() ? numero.trim() : null,
      complemento: complemento.trim() ? complemento.trim() : null,
      bairro: bairro.trim() ? bairro.trim() : null,
      cidade: cidade.trim() ? cidade.trim() : null,
      uf: uf.trim() ? uf.trim().toUpperCase().slice(0, 2) : null,

      observacoes: observacoes.trim() ? observacoes.trim() : null,
      limite_credito: toNumberOrNull(limiteCredito) ?? 0,
      prazo_pagamento_dias: (toNumberOrNull(prazoPagamentoDias) ?? 0) as number,
      ativo,
    };

    const { error } = await supabase.from("clientes").update(payload).eq("id", id);

    setSaving(false);

    if (error) {
      setStatus("❌ Erro ao salvar: " + error.message);
      return;
    }

    // ✅ Fluxo MasterFleetBR: salvar e voltar pra listagem
    router.push("/clientes");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">
        Carregando...
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold">Cliente</h1>
          <p className="text-slate-600 text-sm">{status || "Não encontrado."}</p>
        </div>

        <Link
          href="/clientes"
          className="inline-block border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
        >
          Voltar para clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Editar Cliente</h1>
          <p className="text-slate-600 text-sm">
            ID: <span className="font-mono">{cliente.id}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/clientes"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm"
          >
            Voltar
          </Link>
        </div>
      </div>

      {status ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
          {status}
        </div>
      ) : null}

      <form
        onSubmit={salvar}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        {/* Status Ativo/Inativo */}
        <div className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
          <div>
            <div className="font-medium">Status</div>
            <div className="text-sm text-slate-600">
              Ative/desative este cliente sem apagar.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAtivo((v) => !v)}
            className={`px-4 py-2 rounded-md text-sm transition ${
              ativo
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-slate-700 text-white hover:bg-slate-800"
            }`}
          >
            {ativo ? "Ativo" : "Inativo"}
          </button>
        </div>

        {/* Identificação */}
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Identificação
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "empresa" | "pessoa")}
              >
                <option value="empresa">Empresa</option>
                <option value="pessoa">Pessoa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Nome fantasia
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Documento (CNPJ/CPF)
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Inscrição Estadual
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={inscricaoEstadual}
                onChange={(e) => setInscricaoEstadual(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Contato</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Endereço (opcional)
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">CEP</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Logradouro
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Número</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Complemento
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bairro</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">UF</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                maxLength={2}
              />
            </div>
          </div>
        </div>

        {/* Comercial/Financeiro */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Comercial / Financeiro
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Limite de crédito (R$)
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={limiteCredito}
                onChange={(e) => setLimiteCredito(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Prazo de pagamento (dias)
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={prazoPagamentoDias}
                onChange={(e) => setPrazoPagamentoDias(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Observações
          </h2>

          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Informações internas, anotações, etc."
          />
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

          <Link
            href="/clientes"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>

        <div className="text-xs text-slate-500">
          Criado em: {new Date(cliente.created_at).toLocaleString("pt-BR")} •
          Atualizado em: {new Date(cliente.updated_at).toLocaleString("pt-BR")}
        </div>
      </form>
    </div>
  );
}