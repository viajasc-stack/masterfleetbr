"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Passageiro = {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  observacoes_medicas: string | null;
  observacoes: string | null;
  status: string;
};

export default function EditarPassageiroPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const passageiroId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pax, setPax] = useState<Passageiro | null>(null);

  async function carregar() {
    if (!passageiroId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("passageiros")
      .select(
        "id,nome,email,cpf,rg,data_nascimento,telefone,endereco,numero,complemento,bairro,cidade,uf,cep,contato_emergencia_nome,contato_emergencia_telefone,observacoes_medicas,observacoes,status"
      )
      .eq("id", passageiroId)
      .maybeSingle();

    if (error || !data) {
      alert(error?.message ?? "Passageiro não encontrado.");
      router.push("/passageiros");
      return;
    }

    setPax(data as Passageiro);
    setLoading(false);
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageiroId]);

  async function salvar() {
    if (!pax) return;
    if (!pax.nome.trim()) {
      alert("Informe o nome do passageiro.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("passageiros")
      .update({
        nome: pax.nome.trim(),
        email: pax.email?.trim() || null,
        cpf: pax.cpf?.trim() || null,
        rg: pax.rg?.trim() || null,
        data_nascimento: pax.data_nascimento || null,
        telefone: pax.telefone?.trim() || null,
        endereco: pax.endereco?.trim() || null,
        numero: pax.numero?.trim() || null,
        complemento: pax.complemento?.trim() || null,
        bairro: pax.bairro?.trim() || null,
        cidade: pax.cidade?.trim() || null,
        uf: pax.uf?.trim().toUpperCase() || null,
        cep: pax.cep?.trim() || null,
        contato_emergencia_nome: pax.contato_emergencia_nome?.trim() || null,
        contato_emergencia_telefone: pax.contato_emergencia_telefone?.trim() || null,
        observacoes_medicas: pax.observacoes_medicas?.trim() || null,
        observacoes: pax.observacoes?.trim() || null,
        status: pax.status,
      })
      .eq("id", pax.id);
    setSaving(false);

    if (error) {
      alert(`Erro ao salvar: ${error.message}`);
      return;
    }

    router.push("/passageiros");
    router.refresh();
  }

  async function excluir() {
    if (!pax) return;
    if (!confirm(`Deseja realmente excluir o passageiro \"${pax.nome}\"?`)) return;

    setDeleting(true);
    const { error } = await supabase.from("passageiros").delete().eq("id", pax.id);
    setDeleting(false);

    if (error) {
      alert(`Erro ao excluir: ${error.message}`);
      return;
    }

    router.push("/passageiros");
    router.refresh();
  }

  if (loading || !pax) {
    return <div className="text-sm text-slate-600">Carregando passageiro...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Passageiro"
        description="Atualize o cadastro completo do passageiro."
        actions={
          <>
            <Link href="/passageiros" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
              Voltar
            </Link>
            <button
              onClick={excluir}
              disabled={deleting || saving}
              className="border border-rose-300 text-rose-700 px-4 py-2 rounded-md hover:bg-rose-50 transition disabled:opacity-60 text-sm"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
            <button
              onClick={salvar}
              disabled={saving || deleting}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60 text-sm"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Nome *</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.nome ?? ""} onChange={(e) => setPax({ ...pax, nome: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" type="email" value={pax.email ?? ""} onChange={(e) => setPax({ ...pax, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.telefone ?? ""} onChange={(e) => setPax({ ...pax, telefone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">CPF</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.cpf ?? ""} onChange={(e) => setPax({ ...pax, cpf: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">RG</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.rg ?? ""} onChange={(e) => setPax({ ...pax, rg: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Data nascimento</label>
          <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.data_nascimento ?? ""} onChange={(e) => setPax({ ...pax, data_nascimento: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.status} onChange={(e) => setPax({ ...pax, status: e.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <div className="md:col-span-2 border-t pt-4 mt-2">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Endereço</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.endereco ?? ""} onChange={(e) => setPax({ ...pax, endereco: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Número</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.numero ?? ""} onChange={(e) => setPax({ ...pax, numero: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Complemento</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.complemento ?? ""} onChange={(e) => setPax({ ...pax, complemento: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bairro</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.bairro ?? ""} onChange={(e) => setPax({ ...pax, bairro: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.cidade ?? ""} onChange={(e) => setPax({ ...pax, cidade: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">UF</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.uf ?? ""} maxLength={2} onChange={(e) => setPax({ ...pax, uf: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CEP</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.cep ?? ""} onChange={(e) => setPax({ ...pax, cep: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="md:col-span-2 border-t pt-4 mt-2">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Contato de emergência</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.contato_emergencia_nome ?? ""} onChange={(e) => setPax({ ...pax, contato_emergencia_nome: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={pax.contato_emergencia_telefone ?? ""} onChange={(e) => setPax({ ...pax, contato_emergencia_telefone: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Observações médicas</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]" value={pax.observacoes_medicas ?? ""} onChange={(e) => setPax({ ...pax, observacoes_medicas: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]" value={pax.observacoes ?? ""} onChange={(e) => setPax({ ...pax, observacoes: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
