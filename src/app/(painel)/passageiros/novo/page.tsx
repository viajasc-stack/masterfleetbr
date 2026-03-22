"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

export default function NovoPassageiroPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
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
      cpf: cpf.trim() || null,
      telefone: telefone.trim() || null,
      observacoes: observacoes.trim() || null,
      status,
    });
    setSaving(false);

    if (error) {
      alert(`Erro ao salvar passageiro: ${error.message}`);
      return;
    }

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
    </div>
  );
}
