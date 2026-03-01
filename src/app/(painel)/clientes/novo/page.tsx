"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";


export default function NovoClientePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const [tipo, setTipo] = useState<"empresa" | "pessoa">("empresa");
  const [nome, setNome] = useState("");
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

  async function carregarEmpresaId() {
    setStatus("Carregando sessão...");
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setStatus("❌ Você não está logado. Vá para /login.");
      setEmpresaId(null);
      return;
    }

    setStatus("Lendo seu profile (empresa_id)...");
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();

    if (error) {
      setStatus("❌ Erro ao ler profile: " + error.message);
      setEmpresaId(null);
      return;
    }

    if (!profile?.empresa_id) {
      setStatus("⚠️ Você está logado, mas não tem empresa vinculada.");
      setEmpresaId(null);
      return;
    }

    setEmpresaId(profile.empresa_id);
    setStatus("");
  }

  useEffect(() => {
    carregarEmpresaId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) {
      alert("Sem empresa vinculada. Vá em Configurações.");
      return;
    }

    if (nome.trim().length < 2) {
      alert("Informe o nome do cliente.");
      return;
    }

    setLoading(true);

    const payload = {
      empresa_id: empresaId,
      tipo,
      nome: nome.trim(),
      email: email.trim() ? email.trim() : null,
      telefone: telefone.trim() ? telefone.trim() : null,
      whatsapp: whatsapp.trim() ? whatsapp.trim() : null,

      cep: cep.trim() ? cep.trim() : null,
      logradouro: logradouro.trim() ? logradouro.trim() : null,
      numero: numero.trim() ? numero.trim() : null,
      complemento: complemento.trim() ? complemento.trim() : null,
      bairro: bairro.trim() ? bairro.trim() : null,
      cidade: cidade.trim() ? cidade.trim() : null,
      uf: uf.trim() ? uf.trim() : null,
    };

    const { data, error } = await supabase
      .from("clientes")
      .insert(payload)
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    // Vai para edição do cliente recém criado (padrão ERP)
    router.push(`/clientes/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Novo Cliente</h1>
          <p className="text-slate-600 text-sm">
            Cadastre um cliente na sua empresa.
          </p>
        </div>

        <Link
          href="/clientes"
          className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm"
        >
          Voltar
        </Link>
      </div>

      {/* Status (só aparece se tiver algo) */}
      {status ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-700 whitespace-pre-wrap">
          {status}
        </div>
      ) : null}

      {/* Form */}
      <form
        onSubmit={salvar}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
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
              placeholder="Ex: AGIOTUR Turismo"
              required
            />
          </div>

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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !empresaId}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>

          <Link
            href="/clientes"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
