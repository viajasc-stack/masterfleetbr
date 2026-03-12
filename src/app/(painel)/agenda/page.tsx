"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { getFeriadosNacionais } from "@/lib/feriados";

type ContratoRec = {
  id: string;
  nome: string;
  dias_semana: number[] | null;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
};

type OSEventual = {
  id: string;
  numero: number | null;
  inicio_em: string | null;
  status: string;
};

type AgendaFeriado = {
  data: string;
  cor: string;
};

type ContaFin = {
  id: string;
  descricao: string;
  data_vencimento: string;
  status: string;
  valor: number;
};

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isDateInRange(dateKey: string, from: string | null, to: string | null) {
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

export default function AgendaPage() {
  const router = useRouter();
  const todayKey = toDateKey(new Date());
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [loading, setLoading] = useState(true);

  const [contratos, setContratos] = useState<ContratoRec[]>([]);
  const [osEventuais, setOsEventuais] = useState<OSEventual[]>([]);
  const [eventosCountByDate, setEventosCountByDate] = useState<Record<string, number>>({});
  const [feriados, setFeriados] = useState<AgendaFeriado[]>([]);
  const [contas, setContas] = useState<ContaFin[]>([]);

  const monthLabel = mesRef.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  async function carregarAgenda() {
    setLoading(true);
    const start = toDateKey(new Date(mesRef.getFullYear(), mesRef.getMonth(), 1));
    const end = toDateKey(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0));

    const [cRes, osRes, evRes, fRes, finRes] = await Promise.all([
      supabase
        .from("contratos")
        .select("id, nome, dias_semana, data_inicio, data_fim, ativo")
        .eq("ativo", true),
      supabase
        .from("ordens_servico")
        .select("id, numero, inicio_em, status")
        .eq("tipo", "eventual")
        .gte("inicio_em", `${start}T00:00:00`)
        .lte("inicio_em", `${end}T23:59:59`),
      supabase.from("agenda_eventos").select("data").gte("data", start).lte("data", end),
      supabase
        .from("agenda_feriados")
        .select("id, data, nome, cor")
        .gte("data", start)
        .lte("data", end)
        .order("data"),
      supabase
        .from("contas_financeiras")
        .select("id, descricao, data_vencimento, status, valor")
        .gte("data_vencimento", start)
        .lte("data_vencimento", end)
        .neq("status", "cancelado"),
    ]);

    setContratos((cRes.data ?? []) as ContratoRec[]);
    setOsEventuais((osRes.data ?? []) as OSEventual[]);
    const evCount: Record<string, number> = {};
    ((evRes.data ?? []) as Array<{ data: string }>).forEach((e) => {
      evCount[e.data] = (evCount[e.data] ?? 0) + 1;
    });
    setEventosCountByDate(evCount);
    setFeriados((fRes.data ?? []) as AgendaFeriado[]);
    setContas((finRes.data ?? []) as ContaFin[]);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await carregarAgenda();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesRef]);

  const firstGridDay = useMemo(() => {
    const firstOfMonth = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
    return addDays(firstOfMonth, -firstOfMonth.getDay());
  }, [mesRef]);

  const dayCells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(firstGridDay, i)),
    [firstGridDay]
  );

  const feriadosNacionais = useMemo(() => {
    const years = Array.from(new Set(dayCells.map((d) => d.getFullYear())));
    return years.flatMap((y) => getFeriadosNacionais(y));
  }, [dayCells]);

  const feriadoMap = useMemo(() => {
    const map: Record<string, AgendaFeriado[]> = {};
    for (const f of feriadosNacionais) {
      map[f.data] = [...(map[f.data] ?? []), { data: f.data, cor: f.cor }];
    }
    for (const f of feriados) {
      map[f.data] = [...(map[f.data] ?? []), f];
    }
    return map;
  }, [feriados, feriadosNacionais]);

  const osByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const os of osEventuais) {
      if (!os.inicio_em) continue;
      const k = os.inicio_em.slice(0, 10);
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [osEventuais]);

  const financeiroByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contas) {
      const k = c.data_vencimento?.slice(0, 10);
      if (!k) continue;
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [contas]);

  const recorrenteByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dayCells) {
      const key = toDateKey(d);
      const dow = d.getDay();
      const total = contratos.filter(
        (c) =>
          c.ativo &&
          (c.dias_semana ?? []).includes(dow) &&
          isDateInRange(key, c.data_inicio, c.data_fim)
      ).length;
      if (total > 0) map[key] = total;
    }
    return map;
  }, [contratos, dayCells]);

  const resumoMes = useMemo(() => {
    const osRec = Object.values(recorrenteByDate).reduce((acc, n) => acc + n, 0);
    const osEvt = Object.values(osByDate).reduce((acc, n) => acc + n, 0);
    const compromissos = Object.values(eventosCountByDate).reduce((acc, n) => acc + n, 0);
    const financeiroTotal = contas.reduce((acc, c) => acc + Number(c.valor || 0), 0);
    return { osRec, osEvt, compromissos, financeiroTotal };
  }, [contas, eventosCountByDate, osByDate, recorrenteByDate]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Calendário operacional com OS recorrentes/eventuais, compromissos manuais, financeiro e feriados."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setMesRef((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              ← Mês anterior
            </button>
            <button
              onClick={() => setMesRef((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Próximo mês →
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs text-emerald-700 uppercase font-semibold tracking-wide">OS recorrentes</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{resumoMes.osRec}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs text-blue-700 uppercase font-semibold tracking-wide">OS eventuais</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{resumoMes.osEvt}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs text-amber-700 uppercase font-semibold tracking-wide">Compromissos</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{resumoMes.compromissos}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs text-rose-700 uppercase font-semibold tracking-wide">Financeiro</div>
          <div className="text-xl font-bold text-rose-900 mt-1">
            {resumoMes.financeiroTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="font-semibold text-slate-900 capitalize">{monthLabel}</div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1"><span className="h-2 w-2 rounded-full bg-green-500" /> OS recorrente</div>
            <div className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> OS eventual</div>
            <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Compromissos</div>
            <div className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Financeiro</div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 text-xs text-slate-500 mb-2">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="font-semibold bg-slate-100 rounded-md py-1 text-center">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {dayCells.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === mesRef.getMonth();
            const isToday = key === todayKey;
            const feriadosDia = feriadoMap[key] ?? [];
            const hasFeriado = feriadosDia.length > 0;

            return (
              <button
                key={key}
                onClick={() => router.push(`/agenda/${key}`)}
                className={`text-left min-h-[110px] rounded-xl border p-2.5 transition shadow-sm ${
                  isToday ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300 hover:shadow"
                } ${inMonth ? "text-slate-900" : "text-slate-400"} ${hasFeriado ? "bg-amber-50" : "bg-white"}`}
              >
                <div className="text-xs font-semibold flex items-center justify-between gap-1.5">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {d.getDate()}
                  </span>
                  {hasFeriado ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                      Feriado
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1">
                  {recorrenteByDate[key] ? <span className="text-[10px] rounded bg-emerald-100 text-emerald-800 px-1 py-0.5">R {recorrenteByDate[key]}</span> : null}
                  {osByDate[key] ? <span className="text-[10px] rounded bg-blue-100 text-blue-800 px-1 py-0.5">E {osByDate[key]}</span> : null}
                  {eventosCountByDate[key] ? <span className="text-[10px] rounded bg-amber-100 text-amber-800 px-1 py-0.5">C {eventosCountByDate[key]}</span> : null}
                  {financeiroByDate[key] ? <span className="text-[10px] rounded bg-rose-100 text-rose-800 px-1 py-0.5">F {financeiroByDate[key]}</span> : null}
                </div>
              </button>
            );
          })}
        </div>

      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 text-sm text-indigo-900">
        Clique em um dia para abrir a tela completa da data com:
        leitura detalhada, filtros, criação de compromissos, gestão de feriados
        e ações de OS (mover/excluir individual ou em lote por contrato).
      </div>

      {loading ? <div className="text-sm text-slate-500">Carregando agenda...</div> : null}
    </div>
  );
}
