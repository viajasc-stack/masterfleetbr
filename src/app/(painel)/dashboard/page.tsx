"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase/client";
import {
  DASHBOARD_CONFIG_DEFAULTS,
  mergeDashboardConfig,
  readDashboardConfigLocal,
  writeDashboardConfigLocal,
  type DashboardConfig,
} from "@/lib/dashboardConfig";

type KPIs = {
  os_pendentes: number;
  os_em_andamento: number;
  os_concluidas_hoje: number;
  clientes_ativos: number;
  veiculos_ativos: number;
  motoristas_ativos: number;
  contratos_atencao: number;
};

type OSRecente = {
  id: string;
  numero: number | null;
  created_at: string;
  status: string;
  clientes: { nome: string } | null;
  veiculos: { placa: string } | null;
};

type Alerta = {
  tipo: "aviso" | "info";
  mensagem: string;
  link?: string;
};

type MotoristaOperacao = {
  motorista_id: string;
  motorista_nome: string;
  pendente: number;
  em_andamento: number;
  pausada: number;
  concluida: number;
};

type OSEventoTimeline = {
  id: string;
  created_at: string;
  evento: string;
  severidade: "info" | "warning" | "critical";
  mensagem: string | null;
  ordem_servico_id: string;
};

type OSDesvioEvento = {
  id: string;
  created_at: string;
  evento: string;
  mensagem: string | null;
  ordem_servico_id: string;
  motorista_id: string | null;
  severidade: "info" | "warning" | "critical";
  meta?: {
    distancia_m?: number;
    raio_m?: number;
  } | null;
  motoristas: { nome: string } | { nome: string }[] | null;
};

type MotoristaGeoUlt = {
  motorista_id: string;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
  motorista: { nome: string } | null;
};

type OSOperacional = {
  id: string;
  numero: number | null;
  status: string;
  data_servico: string | null;
  hora_servico: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  km_inicio: number | null;
  km_fim: number | null;
  motorista_id: string | null;
  motoristas: { nome: string } | { nome: string }[] | null;
};

type AlertaOperacionalResumo = {
  atrasos_inicio: number;
  atrasos_finalizacao: number;
  km_divergente: number;
  sem_posicao_recente: number;
  desvio_rota: number;
};

type CombustivelTank = {
  id: string;
  nome: string;
  unidade: string;
  estoque_minimo: number | null;
  estoque_maximo: number | null;
  saldo_total: number;
};

type PessoaAniversariante = {
  id: string;
  nome: string;
  data_nascimento: string;
};

function KPICard({ label, value, link }: { label: string; value: number | string; link: string }) {
  return (
    <Link href={link} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-1 hover:bg-slate-50 transition">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </Link>
  );
}

