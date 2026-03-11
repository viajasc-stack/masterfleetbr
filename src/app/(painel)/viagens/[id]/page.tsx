"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Viagem = {
  id: string;
  titulo: string;
  status: string;
  data_ida: string;
  data_retorno: string | null;
  cidade_saida: string | null;
  cidade_destino: string | null;
  valor: number;
  slug_publico: string | null;
};

export default function ViagemDetalhePage() {
  const params = useParams<{ id: string }>();
  const viagemId = params?.id;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [viagem, setViagem] = useState<Viagem | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!viagemId) return;
        const { data, error } = await supabase
          .from("viagens")
          .select("id,titulo,status,data_ida,data_retorno,cidade_saida,cidade_destino,valor,slug_publico")
          .eq("id", viagemId)
          .maybeSingle();

        if (error || !data) {
          setErro(error?.message ?? "Viagem não encontrada");
          setLoading(false);
          return;
        }
        setViagem(data as Viagem);
        setLoading(false);
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [viagemId]);

  if (loading) return <div className="text-slate-600">Carregando viagem...</div>;
  if (erro || !viagem) return <div className="text-red-700">{erro || "Viagem não encontrada"}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{viagem.titulo}</h1>
          <p className="text-sm text-slate-600">{viagem.cidade_saida ?? "—"} → {viagem.cidade_destino ?? "—"}</p>
        </div>
        <Link href="/viagens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">Voltar</Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid gap-3 md:grid-cols-3 text-sm">
        <Info label="Status" value={viagem.status} />
        <Info label="Ida" value={new Date(`${viagem.data_ida}T00:00:00`).toLocaleDateString("pt-BR")} />
        <Info label="Retorno" value={viagem.data_retorno ? new Date(`${viagem.data_retorno}T00:00:00`).toLocaleDateString("pt-BR") : "—"} />
        <Info label="Valor" value={Number(viagem.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Info label="Link público" value={viagem.slug_publico ? `/v/${viagem.slug_publico}` : "Não publicado"} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Gestão da viagem</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/viagens/${viagem.id}/pedidos`} className="px-3 py-2 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm">Pedidos</Link>
          <Link href={`/viagens/${viagem.id}/financeiro`} className="px-3 py-2 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm">Financeiro</Link>
          {viagem.slug_publico ? (
            <Link href={`/v/${viagem.slug_publico}`} target="_blank" className="px-3 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm">Abrir página pública</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-900 mt-1">{value}</div>
    </div>
  );
}
