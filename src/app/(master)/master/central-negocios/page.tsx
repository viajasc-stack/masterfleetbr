"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Totais = {
  anuncios_ativos: number;
  denuncias_abertas: number;
  aguardando_confirmacao: number;
};

export default function MasterCentralNegociosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [totais, setTotais] = useState<Totais>({
    anuncios_ativos: 0,
    denuncias_abertas: 0,
    aguardando_confirmacao: 0,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      const [ativos, denuncias, confirmacao] = await Promise.all([
        supabase.from("negocio_anuncios").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("negocio_denuncias").select("id", { count: "exact", head: true }).eq("status", "aberta"),
        supabase
          .from("negocio_anuncios")
          .select("id", { count: "exact", head: true })
          .eq("status", "aguardando_confirmacao"),
      ]);

      if (ativos.error || denuncias.error || confirmacao.error) {
        setErro(ativos.error?.message || denuncias.error?.message || confirmacao.error?.message || "Erro ao carregar.");
      } else {
        setTotais({
          anuncios_ativos: ativos.count ?? 0,
          denuncias_abertas: denuncias.count ?? 0,
          aguardando_confirmacao: confirmacao.count ?? 0,
        });
      }

      setLoading(false);
    }

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Central de Negócios (Master)</h1>
        <p className="text-sm text-slate-600 mt-1">Moderação, catálogo e governança do módulo.</p>
      </div>

      <div className="flex gap-2">
        <Link href="/master/central-negocios/categorias" className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">Categorias</Link>
        <Link href="/master/central-negocios/denuncias" className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">Denúncias</Link>
      </div>

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs text-emerald-700">Anúncios ativos</div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">{totais.anuncios_ativos}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-xs text-amber-700">Aguardando confirmação</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{totais.aguardando_confirmacao}</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
            <div className="text-xs text-rose-700">Denúncias abertas</div>
            <div className="text-2xl font-bold text-rose-900 mt-1">{totais.denuncias_abertas}</div>
          </div>
        </div>
      )}
    </div>
  );
}
