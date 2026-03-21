"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type TelemetriaEvento = {
  id: string;
  tipo: string;
  severidade: string;
  velocidade_kmh: number | null;
  ocorrido_em: string;
  veiculos: { placa: string | null; prefixo: string | null }[] | null;
  motoristas: { nome: string | null }[] | null;
};

export default function TelemetriaPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState<TelemetriaEvento[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const { data, error } = await supabase
          .from("telemetria_eventos")
          .select("id, tipo, severidade, velocidade_kmh, ocorrido_em, veiculos(placa,prefixo), motoristas(nome)")
          .order("ocorrido_em", { ascending: false })
          .limit(100);
        if (error) throw error;
        setEventos((data ?? []) as TelemetriaEvento[]);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao carregar telemetria.");
      } finally {
        setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const cards = useMemo(() => {
    return {
      total: eventos.length,
      criticos: eventos.filter((e) => e.severidade === "critical").length,
      alertasVelocidade: eventos.filter((e) => e.tipo === "excesso_velocidade").length,
    };
  }, [eventos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemetria"
        description="Eventos operacionais de rastreamento, velocidade e desvios em tempo quase real."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Eventos</div><div className="text-xl font-semibold">{cards.total}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Críticos</div><div className="text-xl font-semibold">{cards.criticos}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Excesso de velocidade</div><div className="text-xl font-semibold">{cards.alertasVelocidade}</div></div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2 pr-3">Quando</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Severidade</th>
                  <th className="py-2 pr-3">Veículo</th>
                  <th className="py-2 pr-3">Motorista</th>
                  <th className="py-2 pr-3">Velocidade</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{new Date(e.ocorrido_em).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-3">{e.tipo}</td>
                    <td className="py-2 pr-3">{e.severidade}</td>
                    <td className="py-2 pr-3">{e.veiculos?.[0]?.placa ?? e.veiculos?.[0]?.prefixo ?? "-"}</td>
                    <td className="py-2 pr-3">{e.motoristas?.[0]?.nome ?? "-"}</td>
                    <td className="py-2 pr-3">{e.velocidade_kmh ? `${Number(e.velocidade_kmh).toFixed(1)} km/h` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
