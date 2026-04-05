"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SuccessRedirectModal } from "@/components/ui/SuccessRedirectModal";
import { supabase } from "@/lib/supabase/client";

export default function NovoPassageiroPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");
  const [contatoEmergenciaNome, setContatoEmergenciaNome] = useState("");
  const [contatoEmergenciaTelefone, setContatoEmergenciaTelefone] = useState("");
  const [observacoesMedicas, setObservacoesMedicas] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("ativo");

  async function salvar() {
    if (!nome.trim()) {
      alert("Informe o nome do passageiro.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("passageiros").insert({
      nome: nome.trim(),
      email: email.trim() || null,
      cpf: cpf.trim() || null,
      rg: rg.trim() || null,
      data_nascimento: dataNascimento || null,
      telefone: telefone.trim() || null,
      endereco: endereco.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      uf: uf.trim().toUpperCase() || null,
      cep: cep.trim() || null,
      contato_emergencia_nome: contatoEmergenciaNome.trim() || null,
      contato_emergencia_telefone: contatoEmergenciaTelefone.trim() || null,
      observacoes_medicas: observacoesMedicas.trim() || null,
      observacoes: observacoes.trim() || null,
      status,
    });
    setSaving(false);

    if (error) {
      alert(`Erro ao salvar passageiro: ${error.message}`);
      return;
    }

    setSuccessModalOpen(true);
  }

  function confirmarSucesso() {
    router.push("/passageiros");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Passageiro"
        description="Cadastre todos os dados necessários do passageiro."
        actions={
          <>
            <Link href="/passageiros" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
              Voltar
            </Link>
            <button
              onClick={salvar}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60 text-sm"
            >
              {saving ? "Salvando..." : "Salvar passageiro"}
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Nome *</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">CPF</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">RG</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={rg}
            onChange={(e) => setRg(e.target.value)}
            placeholder="RG"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data de nascimento</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <div className="md:col-span-2 border-t pt-4 mt-2">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Endereço</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Número</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Complemento</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bairro</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">UF</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CEP</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cep} onChange={(e) => setCep(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="md:col-span-2 border-t pt-4 mt-2">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Contato de emergência</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={contatoEmergenciaNome} onChange={(e) => setContatoEmergenciaNome(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={contatoEmergenciaTelefone} onChange={(e) => setContatoEmergenciaTelefone(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Observações médicas</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]"
            value={observacoesMedicas}
            onChange={(e) => setObservacoesMedicas(e.target.value)}
            placeholder="Alergias, restrições e informações úteis para operação"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Informações adicionais do passageiro..."
          />
        </div>
      </div>

      <SuccessRedirectModal
        open={successModalOpen}
        title="Passageiro adicionado com sucesso"
        description="Cadastro concluído."
        onConfirm={confirmarSucesso}
      />
    </div>
  );
}
