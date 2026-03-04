"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase/client";

type KPIs = {
  os_pendentes: number;
  os_em_andamento: number;
  os_concluidas_hoje: number;
  clientes_ativos: number;
  veiculos_ativos: number;
  motoristas_ativos: number;
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
  });
  const [aniversariantesMes, setAniversariantesMes] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setNomeUsuario(profile?.nome ?? null);

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
        { data: usuariosAniversarioData },
        { data: motoristasAniversarioData },
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
          .from("usuarios")
          .select("id, nome, data_nascimento")
          .not("data_nascimento", "is", null),
        supabase
          .from("motoristas")
          .select("id, nome, data_nascimento")
          .not("data_nascimento", "is", null),
      ]);

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

      const now = new Date();
      const operacionais = ((osOperacionaisData as OSOperacional[] | null) ?? []);
      let atrasosInicio = 0;
      let atrasosFinalizacao = 0;
      let kmDivergente = 0;

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
      });

      if (criticos > 0) setSemaforoOperacional("vermelho");
      else if (warnings > 0 || kmDivergente > 0 || atrasosInicio > 0 || atrasosFinalizacao > 0 || (osPendentes ?? 0) > 5) setSemaforoOperacional("amarelo");
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

      {alertas.length > 0 && (
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard label="OS Pendentes" value={kpis?.os_pendentes ?? 0} link="/ordens-servico?status=pendente" />
            <KPICard label="OS em Andamento" value={kpis?.os_em_andamento ?? 0} link="/ordens-servico?status=em_execucao" />
            <KPICard label="Concluídas Hoje" value={kpis?.os_concluidas_hoje ?? 0} link="/ordens-servico?status=concluida" />
            <KPICard label="Clientes Ativos" value={kpis?.clientes_ativos ?? 0} link="/clientes" />
            <KPICard label="Veículos Ativos" value={kpis?.veiculos_ativos ?? 0} link="/veiculos" />
            <KPICard label="Motoristas Ativos" value={kpis?.motoristas_ativos ?? 0} link="/motoristas" />
            <KPICard label="Aniversariantes do mês" value={aniversariantesMes} link="/aniversariantes" />
          </div>

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

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

          {tanquesCombustivel.length > 0 && (
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
                  const needleDeg = -90 + (pct * 1.8);

                  return (
                    <Link key={t.id} href={`/inventario/produtos/${t.id}`} className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition">
                      <div className="text-sm font-semibold text-slate-900">{t.nome}</div>
                      <div className="text-xs text-slate-500 mb-3">
                        {t.saldo_total.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")} {t.unidade}
                      </div>

                      <div className="relative w-44 h-24 mx-auto">
                        <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-full border-[10px] border-slate-200 border-b-0" />
                        <div
                          className="absolute inset-x-0 bottom-0 h-24 rounded-t-full border-[10px] border-b-0"
                          style={{
                            borderColor: emReserva ? "#f43f5e" : "#10b981",
                            clipPath: `polygon(0 100%, 0 0, ${pct}% 0, ${pct}% 100%)`,
                          }}
                        />

                        <div className="absolute left-1/2 bottom-0 w-0.5 h-16 bg-slate-800 origin-bottom" style={{ transform: `translateX(-50%) rotate(${needleDeg}deg)` }} />
                        <div className="absolute left-1/2 bottom-0 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-slate-800" />

                        <div className="absolute left-0 bottom-0 text-[10px] text-slate-500">0%</div>
                        <div className="absolute right-0 bottom-0 text-[10px] text-slate-500">100%</div>
                        {t.estoque_minimo !== null && (
                          <div className="absolute text-[10px] text-amber-600 font-medium" style={{ left: `${minPct}%`, bottom: "-6px", transform: "translateX(-50%)" }}>
                            Reserva
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className={emReserva ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>
                          {emReserva ? "Na reserva" : "Nível normal"}
                        </span>
                        <span className="text-slate-500">{pct.toFixed(1)}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

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
                      <Link href={`/ordens-servico/${os.id}`} className="text-sm font-medium text-white hover:underline">
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
        </>
      )}
    </div>
  );
}
