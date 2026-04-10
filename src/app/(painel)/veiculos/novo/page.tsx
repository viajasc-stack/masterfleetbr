"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SuccessRedirectModal } from "@/components/ui/SuccessRedirectModal";
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

export default function NovoVeiculoPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [uploadWarning, setUploadWarning] = useState<string>("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [canShowFinanciamento, setCanShowFinanciamento] = useState(false);

  const [placa, setPlaca] = useState("");
  const [prefixo, setPrefixo] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS_VEICULO)[number]>("van");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [cor, setCor] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [combustivel, setCombustivel] = useState<(typeof COMBUSTIVEIS)[number]>("diesel_s10");
  const [usaArla32, setUsaArla32] = useState(false);
  const [kmAtual, setKmAtual] = useState("");
  const [status, setStatus] = useState<"ativo" | "manutencao" | "inativo">("ativo");

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

  const [imagemDestaqueFile, setImagemDestaqueFile] = useState<File | null>(null);
  const [documentoVeiculoFile, setDocumentoVeiculoFile] = useState<File | null>(null);
  const [apoliceSeguroFile, setApoliceSeguroFile] = useState<File | null>(null);
  const [vistoriaFile, setVistoriaFile] = useState<File | null>(null);
  const [galeriaFiles, setGaleriaFiles] = useState<File[]>([]);
  const [imagemDestaquePreview, setImagemDestaquePreview] = useState<string | null>(null);
  const [galeriaPreviewUrls, setGaleriaPreviewUrls] = useState<string[]>([]);

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

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        const access = await loadEmpresaModuleAccess();
        setCanShowFinanciamento(
          access.canUseAllModules || access.allowedModules.includes("financeiro")
        );
      })();
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

  function addMonthsKeepingDay(baseDate: Date, monthsToAdd: number, desiredDay: number) {
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const target = new Date(y, m + monthsToAdd, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(desiredDay, lastDay);
    return new Date(target.getFullYear(), target.getMonth(), day);
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

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setUploadWarning("");

    if (!empresaId) {
      alert("Sem empresa vinculada. Vá em Configurações.");
      return;
    }

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

    setLoading(true);

    let imagemUrl: string | null = null;
    let documentoVeiculoUrl: string | null = null;
    let apoliceSeguroUrl: string | null = null;
    let vistoriaUrl: string | null = null;
    let galeriaUrls: string[] = [];

    try {
      if (imagemDestaqueFile) {
        imagemUrl = await uploadArquivo(empresaId, "imagem-destaque", imagemDestaqueFile);
      }

      if (documentoVeiculoFile) {
        documentoVeiculoUrl = await uploadArquivo(empresaId, "documento-veiculo", documentoVeiculoFile);
      }

      if (apoliceSeguroFile) {
        apoliceSeguroUrl = await uploadArquivo(empresaId, "apolice-seguro", apoliceSeguroFile);
      }

      if (vistoriaFile) {
        vistoriaUrl = await uploadArquivo(empresaId, "vistoria", vistoriaFile);
      }

      if (galeriaFiles.length > 0) {
        galeriaUrls = await Promise.all(
          galeriaFiles.map((file) => uploadArquivo(empresaId, "galeria", file))
        );
      }
    } catch (uploadError) {
      if (isBucketNotFoundError(uploadError)) {
        setUploadWarning(
          "Uploads ignorados porque o bucket 'veiculos' ainda não existe no Supabase. O veículo será salvo sem anexos."
        );
      } else {
        setLoading(false);
        alert(
          `Erro no upload de arquivos: ${
            uploadError instanceof Error ? uploadError.message : "erro desconhecido"
          }`
        );
        return;
      }
    }

    const payload = {
      empresa_id: empresaId,

      placa: placaFinal,
      prefixo: prefixo.trim() || null,
      tipo: tipo.trim() || null,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      imagem_url: imagemUrl,
      ano_fabricacao: toIntOrNull(anoFabricacao),
      ano_modelo: toIntOrNull(anoModelo),
      cor: cor.trim() || null,

      capacidade_passageiros: toIntOrNull(capacidade) ?? 0,
      combustivel,
      arla32: usaArla32,
      km_atual: toNumOrNull(kmAtual) ?? 0,
      status,

      renavam: renavam.trim() || null,
      chassi: chassi.trim() || null,
      validade_documento: toDateOrNull(validadeDocumento),
      validade_seguro: toDateOrNull(validadeSeguro),
      documento_veiculo_url: documentoVeiculoUrl,
      apolice_seguro_url: apoliceSeguroUrl,
      vistoria_url: vistoriaUrl,
      galeria_urls: galeriaUrls,

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

    if (canShowFinanciamento && financiado) {
      const qtd = Number(parcelasRestantes);
      const valorParcela = toNumOrNull(valorParcelaFinanciamento) ?? 0;
      const dia = Number(diaVencimentoFinanciamento);
      const hoje = new Date();
      const dataPrimeiroVencimento = addMonthsKeepingDay(
        new Date(hoje.getFullYear(), hoje.getMonth(), 1),
        hoje.getDate() > dia ? 1 : 0,
        dia
      );

      const grupoId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `fin-${data.id}-${Date.now()}`;

      const linhasFinanceiro = Array.from({ length: qtd }, (_, i) => {
        const venc = addMonthsKeepingDay(dataPrimeiroVencimento, i, dia);
        return {
          descricao: `Financiamento veículo ${placaFinal} (${i + 1}/${qtd})`,
          tipo: "pagar" as const,
          valor: valorParcela,
          data_vencimento: venc.toISOString().slice(0, 10),
          categoria: "Financiamento Veículo",
          observacoes: [
            `Gerado automaticamente no cadastro do veículo ${placaFinal}.`,
            `Parcela ${i + 1} de ${qtd}.`,
          ].join(" "),
          status: "pendente",
          carne_grupo_id: grupoId,
          parcela_numero: i + 1,
          parcela_total: qtd,
          valor_total_carne: Number((valorParcela * qtd).toFixed(2)),
        };
      });

      const { error: errorFinanceiro } = await supabase
        .from("contas_financeiras")
        .insert(linhasFinanceiro);

      if (errorFinanceiro) {
        alert(
          `Veículo salvo, mas houve erro ao gerar contas do financiamento: ${errorFinanceiro.message}`
        );
      }
    }

    setSuccessModalOpen(true);
  }

  function confirmarSucesso() {
    router.push("/veiculos");
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
                placeholder="ABC1D23"
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
              {imagemDestaquePreview ? (
                <div className="mt-3 overflow-x-auto">
                  <div className="flex gap-3">
                    <div className="shrink-0 w-36">
                      <div className="text-[11px] text-slate-500 mb-1">Destaque</div>
                      <img
                        src={imagemDestaquePreview}
                        alt="Prévia da imagem de destaque"
                        className="h-24 w-36 rounded-md border border-slate-300 object-cover"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
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
                {COMBUSTIVEIS.map((comb) => (
                  <option key={comb} value={comb}>
                    {comb === "alcool"
                      ? "Álcool"
                      : comb === "gasolina_comum"
                      ? "Gasolina comum"
                      : comb === "gasolina_aditivada"
                      ? "Gasolina aditivada"
                      : comb === "diesel_comum"
                      ? "Diesel comum"
                      : "Diesel S10"}
                  </option>
                ))}
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
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Apólice do seguro</label>
              <input
                type="file"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setApoliceSeguroFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Vistoria</label>
              <input
                type="file"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                onChange={(e) => setVistoriaFile(e.target.files?.[0] ?? null)}
              />
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
              {galeriaFiles.length > 0 ? (
                <p className="text-xs text-slate-600 mt-2">
                  {galeriaFiles.length} arquivo(s) selecionado(s).
                </p>
              ) : null}
              {galeriaPreviewUrls.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <div className="flex gap-3">
                    {galeriaPreviewUrls.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="shrink-0 w-36">
                        <div className="text-[11px] text-slate-500 mb-1">Upload {idx + 1}</div>
                        <img
                          src={url}
                          alt={`Prévia ${idx + 1}`}
                          className="h-24 w-36 rounded-md border border-slate-300 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {canShowFinanciamento ? (
          <div className="border-t pt-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">
              Financiamento
            </h2>

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

              {financiado && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parcelas restantes</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border border-slate-300 rounded-md px-3 py-2"
                      value={parcelasRestantes}
                      onChange={(e) => setParcelasRestantes(e.target.value)}
                      placeholder="Ex: 24"
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
                      placeholder="Ex: 1850.50"
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
                      placeholder="Ex: 10"
                    />
                  </div>

                  <div className="md:col-span-3 text-xs text-slate-500">
                    Ao salvar o veículo, as parcelas serão lançadas automaticamente no financeiro em contas a pagar.
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Observações */}
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

      <SuccessRedirectModal
        open={successModalOpen}
        title="Veículo adicionado com sucesso"
        description="Cadastro concluído."
        onConfirm={confirmarSucesso}
      />
    </div>
  );
}
