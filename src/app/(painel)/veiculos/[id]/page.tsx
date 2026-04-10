"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";

const TIPOS_VEICULO = ["automovel", "van", "microonibus", "onibus"] as const;
const COMBUSTIVEIS = [
  "alcool",
  "gasolina_comum",
  "gasolina_aditivada",
  "diesel_comum",
  "diesel_s10",
] as const;

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

type VeiculoDb = {
  id: string;
  empresa_id: string;

  placa: string;
  prefixo: string | null;
  renavam: string | null;
  chassi: string | null;

  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  imagem_url: string | null;
  documento_veiculo_url: string | null;
  apolice_seguro_url: string | null;
  vistoria_url: string | null;
  galeria_urls: string[] | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;

  capacidade_passageiros: number | null;
  combustivel: string | null;
  arla32: boolean | null;
  km_atual: number | null;
  status: "ativo" | "manutencao" | "inativo";

  validade_documento: string | null;
  validade_seguro: string | null;

  observacoes: string | null;
  descricao_compartilhamento: string | null;

  financiado: boolean | null;
  parcelas_financiamento_restantes: number | null;
  valor_parcela_financiamento: number | null;
  dia_vencimento_financiamento: number | null;

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
  const [uploadWarning, setUploadWarning] = useState<string>("");
  const [canShowFinanciamento, setCanShowFinanciamento] = useState(false);

  const [veiculo, setVeiculo] = useState<VeiculoDb | null>(null);

  // Campos
  const [placa, setPlaca] = useState("");
  const [prefixo, setPrefixo] = useState("");
  const [status, setStatus] = useState<"ativo" | "manutencao" | "inativo">("ativo");

  const [tipo, setTipo] = useState<(typeof TIPOS_VEICULO)[number]>("van");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [documentoVeiculoUrl, setDocumentoVeiculoUrl] = useState<string | null>(null);
  const [apoliceSeguroUrl, setApoliceSeguroUrl] = useState<string | null>(null);
  const [vistoriaUrl, setVistoriaUrl] = useState<string | null>(null);
  const [galeriaUrls, setGaleriaUrls] = useState<string[]>([]);

  const [imagemDestaqueFile, setImagemDestaqueFile] = useState<File | null>(null);
  const [documentoVeiculoFile, setDocumentoVeiculoFile] = useState<File | null>(null);
  const [apoliceSeguroFile, setApoliceSeguroFile] = useState<File | null>(null);
  const [vistoriaFile, setVistoriaFile] = useState<File | null>(null);
  const [galeriaFiles, setGaleriaFiles] = useState<File[]>([]);
  const [imagemDestaquePreview, setImagemDestaquePreview] = useState<string | null>(null);
  const [galeriaPreviewUrls, setGaleriaPreviewUrls] = useState<string[]>([]);

  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [cor, setCor] = useState("");

  const [capacidade, setCapacidade] = useState("");
  const [combustivel, setCombustivel] = useState<(typeof COMBUSTIVEIS)[number]>("diesel_s10");
  const [usaArla32, setUsaArla32] = useState(false);
  const [kmAtual, setKmAtual] = useState("");

  const [renavam, setRenavam] = useState("");
  const [chassi, setChassi] = useState("");
  const [validadeDocumento, setValidadeDocumento] = useState("");
  const [validadeSeguro, setValidadeSeguro] = useState("");

  const [observacoes, setObservacoes] = useState("");
  const [descricaoCompartilhamento, setDescricaoCompartilhamento] = useState("");

  // Financiamento
  const [financiado, setFinanciado] = useState(false);
  const [parcelasRestantes, setParcelasRestantes] = useState("");
  const [valorParcelaFinanciamento, setValorParcelaFinanciamento] = useState("");
  const [diaVencimentoFinanciamento, setDiaVencimentoFinanciamento] = useState("");

  useEffect(() => {
    return () => {
      if (imagemDestaquePreview) {
        URL.revokeObjectURL(imagemDestaquePreview);
      }
    };
  }, [imagemDestaquePreview]);

  useEffect(() => {
    return () => {
      galeriaPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [galeriaPreviewUrls]);

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

  async function uploadArquivo(empresa: string, pasta: string, file: File) {
    const path = `${empresa}/veiculos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}/${pasta}/${sanitizeFileName(file.name)}`;

    const { error } = await supabase.storage
      .from("veiculos")
      .upload(path, file, { upsert: false });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("veiculos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function carregar() {
    if (!id) return;

    setLoading(true);
    setStatusMsg("Carregando veículo...");

    const { data, error } = await supabase
      .from("veiculos")
      .select(
        "id, empresa_id, placa, prefixo, renavam, chassi, tipo, marca, modelo, imagem_url, documento_veiculo_url, apolice_seguro_url, vistoria_url, galeria_urls, ano_fabricacao, ano_modelo, cor, capacidade_passageiros, combustivel, arla32, km_atual, status, validade_documento, validade_seguro, observacoes, descricao_compartilhamento, financiado, parcelas_financiamento_restantes, valor_parcela_financiamento, dia_vencimento_financiamento, created_at, updated_at"
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
    setPrefixo(v.prefixo ?? "");
    setStatus(v.status ?? "ativo");

    setTipo(TIPOS_VEICULO.includes((v.tipo ?? "") as (typeof TIPOS_VEICULO)[number]) ? (v.tipo as (typeof TIPOS_VEICULO)[number]) : "van");
    setMarca(v.marca ?? "");
    setModelo(v.modelo ?? "");
    setImagemUrl(v.imagem_url ?? null);
    setDocumentoVeiculoUrl(v.documento_veiculo_url ?? null);
    setApoliceSeguroUrl(v.apolice_seguro_url ?? null);
    setVistoriaUrl(v.vistoria_url ?? null);
    setGaleriaUrls(Array.isArray(v.galeria_urls) ? v.galeria_urls : []);
    setAnoFabricacao(v.ano_fabricacao ? String(v.ano_fabricacao) : "");
    setAnoModelo(v.ano_modelo ? String(v.ano_modelo) : "");
    setCor(v.cor ?? "");

    setCapacidade(
      typeof v.capacidade_passageiros === "number"
        ? String(v.capacidade_passageiros)
        : ""
    );
    setCombustivel(
      COMBUSTIVEIS.includes((v.combustivel ?? "") as (typeof COMBUSTIVEIS)[number])
        ? (v.combustivel as (typeof COMBUSTIVEIS)[number])
        : "diesel_s10"
    );
    setUsaArla32(!!v.arla32);
    setKmAtual(typeof v.km_atual === "number" ? String(v.km_atual) : "");

    setRenavam(v.renavam ?? "");
    setChassi(v.chassi ?? "");
    setValidadeDocumento(isoToInputDate(v.validade_documento));
    setValidadeSeguro(isoToInputDate(v.validade_seguro));

    setObservacoes(v.observacoes ?? "");
    setDescricaoCompartilhamento(v.descricao_compartilhamento ?? "");
    setFinanciado(!!v.financiado);
    setParcelasRestantes(
      typeof v.parcelas_financiamento_restantes === "number"
        ? String(v.parcelas_financiamento_restantes)
        : ""
    );
    setValorParcelaFinanciamento(
      typeof v.valor_parcela_financiamento === "number"
        ? String(v.valor_parcela_financiamento)
        : ""
    );
    setDiaVencimentoFinanciamento(
      typeof v.dia_vencimento_financiamento === "number"
        ? String(v.dia_vencimento_financiamento)
        : ""
    );

    setStatusMsg("");
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const tid = setTimeout(() => {
      void (async () => {
        const access = await loadEmpresaModuleAccess();
        setCanShowFinanciamento(
          access.canUseAllModules || access.allowedModules.includes("financeiro")
        );
      })();
    }, 0);

    return () => clearTimeout(tid);
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setUploadWarning("");

    const placaFinal = placa.trim().toUpperCase();

    if (placaFinal.length < 7) {
      alert("Informe a placa (mínimo 7 caracteres).");
      return;
    }

    if (canShowFinanciamento && financiado) {
      const qtd = Number(parcelasRestantes);
      const valorParcela = toNumOrNull(valorParcelaFinanciamento);
      const dia = Number(diaVencimentoFinanciamento);

      if (!Number.isInteger(qtd) || qtd <= 0) {
        alert("Informe a quantidade de parcelas restantes (maior que 0).");
        return;
      }
      if (!valorParcela || valorParcela <= 0) {
        alert("Informe o valor da parcela do financiamento.");
        return;
      }
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        alert("Informe um dia de vencimento válido (1 a 31).");
        return;
      }
    }

    setSaving(true);
    setStatusMsg("Salvando...");

    let imagemUrlFinal = imagemUrl;
    let documentoVeiculoUrlFinal = documentoVeiculoUrl;
    let apoliceSeguroUrlFinal = apoliceSeguroUrl;
    let vistoriaUrlFinal = vistoriaUrl;
    let galeriaUrlsFinal = [...galeriaUrls];

    try {
      if (imagemDestaqueFile && veiculo?.empresa_id) {
        imagemUrlFinal = await uploadArquivo(veiculo.empresa_id, "imagem-destaque", imagemDestaqueFile);
      }

      if (documentoVeiculoFile && veiculo?.empresa_id) {
        documentoVeiculoUrlFinal = await uploadArquivo(veiculo.empresa_id, "documento-veiculo", documentoVeiculoFile);
      }

      if (apoliceSeguroFile && veiculo?.empresa_id) {
        apoliceSeguroUrlFinal = await uploadArquivo(veiculo.empresa_id, "apolice-seguro", apoliceSeguroFile);
      }

      if (vistoriaFile && veiculo?.empresa_id) {
        vistoriaUrlFinal = await uploadArquivo(veiculo.empresa_id, "vistoria", vistoriaFile);
      }

      if (galeriaFiles.length > 0 && veiculo?.empresa_id) {
        galeriaUrlsFinal = await Promise.all(
          galeriaFiles.map((file) => uploadArquivo(veiculo.empresa_id, "galeria", file))
        );
      }
    } catch (uploadError) {
      if (isBucketNotFoundError(uploadError)) {
        setUploadWarning(
          "Uploads ignorados porque o bucket 'veiculos' ainda não existe no Supabase. As alterações serão salvas sem anexos."
        );
      } else {
        setSaving(false);
        setStatusMsg(
          `❌ Erro no upload: ${uploadError instanceof Error ? uploadError.message : "erro desconhecido"}`
        );
        return;
      }
    }

    const payload = {
      placa: placaFinal,
      prefixo: prefixo.trim() || null,
      status,

      tipo: tipo.trim() || null,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      imagem_url: imagemUrlFinal,
      documento_veiculo_url: documentoVeiculoUrlFinal,
      apolice_seguro_url: apoliceSeguroUrlFinal,
      vistoria_url: vistoriaUrlFinal,
      galeria_urls: galeriaUrlsFinal,
      ano_fabricacao: toIntOrNull(anoFabricacao),
      ano_modelo: toIntOrNull(anoModelo),
      cor: cor.trim() || null,

      capacidade_passageiros: toIntOrNull(capacidade) ?? 0,
      combustivel,
      arla32: usaArla32,
      km_atual: toNumOrNull(kmAtual) ?? 0,

      renavam: renavam.trim() || null,
      chassi: chassi.trim() || null,
      validade_documento: inputDateToIso(validadeDocumento),
      validade_seguro: inputDateToIso(validadeSeguro),

      observacoes: observacoes.trim() || null,
      descricao_compartilhamento: descricaoCompartilhamento.trim() || null,
      financiado: canShowFinanciamento ? financiado : false,
      parcelas_financiamento_restantes:
        canShowFinanciamento && financiado ? toIntOrNull(parcelasRestantes) : null,
      valor_parcela_financiamento:
        canShowFinanciamento && financiado ? toNumOrNull(valorParcelaFinanciamento) : null,
      dia_vencimento_financiamento:
        canShowFinanciamento && financiado ? toIntOrNull(diaVencimentoFinanciamento) : null,
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
            <div>
              <label className="block text-sm font-medium mb-1">Prefixo</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
                placeholder="Ex.: VAN-01, EXEC-7"
              />
            </div>

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
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as (typeof TIPOS_VEICULO)[number])}
              >
                {TIPOS_VEICULO.map((op) => (
                  <option key={op} value={op}>
                    {op === "automovel"
                      ? "Automóvel"
                      : op === "microonibus"
                      ? "Micro-ônibus"
                      : op === "onibus"
                      ? "Ônibus"
                      : "Van"}
                  </option>
                ))}
              </select>
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

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">Imagem de destaque</label>
              <input
                type="file"
                accept="image/*"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImagemDestaqueFile(file);
                  setImagemDestaquePreview((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return file ? URL.createObjectURL(file) : null;
                  });
                }}
              />
              {imagemUrl ? (
                <a className="text-xs text-blue-700 mt-2 inline-block" href={imagemUrl} target="_blank" rel="noreferrer">
                  Ver imagem atual
                </a>
              ) : null}
              <div className="mt-3 overflow-x-auto">
                <div className="flex gap-3">
                  {imagemUrl ? (
                    <div className="shrink-0 w-36">
                      <div className="text-[11px] text-slate-500 mb-1">Destaque atual</div>
                      <img
                        src={imagemUrl}
                        alt="Imagem de destaque atual"
                        className="h-24 w-36 rounded-md border border-slate-300 object-cover"
                      />
                    </div>
                  ) : null}
                  {imagemDestaquePreview ? (
                    <div className="shrink-0 w-36">
                      <div className="text-[11px] text-slate-500 mb-1">Novo destaque</div>
                      <img
                        src={imagemDestaquePreview}
                        alt="Prévia da nova imagem de destaque"
                        className="h-24 w-36 rounded-md border border-blue-300 object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
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
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={combustivel}
                onChange={(e) => setCombustivel(e.target.value as (typeof COMBUSTIVEIS)[number])}
              >
                <option value="alcool">Álcool</option>
                <option value="gasolina_comum">Gasolina comum</option>
                <option value="gasolina_aditivada">Gasolina aditivada</option>
                <option value="diesel_comum">Diesel comum</option>
                <option value="diesel_s10">Diesel S10</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Usa ARLA 32?</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={usaArla32 ? "sim" : "nao"}
                onChange={(e) => setUsaArla32(e.target.value === "sim")}
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
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

            <div>
              <label className="block text-sm font-medium mb-1">Documento do veículo</label>
              <input
                type="file"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setDocumentoVeiculoFile(e.target.files?.[0] ?? null)}
              />
              {documentoVeiculoUrl ? (
                <a className="text-xs text-blue-700 mt-2 inline-block" href={documentoVeiculoUrl} target="_blank" rel="noreferrer">
                  Ver documento atual
                </a>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Apólice do seguro</label>
              <input
                type="file"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setApoliceSeguroFile(e.target.files?.[0] ?? null)}
              />
              {apoliceSeguroUrl ? (
                <a className="text-xs text-blue-700 mt-2 inline-block" href={apoliceSeguroUrl} target="_blank" rel="noreferrer">
                  Ver apólice atual
                </a>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Vistoria</label>
              <input
                type="file"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setVistoriaFile(e.target.files?.[0] ?? null)}
              />
              {vistoriaUrl ? (
                <a className="text-xs text-blue-700 mt-2 inline-block" href={vistoriaUrl} target="_blank" rel="noreferrer">
                  Ver vistoria atual
                </a>
              ) : null}
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">Galeria do veículo (múltiplas imagens)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setGaleriaFiles(files);
                  setGaleriaPreviewUrls((prev) => {
                    prev.forEach((url) => URL.revokeObjectURL(url));
                    return files.map((file) => URL.createObjectURL(file));
                  });
                }}
              />
              {galeriaUrls.length > 0 ? (
                <p className="text-xs text-slate-600 mt-2">{galeriaUrls.length} imagem(ns) já cadastrada(s).</p>
              ) : null}
              {galeriaUrls.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <div className="flex gap-3">
                    {galeriaUrls.map((url, idx) => (
                      <div key={`salva-${url}-${idx}`} className="shrink-0 w-36">
                        <div className="text-[11px] text-slate-500 mb-1">Salva {idx + 1}</div>
                        <img
                          src={url}
                          alt={`Imagem salva ${idx + 1}`}
                          className="h-24 w-36 rounded-md border border-slate-300 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {galeriaPreviewUrls.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <div className="flex gap-3">
                    {galeriaPreviewUrls.map((url, idx) => (
                      <div key={`nova-${url}-${idx}`} className="shrink-0 w-36">
                        <div className="text-[11px] text-slate-500 mb-1">Novo upload {idx + 1}</div>
                        <img
                          src={url}
                          alt={`Nova imagem ${idx + 1}`}
                          className="h-24 w-36 rounded-md border border-blue-300 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Observações */}
        {canShowFinanciamento ? (
          <div className="border-t pt-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Financiamento</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium mb-1">Veículo financiado?</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={financiado ? "sim" : "nao"}
                  onChange={(e) => setFinanciado(e.target.value === "sim")}
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              {financiado ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parcelas restantes</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border border-slate-300 rounded-md px-3 py-2"
                      value={parcelasRestantes}
                      onChange={(e) => setParcelasRestantes(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor da parcela (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="w-full border border-slate-300 rounded-md px-3 py-2"
                      value={valorParcelaFinanciamento}
                      onChange={(e) => setValorParcelaFinanciamento(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dia do vencimento</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className="w-full border border-slate-300 rounded-md px-3 py-2"
                      value={diaVencimentoFinanciamento}
                      onChange={(e) => setDiaVencimentoFinanciamento(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Descrição para compartilhamento com cliente
          </h2>

          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]"
            value={descricaoCompartilhamento}
            onChange={(e) => setDescricaoCompartilhamento(e.target.value)}
            placeholder="Ex.: Veículo equipado com ar-condicionado, banheiro, geladeira, poltronas reclináveis, Wi-Fi..."
          />
          <p className="text-xs text-slate-500 mt-2">
            Este texto será exibido no link público de compartilhamento do veículo.
          </p>
        </div>

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