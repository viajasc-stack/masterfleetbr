"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";

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

type MotoristaDb = {
  id: string;
  empresa_id: string;

  nome: string;
  apelido: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;

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

  cnh_numero: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;
  cnh_observacoes: string | null;

  status: "ativo" | "ferias" | "afastado" | "inativo";
  pode_abastecer: boolean;
  data_admissao: string | null;
  data_demissao: string | null;

  chave_pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;

  vinculo_trabalho: "freelancer" | "contratado" | null;
  tipo_remuneracao: "fixo_extra" | "fixo_banco_horas" | "por_os_executada" | "por_diaria" | null;
  salario_base: number | null;
  valor_hora_extra: number | null;
  banco_horas_saldo: number | null;
  valor_por_os: number | null;
  valor_diaria: number | null;
  observacoes_remuneracao: string | null;

  foto_perfil_url: string | null;
  cnh_arquivo_url: string | null;
  cursos_urls: string[] | null;

  observacoes: string | null;

  created_at: string;
  updated_at: string;
};

export default function EditarMotoristaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingSenha, setResettingSenha] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [uploadWarning, setUploadWarning] = useState<string>("");
  const [canShowFinanceiro, setCanShowFinanceiro] = useState(false);

  const [motorista, setMotorista] = useState<MotoristaDb | null>(null);

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
  const [podeAbastecer, setPodeAbastecer] = useState(false);
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDemissao, setDataDemissao] = useState("");

  // Financeiro
  const [chavePix, setChavePix] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");

  // Vínculo e remuneração
  const [vinculoTrabalho, setVinculoTrabalho] = useState<"freelancer" | "contratado">("contratado");
  const [tipoRemuneracao, setTipoRemuneracao] = useState<
    "fixo_extra" | "fixo_banco_horas" | "por_os_executada" | "por_diaria"
  >("fixo_extra");
  const [salarioBase, setSalarioBase] = useState("");
  const [valorHoraExtra, setValorHoraExtra] = useState("");
  const [bancoHorasSaldo, setBancoHorasSaldo] = useState("");
  const [valorPorOs, setValorPorOs] = useState("");
  const [valorDiaria, setValorDiaria] = useState("");
  const [observacoesRemuneracao, setObservacoesRemuneracao] = useState("");

  // Arquivos
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);
  const [cnhArquivoUrl, setCnhArquivoUrl] = useState<string | null>(null);
  const [cursosUrls, setCursosUrls] = useState<string[]>([]);
  const [cnhFile, setCnhFile] = useState<File | null>(null);
  const [cursosFiles, setCursosFiles] = useState<File[]>([]);

  // Observações
  const [observacoes, setObservacoes] = useState("");

  async function carregarEmpresaId() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setStatusMsg("❌ Você não está logado. Faça login para ver os detalhes do motorista.");
      return null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error || !profile?.empresa_id) {
      setStatusMsg("⚠️ Não foi possível identificar sua empresa.");
      return null;
    }

    return profile.empresa_id as string;
  }

  async function carregar() {
    if (!id) return;

    setLoading(true);
    setStatusMsg("Carregando motorista...");

    const empresaId = await carregarEmpresaId();
    if (!empresaId) {
      setMotorista(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("motoristas")
      .select(
        "id, empresa_id, nome, apelido, cpf, rg, data_nascimento, email, telefone, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, uf, cnh_numero, cnh_categoria, cnh_validade, cnh_observacoes, status, pode_abastecer, data_admissao, data_demissao, chave_pix, banco, agencia, conta, vinculo_trabalho, tipo_remuneracao, salario_base, valor_hora_extra, banco_horas_saldo, valor_por_os, valor_diaria, observacoes_remuneracao, foto_perfil_url, cnh_arquivo_url, cursos_urls, observacoes, created_at, updated_at"
      )
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) {
      setStatusMsg("❌ Erro ao carregar: " + error.message);
      setMotorista(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setStatusMsg("⚠️ Motorista não encontrado (ou você não tem acesso).");
      setMotorista(null);
      setLoading(false);
      return;
    }

    const m = data as MotoristaDb;
    setMotorista(m);

    setNome(m.nome ?? "");
    setApelido(m.apelido ?? "");
    setCpf(m.cpf ?? "");
    setRg(m.rg ?? "");
    setDataNascimento(m.data_nascimento ?? "");

    setEmail(m.email ?? "");
    setTelefone(m.telefone ?? "");
    setWhatsapp(m.whatsapp ?? "");

    setCep(m.cep ?? "");
    setLogradouro(m.logradouro ?? "");
    setNumero(m.numero ?? "");
    setComplemento(m.complemento ?? "");
    setBairro(m.bairro ?? "");
    setCidade(m.cidade ?? "");
    setUf(m.uf ?? "");

    setCnhNumero(m.cnh_numero ?? "");
    setCnhCategoria(m.cnh_categoria ?? "");
    setCnhValidade(m.cnh_validade ?? "");
    setCnhObs(m.cnh_observacoes ?? "");

    setStatus(m.status ?? "ativo");
    setPodeAbastecer(Boolean(m.pode_abastecer));
    setDataAdmissao(m.data_admissao ?? "");
    setDataDemissao(m.data_demissao ?? "");

    setChavePix(m.chave_pix ?? "");
    setBanco(m.banco ?? "");
    setAgencia(m.agencia ?? "");
    setConta(m.conta ?? "");
    setVinculoTrabalho(m.vinculo_trabalho ?? "contratado");
    setTipoRemuneracao(m.tipo_remuneracao ?? "fixo_extra");
    setSalarioBase(m.salario_base != null ? String(m.salario_base) : "");
    setValorHoraExtra(m.valor_hora_extra != null ? String(m.valor_hora_extra) : "");
    setBancoHorasSaldo(m.banco_horas_saldo != null ? String(m.banco_horas_saldo) : "");
    setValorPorOs(m.valor_por_os != null ? String(m.valor_por_os) : "");
    setValorDiaria(m.valor_diaria != null ? String(m.valor_diaria) : "");
    setObservacoesRemuneracao(m.observacoes_remuneracao ?? "");

    setFotoPerfilUrl(m.foto_perfil_url ?? null);
    setCnhArquivoUrl(m.cnh_arquivo_url ?? null);
    setCursosUrls(Array.isArray(m.cursos_urls) ? m.cursos_urls : []);

    setObservacoes(m.observacoes ?? "");

    setStatusMsg("");
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        const access = await loadEmpresaModuleAccess();
        setCanShowFinanceiro(
          access.canUseAllModules || access.allowedModules.includes("financeiro")
        );
      })();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  function dateOrNull(v: string) {
    if (!v) return null;
    return v; // coluna date
  }

  function numberOrNull(v: string) {
    if (!v.trim()) return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  async function uploadArquivo(pasta: string, file: File) {
    if (!motorista?.empresa_id || !id) throw new Error("Dados do motorista não carregados para upload");

    const path = `${motorista.empresa_id}/motoristas/${id}/${pasta}/${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error } = await supabase.storage
      .from("motoristas")
      .upload(path, file, { upsert: false });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("motoristas").getPublicUrl(path);
    return data.publicUrl;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    if (nome.trim().length < 2) {
      alert("Informe o nome do motorista.");
      return;
    }

    setSaving(true);
    setStatusMsg("Salvando...");
    setUploadWarning("");

    let cnhArquivoUrlFinal = cnhArquivoUrl;
    let cursosUrlsFinal = [...cursosUrls];

    try {
      if (cnhFile) {
        cnhArquivoUrlFinal = await uploadArquivo("cnh", cnhFile);
      }

      if (cursosFiles.length > 0) {
        cursosUrlsFinal = await Promise.all(cursosFiles.map((file) => uploadArquivo("cursos", file)));
      }
    } catch (uploadError) {
      if (isBucketNotFoundError(uploadError)) {
        setUploadWarning(
          "Uploads ignorados porque o bucket 'motoristas' ainda não existe no Supabase. As alterações foram salvas sem anexos."
        );
      } else {
        setSaving(false);
        setStatusMsg(`❌ Erro no upload: ${uploadError instanceof Error ? uploadError.message : "erro desconhecido"}`);
        return;
      }
    }

    const payloadFinanceiro = canShowFinanceiro
      ? {
          chave_pix: chavePix.trim() || null,
          banco: banco.trim() || null,
          agencia: agencia.trim() || null,
          conta: conta.trim() || null,
          vinculo_trabalho: vinculoTrabalho,
          tipo_remuneracao: tipoRemuneracao,
          salario_base: ["fixo_extra", "fixo_banco_horas"].includes(tipoRemuneracao)
            ? numberOrNull(salarioBase)
            : null,
          valor_hora_extra: tipoRemuneracao === "fixo_extra" ? numberOrNull(valorHoraExtra) : null,
          banco_horas_saldo: tipoRemuneracao === "fixo_banco_horas" ? numberOrNull(bancoHorasSaldo) : null,
          valor_por_os: tipoRemuneracao === "por_os_executada" ? numberOrNull(valorPorOs) : null,
          valor_diaria: tipoRemuneracao === "por_diaria" ? numberOrNull(valorDiaria) : null,
          observacoes_remuneracao: observacoesRemuneracao.trim() || null,
        }
      : {};

    const payload = {
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
      pode_abastecer: podeAbastecer,
      data_admissao: dateOrNull(dataAdmissao),
      data_demissao: dateOrNull(dataDemissao),

      ...payloadFinanceiro,
      foto_perfil_url: fotoPerfilUrl,
      cnh_arquivo_url: cnhArquivoUrlFinal,
      cursos_urls: cursosUrlsFinal,

      observacoes: observacoes.trim() || null,
    };

    const { error } = await supabase
      .from("motoristas")
      .update(payload)
      .eq("id", id);

    setSaving(false);

    if (error) {
      setStatusMsg("❌ Erro ao salvar: " + error.message);
      return;
    }

    // ✅ Padrão MasterFleetBR: salvar e voltar
    router.push("/motoristas");
    router.refresh();
  }

  async function resetarSenhaParaCpf() {
    if (!motorista?.id) return;

    const confirmado = window.confirm(
      `Deseja resetar a senha de \"${motorista.nome}\" para os 6 primeiros números do CPF e exigir troca no próximo login?`
    );
    if (!confirmado) return;

    setResettingSenha(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        alert("Sessão inválida. Faça login novamente.");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reset-motorista-senha`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ motorista_id: motorista.id }),
      });

      const result = await response.json();
      if (!response.ok || !result?.ok) {
        alert("Erro ao resetar senha: " + (result?.error ?? "erro desconhecido"));
        return;
      }

      alert("Senha resetada com sucesso para os 6 primeiros números do CPF. No próximo login, o motorista será obrigado a alterar a senha.");
    } catch (err) {
      alert(`Falha de conexão ao resetar senha: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setResettingSenha(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">
        Carregando...
      </div>
    );
  }

  if (!motorista) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold">Motorista</h1>
          <p className="text-slate-600 text-sm">{statusMsg || "Não encontrado."}</p>
        </div>

        <Link
          href="/motoristas"
          className="inline-block border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
        >
          Voltar para motoristas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Motorista"
        description={`ID: ${motorista.id}`}
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
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
          {statusMsg}
        </div>
      ) : null}

      {uploadWarning ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {uploadWarning}
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Permissão de abastecimento</label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={podeAbastecer}
                  onChange={(e) => setPodeAbastecer(e.target.checked)}
                />
                Motorista pode registrar abastecimento
              </label>
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

        {canShowFinanceiro ? (
          <>
        {/* Financeiro */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Vínculo e remuneração
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Formato de trabalho</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={vinculoTrabalho}
                onChange={(e) => setVinculoTrabalho(e.target.value as "freelancer" | "contratado")}
              >
                <option value="contratado">Contratado</option>
                <option value="freelancer">Freelancer</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Tipo de salário/remuneração</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={tipoRemuneracao}
                onChange={(e) =>
                  setTipoRemuneracao(
                    e.target.value as "fixo_extra" | "fixo_banco_horas" | "por_os_executada" | "por_diaria"
                  )
                }
              >
                <option value="fixo_extra">Fixo + extra</option>
                <option value="fixo_banco_horas">Fixo + banco de horas</option>
                <option value="por_os_executada">Por OS executada</option>
                <option value="por_diaria">Por diária</option>
              </select>
            </div>

            {(tipoRemuneracao === "fixo_extra" || tipoRemuneracao === "fixo_banco_horas") && (
              <div>
                <label className="block text-sm font-medium mb-1">Salário base (R$)</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={salarioBase}
                  onChange={(e) => setSalarioBase(e.target.value)}
                />
              </div>
            )}

            {tipoRemuneracao === "fixo_extra" && (
              <div>
                <label className="block text-sm font-medium mb-1">Valor hora extra (R$)</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={valorHoraExtra}
                  onChange={(e) => setValorHoraExtra(e.target.value)}
                />
              </div>
            )}

            {tipoRemuneracao === "fixo_banco_horas" && (
              <div>
                <label className="block text-sm font-medium mb-1">Saldo banco de horas</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={bancoHorasSaldo}
                  onChange={(e) => setBancoHorasSaldo(e.target.value)}
                />
              </div>
            )}

            {tipoRemuneracao === "por_os_executada" && (
              <div>
                <label className="block text-sm font-medium mb-1">Valor por OS (R$)</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={valorPorOs}
                  onChange={(e) => setValorPorOs(e.target.value)}
                />
              </div>
            )}

            {tipoRemuneracao === "por_diaria" && (
              <div>
                <label className="block text-sm font-medium mb-1">Valor da diária (R$)</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={valorDiaria}
                  onChange={(e) => setValorDiaria(e.target.value)}
                />
              </div>
            )}

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">Observações da remuneração</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={observacoesRemuneracao}
                onChange={(e) => setObservacoesRemuneracao(e.target.value)}
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
          </>
        ) : null}

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

        {/* Arquivos do motorista */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Arquivos do motorista</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">Imagem de perfil (definida pelo app)</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2 bg-slate-50"
                value={fotoPerfilUrl ?? ""}
                readOnly
                placeholder="Será enviada pelo aplicativo do motorista"
              />
              {fotoPerfilUrl ? (
                <a className="text-xs text-blue-700 mt-2 inline-block" href={fotoPerfilUrl} target="_blank" rel="noreferrer">
                  Ver imagem de perfil atual
                </a>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Upload CNH (web)</label>
              <input
                type="file"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setCnhFile(e.target.files?.[0] ?? null)}
              />
              {cnhArquivoUrl ? (
                <a className="text-xs text-blue-700 mt-2 inline-block" href={cnhArquivoUrl} target="_blank" rel="noreferrer">
                  Ver CNH atual
                </a>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Upload cursos (web, múltiplos)</label>
              <input
                type="file"
                multiple
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setCursosFiles(Array.from(e.target.files ?? []))}
              />
              {cursosUrls.length > 0 ? (
                <p className="text-xs text-slate-600 mt-2">{cursosUrls.length} arquivo(s) de curso já cadastrado(s).</p>
              ) : null}
            </div>
          </div>
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

          <button
            type="button"
            onClick={resetarSenhaParaCpf}
            disabled={resettingSenha}
            className="border border-amber-300 text-amber-800 px-4 py-2 rounded-md hover:bg-amber-50 transition disabled:opacity-60"
          >
            {resettingSenha ? "Resetando senha..." : "Resetar senha (6 primeiros do CPF)"}
          </button>

          <Link
            href="/motoristas"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>

        <div className="text-xs text-slate-500">
          Criado em: {new Date(motorista.created_at).toLocaleString("pt-BR")} •
          Atualizado em: {new Date(motorista.updated_at).toLocaleString("pt-BR")}
        </div>
      </form>
    </div>
  );
}