function MiniBars({
  items,
  color,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  color: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="truncate pr-2">{item.label}</span>
            <span className="font-semibold text-slate-800">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          {item.hint ? <div className="text-[11px] text-slate-500 mt-1">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

function Donut({ values }: { values: Array<{ value: number; color: string }> }) {
  const total = values.reduce((acc, v) => acc + v.value, 0);
  if (total <= 0) {
    return <div className="h-32 w-32 rounded-full bg-slate-100 border border-slate-200" />;
  }

  const segments = values
    .reduce(
      (acc, v) => {
        const start = (acc.current / total) * 100;
        const next = acc.current + v.value;
        const end = (next / total) * 100;
        acc.parts.push(`${v.color} ${start}% ${end}%`);
        return { current: next, parts: acc.parts };
      },
      { current: 0, parts: [] as string[] }
    )
    .parts.join(", ");

  return (
    <div
      className="h-32 w-32 rounded-full relative"
      style={{ background: `conic-gradient(${segments})` }}
    >
      <div className="absolute inset-4 rounded-full bg-white border border-slate-100" />
    </div>
  );
}

function badgeStatus(s: string) {
  if (s === "pendente") return "border-amber-200 text-amber-700 bg-amber-50";
  if (s === "em_execucao") return "border-blue-200 text-blue-700 bg-blue-50";
  if (s === "concluida") return "border-green-200 text-green-700 bg-green-50";
  return "border-slate-200 text-slate-600 bg-slate-50";
}

function labelStatus(s: string) {
  if (s === "pendente") return "Pendente";
  if (s === "em_execucao") return "Em andamento";
  if (s === "concluida") return "Concluída";
  if (s === "cancelada") return "Cancelada";
  return s;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [osRecentes, setOsRecentes] = useState<OSRecente[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);
  const [tanquesCombustivel, setTanquesCombustivel] = useState<CombustivelTank[]>([]);
  const [operacaoPorMotorista, setOperacaoPorMotorista] = useState<MotoristaOperacao[]>([]);
  const [timeline, setTimeline] = useState<OSEventoTimeline[]>([]);
  const [semaforoOperacional, setSemaforoOperacional] = useState<"verde" | "amarelo" | "vermelho">("verde");
  const [alertasOperacionais, setAlertasOperacionais] = useState<AlertaOperacionalResumo>({
    atrasos_inicio: 0,
    atrasos_finalizacao: 0,
    km_divergente: 0,
    sem_posicao_recente: 0,
    desvio_rota: 0,
  });
  const [aniversariantesMes, setAniversariantesMes] = useState(0);
  const [posicoesMapa, setPosicoesMapa] = useState<MotoristaGeoUlt[]>([]);
  const [desviosRecentes, setDesviosRecentes] = useState<OSDesvioEvento[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(DASHBOARD_CONFIG_DEFAULTS);

  const osDistribuicao = useMemo(
    () => [
      { label: "Pendentes", value: kpis?.os_pendentes ?? 0, color: "#f59e0b" },
      { label: "Em andamento", value: kpis?.os_em_andamento ?? 0, color: "#3b82f6" },
      { label: "Concluídas hoje", value: kpis?.os_concluidas_hoje ?? 0, color: "#10b981" },
    ],
    [kpis]
  );

  const eventosPorSeveridade = useMemo(() => {
    const info = timeline.filter((e) => e.severidade === "info").length;
    const warning = timeline.filter((e) => e.severidade === "warning").length;
    const critical = timeline.filter((e) => e.severidade === "critical").length;
    return [
      { label: "Info", value: info },
      { label: "Warning", value: warning },
      { label: "Crítico", value: critical },
    ];
  }, [timeline]);

  const riscoOperacional = useMemo(
    () => [
      { label: "Atraso início", value: alertasOperacionais.atrasos_inicio },
      { label: "Atraso finalização", value: alertasOperacionais.atrasos_finalizacao },
      { label: "KM divergente", value: alertasOperacionais.km_divergente },
      { label: "Sem posição recente", value: alertasOperacionais.sem_posicao_recente },
      { label: "Desvio rota (24h)", value: alertasOperacionais.desvio_rota },
    ],
    [alertasOperacionais]
  );

  const topMotoristasGrafico = useMemo(
    () =>
      operacaoPorMotorista.slice(0, 5).map((m) => ({
        label: m.motorista_nome,
        value: m.em_andamento,
        hint: `${m.pendente} pendente • ${m.concluida} concluída`,
      })),
    [operacaoPorMotorista]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setNomeUsuario(profile?.nome ?? null);

      if (profile?.empresa_id) {
        const localCfg = readDashboardConfigLocal(profile.empresa_id);
        if (localCfg) setDashboardConfig(localCfg);

        const { data: empresaCfg, error: empresaCfgError } = await supabase
          .from("empresas")
          .select("dashboard_config")
          .eq("id", profile.empresa_id)
          .maybeSingle();

        if (!empresaCfgError && !localCfg) {
          const merged = mergeDashboardConfig(empresaCfg?.dashboard_config);
          setDashboardConfig(merged);
          writeDashboardConfigLocal(profile.empresa_id, merged);
        }
      } else {
        setDashboardConfig(DASHBOARD_CONFIG_DEFAULTS);
      }

      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1).toISOString();

      const [
        { count: osPendentes },
        { count: osAndamento },
        { count: osConcluidas },
        { count: clientesAtivos },
        { count: veiculosAtivos },
        { count: motoristasAtivos },
        { data: osData },
        { data: combustiveisData },
        { data: osOperacaoData },
        { data: osEventosData },
        { data: osOperacionaisData },
        { data: geoData },
        { data: desviosData },
        { data: usuariosAniversarioData },
        { data: motoristasAniversarioData },
        { data: contratosData },
        { data: osRecorrentesData },
      ] = await Promise.all([
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("status", "em_execucao"),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("status", "concluida").gte("updated_at", inicioHoje).lt("updated_at", fimHoje),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("motoristas").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("ordens_servico")
          .select("id, numero, created_at, status, clientes(nome), veiculos(placa)")
          .in("status", ["pendente", "em_execucao"])
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("produtos")
          .select("id, nome, unidade, estoque_minimo, estoque_maximo")
          .eq("ativo", true)
          .eq("destaque", true)
          .eq("tipo_item", "combustivel")
          .limit(3),
        supabase.from("ordens_servico")
          .select("id, status, motorista_id, motoristas(nome)")
          .in("status", ["pendente", "em_execucao", "em_andamento", "pausada", "concluida", "finalizada"])
          .order("updated_at", { ascending: false })
          .limit(300),
        supabase.from("os_eventos")
          .select("id, created_at, evento, severidade, mensagem, ordem_servico_id")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("ordens_servico")
          .select("id, numero, status, data_servico, hora_servico, inicio_em, fim_em, km_inicio, km_fim, motorista_id, motoristas(nome)")
          .in("status", ["pendente", "aprovada", "confirmada", "em_execucao", "em_andamento", "pausada"])
          .order("updated_at", { ascending: false })
          .limit(400),
        supabase
          .from("motoristas_geo")
          .select("motorista_id, latitude, longitude, updated_at, motorista:motoristas(nome)")
          .order("updated_at", { ascending: false })
          .limit(500),
        supabase
          .from("os_eventos")
          .select("id, created_at, evento, mensagem, ordem_servico_id, motorista_id, severidade, meta, motoristas(nome)")
          .or("evento.eq.desvio_rota_geom,evento.ilike.%desvio%,mensagem.ilike.%fora de rota%,mensagem.ilike.%desvio%")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("usuarios")
          .select("id, nome, data_nascimento")
          .not("data_nascimento", "is", null),
        supabase
          .from("motoristas")
          .select("id, nome, data_nascimento")
          .not("data_nascimento", "is", null),
        supabase
          .from("contratos")
          .select("id, ativo, data_fim")
          .eq("ativo", true),
        supabase
          .from("ordens_servico")
          .select("id, contrato_id, inicio_em")
          .eq("tipo", "recorrente")
          .not("contrato_id", "is", null)
          .not("inicio_em", "is", null)
          .neq("status", "cancelada"),
      ]);

      const hojeYmd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(hoje);

      const coberturaContrato: Record<string, string> = {};
      ((osRecorrentesData ?? []) as Array<{ contrato_id: string | null; inicio_em: string | null }>).forEach((os) => {
        if (!os.contrato_id || !os.inicio_em) return;
        const ymd = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(os.inicio_em));
        if (!coberturaContrato[os.contrato_id] || ymd > coberturaContrato[os.contrato_id]) {
          coberturaContrato[os.contrato_id] = ymd;
        }
      });

      const contratosAtencao = ((contratosData ?? []) as Array<{ id: string; ativo: boolean; data_fim: string | null }>).filter((c) => {
        if (!c.ativo) return false;
        if (c.data_fim && c.data_fim < hojeYmd) return false;

        const cobertura = coberturaContrato[c.id];
        if (!cobertura) return true;

        const a = new Date(`${hojeYmd}T00:00:00`);
        const b = new Date(`${cobertura}T00:00:00`);
        const diasCobertura = b.getTime() >= a.getTime() ? Math.floor((b.getTime() - a.getTime()) / 86400000) + 1 : 0;

        const aindaTemVigenciaDepois = c.data_fim ? c.data_fim > cobertura : true;
        return aindaTemVigenciaDepois && diasCobertura <= 3;
      }).length;

      const mesAtual = hoje.getMonth() + 1;
      const usuariosMes = ((usuariosAniversarioData ?? []) as PessoaAniversariante[]).filter((x) => {
        const d = new Date(`${x.data_nascimento}T12:00:00`);
        return !Number.isNaN(d.getTime()) && d.getMonth() + 1 === mesAtual;
      });
      const motoristasMes = ((motoristasAniversarioData ?? []) as PessoaAniversariante[]).filter((x) => {
        const d = new Date(`${x.data_nascimento}T12:00:00`);
        return !Number.isNaN(d.getTime()) && d.getMonth() + 1 === mesAtual;
      });
      setAniversariantesMes(usuariosMes.length + motoristasMes.length);

      setKpis({
        os_pendentes: osPendentes ?? 0,
        os_em_andamento: osAndamento ?? 0,
        os_concluidas_hoje: osConcluidas ?? 0,
        clientes_ativos: clientesAtivos ?? 0,
        veiculos_ativos: veiculosAtivos ?? 0,
        motoristas_ativos: motoristasAtivos ?? 0,
        contratos_atencao: contratosAtencao,
      });

      setOsRecentes((osData as unknown as OSRecente[]) ?? []);

      if (combustiveisData && combustiveisData.length > 0) {
        const ids = combustiveisData.map((c: { id: string }) => c.id);
        const { data: saldosComb } = await supabase
          .from("saldos_estoque")
          .select("produto_id, quantidade")
          .in("produto_id", ids);

        const saldoMap: Record<string, number> = {};
        (saldosComb ?? []).forEach((s: { produto_id: string; quantidade: number }) => {
          saldoMap[s.produto_id] = (saldoMap[s.produto_id] ?? 0) + s.quantidade;
        });

        setTanquesCombustivel(
          (combustiveisData as Array<{ id: string; nome: string; unidade: string; estoque_minimo: number | null; estoque_maximo: number | null }>)
            .filter((c) => c.estoque_maximo !== null && c.estoque_maximo > 0)
            .map((c) => ({
              id: c.id,
              nome: c.nome,
              unidade: c.unidade,
              estoque_minimo: c.estoque_minimo,
              estoque_maximo: c.estoque_maximo,
              saldo_total: saldoMap[c.id] ?? 0,
            }))
        );
      } else {
        setTanquesCombustivel([]);
      }

      const novosAlertas: Alerta[] = [];
      if ((osPendentes ?? 0) > 5) {
        novosAlertas.push({ tipo: "aviso", mensagem: `${osPendentes} OS pendentes aguardando execução`, link: "/ordens-servico" });
      }
      if ((veiculosAtivos ?? 0) === 0) {
        novosAlertas.push({ tipo: "aviso", mensagem: "Nenhum veículo ativo cadastrado", link: "/veiculos" });
      }
      if (contratosAtencao > 0) {
        novosAlertas.push({
          tipo: "aviso",
          mensagem: `${contratosAtencao} contrato(s) precisam de atenção para geração de OS`,
          link: "/contratos",
        });
      }

      const operacaoMap = new Map<string, MotoristaOperacao>();
      ((osOperacaoData as Array<{ id: string; status: string; motorista_id: string | null; motoristas?: { nome: string } | { nome: string }[] | null }> | null) ?? []).forEach((os) => {
        if (!os.motorista_id) return;
        const status = String(os.status || "").toLowerCase();
        const rawMotorista = Array.isArray(os.motoristas) ? os.motoristas[0] : os.motoristas;
        const nome = rawMotorista?.nome || "Motorista";

        const atual = operacaoMap.get(os.motorista_id) || {
          motorista_id: os.motorista_id,
          motorista_nome: nome,
          pendente: 0,
          em_andamento: 0,
          pausada: 0,
          concluida: 0,
        };

        if (status === "pendente") atual.pendente += 1;
        if (status === "em_execucao" || status === "em_andamento") atual.em_andamento += 1;
        if (status === "pausada") atual.pausada += 1;
        if (status === "concluida" || status === "finalizada") atual.concluida += 1;

        operacaoMap.set(os.motorista_id, atual);
      });

      const opList = Array.from(operacaoMap.values()).sort((a, b) =>
        b.em_andamento - a.em_andamento || b.pendente - a.pendente
      );
      setOperacaoPorMotorista(opList);

      const tl = ((osEventosData as OSEventoTimeline[] | null) ?? []).map((e) => ({
        ...e,
        severidade: (e.severidade || "info") as "info" | "warning" | "critical",
      }));
      setTimeline(tl);

      const criticos = tl.filter((e) => e.severidade === "critical").length;
      const warnings = tl.filter((e) => e.severidade === "warning").length;

      const desvios = ((desviosData as OSDesvioEvento[] | null) ?? []).map((d) => ({
        ...d,
        severidade: (d.severidade || "warning") as "info" | "warning" | "critical",
      }));
      setDesviosRecentes(desvios);

      const now = new Date();
      const operacionais = ((osOperacionaisData as OSOperacional[] | null) ?? []);
      const geoLista = ((geoData as MotoristaGeoUlt[] | null) ?? []);

      const ultPosicao = new Map<string, MotoristaGeoUlt>();
      for (const p of geoLista) {
        if (!p.motorista_id) continue;
        if (!ultPosicao.has(p.motorista_id)) ultPosicao.set(p.motorista_id, p);
      }

      const mapaPosicoes = Array.from(ultPosicao.values()).filter(
        (p) => typeof p.latitude === "number" && typeof p.longitude === "number"
      );
      setPosicoesMapa(mapaPosicoes);

      let atrasosInicio = 0;
      let atrasosFinalizacao = 0;
      let kmDivergente = 0;
      let semPosicaoRecente = 0;

      const dt24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const desvioRota24h = desvios.filter((d) => {
        const t = new Date(d.created_at);
        return !Number.isNaN(t.getTime()) && t >= dt24h;
      }).length;

      operacionais.forEach((os) => {
        const status = String(os.status || "").toLowerCase();

        if (["pendente", "aprovada", "confirmada"].includes(status) && os.data_servico) {
          const hora = String(os.hora_servico || "00:00").slice(0, 5);
          const agendamento = new Date(`${os.data_servico}T${hora}:00`);
          if (!Number.isNaN(agendamento.getTime())) {
            const diffMin = Math.floor((now.getTime() - agendamento.getTime()) / 60000);
            if (diffMin >= 15) atrasosInicio += 1;
          }
        }

        if (["em_andamento", "em_execucao"].includes(status) && os.inicio_em) {
          const inicio = new Date(os.inicio_em);
          if (!Number.isNaN(inicio.getTime())) {
            const duracaoMin = Math.floor((now.getTime() - inicio.getTime()) / 60000);
            if (duracaoMin >= 180) atrasosFinalizacao += 1;
          }

          if (os.motorista_id) {
            const pos = ultPosicao.get(os.motorista_id);
            if (!pos?.updated_at) {
              semPosicaoRecente += 1;
            } else {
              const upd = new Date(pos.updated_at);
              if (Number.isNaN(upd.getTime())) {
                semPosicaoRecente += 1;
              } else {
                const minSemAtualizacao = Math.floor((now.getTime() - upd.getTime()) / 60000);
                if (minSemAtualizacao > 30) semPosicaoRecente += 1;
              }
            }
          }
        }

        const kmInicio = Number(os.km_inicio || 0);
        const kmFim = Number(os.km_fim || 0);
        if (kmInicio > 0 && kmFim > 0 && kmFim < kmInicio) {
          kmDivergente += 1;
        }
      });

      setAlertasOperacionais({
        atrasos_inicio: atrasosInicio,
        atrasos_finalizacao: atrasosFinalizacao,
        km_divergente: kmDivergente,
        sem_posicao_recente: semPosicaoRecente,
        desvio_rota: desvioRota24h,
      });

      if (criticos > 0) setSemaforoOperacional("vermelho");
      else if (warnings > 0 || kmDivergente > 0 || atrasosInicio > 0 || atrasosFinalizacao > 0 || semPosicaoRecente > 0 || desvioRota24h > 0 || (osPendentes ?? 0) > 5) setSemaforoOperacional("amarelo");
      else setSemaforoOperacional("verde");

      if (criticos > 0) {
        novosAlertas.push({
          tipo: "aviso",
          mensagem: `${criticos} alerta(s) crítico(s) detectado(s) na operação`,
          link: "/ordens-servico",
        });
      }

      if (atrasosInicio > 0) {
        novosAlertas.push({
          tipo: "aviso",
          mensagem: `${atrasosInicio} OS com atraso de início`,
          link: "/ordens-servico?status=pendente",
        });
      }

      if (atrasosFinalizacao > 0) {
        novosAlertas.push({
          tipo: "aviso",
          mensagem: `${atrasosFinalizacao} OS em execução com duração elevada`,
          link: "/ordens-servico?status=em_execucao",
        });
      }

      if (kmDivergente > 0) {
        novosAlertas.push({
          tipo: "aviso",
          mensagem: `${kmDivergente} OS com divergência de KM`,
          link: "/ordens-servico",
        });
      }

      if (semPosicaoRecente > 0) {
        novosAlertas.push({
          tipo: "aviso",
          mensagem: `${semPosicaoRecente} OS em execução sem posição recente do motorista`,
          link: "/ordens-servico?status=em_execucao",
        });
      }

      if (desvioRota24h > 0) {
        novosAlertas.push({
          tipo: "aviso",
          mensagem: `${desvioRota24h} alerta(s) de desvio de rota nas últimas 24h`,
          link: "/ordens-servico?status=em_execucao",
        });
      }

      setAlertas(novosAlertas);

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 p-6 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {nomeUsuario ? `Olá, ${nomeUsuario.split(" ")[0]}` : "Bem-vindo"}
            </h1>
            <p className="text-white/80 mt-0.5 text-sm">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button href="/ordens-servico/nova">+ Nova OS</Button>
            <Button href="/clientes/novo" variant="secondary">+ Cliente</Button>
          </div>
        </div>
      </div>

      {dashboardConfig.marcador_combustivel_topo && tanquesCombustivel.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-900">Marcador de combustível</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            {tanquesCombustivel.map((t) => {
              const max = Math.max(1, Number(t.estoque_maximo ?? 0));
              const pct = Math.min(100, Math.max(0, (t.saldo_total / max) * 100));
              const minPct = t.estoque_minimo && t.estoque_minimo > 0 ? Math.min(100, Math.max(0, (t.estoque_minimo / max) * 100)) : 0;
              const emReserva = t.estoque_minimo !== null && t.saldo_total <= t.estoque_minimo;
              const grad = emReserva
                ? "from-rose-500 to-orange-500"
                : pct < 45
                ? "from-amber-500 to-yellow-500"
                : "from-emerald-500 to-cyan-500";

              return (
                <Link
                  key={t.id}
                  href={`/inventario/produtos/${t.id}`}
                  className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{t.nome}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Tanque monitorado</div>
                    </div>
                    <div className={`text-[11px] px-2 py-1 rounded-full text-white bg-gradient-to-r ${grad}`}>
                      {pct.toFixed(1)}%
                    </div>
                  </div>

                  <div className="mt-4 mb-2">
                    <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${grad}`}
                        style={{ width: `${pct}%` }}
                      />
                      {t.estoque_minimo !== null ? (
                        <div
                          className="absolute top-0 h-full w-[2px] bg-amber-700/80"
                          style={{ left: `${minPct}%` }}
                          title="Limite de reserva"
                        />
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>0%</span>
                      <span>Reserva</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-lg font-bold text-slate-900">
                        {t.saldo_total.toLocaleString("pt-BR")} {t.unidade}
                      </div>
                      <div className="text-xs text-slate-500">
                        Capacidade: {max.toLocaleString("pt-BR")} {t.unidade}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${emReserva ? "text-rose-600" : "text-emerald-600"}`}>
                      {emReserva ? "⚠ Na reserva" : "✓ Nível normal"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {dashboardConfig.alertas_topo && alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${a.tipo === "aviso" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-sky-500/30 bg-sky-500/10 text-sky-300"}`}>
              <span>{a.mensagem}</span>
              {a.link && <Link href={a.link} className="underline text-xs opacity-75 hover:opacity-100">Ver</Link>}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          {dashboardConfig.kpis_gerais && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard label="OS Pendentes" value={kpis?.os_pendentes ?? 0} link="/ordens-servico?status=pendente" />
            <KPICard label="OS em Andamento" value={kpis?.os_em_andamento ?? 0} link="/ordens-servico?status=em_execucao" />
            <KPICard label="Concluídas Hoje" value={kpis?.os_concluidas_hoje ?? 0} link="/ordens-servico?status=concluida" />
            <KPICard label="Clientes Ativos" value={kpis?.clientes_ativos ?? 0} link="/clientes" />
            <KPICard label="Veículos Ativos" value={kpis?.veiculos_ativos ?? 0} link="/veiculos" />
            <KPICard label="Motoristas Ativos" value={kpis?.motoristas_ativos ?? 0} link="/motoristas" />
            <KPICard label="Contratos atenção" value={kpis?.contratos_atencao ?? 0} link="/contratos" />
            <KPICard label="Aniversariantes do mês" value={aniversariantesMes} link="/aniversariantes" />
          </div>
          )}

          {(dashboardConfig.grafico_distribuicao_operacional || dashboardConfig.grafico_top_motoristas || dashboardConfig.radar_risco_operacional) && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {dashboardConfig.grafico_distribuicao_operacional && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="text-sm font-semibold text-slate-900 mb-4">Distribuição operacional</div>
              <div className="flex items-center gap-5">
                <Donut
                  values={osDistribuicao.map((o) => ({
                    value: o.value,
                    color: o.color,
                  }))}
                />
                <div className="space-y-2 text-xs">
                  {osDistribuicao.map((o) => (
                    <div key={o.label} className="flex items-center gap-2 text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                      <span>{o.label}</span>
                      <span className="font-semibold">{o.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            {dashboardConfig.grafico_top_motoristas && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="text-sm font-semibold text-slate-900 mb-4">Top motoristas em execução</div>
              {topMotoristasGrafico.length === 0 ? (
                <div className="text-sm text-slate-600">Sem OS em execução por motorista no momento.</div>
              ) : (
                <MiniBars items={topMotoristasGrafico} color="bg-blue-500" />
              )}
            </div>
            )}

            {dashboardConfig.radar_risco_operacional && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="text-sm font-semibold text-slate-900">Radar de risco operacional</div>
                <span
                  className={`text-[11px] px-2 py-1 rounded border ${
                    semaforoOperacional === "vermelho"
                      ? "border-rose-200 text-rose-700 bg-rose-50"
                      : semaforoOperacional === "amarelo"
                      ? "border-amber-200 text-amber-700 bg-amber-50"
                      : "border-emerald-200 text-emerald-700 bg-emerald-50"
                  }`}
                >
                  Semáforo {semaforoOperacional}
                </span>
              </div>
              <MiniBars items={riscoOperacional} color="bg-rose-500" />
            </div>
            )}
          </div>
          )}

          {dashboardConfig.eventos_severidade && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="text-sm font-semibold text-slate-900 mb-4">Eventos da operação (últimos 12)</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Info</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{eventosPorSeveridade[0]?.value ?? 0}</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="text-xs uppercase tracking-wide text-amber-700">Warning</div>
                <div className="text-2xl font-bold text-amber-900 mt-1">{eventosPorSeveridade[1]?.value ?? 0}</div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
                <div className="text-xs uppercase tracking-wide text-rose-700">Crítico</div>
                <div className="text-2xl font-bold text-rose-900 mt-1">{eventosPorSeveridade[2]?.value ?? 0}</div>
              </div>
            </div>
          </div>
          )}

          {dashboardConfig.semaforo_operacional && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Semáforo Operacional</span>
              <span
                className={`text-xs px-2 py-1 rounded border ${
                  semaforoOperacional === "vermelho"
                    ? "border-rose-200 text-rose-700 bg-rose-50"
                    : semaforoOperacional === "amarelo"
                    ? "border-amber-200 text-amber-700 bg-amber-50"
                    : "border-emerald-200 text-emerald-700 bg-emerald-50"
                }`}
              >
                {semaforoOperacional === "vermelho"
                  ? "Vermelho"
                  : semaforoOperacional === "amarelo"
                  ? "Amarelo"
                  : "Verde"}
              </span>
            </div>

            {operacaoPorMotorista.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-600">Sem dados operacionais por motorista no momento.</div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {operacaoPorMotorista.map((m) => (
                  <div key={m.motorista_id} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-900">{m.motorista_nome}</div>
                    <div className="mt-2 flex gap-2 flex-wrap text-xs">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Pendente: {m.pendente}</span>
                      <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">Andamento: {m.em_andamento}</span>
                      <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">Pausada: {m.pausada}</span>
                      <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">Concluída: {m.concluida}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {dashboardConfig.cards_alertas_operacionais && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-amber-700 font-semibold">Atraso de início</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{alertasOperacionais.atrasos_inicio}</div>
              <div className="text-xs text-amber-700 mt-1">OS pendentes com 15+ min após horário previsto</div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Atraso de finalização</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{alertasOperacionais.atrasos_finalizacao}</div>
              <div className="text-xs text-blue-700 mt-1">OS em execução há mais de 3 horas</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-rose-700 font-semibold">KM divergente</div>
              <div className="text-2xl font-bold text-rose-900 mt-1">{alertasOperacionais.km_divergente}</div>
              <div className="text-xs text-rose-700 mt-1">KM final menor que KM inicial</div>
            </div>
            <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 p-4">
              <div className="text-xs uppercase tracking-wide text-fuchsia-700 font-semibold">Desvio de rota (24h)</div>
              <div className="text-2xl font-bold text-fuchsia-900 mt-1">{alertasOperacionais.desvio_rota}</div>
              <div className="text-xs text-fuchsia-700 mt-1">Eventos de desvio/fora de rota registrados</div>
            </div>
          </div>
          )}

          {dashboardConfig.alertas_desvio_rota && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Alertas de desvio de rota</span>
              <span className="text-xs text-slate-500">Últimos eventos capturados</span>
            </div>
            {desviosRecentes.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-600">Sem alertas de desvio de rota recentes.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {desviosRecentes.map((d) => {
                  const m = Array.isArray(d.motoristas) ? d.motoristas[0] : d.motoristas;
                  return (
                    <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{d.mensagem || d.evento}</div>
                        <div className="text-xs text-slate-500">
                          {m?.nome || "Motorista"} • OS {d.ordem_servico_id.slice(0, 8)} • {new Date(d.created_at).toLocaleString("pt-BR")}
                        </div>
                      {typeof d.meta?.distancia_m === "number" ? (
                        <div className="text-xs text-fuchsia-700 mt-0.5">
                          Distância: {Math.round(d.meta.distancia_m)}m
                          {typeof d.meta?.raio_m === "number" ? ` • Raio: ${Math.round(d.meta.raio_m)}m` : ""}
                        </div>
                      ) : null}
                      </div>
                      <span className="text-xs px-2 py-1 rounded border border-fuchsia-200 text-fuchsia-700 bg-fuchsia-50">
                        {d.severidade}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {dashboardConfig.mapa_operacional && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Mapa Operacional (simplificado)</span>
              <span className="text-xs text-slate-500">Última posição por motorista</span>
            </div>

            {posicoesMapa.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-600">Sem posições recentes para exibir.</div>
            ) : (
              <div className="p-5">
                <div className="h-56 rounded-lg border border-slate-200 bg-slate-50 relative overflow-hidden">
                  {posicoesMapa.map((p, idx) => {
                    const lat = Number(p.latitude ?? 0);
                    const lng = Number(p.longitude ?? 0);
                    const top = ((-lat + 90) / 180) * 100;
                    const left = ((lng + 180) / 360) * 100;
                    return (
                      <div
                        key={`${p.motorista_id}-${idx}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ top: `${Math.max(3, Math.min(97, top))}%`, left: `${Math.max(3, Math.min(97, left))}%` }}
                        title={`${p.motorista?.nome ?? "Motorista"} • ${new Date(p.updated_at).toLocaleString("pt-BR")}`}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200" />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-600">
                  {alertasOperacionais.sem_posicao_recente > 0
                    ? `${alertasOperacionais.sem_posicao_recente} OS em execução sem atualização de posição nos últimos 30 min.`
                    : "Todas as OS em execução com posição recente do motorista."}
                </div>
              </div>
            )}
          </div>
          )}

          {dashboardConfig.timeline_eventos && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Timeline de Eventos (OS)</span>
              <span className="text-xs text-slate-500">Auditoria operacional</span>
            </div>

            {timeline.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-600">Sem eventos recentes.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {timeline.map((ev) => (
                  <div key={ev.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{ev.mensagem || ev.evento}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        OS {ev.ordem_servico_id.slice(0, 8)} • {new Date(ev.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded border ${
                        ev.severidade === "critical"
                          ? "border-rose-200 text-rose-700 bg-rose-50"
                          : ev.severidade === "warning"
                          ? "border-amber-200 text-amber-700 bg-amber-50"
                          : "border-slate-200 text-slate-600 bg-slate-50"
                      }`}
                    >
                      {ev.severidade}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {dashboardConfig.os_em_aberto && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">OS em aberto</span>
              <Link href="/ordens-servico" className="text-xs text-sky-600 hover:underline">Ver todas</Link>
            </div>
            {osRecentes.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-600 text-sm">Nenhuma OS em aberto</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {osRecentes.map((os) => (
                  <div key={os.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <Link href={`/ordens-servico/${os.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                        {os.numero ? `OS-${String(os.numero).padStart(4, "0")}` : "OS"}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {os.clientes?.nome ?? "—"} {os.veiculos ? `• ${os.veiculos.placa}` : ""}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border ${badgeStatus(os.status)}`}>
                      {labelStatus(os.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {dashboardConfig.atalhos_rapidos && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Nova OS", href: "/ordens-servico/nova", desc: "Criar ordem de serviço" },
              { label: "Novo Cliente", href: "/clientes/novo", desc: "Cadastrar cliente" },
              { label: "Novo Veículo", href: "/veiculos/novo", desc: "Adicionar à frota" },
              { label: "Entrada Estoque", href: "/inventario/entradas/nova", desc: "Registrar entrada" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition">
                <div className="text-sm font-semibold text-slate-900">{a.label}</div>
                <div className="text-xs text-slate-600 mt-0.5">{a.desc}</div>
              </Link>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}
