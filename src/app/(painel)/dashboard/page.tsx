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
      ]);

      setKpis({
        os_pendentes: osPendentes ?? 0,
        os_em_andamento: osAndamento ?? 0,
        os_concluidas_hoje: osConcluidas ?? 0,
        clientes_ativos: clientesAtivos ?? 0,
        veiculos_ativos: veiculosAtivos ?? 0,
        motoristas_ativos: motoristasAtivos ?? 0,
      });

      setOsRecentes((osData as unknown as OSRecente[]) ?? []);

      const novosAlertas: Alerta[] = [];
      if ((osPendentes ?? 0) > 5) {
        novosAlertas.push({ tipo: "aviso", mensagem: `${osPendentes} OS pendentes aguardando execução`, link: "/ordens-servico" });
      }
      if ((veiculosAtivos ?? 0) === 0) {
        novosAlertas.push({ tipo: "aviso", mensagem: "Nenhum veículo ativo cadastrado", link: "/veiculos" });
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
          </div>

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
