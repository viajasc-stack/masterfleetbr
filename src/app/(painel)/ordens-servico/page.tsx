"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { ActionIconButton, ActionIconLink } from "@/components/ui/ActionIcon";
import { logError, logInfo } from "@/lib/observability";

type OsRow = {
  id: string;
  numero: number | null;
  tipo: string;
  status: string;

  inicio_em: string | null;
  fim_em: string | null;

  origem: string | null;
  destino: string | null;
  roteiro: string | null;
  observacoes: string | null;
  local_saida: string | null;
  local_chegada: string | null;

  modo_cobranca: string | null;
  valor_total: number | null;
  status_pagamento: string | null;

  km_inicial: number | null;
  km_final: number | null;
  assinatura_inicio_em: string | null;
  assinatura_inicio_geo: unknown;
  assinatura_inicio_endereco: string | null;
  assinatura_inicio_foto_url: string | null;
  assinatura_fim_em: string | null;
  assinatura_fim_geo: unknown;
  assinatura_fim_endereco: string | null;
  assinatura_fim_foto_url: string | null;

  cliente_id: string | null;
  contrato_id: string | null;
  veiculo_id: string | null;
  motorista_id: string | null;

  created_at: string;

  clientes?: { nome: string } | null;
  contratos?: { nome: string } | null;
  veiculos?: { placa: string } | null;
  motoristas?: { nome: string } | null;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractLatLng(geo: unknown) {
  if (!geo || typeof geo !== "object") return null;
  const obj = geo as Record<string, unknown>;
  const lat =
    toNumber(obj.lat) ??
    toNumber(obj.latitude) ??
    toNumber(obj.coords && typeof obj.coords === "object" ? (obj.coords as Record<string, unknown>).latitude : null);
  const lng =
    toNumber(obj.lng) ??
    toNumber(obj.longitude) ??
    toNumber(obj.lon) ??
    toNumber(obj.coords && typeof obj.coords === "object" ? (obj.coords as Record<string, unknown>).longitude : null);

  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function statusTemVisualizacaoExecucao(status: string) {
  const s = (status || "").toLowerCase();
  return s === "em_execucao" || s === "em_andamento" || s === "concluida";
}

type VeiculoQuickOpt = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  status?: string | null;
};

type MotoristaQuickOpt = {
  id: string;
  nome: string;
  ativo?: boolean | null;
};

type FiltroStatus =
  | "pendente"
  | "em_execucao"
  | "concluida"
  | "cancelada"
  | "todas";

function formatNumeroOS(numero: number | null, createdAt: string) {
  if (!numero) return "Sem número";

  const ano = new Date(createdAt).getFullYear();
  const seq = String(numero).padStart(4, "0");

  return `OS-${ano}-${seq}`;
}

function ehMesmoDia(dataIso: string | null, ref: Date) {
  if (!dataIso) return false;
  const d = new Date(dataIso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function ehStatusPausadaOuEmAndamento(status: string) {
  const s = (status || "").toLowerCase();
  return (
    s === "em_execucao" ||
    s === "em_andamento" ||
    s === "pausada" ||
    s === "pausado"
  );
}

function getHorarioOrdenacaoOs(os: OsRow) {
  const base = os.inicio_em ?? os.assinatura_inicio_em ?? os.created_at;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return Number.MAX_SAFE_INTEGER;
  return d.getTime();
}

export default function OrdensServicoPage() {
  const searchParams = useSearchParams();
  const statusParam = String(searchParams?.get("status") || "").toLowerCase();
  const filtroInicial: FiltroStatus =
    statusParam === "pendente" ||
    statusParam === "em_execucao" ||
    statusParam === "concluida" ||
    statusParam === "cancelada"
      ? (statusParam as FiltroStatus)
      : "todas";
  const [osList, setOsList] = useState<OsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<OsRow | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<OsRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [contratosMap, setContratosMap] = useState<Record<string, string>>({});
  const [veiculosOpts, setVeiculosOpts] = useState<VeiculoQuickOpt[]>([]);
  const [motoristasOpts, setMotoristasOpts] = useState<MotoristaQuickOpt[]>([]);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickVeiculoId, setQuickVeiculoId] = useState("");
  const [quickMotoristaId, setQuickMotoristaId] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [execucaoTarget, setExecucaoTarget] = useState<OsRow | null>(null);
  const [execucaoEditMode, setExecucaoEditMode] = useState(false);
  const [execucaoSaving, setExecucaoSaving] = useState(false);
  const [execucaoForm, setExecucaoForm] = useState({
    status: "",
    km_inicial: "",
    km_final: "",
    assinatura_inicio_em: "",
    assinatura_fim_em: "",
    inicio_em: "",
    fim_em: "",
    local_saida: "",
    local_chegada: "",
    assinatura_inicio_endereco: "",
    assinatura_fim_endereco: "",
    roteiro: "",
    observacoes: "",
    modo_cobranca: "",
    valor_total: "",
    status_pagamento: "",
  });
  const realtimeReloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [diaReferencia, setDiaReferencia] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [busca, setBusca] = useState(() => searchParams?.get("q") || "");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>(filtroInicial);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [canShowFinanceiro, setCanShowFinanceiro] = useState(false);

  async function carregarOS() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ordens_servico")
      .select(
        `
        id, numero, tipo, status, inicio_em, fim_em, origem, destino, roteiro, observacoes, local_saida, local_chegada,
        modo_cobranca, valor_total, status_pagamento, km_inicial, km_final,
        assinatura_inicio_em, assinatura_inicio_geo, assinatura_inicio_endereco, assinatura_inicio_foto_url,
        assinatura_fim_em, assinatura_fim_geo, assinatura_fim_endereco, assinatura_fim_foto_url,
        cliente_id, contrato_id, veiculo_id, motorista_id, created_at, updated_at,
        clientes:cliente_id ( nome ),
        veiculos:veiculo_id ( placa ),
        motoristas:motorista_id ( nome )
      `
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      const lista = data as unknown as OsRow[];
      setOsList(lista);
      setSelectedIds((prev) => prev.filter((id) => lista.some((o) => o.id === id)));

      const contratoIds = Array.from(
        new Set(
          lista
            .filter((o) => o.tipo === "recorrente" && !!o.contrato_id)
            .map((o) => o.contrato_id as string)
        )
      );

      if (contratoIds.length > 0) {
        const { data: contratosData, error: contratosError } = await supabase
          .from("contratos")
          .select("id, nome")
          .in("id", contratoIds);

        if (!contratosError && contratosData) {
          const mapa: Record<string, string> = {};
          (contratosData as Array<{ id: string; nome: string | null }>).forEach((c) => {
            mapa[c.id] = c.nome ?? "Sem nome";
          });
          setContratosMap(mapa);
        } else {
          setContratosMap({});
        }
      } else {
        setContratosMap({});
      }
    } else {
      logError("operacao.ordens_servico", "Falha ao carregar lista de OS", error);
      setOsList([]);
      setContratosMap({});
    }

    const [veiculosResp, motoristasResp] = await Promise.all([
      supabase
        .from("veiculos")
        .select("id, placa, marca, modelo, status")
        .order("placa"),
      supabase
        .from("motoristas")
        .select("id, nome, ativo")
        .order("nome"),
    ]);

    if (!veiculosResp.error) {
      const veiculos = ((veiculosResp.data ?? []) as VeiculoQuickOpt[]).filter(
        (v) => (v.status || "").toLowerCase() !== "inativo"
      );
      setVeiculosOpts(veiculos);
    }

    if (!motoristasResp.error) {
      const motoristas = ((motoristasResp.data ?? []) as MotoristaQuickOpt[]).filter(
        (m) => m.ativo !== false
      );
      setMotoristasOpts(motoristas);
    }

    setLoading(false);
  }

  function iniciarEdicaoRapida(os: OsRow) {
    setQuickEditId(os.id);
    setQuickVeiculoId(os.veiculo_id ?? "");
    setQuickMotoristaId(os.motorista_id ?? "");
  }

  function cancelarEdicaoRapida() {
    if (quickSaving) return;
    setQuickEditId(null);
    setQuickVeiculoId("");
    setQuickMotoristaId("");
  }

  async function salvarEdicaoRapida() {
    if (!quickEditId) return;

    setQuickSaving(true);
    setErro("");
    setOkMsg("");

    const payload = {
      veiculo_id: quickVeiculoId || null,
      motorista_id: quickMotoristaId || null,
    };

    const { error } = await supabase
      .from("ordens_servico")
      .update(payload)
      .eq("id", quickEditId);

    setQuickSaving(false);

    if (error) {
      logError("operacao.ordens_servico", "Falha na edição rápida de veículo/motorista", error, {
        os_id: quickEditId,
      });
      setErro(`Não foi possível atualizar veículo/motorista: ${error.message}`);
      return;
    }

    const veiculo = veiculosOpts.find((v) => v.id === quickVeiculoId);
    const motorista = motoristasOpts.find((m) => m.id === quickMotoristaId);

    setOsList((prev) =>
      prev.map((o) =>
        o.id === quickEditId
          ? {
              ...o,
              veiculo_id: quickVeiculoId || null,
              motorista_id: quickMotoristaId || null,
              veiculos: veiculo ? { placa: veiculo.placa } : null,
              motoristas: motorista ? { nome: motorista.nome } : null,
            }
          : o
      )
    );

    logInfo("operacao.ordens_servico", "Edição rápida de OS concluída", {
      os_id: quickEditId,
      veiculo_id: quickVeiculoId || null,
      motorista_id: quickMotoristaId || null,
    });

    setOkMsg("OS atualizada com sucesso (veículo e/ou motorista).");
    setQuickEditId(null);
    setQuickVeiculoId("");
    setQuickMotoristaId("");
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarOS(); }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("ordens-servico-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordens_servico" },
        () => {
          if (realtimeReloadTimeoutRef.current) {
            clearTimeout(realtimeReloadTimeoutRef.current);
          }

          realtimeReloadTimeoutRef.current = setTimeout(() => {
            void carregarOS();
          }, 250);
        }
      )
      .subscribe();

    return () => {
      if (realtimeReloadTimeoutRef.current) {
        clearTimeout(realtimeReloadTimeoutRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const access = await loadEmpresaModuleAccess();
        setCanShowFinanceiro(
          access.canUseAllModules || access.allowedModules.includes("financeiro")
        );
      } catch {
        setCanShowFinanceiro(false);
      }
    })();
  }, []);

  const q = busca.trim().toLowerCase();

  const periodoInicioDate = useMemo(() => {
    if (!periodoInicio) return null;
    const d = new Date(`${periodoInicio}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [periodoInicio]);

  const periodoFimDate = useMemo(() => {
    if (!periodoFim) return null;
    const d = new Date(`${periodoFim}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [periodoFim]);

  const usandoFiltroPeriodo = Boolean(periodoInicioDate || periodoFimDate);

  const filtradas = useMemo(
    () =>
      osList
        .filter((o) => {
          if (!usandoFiltroPeriodo) {
            return ehMesmoDia(o.inicio_em, diaReferencia) || ehStatusPausadaOuEmAndamento(o.status);
          }

          if (!o.inicio_em) return false;
          const inicio = new Date(o.inicio_em);
          if (Number.isNaN(inicio.getTime())) return false;

          if (periodoInicioDate && inicio < periodoInicioDate) return false;
          if (periodoFimDate && inicio > periodoFimDate) return false;

          return true;
        })
        .filter((o) => {
          if (filtroStatus === "todas") return true;
          return (o.status || "").toLowerCase() === filtroStatus;
        })
        .filter((o) => {
          if (!q) return true;

          const alvo = [
            o.numero ? String(o.numero) : "",
            o.tipo ?? "",
            o.status ?? "",
            o.origem ?? "",
            o.destino ?? "",
            o.clientes?.nome ?? "",
            o.contrato_id ? contratosMap[o.contrato_id] ?? "" : "",
            o.veiculos?.placa ?? "",
            o.motoristas?.nome ?? "",
            o.status_pagamento ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return alvo.includes(q);
        })
        .sort((a, b) => {
          const horarioA = getHorarioOrdenacaoOs(a);
          const horarioB = getHorarioOrdenacaoOs(b);

          if (horarioA !== horarioB) return horarioA - horarioB;

          const numeroA = a.numero ?? Number.MAX_SAFE_INTEGER;
          const numeroB = b.numero ?? Number.MAX_SAFE_INTEGER;
          if (numeroA !== numeroB) return numeroA - numeroB;

          return a.created_at.localeCompare(b.created_at);
        }),
    [
      osList,
      diaReferencia,
      filtroStatus,
      q,
      usandoFiltroPeriodo,
      periodoInicioDate,
      periodoFimDate,
      contratosMap,
    ]
  );

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  const tituloDia =
    diaReferencia.getTime() === hoje.getTime()
      ? "Hoje"
      : diaReferencia.getTime() === amanha.getTime()
        ? "Amanhã"
        : diaReferencia.getTime() === ontem.getTime()
          ? "Ontem"
          : diaReferencia.toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });

  const allFilteredSelected =
    filtradas.length > 0 && filtradas.every((o) => selectedIds.includes(o.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...filtradas.map((o) => o.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !filtradas.some((o) => o.id === id)));
  }

  function somarDias(base: Date, dias: number) {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function badgeStatus(status: string) {
    const s = (status || "").toLowerCase();
    if (s === "pendente") return "border-amber-200 text-amber-800 bg-amber-50";
    if (s === "em_execucao")
      return "border-indigo-200 text-indigo-800 bg-indigo-50";
    if (s === "concluida") return "border-green-200 text-green-700 bg-green-50";
    return "border-red-200 text-red-700 bg-red-50";
  }

  function labelStatus(status: string) {
    const s = (status || "").toLowerCase();
    if (s === "pendente") return "Pendente";
    if (s === "em_execucao") return "Em execução";
    if (s === "concluida") return "Concluída";
    if (s === "cancelada") return "Cancelada";
    return status || "—";
  }

  function labelPagamento(status: string | null) {
    const s = (status || "").toLowerCase();
    if (s === "pago") return "Pago";
    if (s === "parcial") return "Parcial";
    if (s === "cancelado") return "Cancelado";
    return "Pendente";
  }

  function labelModoCobranca(modo: string | null) {
    const m = (modo || "").toLowerCase();
    if (m === "km") return "Por KM";
    if (m === "fixo") return "Valor fixo";
    return "—";
  }

  function formatMoney(v: number | null) {
    const n = typeof v === "number" ? v : 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR");
  }

  function toDatetimeLocalValue(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }

  function abrirModalExecucao(os: OsRow) {
    setExecucaoTarget(os);
    setExecucaoEditMode(false);
    setExecucaoSaving(false);
    setExecucaoForm({
      status: os.status ?? "",
      km_inicial: os.km_inicial != null ? String(os.km_inicial) : "",
      km_final: os.km_final != null ? String(os.km_final) : "",
      assinatura_inicio_em: toDatetimeLocalValue(os.assinatura_inicio_em),
      assinatura_fim_em: toDatetimeLocalValue(os.assinatura_fim_em),
      inicio_em: toDatetimeLocalValue(os.inicio_em),
      fim_em: toDatetimeLocalValue(os.fim_em),
      local_saida: os.local_saida ?? "",
      local_chegada: os.local_chegada ?? "",
      assinatura_inicio_endereco: os.assinatura_inicio_endereco ?? "",
      assinatura_fim_endereco: os.assinatura_fim_endereco ?? "",
      roteiro: os.roteiro ?? "",
      observacoes: os.observacoes ?? "",
      modo_cobranca: os.modo_cobranca ?? "",
      valor_total: os.valor_total != null ? String(os.valor_total) : "",
      status_pagamento: os.status_pagamento ?? "",
    });
  }

  function fecharModalExecucao() {
    if (execucaoSaving) return;
    setExecucaoEditMode(false);
    setExecucaoTarget(null);
  }

  async function salvarExecucaoDetalhes() {
    if (!execucaoTarget) return;

    setExecucaoSaving(true);
    setErro("");
    setOkMsg("");

    const payload = {
      status: execucaoForm.status || execucaoTarget.status,
      km_inicial: execucaoForm.km_inicial.trim() ? Number(execucaoForm.km_inicial) : null,
      km_final: execucaoForm.km_final.trim() ? Number(execucaoForm.km_final) : null,
      assinatura_inicio_em: execucaoForm.assinatura_inicio_em ? new Date(execucaoForm.assinatura_inicio_em).toISOString() : null,
      assinatura_fim_em: execucaoForm.assinatura_fim_em ? new Date(execucaoForm.assinatura_fim_em).toISOString() : null,
      inicio_em: execucaoForm.inicio_em ? new Date(execucaoForm.inicio_em).toISOString() : null,
      fim_em: execucaoForm.fim_em ? new Date(execucaoForm.fim_em).toISOString() : null,
      local_saida: execucaoForm.local_saida.trim() || null,
      local_chegada: execucaoForm.local_chegada.trim() || null,
      assinatura_inicio_endereco: execucaoForm.assinatura_inicio_endereco.trim() || null,
      assinatura_fim_endereco: execucaoForm.assinatura_fim_endereco.trim() || null,
      roteiro: execucaoForm.roteiro.trim() || null,
      observacoes: execucaoForm.observacoes.trim() || null,
      modo_cobranca: execucaoForm.modo_cobranca || null,
      valor_total: execucaoForm.valor_total.trim() ? Number(execucaoForm.valor_total) : null,
      status_pagamento: execucaoForm.status_pagamento || null,
    };

    const { error } = await supabase.from("ordens_servico").update(payload).eq("id", execucaoTarget.id);
    setExecucaoSaving(false);

    if (error) {
      logError("operacao.ordens_servico", "Falha ao salvar detalhes no modal de execução", error, {
        os_id: execucaoTarget.id,
      });
      setErro(`Não foi possível salvar os detalhes da execução: ${error.message}`);
      return;
    }

    const atualizada: OsRow = {
      ...execucaoTarget,
      ...payload,
    };

    setOsList((prev) => prev.map((o) => (o.id === execucaoTarget.id ? { ...o, ...payload } : o)));
    setExecucaoTarget(atualizada);
    setExecucaoEditMode(false);
    setOkMsg("Detalhes da execução atualizados com sucesso.");
  }

  const inicioGeoExecucao = extractLatLng(execucaoTarget?.assinatura_inicio_geo);
  const fimGeoExecucao = extractLatLng(execucaoTarget?.assinatura_fim_geo);
  const kmInicialVisual = execucaoEditMode ? toNumber(execucaoForm.km_inicial) : execucaoTarget?.km_inicial ?? null;
  const kmFinalVisual = execucaoEditMode ? toNumber(execucaoForm.km_final) : execucaoTarget?.km_final ?? null;
  const totalKmExecucao =
    kmInicialVisual != null && kmFinalVisual != null
      ? Number(kmFinalVisual) - Number(kmInicialVisual)
      : null;

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    setErro("");
    setOkMsg("");
    const { error } = await supabase
      .from("ordens_servico")
      .update({ status: "cancelada" })
      .eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      logError("operacao.ordens_servico", "Falha ao cancelar OS individual", error, {
        os_id: deleteTarget.id,
      });
      setErro(`Não foi possível cancelar a OS: ${error.message}`);
      return;
    }

    logInfo("operacao.ordens_servico", "OS cancelada", { os_id: deleteTarget.id });
    setDeleteTarget(null);
    setOkMsg("OS cancelada com sucesso.");
    await carregarOS();
  }

  async function excluirCanceladaDefinitivamente() {
    if (!hardDeleteTarget) return;

    setDeleting(true);
    setErro("");
    setOkMsg("");

    const { error } = await supabase
      .from("ordens_servico")
      .delete()
      .eq("id", hardDeleteTarget.id)
      .eq("status", "cancelada");

    setDeleting(false);

    if (error) {
      logError("operacao.ordens_servico", "Falha ao excluir OS cancelada", error, {
        os_id: hardDeleteTarget.id,
      });
      setErro(`Não foi possível excluir a OS cancelada: ${error.message}`);
      return;
    }

    logInfo("operacao.ordens_servico", "OS cancelada excluída definitivamente", {
      os_id: hardDeleteTarget.id,
    });

    setHardDeleteTarget(null);
    setOkMsg("OS cancelada excluída com sucesso.");
    await carregarOS();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    setErro("");
    setOkMsg("");
    const { error } = await supabase
      .from("ordens_servico")
      .update({ status: "cancelada" })
      .in("id", selectedIds);
    setDeleting(false);

    if (error) {
      logError("operacao.ordens_servico", "Falha ao cancelar OS em lote", error, {
        total_ids: selectedIds.length,
      });
      setErro(`Não foi possível cancelar OS selecionadas: ${error.message}`);
      return;
    }

    logInfo("operacao.ordens_servico", "OS canceladas em lote", {
      total_ids: selectedIds.length,
    });
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    setOkMsg("OS selecionadas canceladas com sucesso.");
    await carregarOS();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Serviço"
        description="Crie, gerencie e acompanhe suas OS."
        actions={
          <>
            <Link
              href="/ordens-servico/nova"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Nova OS
            </Link>

            <button
              onClick={carregarOS}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Recarregar
            </button>
          </>
        }
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <div className="text-xs text-slate-500">Navegação diária</div>
            <div className="text-sm font-medium text-slate-900">{tituloDia}</div>
            <div className="text-xs text-slate-500">
              {usandoFiltroPeriodo
                ? "Exibindo OS do período selecionado."
                : "Exibe OS do dia selecionado + OS pausadas e em andamento."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiaReferencia((prev) => somarDias(prev, -1))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white"
              disabled={usandoFiltroPeriodo}
            >
              ← Dia anterior
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setDiaReferencia(d);
              }}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white"
              disabled={usandoFiltroPeriodo}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setDiaReferencia((prev) => somarDias(prev, 1))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-white"
              disabled={usandoFiltroPeriodo}
            >
              Próximo dia →
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-1">Período inicial</label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Período final</label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setPeriodoInicio("");
                setPeriodoFim("");
              }}
              className="w-full border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-50"
            >
              Limpar período
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº OS, cliente, veículo, motorista, origem..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            >
              <option value="todas">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="em_execucao">Em execução</option>
              <option value="concluida">Concluídas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Selecionadas: {selectedIds.length}</span>
          <span className="text-xs text-slate-500">Listadas: {filtradas.length}</span>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
            className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Cancelar selecionadas
          </button>
        </div>

        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-slate-600">Nenhuma OS encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => toggleSelecionarTodosFiltrados(e.target.checked)}
                      aria-label="Selecionar todas"
                    />
                  </th>
                  <th className="py-2 pr-4">OS</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Motorista</th>
                  <th className="py-2 pr-4">Início</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Pagamento</th>
                  <th className="py-2 pr-0">Valor</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => {
                  const statusAtual = (o.status || "").toLowerCase();
                  const isConcluida = statusAtual === "concluida";
                  const isCancelada = statusAtual === "cancelada";
                  const emEdicaoRapida = quickEditId === o.id && !isConcluida;
                  const nomeContrato = o.contrato_id ? contratosMap[o.contrato_id] : "";

                  return (
                  <tr
                    key={o.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o.id)}
                        onChange={(e) => toggleSelecionado(o.id, e.target.checked)}
                        aria-label={`Selecionar OS ${formatNumeroOS(o.numero, o.created_at)}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      {isConcluida ? (
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => abrirModalExecucao(o)}
                          title="Visualizar detalhes da execução"
                        >
                          {formatNumeroOS(o.numero, o.created_at)}
                        </button>
                      ) : (
                        <Link
                          href={`/ordens-servico/${o.id}`}
                          className="hover:underline"
                        >
                          {formatNumeroOS(o.numero, o.created_at)}
                        </Link>
                      )}
                      <div className="text-xs text-slate-500">
                        {o.tipo === "recorrente" ? "Recorrente" : "Eventual"}
                      </div>
                      {o.tipo === "recorrente" && nomeContrato ? (
                        <div className="text-xs text-indigo-700">Contrato: {nomeContrato}</div>
                      ) : null}
                    </td>

                    <td className="py-2 pr-4">{o.clientes?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {emEdicaoRapida ? (
                        <select
                          className="w-full min-w-[220px] border border-slate-300 rounded-md px-2 py-1 text-xs"
                          value={quickVeiculoId}
                          onChange={(e) => setQuickVeiculoId(e.target.value)}
                          disabled={quickSaving}
                        >
                          <option value="">(sem veículo)</option>
                          {veiculosOpts.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.placa}
                              {v.marca || v.modelo
                                ? ` — ${[v.marca, v.modelo].filter(Boolean).join(" ")}`
                                : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        o.veiculos?.placa ?? "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {emEdicaoRapida ? (
                        <select
                          className="w-full min-w-[220px] border border-slate-300 rounded-md px-2 py-1 text-xs"
                          value={quickMotoristaId}
                          onChange={(e) => setQuickMotoristaId(e.target.value)}
                          disabled={quickSaving}
                        >
                          <option value="">(sem motorista)</option>
                          {motoristasOpts.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        o.motoristas?.nome ?? "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatDt(o.inicio_em)}</td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${badgeStatus(
                          o.status
                        )}`}
                      >
                        {labelStatus(o.status)}
                      </span>
                    </td>

                    <td className="py-2 pr-4">
                      {labelPagamento(o.status_pagamento)}
                    </td>

                    <td className="py-2 pr-0">
                      {formatMoney(o.valor_total)}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        {emEdicaoRapida ? (
                          <>
                            <ActionIconButton
                              type="button"
                              title={quickSaving ? "Salvando alteração rápida" : "Salvar alteração rápida"}
                              variant="success"
                              onClick={() => void salvarEdicaoRapida()}
                              disabled={quickSaving}
                            >
                              {quickSaving ? "⏳" : "✅"}
                            </ActionIconButton>
                            <ActionIconButton
                              type="button"
                              title="Cancelar edição rápida"
                              onClick={cancelarEdicaoRapida}
                              disabled={quickSaving}
                            >
                              ❌
                            </ActionIconButton>
                          </>
                        ) : !isConcluida && !isCancelada ? (
                          <ActionIconButton
                            type="button"
                            title="Edição rápida de veículo/motorista"
                            variant="success"
                            onClick={() => iniciarEdicaoRapida(o)}
                          >
                            ⚡
                          </ActionIconButton>
                        ) : null}
                        {!isConcluida ? (
                          <ActionIconLink
                            href={`/ordens-servico/${o.id}`}
                            title="Ver detalhes e edição completa"
                            variant="primary"
                          >
                            ✏️
                          </ActionIconLink>
                        ) : null}

                        {statusTemVisualizacaoExecucao(o.status) ? (
                          <ActionIconButton
                            type="button"
                            title="Visualizar dados de execução"
                            variant="primary"
                            onClick={() => abrirModalExecucao(o)}
                          >
                            👁️
                          </ActionIconButton>
                        ) : null}

                        {!isConcluida && !isCancelada ? (
                          <ActionIconButton
                            type="button"
                            title="Cancelar OS"
                            variant="danger"
                            onClick={() => setDeleteTarget(o)}
                          >
                            🛑
                          </ActionIconButton>
                        ) : null}

                        {isCancelada ? (
                          <ActionIconButton
                            type="button"
                            title="Excluir OS cancelada definitivamente"
                            variant="danger"
                            onClick={() => setHardDeleteTarget(o)}
                          >
                            🗑️
                          </ActionIconButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Cancelar OS"
        description={`Deseja cancelar a OS "${deleteTarget ? formatNumeroOS(deleteTarget.numero, deleteTarget.created_at) : ""}"?`}
        confirmLabel="Cancelar OS"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Cancelar OS selecionadas"
        description={`Deseja cancelar ${selectedIds.length} OS selecionada(s)?`}
        confirmLabel="Cancelar selecionadas"
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />

      <DeleteConfirmDialog
        open={!!hardDeleteTarget}
        title="Excluir OS cancelada"
        description={`Esta ação é definitiva. Deseja excluir a OS "${hardDeleteTarget ? formatNumeroOS(hardDeleteTarget.numero, hardDeleteTarget.created_at) : ""}"?`}
        confirmLabel="Excluir definitivamente"
        loading={deleting}
        onCancel={() => setHardDeleteTarget(null)}
        onConfirm={excluirCanceladaDefinitivamente}
      />

      {execucaoTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Detalhes da execução</h3>
                <p className="text-sm text-slate-600">
                  {formatNumeroOS(execucaoTarget.numero, execucaoTarget.created_at)} • {labelStatus(execucaoTarget.status)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!execucaoEditMode ? (
                  <button
                    type="button"
                    className="rounded-md border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
                    onClick={() => setExecucaoEditMode(true)}
                  >
                    Editar detalhes
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      onClick={() => void salvarExecucaoDetalhes()}
                      disabled={execucaoSaving}
                    >
                      {execucaoSaving ? "Salvando..." : "Salvar alterações"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      onClick={() => abrirModalExecucao(execucaoTarget)}
                      disabled={execucaoSaving}
                    >
                      Cancelar edição
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={fecharModalExecucao}
                  disabled={execucaoSaving}
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="max-h-[80vh] space-y-5 overflow-y-auto px-5 py-4 text-sm">
              <div className="grid gap-3 md:grid-cols-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Status da OS</div>
                  {execucaoEditMode ? (
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.status}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_execucao">Em execução</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  ) : (
                    <div className="font-semibold text-slate-900">{labelStatus(execucaoTarget.status)}</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">KM inicial</div>
                  {execucaoEditMode ? (
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.km_inicial}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, km_inicial: e.target.value }))}
                    />
                  ) : (
                    <div className="font-semibold text-slate-900">{execucaoTarget.km_inicial ?? "—"}</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">KM final</div>
                  {execucaoEditMode ? (
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.km_final}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, km_final: e.target.value }))}
                    />
                  ) : (
                    <div className="font-semibold text-slate-900">{execucaoTarget.km_final ?? "—"}</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Total de KM da OS</div>
                  <div className="font-semibold text-slate-900">{totalKmExecucao != null ? `${totalKmExecucao} km` : "—"}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Início real</div>
                  {execucaoEditMode ? (
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.assinatura_inicio_em}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, assinatura_inicio_em: e.target.value }))}
                    />
                  ) : (
                    <div className="font-semibold text-slate-900">{formatDt(execucaoTarget.assinatura_inicio_em)}</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Fim real</div>
                  {execucaoEditMode ? (
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.assinatura_fim_em}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, assinatura_fim_em: e.target.value }))}
                    />
                  ) : (
                    <div className="font-semibold text-slate-900">{formatDt(execucaoTarget.assinatura_fim_em)}</div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="mb-2 font-semibold text-slate-900">Início (partida)</h4>
                  <p className="text-slate-700"><span className="font-medium">Local operacional:</span> {execucaoEditMode ? (
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.local_saida}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, local_saida: e.target.value }))}
                    />
                  ) : (execucaoTarget.local_saida || "—")}</p>
                  <p className="text-slate-700"><span className="font-medium">Endereço capturado:</span> {execucaoEditMode ? (
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.assinatura_inicio_endereco}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, assinatura_inicio_endereco: e.target.value }))}
                    />
                  ) : (execucaoTarget.assinatura_inicio_endereco || "—")}</p>
                  <p className="text-slate-700">
                    <span className="font-medium">Coordenadas:</span>{" "}
                    {inicioGeoExecucao ? `${inicioGeoExecucao.lat}, ${inicioGeoExecucao.lng}` : "—"}
                  </p>
                  {inicioGeoExecucao ? (
                    <a
                      href={`https://www.google.com/maps?q=${inicioGeoExecucao.lat},${inicioGeoExecucao.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-blue-700 hover:underline"
                    >
                      Abrir no mapa
                    </a>
                  ) : null}
                  <p className="mt-2 text-slate-700">
                    <span className="font-medium">Foto odômetro:</span>{" "}
                    {execucaoTarget.assinatura_inicio_foto_url ? (
                      <a
                        href={execucaoTarget.assinatura_inicio_foto_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline"
                      >
                        visualizar foto
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="mb-2 font-semibold text-slate-900">Fim (encerramento)</h4>
                  <p className="text-slate-700"><span className="font-medium">Local operacional:</span> {execucaoEditMode ? (
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.local_chegada}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, local_chegada: e.target.value }))}
                    />
                  ) : (execucaoTarget.local_chegada || "—")}</p>
                  <p className="text-slate-700"><span className="font-medium">Endereço capturado:</span> {execucaoEditMode ? (
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                      value={execucaoForm.assinatura_fim_endereco}
                      onChange={(e) => setExecucaoForm((prev) => ({ ...prev, assinatura_fim_endereco: e.target.value }))}
                    />
                  ) : (execucaoTarget.assinatura_fim_endereco || "—")}</p>
                  <p className="text-slate-700">
                    <span className="font-medium">Coordenadas:</span>{" "}
                    {fimGeoExecucao ? `${fimGeoExecucao.lat}, ${fimGeoExecucao.lng}` : "—"}
                  </p>
                  {fimGeoExecucao ? (
                    <a
                      href={`https://www.google.com/maps?q=${fimGeoExecucao.lat},${fimGeoExecucao.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-blue-700 hover:underline"
                    >
                      Abrir no mapa
                    </a>
                  ) : null}
                  <p className="mt-2 text-slate-700">
                    <span className="font-medium">Foto odômetro:</span>{" "}
                    {execucaoTarget.assinatura_fim_foto_url ? (
                      <a
                        href={execucaoTarget.assinatura_fim_foto_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline"
                      >
                        visualizar foto
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-2 font-semibold text-slate-900">Roteiro e observações</h4>
                <p className="text-slate-700"><span className="font-medium">Roteiro:</span> {execucaoEditMode ? (
                  <textarea
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    value={execucaoForm.roteiro}
                    onChange={(e) => setExecucaoForm((prev) => ({ ...prev, roteiro: e.target.value }))}
                  />
                ) : (execucaoTarget.roteiro || "—")}</p>
                <p className="text-slate-700"><span className="font-medium">Observações:</span> {execucaoEditMode ? (
                  <textarea
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                    value={execucaoForm.observacoes}
                    onChange={(e) => setExecucaoForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                  />
                ) : (execucaoTarget.observacoes || "—")}</p>
              </div>

              {canShowFinanceiro ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <h4 className="mb-2 font-semibold text-slate-900">Financeiro</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Tipo de cobrança</div>
                      {execucaoEditMode ? (
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                          value={execucaoForm.modo_cobranca}
                          onChange={(e) => setExecucaoForm((prev) => ({ ...prev, modo_cobranca: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          <option value="fixo">Valor fixo</option>
                          <option value="km">Por KM</option>
                        </select>
                      ) : (
                        <div className="font-semibold text-slate-900">{labelModoCobranca(execucaoTarget.modo_cobranca)}</div>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Valor total</div>
                      {execucaoEditMode ? (
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                          value={execucaoForm.valor_total}
                          onChange={(e) => setExecucaoForm((prev) => ({ ...prev, valor_total: e.target.value }))}
                        />
                      ) : (
                        <div className="font-semibold text-slate-900">{formatMoney(execucaoTarget.valor_total)}</div>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Status do pagamento</div>
                      {execucaoEditMode ? (
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
                          value={execucaoForm.status_pagamento}
                          onChange={(e) => setExecucaoForm((prev) => ({ ...prev, status_pagamento: e.target.value }))}
                        >
                          <option value="">Pendente</option>
                          <option value="pendente">Pendente</option>
                          <option value="parcial">Parcial</option>
                          <option value="pago">Pago</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      ) : (
                        <div className="font-semibold text-slate-900">{labelPagamento(execucaoTarget.status_pagamento)}</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Linha do tempo</h4>
                <ol className="space-y-2 text-slate-700">
                  <li>• Criada em {formatDt(execucaoTarget.created_at)}</li>
                  <li>
                    • Início programado:{" "}
                    {execucaoEditMode ? (
                      <input
                        type="datetime-local"
                        className="ml-1 rounded-md border border-slate-300 px-2 py-1"
                        value={execucaoForm.inicio_em}
                        onChange={(e) => setExecucaoForm((prev) => ({ ...prev, inicio_em: e.target.value }))}
                      />
                    ) : (
                      formatDt(execucaoTarget.inicio_em)
                    )}
                  </li>
                  <li>• Início real: {formatDt(execucaoTarget.assinatura_inicio_em)}</li>
                  <li>
                    • Fim programado:{" "}
                    {execucaoEditMode ? (
                      <input
                        type="datetime-local"
                        className="ml-1 rounded-md border border-slate-300 px-2 py-1"
                        value={execucaoForm.fim_em}
                        onChange={(e) => setExecucaoForm((prev) => ({ ...prev, fim_em: e.target.value }))}
                      />
                    ) : (
                      formatDt(execucaoTarget.fim_em)
                    )}
                  </li>
                  <li>• Fim real: {formatDt(execucaoTarget.assinatura_fim_em)}</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
