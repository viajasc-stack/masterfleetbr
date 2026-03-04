"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type UsuarioDb = {
  id: string;
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
  status: "ativo" | "ferias" | "afastado" | "inativo";
  data_admissao: string | null;
  data_demissao: string | null;
  chave_pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export default function EditarUsuarioPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingSenha, setResettingSenha] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [usuario, setUsuario] = useState<UsuarioDb | null>(null);

  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
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
  const [status, setStatus] = useState<"ativo" | "ferias" | "afastado" | "inativo">("ativo");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDemissao, setDataDemissao] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function carregar() {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      setStatusMsg(error?.message ?? "Usuário não encontrado.");
      setUsuario(null);
      setLoading(false);
      return;
    }

    const u = data as UsuarioDb;
    setUsuario(u);

    setNome(u.nome ?? "");
    setApelido(u.apelido ?? "");
    setCpf(u.cpf ?? "");
    setRg(u.rg ?? "");
    setDataNascimento(u.data_nascimento ?? "");
    setEmail(u.email ?? "");
    setTelefone(u.telefone ?? "");
    setWhatsapp(u.whatsapp ?? "");
    setCep(u.cep ?? "");
    setLogradouro(u.logradouro ?? "");
    setNumero(u.numero ?? "");
    setComplemento(u.complemento ?? "");
    setBairro(u.bairro ?? "");
    setCidade(u.cidade ?? "");
    setUf(u.uf ?? "");
    setStatus(u.status ?? "ativo");
    setDataAdmissao(u.data_admissao ?? "");
    setDataDemissao(u.data_demissao ?? "");
    setChavePix(u.chave_pix ?? "");
    setBanco(u.banco ?? "");
    setAgencia(u.agencia ?? "");
    setConta(u.conta ?? "");
    setObservacoes(u.observacoes ?? "");

    setStatusMsg("");
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (nome.trim().length < 2) return alert("Informe o nome do usuário.");

    setSaving(true);
    const { error } = await supabase
      .from("usuarios")
      .update({
        nome: nome.trim(),
        apelido: apelido.trim() || null,
        cpf: cpf.trim() || null,
        rg: rg.trim() || null,
        data_nascimento: dataNascimento || null,
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
        status,
        data_admissao: dataAdmissao || null,
        data_demissao: dataDemissao || null,
        chave_pix: chavePix.trim() || null,
        banco: banco.trim() || null,
        agencia: agencia.trim() || null,
        conta: conta.trim() || null,
        observacoes: observacoes.trim() || null,
      })
      .eq("id", id);

    setSaving(false);
    if (error) return alert("Erro ao salvar: " + error.message);

    router.push("/usuarios");
    router.refresh();
  }

  async function resetarSenhaParaCpf() {
    if (!usuario?.id) return;

    const confirmado = window.confirm(
      `Deseja resetar a senha de \"${usuario.nome}\" para o CPF e exigir troca no próximo login?`
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reset-usuario-senha`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ usuario_id: usuario.id }),
      });

      const result = await response.json();
      if (!response.ok || !result?.ok) {
        alert("Erro ao resetar senha: " + (result?.error ?? "erro desconhecido"));
        return;
      }

      alert("Senha resetada para o CPF com sucesso. No próximo login, o usuário será obrigado a alterar a senha.");
    } catch (err) {
      alert(`Falha de conexão ao resetar senha: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setResettingSenha(false);
    }
  }

  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">Carregando...</div>;
  }

  if (!usuario) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold">Usuário</h1>
          <p className="text-slate-600 text-sm">{statusMsg || "Não encontrado."}</p>
        </div>
        <Link href="/usuarios" className="inline-block border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Usuário"
        description={`ID: ${usuario.id}`}
        actions={<Link href="/usuarios" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">Voltar</Link>}
      />

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Identificação</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Nome *</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div><label className="block text-sm font-medium mb-1">Apelido</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={apelido} onChange={(e) => setApelido(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">CPF</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cpf} onChange={(e) => setCpf(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">RG</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={rg} onChange={(e) => setRg(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Data de nascimento</label><input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} /></div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Contato</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Telefone</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">WhatsApp</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Endereço (opcional)</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="block text-sm font-medium mb-1">CEP</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cep} onChange={(e) => setCep(e.target.value)} /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Logradouro</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Número</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Complemento</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Bairro</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Cidade</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">UF</label><input maxLength={2} className="w-full border border-slate-300 rounded-md px-3 py-2" value={uf} onChange={(e) => setUf(e.target.value)} /></div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Operacional</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="ativo">Ativo</option>
                <option value="ferias">Férias</option>
                <option value="afastado">Afastado</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Data admissão</label><input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Data demissão</label><input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataDemissao} onChange={(e) => setDataDemissao(e.target.value)} /></div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Financeiro (opcional)</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Chave PIX</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={chavePix} onChange={(e) => setChavePix(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Banco</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={banco} onChange={(e) => setBanco(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Agência</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={agencia} onChange={(e) => setAgencia(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1">Conta</label><input className="w-full border border-slate-300 rounded-md px-3 py-2" value={conta} onChange={(e) => setConta(e.target.value)} /></div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Observações</h2>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={resetarSenhaParaCpf}
            disabled={resettingSenha}
            className="border border-amber-300 text-amber-800 px-4 py-2 rounded-md hover:bg-amber-50 transition disabled:opacity-60"
          >
            {resettingSenha ? "Resetando senha..." : "Resetar senha para CPF"}
          </button>
          <Link href="/usuarios" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">Cancelar</Link>
        </div>

        <div className="text-xs text-slate-500">
          Criado em: {new Date(usuario.created_at).toLocaleString("pt-BR")} • Atualizado em: {new Date(usuario.updated_at).toLocaleString("pt-BR")}
        </div>
      </form>
    </div>
  );
}
