"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type VeiculoDb = {
  id: string;

  placa: string;
  renavam: string | null;
  chassi: string | null;

  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;

  capacidade_passageiros: number | null;
  combustivel: string | null;
  km_atual: number | null;
  status: "ativo" | "manutencao" | "inativo";

  validade_documento: string | null;
  validade_seguro: string | null;

  observacoes: string | null;

  created_at: string;
  updated_at: string;
};

function isoToInputDate(iso: string | null) {
  if (!iso) return "";
  // pega YYYY-MM-DD
  return iso.slice(0, 10);
}

function inputDateToIso(v: string) {
  if (!v) return null;
  return new Date(v + "T00:00:00.000Z").toISOString();
}

export default function EditarVeiculoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const [veiculo, setVeiculo] = useState<VeiculoDb | null>(null);

  // Campos
  const [placa, setPlaca] = useState("");
  const [status, setStatus] = useState<"ativo" | "manutencao" | "inativo">("ativo");

  const [tipo, setTipo] = useState("van");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [cor, setCor] = useState("");

  const [capacidade, setCapacidade] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [kmAtual, setKmAtual] = useState("");

  const [renavam, setRenavam] = useState("");
  const [chassi, setChassi] = useState("");
  const [validadeDocumento, setValidadeDocumento] = useState("");
  const [validadeSeguro, setValidadeSeguro] = useState("");

  const [observacoes, setObservacoes] = useState("");

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

  async function carregar() {
    if (!id) return;

    setLoading(true);
    setStatusMsg("Carregando veículo...");

    const { data, error } = await supabase
      .from("veiculos")
      .select(
        "id, placa, renavam, chassi, tipo, marca, modelo, ano_fabricacao, ano_modelo, cor, capacidade_passageiros, combustivel, km_atual, status, validade_documento, validade_seguro, observacoes, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      setStatusMsg("❌ Erro ao carregar: " + error.message);
      setVeiculo(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setStatusMsg("⚠️ Veículo não encontrado (ou você não tem acesso).");
      setVeiculo(null);
      setLoading(false);
      return;
    }

    const v = data as VeiculoDb;
    setVeiculo(v);

    setPlaca(v.placa ?? "");
    setStatus(v.status ?? "ativo");

    setTipo(v.tipo ?? "van");
    setMarca(v.marca ?? "");
    setModelo(v.modelo ?? "");
    setAnoFabricacao(v.ano_fabricacao ? String(v.ano_fabricacao) : "");
    setAnoModelo(v.ano_modelo ? String(v.ano_modelo) : "");
    setCor(v.cor ?? "");

    setCapacidade(
      typeof v.capacidade_passageiros === "number"
        ? String(v.capacidade_passageiros)
        : ""
    );
    setCombustivel(v.combustivel ?? "");
    setKmAtual(typeof v.km_atual === "number" ? String(v.km_atual) : "");

    setRenavam(v.renavam ?? "");
    setChassi(v.chassi ?? "");
    setValidadeDocumento(isoToInputDate(v.validade_documento));
    setValidadeSeguro(isoToInputDate(v.validade_seguro));

    setObservacoes(v.observacoes ?? "");

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

    const placaFinal = placa.trim().toUpperCase();

    if (placaFinal.length < 7) {
      alert("Informe a placa (mínimo 7 caracteres).");
      return;
    }

    setSaving(true);
    setStatusMsg("Salvando...");

    const payload = {
      placa: placaFinal,
      status,

      tipo: tipo.trim() || null,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      ano_fabricacao: toIntOrNull(anoFabricacao),
      ano_modelo: toIntOrNull(anoModelo),
      cor: cor.trim() || null,

      capacidade_passageiros: toIntOrNull(capacidade) ?? 0,
      combustivel: combustivel.trim() || null,
      km_atual: toNumOrNull(kmAtual) ?? 0,

      renavam: renavam.trim() || null,
      chassi: chassi.trim() || null,
      validade_documento: inputDateToIso(validadeDocumento),
      validade_seguro: inputDateToIso(validadeSeguro),

      observacoes: observacoes.trim() || null,
    };

    const { error } = await supabase.from("veiculos").update(payload).eq("id", id);

    setSaving(false);

    if (error) {
      setStatusMsg("❌ Erro ao salvar: " + error.message);
      return;
    }

    // ✅ Padrão MasterFleetBR: salva e volta para listagem
    router.push("/veiculos");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">
        Carregando...
      </div>
    );
  }

  if (!veiculo) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold">Veículo</h1>
          <p className="text-slate-600 text-sm">{statusMsg || "Não encontrado."}</p>
        </div>

        <Link
          href="/veiculos"
          className="inline-block border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
        >
          Voltar para veículos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Veículo"
        description={`ID: ${veiculo.id}`}
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
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Modelo</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cor</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
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
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

          <Link
            href="/veiculos"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>

        <div className="text-xs text-slate-500">
          Criado em: {new Date(veiculo.created_at).toLocaleString("pt-BR")} •
          Atualizado em: {new Date(veiculo.updated_at).toLocaleString("pt-BR")}
        </div>
      </form>
    </div>
  );
}