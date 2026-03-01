"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";


export default function NovoMotoristaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Identificação
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");

  // Contato
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Endereço
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  // CNH
  const [cnhNumero, setCnhNumero] = useState("");
  const [cnhCategoria, setCnhCategoria] = useState("");
  const [cnhValidade, setCnhValidade] = useState("");
  const [cnhObs, setCnhObs] = useState("");

  // Operacional
  const [status, setStatus] = useState<"ativo" | "ferias" | "afastado" | "inativo">(
    "ativo"
  );
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDemissao, setDataDemissao] = useState("");

  // Financeiro
  const [chavePix, setChavePix] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");

  // Observações
  const [observacoes, setObservacoes] = useState("");

  async function carregarEmpresaId() {
    setStatusMsg("Carregando sessão...");
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setStatusMsg("❌ Você não está logado. Vá para /login.");
      setEmpresaId(null);
      return;
    }

    setStatusMsg("Lendo seu profile (empresa_id)...");
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();

    if (error) {
      setStatusMsg("❌ Erro ao ler profile: " + error.message);
      setEmpresaId(null);
      return;
    }

    if (!profile?.empresa_id) {
      setStatusMsg("⚠️ Você está logado, mas não tem empresa vinculada.");
      setEmpresaId(null);
      return;
    }

    setEmpresaId(profile.empresa_id);
    setStatusMsg("");
  }

  useEffect(() => {
    carregarEmpresaId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dateOrNull(v: string) {
    if (!v) return null;
    return v; // coluna é date, pode enviar YYYY-MM-DD
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) {
      alert("Sem empresa vinculada. Vá em Configurações.");
      return;
    }

    if (nome.trim().length < 2) {
      alert("Informe o nome do motorista.");
      return;
    }

    setLoading(true);

    const payload = {
      empresa_id: empresaId,

      nome: nome.trim(),
      apelido: apelido.trim() || null,
      cpf: cpf.trim() || null,
      rg: rg.trim() || null,
      data_nascimento: dateOrNull(dataNascimento),

      email: email.trim() || null,
      telefone: telefone.trim() || null,
      whatsapp: whatsapp.trim() || null,

      cep: cep.trim() || null,
      logradouro: logradouro.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      uf: uf.trim() ? uf.trim().toUpperCase().slice(0, 2) : null,

      cnh_numero: cnhNumero.trim() || null,
      cnh_categoria: cnhCategoria.trim() || null,
      cnh_validade: dateOrNull(cnhValidade),
      cnh_observacoes: cnhObs.trim() || null,

      status,
      data_admissao: dateOrNull(dataAdmissao),
      data_demissao: dateOrNull(dataDemissao),

      chave_pix: chavePix.trim() || null,
      banco: banco.trim() || null,
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,

      observacoes: observacoes.trim() || null,
    };

    const { data, error } = await supabase
      .from("motoristas")
      .insert(payload)
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    router.push(`/motoristas/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Motorista"
        description="Cadastre um motorista na sua empresa."
        actions={
          <Link
            href="/motoristas"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm"
          >
            Voltar
          </Link>
        }
      />

      {statusMsg ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-700 whitespace-pre-wrap">
          {statusMsg}
        </div>
      ) : null}

      <form
        onSubmit={salvar}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        {/* Identificação */}
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Identificação
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Apelido</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CPF</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">RG</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Data de nascimento
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
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

        {/* CNH */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">CNH</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Número CNH
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cnhNumero}
                onChange={(e) => setCnhNumero(e.target.value)}
                placeholder="opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cnhCategoria}
                onChange={(e) => setCnhCategoria(e.target.value)}
                placeholder="D, E..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Validade</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cnhValidade}
                onChange={(e) => setCnhValidade(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">
                Observações CNH
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cnhObs}
                onChange={(e) => setCnhObs(e.target.value)}
                placeholder="Ex: EAR, restrições, etc."
              />
            </div>
          </div>
        </div>

        {/* Operacional */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Operacional
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as "ativo" | "ferias" | "afastado" | "inativo"
                  )
                }
              >
                <option value="ativo">Ativo</option>
                <option value="ferias">Férias</option>
                <option value="afastado">Afastado</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Data admissão
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={dataAdmissao}
                onChange={(e) => setDataAdmissao(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Data demissão
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={dataDemissao}
                onChange={(e) => setDataDemissao(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Financeiro */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Financeiro (opcional)
          </h2>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Chave PIX</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Banco</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Agência</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Conta</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
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
            placeholder="Anotações internas..."
          />
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !empresaId}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>

          <Link
            href="/motoristas"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
