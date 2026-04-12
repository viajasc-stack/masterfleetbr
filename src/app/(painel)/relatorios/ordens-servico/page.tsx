"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type ViewMode = "cliente" | "contrato" | "data" | "status" | "tipo" | "conformidade" | "rota";

type OsRow = {
  id: string;
  numero: number | null;
  tipo: string | null;
  status: string | null;
  created_at: string;
  inicio_em: string | null;
  fim_em: string | null;
  km_inicial: number | null;
  km_final: number | null;
  origem: string | null;
  destino: string | null;
  roteiro: string | null;
  contrato_id: string | null;
  cliente_id: string | null;
  assinatura_inicio_em: string | null;
  assinatura_fim_em: string | null;
  assinatura_inicio_geo: unknown;
  assinatura_fim_geo: unknown;
  assinatura_inicio_foto_url: string | null;
  assinatura_fim_foto_url: string | null;
  cliente_nome?: string | null;
  contrato_nome?: string | null;
};

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toDateInput(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function csvDownload(filename: string, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? {});
  const content = [
    headers.join(";"),
    ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(";")),
  ].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosOrdensServicoPage() {
  const now = new Date();
  const [inicio, setInicio] = useState(dateOnly(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [fim, setFim] = useState(dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [status, setStatus] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("cliente");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [ordens, setOrdens] = useState<OsRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(
          "id,numero,tipo,status,created_at,inicio_em,fim_em,km_inicial,km_final,origem,destino,roteiro,contrato_id,cliente_id,assinatura_inicio_em,assinatura_fim_em,assinatura_inicio_geo,assinatura_fim_geo,assinatura_inicio_foto_url,assinatura_fim_foto_url"
        )
        .gte("created_at", `${inicio}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .order("created_at", { ascending: false });

      if (error) {
        setErro(error.message);
        setOrdens([]);
      } else {
        const base = (data ?? []) as unknown as OsRow[];

        const clienteIds = Array.from(new Set(base.map((o) => o.cliente_id).filter(Boolean) as string[]));
        const contratoIds = Array.from(new Set(base.map((o) => o.contrato_id).filter(Boolean) as string[]));

        let clienteMap: Record<string, string> = {};
        let contratoMap: Record<string, string> = {};

        if (clienteIds.length > 0) {
          const { data: clientesData } = await supabase
            .from("clientes")
            .select("id,nome")
            .in("id", clienteIds);

          clienteMap = Object.fromEntries((clientesData ?? []).map((c) => [String(c.id), String(c.nome ?? "")]));
        }

        if (contratoIds.length > 0) {
          const { data: contratosData } = await supabase
            .from("contratos")
            .select("id,nome")
            .in("id", contratoIds);

          contratoMap = Object.fromEntries((contratosData ?? []).map((c) => [String(c.id), String(c.nome ?? "")]));
        }

        const enriched = base.map((o) => ({
          ...o,
          cliente_nome: o.cliente_id ? (clienteMap[o.cliente_id] || null) : null,
          contrato_nome: o.contrato_id ? (contratoMap[o.contrato_id] || null) : null,
        }));

        setOrdens(enriched);
      }
      setLoading(false);
    }

    void load();
  }, [inicio, fim]);

  const filtradas = useMemo(() => {
    return ordens.filter((o) => {
      if (status !== "todos" && (o.status || "") !== status) return false;
      if (tipo !== "todos" && (o.tipo || "") !== tipo) return false;
      return true;
    });
  }, [ordens, status, tipo]);

  const resumo = useMemo(() => {
    const concluidas = filtradas.filter((o) => (o.status || "") === "concluida").length;
    const kmTotal = filtradas.reduce((acc, o) => {
      if (o.km_inicial == null || o.km_final == null) return acc;
      return acc + (Number(o.km_final) - Number(o.km_inicial));
    }, 0);
    return {
      total: filtradas.length,
      concluidas,
      taxaConclusao: filtradas.length ? Math.round((concluidas / filtradas.length) * 100) : 0,
      kmTotal,
    };
  }, [filtradas]);

  const byCliente = useMemo(() => {
    const map: Record<string, { os: number; km: number }> = {};
    filtradas.forEach((o) => {
      const nome = o.cliente_nome?.trim() || "Sem cliente";
      map[nome] = map[nome] || { os: 0, km: 0 };
      map[nome].os += 1;
      if (o.km_inicial != null && o.km_final != null) map[nome].km += Number(o.km_final) - Number(o.km_inicial);
    });
    return Object.entries(map).map(([cliente, v]) => ({ cliente, os: v.os, km: v.km })).sort((a, b) => b.os - a.os);
  }, [filtradas]);

  const byContrato = useMemo(() => {
    const map: Record<string, { os: number; concluidas: number }> = {};
    filtradas.forEach((o) => {
      const nome = o.contrato_nome?.trim() || "Sem contrato";
      map[nome] = map[nome] || { os: 0, concluidas: 0 };
      map[nome].os += 1;
      if ((o.status || "") === "concluida") map[nome].concluidas += 1;
    });
    return Object.entries(map).map(([contrato, v]) => ({ contrato, ...v })).sort((a, b) => b.os - a.os);
  }, [filtradas]);

  const byData = useMemo(() => {
    const map: Record<string, number> = {};
    filtradas.forEach((o) => {
      const d = (o.created_at || "").slice(0, 10) || "Sem data";
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([data, os]) => ({ data, os })).sort((a, b) => a.data.localeCompare(b.data));
  }, [filtradas]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtradas.forEach((o) => {
      const s = o.status || "sem_status";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([statusLabel, os]) => ({ status: statusLabel, os })).sort((a, b) => b.os - a.os);
  }, [filtradas]);

  const byTipo = useMemo(() => {
    const map: Record<string, number> = {};
    filtradas.forEach((o) => {
      const t = o.tipo || "sem_tipo";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([tipoLabel, os]) => ({ tipo: tipoLabel, os })).sort((a, b) => b.os - a.os);
  }, [filtradas]);

  const conformidade = useMemo(() => {
    return filtradas.map((o) => ({
      os: o.numero ?? o.id.slice(0, 8),
      status: o.status || "—",
      km_inicio: o.km_inicial != null ? "OK" : "Faltando",
      km_fim: o.km_final != null ? "OK" : "Faltando",
      foto_inicio: o.assinatura_inicio_foto_url ? "OK" : "Faltando",
      foto_fim: o.assinatura_fim_foto_url ? "OK" : "Faltando",
      geo_inicio: o.assinatura_inicio_geo ? "OK" : "Faltando",
      geo_fim: o.assinatura_fim_geo ? "OK" : "Faltando",
    }));
  }, [filtradas]);

  const byRota = useMemo(() => {
    const map: Record<string, number> = {};
    filtradas.forEach((o) => {
      const rota = `${o.origem || "Sem origem"} → ${o.destino || "Sem destino"}`;
      map[rota] = (map[rota] || 0) + 1;
    });
    return Object.entries(map).map(([rota, os]) => ({ rota, os })).sort((a, b) => b.os - a.os);
  }, [filtradas]);

  const currentRows: Array<Record<string, string | number>> =
    viewMode === "cliente"
      ? byCliente
      : viewMode === "contrato"
        ? byContrato
        : viewMode === "data"
          ? byData
          : viewMode === "status"
            ? byStatus
            : viewMode === "tipo"
              ? byTipo
              : viewMode === "conformidade"
                ? conformidade
                : byRota;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios • Ordens de Serviço"
        description="Relatórios dinâmicos por cliente, contrato, data, status, tipo, conformidade e rota."
        actions={
          <button
            type="button"
            onClick={() => currentRows.length && csvDownload(`relatorio-os-${viewMode}.csv`, currentRows)}
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50"
          >
            Exportar CSV
          </button>
        }
      />

      <section className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-5">
        <div>
          <label className="block text-sm mb-1">De</label>
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Até</label>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2">
            <option value="todos">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="em_execucao">Em execução</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2">
            <option value="todos">Todos</option>
            <option value="eventual">Eventual</option>
            <option value="recorrente">Recorrente</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Visão</label>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)} className="w-full border border-slate-300 rounded-md px-3 py-2">
            <option value="cliente">Por cliente</option>
            <option value="contrato">Por contrato</option>
            <option value="data">Por data</option>
            <option value="status">Por status</option>
            <option value="tipo">Por tipo</option>
            <option value="conformidade">Conformidade</option>
            <option value="rota">Por rota</option>
          </select>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4"><div className="text-slate-500 text-sm">OS no período</div><div className="text-2xl font-semibold">{resumo.total}</div></div>
        <div className="bg-white border border-slate-200 rounded-xl p-4"><div className="text-slate-500 text-sm">Concluídas</div><div className="text-2xl font-semibold">{resumo.concluidas}</div></div>
        <div className="bg-white border border-slate-200 rounded-xl p-4"><div className="text-slate-500 text-sm">Taxa de conclusão</div><div className="text-2xl font-semibold">{resumo.taxaConclusao}%</div></div>
        <div className="bg-white border border-slate-200 rounded-xl p-4"><div className="text-slate-500 text-sm">KM total (com km inicial/final)</div><div className="text-2xl font-semibold">{resumo.kmTotal}</div></div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        {loading ? <div className="text-slate-600">Carregando...</div> : null}
        {erro ? <div className="text-rose-700">{erro}</div> : null}

        {!loading && !erro ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  {Object.keys(currentRows[0] ?? { resultado: "Sem dados" }).map((h) => (
                    <th key={h} className="py-2 pr-3 text-left capitalize">{h.replaceAll("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(currentRows.length ? currentRows : [{ resultado: "Sem dados para o filtro atual" }]).map((row, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    {Object.keys(row).map((k) => (
                      <td key={k} className="py-2 pr-3">{String(row[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold mb-2">Amostra detalhada de OS (base operacional)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-3 text-left">OS</th>
                <th className="py-2 pr-3 text-left">Cliente</th>
                <th className="py-2 pr-3 text-left">Contrato</th>
                <th className="py-2 pr-3 text-left">Status</th>
                <th className="py-2 pr-3 text-left">Tipo</th>
                <th className="py-2 pr-3 text-left">Início real</th>
                <th className="py-2 pr-3 text-left">Fim real</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0, 20).map((o) => (
                <tr key={o.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{o.numero ?? o.id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{o.cliente_nome || "—"}</td>
                  <td className="py-2 pr-3">{o.contrato_nome || "—"}</td>
                  <td className="py-2 pr-3">{o.status || "—"}</td>
                  <td className="py-2 pr-3">{o.tipo || "—"}</td>
                  <td className="py-2 pr-3">{toDateInput(o.assinatura_inicio_em)}</td>
                  <td className="py-2 pr-3">{toDateInput(o.assinatura_fim_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
