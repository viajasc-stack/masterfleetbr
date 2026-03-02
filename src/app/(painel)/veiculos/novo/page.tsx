"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";


export default function NovoVeiculoPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState("van");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [cor, setCor] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [kmAtual, setKmAtual] = useState("");
  const [status, setStatus] = useState<"ativo" | "manutencao" | "inativo">("ativo");

  const [renavam, setRenavam] = useState("");
  const [chassi, setChassi] = useState("");
  const [validadeDocumento, setValidadeDocumento] = useState("");
  const [validadeSeguro, setValidadeSeguro] = useState("");
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
    const id = setTimeout(() => {
      void carregarEmpresaId();
    }, 0);

    return () => clearTimeout(id);
  }, []);

  function toIntOrNull(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  function toNumOrNull(v: string) {
    const normalized = v.replace(",", ".").trim();
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function toDateOrNull(v: string) {
    if (!v) return null;
    // HTML date -> "YYYY-MM-DD"
    return new Date(v + "T00:00:00.000Z").toISOString();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) {
      alert("Sem empresa vinculada. Vá em Configurações.");
      return;
    }

    const placaFinal = placa.trim().toUpperCase();

    if (placaFinal.length < 7) {
      alert("Informe a placa (mínimo 7 caracteres).");
      return;
    }

    setLoading(true);

    const payload = {
      empresa_id: empresaId,

      placa: placaFinal,
      tipo: tipo.trim() || null,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      ano_fabricacao: toIntOrNull(anoFabricacao),
      ano_modelo: toIntOrNull(anoModelo),
      cor: cor.trim() || null,

      capacidade_passageiros: toIntOrNull(capacidade) ?? 0,
      combustivel: combustivel.trim() || null,
      km_atual: toNumOrNull(kmAtual) ?? 0,
      status,

      renavam: renavam.trim() || null,
      chassi: chassi.trim() || null,
      validade_documento: toDateOrNull(validadeDocumento),
      validade_seguro: toDateOrNull(validadeSeguro),

      observacoes: observacoes.trim() || null,
    };

    const { data, error } = await supabase
      .from("veiculos")
      .insert(payload)
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    router.push(`/veiculos/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Veículo"
        description="Cadastre um veículo na sua frota."
        actions={
          <Link
            href="/veiculos"
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
            <div>
              <label className="block text-sm font-medium mb-1">Placa *</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                placeholder="ABC1D23"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="van, onibus, micro..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "ativo" | "manutencao" | "inativo")
                }
              >
                <option value="ativo">Ativo</option>
                <option value="manutencao">Manutenção</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dados do veículo */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Dados do veículo
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Marca</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Mercedes, VW..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Modelo</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Sprinter..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cor</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                placeholder="Branco..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Ano fabricação
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={anoFabricacao}
                onChange={(e) => setAnoFabricacao(e.target.value)}
                placeholder="2020"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ano modelo</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={anoModelo}
                onChange={(e) => setAnoModelo(e.target.value)}
                placeholder="2021"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Capacidade (pax)
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Combustível</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={combustivel}
                onChange={(e) => setCombustivel(e.target.value)}
                placeholder="diesel, flex..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">KM atual</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={kmAtual}
                onChange={(e) => setKmAtual(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Documentos / Seguro (opcional)
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Renavam</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={renavam}
                onChange={(e) => setRenavam(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Chassi</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={chassi}
                onChange={(e) => setChassi(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Validade licenciamento
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={validadeDocumento}
                onChange={(e) => setValidadeDocumento(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Validade seguro
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={validadeSeguro}
                onChange={(e) => setValidadeSeguro(e.target.value)}
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
            href="/veiculos"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
