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

export default function EditarCadastroPassageiroPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const passageiroId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pax, setPax] = useState<Passageiro | null>(null);

  async function carregar() {
    if (!passageiroId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("passageiros")
      .select(
        "id,nome,email,cpf,rg,data_nascimento,telefone,endereco,numero,complemento,bairro,cidade,uf,cep,contato_emergencia_nome,contato_emergencia_telefone,observacoes_medicas,observacoes,status",
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
    if (!pax.nome.trim()) return alert("Informe o nome do passageiro.");

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

    if (error) return alert(error.message);
    router.push(`/passageiros/${pax.id}`);
    router.refresh();
  }

  if (loading || !pax) return <div className="text-sm text-slate-600">Carregando cadastro...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar cadastro do passageiro"
        description="Altere apenas os dados cadastrais do passageiro."
        actions={
          <>
            <Link href={`/passageiros/${pax.id}`} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
              Voltar para operação
            </Link>
            <button onClick={salvar} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60 text-sm">
              {saving ? "Salvando..." : "Salvar cadastro"}
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
      </div>
    </div>
  );
}
