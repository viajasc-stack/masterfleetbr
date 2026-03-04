"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (nome.trim().length < 2) return alert("Informe o nome do usuário.");
    if (!email.trim()) return alert("Informe o e-mail do usuário.");
    if (cpf.replace(/\D/g, "").length < 11) return alert("Informe um CPF válido (11 dígitos).");

    setLoading(true);

    try {
      const { data: result, error } = await supabase.functions.invoke("create-usuario", {
        body: {
          nome: nome.trim(),
          apelido: apelido.trim() || null,
          cpf: cpf.trim() || null,
          rg: rg.trim() || null,
          data_nascimento: dataNascimento || null,

          email: email.trim(),
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
        },
      });

      if (error) {
        alert(`Erro ao criar usuário: ${error.message}`);
        return;
      }

      if (!result?.ok) {
        alert(`Erro ao criar usuário: ${result?.error ?? "erro desconhecido"}`);
        return;
      }

      alert("Usuário criado com sucesso. Senha padrão: CPF. No primeiro acesso será obrigatório alterar a senha.");
      router.push(`/usuarios/${result.usuario.id}`);
      router.refresh();
    } catch (err) {
      alert(`Falha de conexão ao criar usuário: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Usuário"
        description="Crie um usuário com acesso ao sistema web. Login: e-mail • Senha inicial: CPF"
        actions={
          <Link href="/usuarios" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
            Voltar
          </Link>
        }
      />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        Ao criar, o usuário receberá senha inicial baseada no CPF e será obrigado a alterá-la no primeiro acesso.
      </div>

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Identificação</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Apelido</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={apelido} onChange={(e) => setApelido(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CPF *</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">RG</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={rg} onChange={(e) => setRg(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data de nascimento</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Contato</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
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
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60">
            {loading ? "Salvando..." : "Salvar"}
          </button>
          <Link href="/usuarios" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
