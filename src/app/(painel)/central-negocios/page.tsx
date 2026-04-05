"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { CardAnuncio } from "@/components/central-negocios/CardAnuncio";
import { FiltroAnuncios, type FiltroAnunciosState } from "@/components/central-negocios/FiltroAnuncios";
import { supabase } from "@/lib/supabase/client";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import {
  listarAnuncios,
  listarCategorias,
  toggleFavorito,
  type NegocioAnuncioListItem,
  type NegocioCategoria,
} from "@/lib/centralNegocios";

type ModuloCatalogo = {
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number | null;
  ativo: boolean;
  ordem: number | null;
  metadata: Record<string, unknown> | null;
};

const MODULO_HREF_MAP: Record<string, string> = {
  operacional: "/dashboard",
  orcamentos: "/orcamentos",
  inventario: "/inventario",
  financeiro: "/financeiro",
  manutencao: "/manutencao",
  oficina: "/oficina",
  agenda: "/agenda",
  viagens: "/viagens",
  relatorios: "/relatorios",
};

const MODULO_ACCESS_MAP: Record<string, string> = {
  orcamentos: "operacional",
};

export default function CentralNegociosPage() {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<NegocioCategoria[]>([]);
  const [anuncios, setAnuncios] = useState<NegocioAnuncioListItem[]>([]);
  const [erro, setErro] = useState("");
  const [canUseAllModules, setCanUseAllModules] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [modulosCatalogo, setModulosCatalogo] = useState<ModuloCatalogo[]>([]);
  const [filtro, setFiltro] = useState<FiltroAnunciosState>({
    busca: "",
    tipo: "",
    categoriaId: "",
    estado: "",
    cidade: "",
  });

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const [cats, list] = await Promise.all([
        listarCategorias(),
        listarAnuncios({
          busca: filtro.busca,
          tipo: filtro.tipo,
          categoriaId: filtro.categoriaId || undefined,
          estado: filtro.estado || undefined,
          cidade: filtro.cidade || undefined,
          somenteMeus: false,
        }),
      ]);

      const { data: modulosData, error: modulosError } = await supabase
        .from("modulos_globais")
        .select("codigo, nome, descricao, preco_centavos, ativo, ordem, metadata")
        .not("codigo", "in", "(dashboard,ordens_servico,clientes,veiculos,motoristas)")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");

      if (modulosError) throw new Error(modulosError.message);

      setCategorias(cats);
      setAnuncios(list);
      setModulosCatalogo((modulosData ?? []) as ModuloCatalogo[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar anúncios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro.busca, filtro.tipo, filtro.categoriaId, filtro.estado, filtro.cidade]);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        const access = await loadEmpresaModuleAccess();
        setCanUseAllModules(access.canUseAllModules);
        setAllowedModules(access.allowedModules ?? []);
      })();
    }, 0);

    return () => clearTimeout(t);
  }, []);

  function moduloAtivo(moduloCodigo: string) {
    const accessModulo = MODULO_ACCESS_MAP[moduloCodigo] ?? moduloCodigo;
    return canUseAllModules || allowedModules.includes(accessModulo);
  }

  function moduloHref(moduloCodigo: string) {
    return MODULO_HREF_MAP[moduloCodigo] ?? `/configuracoes/meu-plano?modulo=${moduloCodigo}`;
  }

  async function handleFavorito(id: string) {
    try {
      await toggleFavorito(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao favoritar.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Negócios"
        description="Classificados internos entre empresas assinantes."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Link href="/central-negocios/novo" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500">Novo anúncio</Link>
            <Link href="/central-negocios/meus-anuncios" className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">Meus anúncios</Link>
            <Link href="/central-negocios/favoritos" className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">Favoritos</Link>
          </div>
        )}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Módulos da plataforma</div>
        <p className="text-xs text-slate-500 mt-1">Vitrine de módulos com imagem, valor e acesso contextual por empresa.</p>

        <div className="mt-3 overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-1">
            {modulosCatalogo.map((m) => {
              const ativo = moduloAtivo(m.codigo);
              const imagemUrl = String((m.metadata?.imagem_url as string | undefined) ?? "");
              return (
                <div key={m.codigo} className="w-64 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="h-32 w-full rounded-md border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                    {imagemUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagemUrl} alt={`Imagem do módulo ${m.nome}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-xs text-slate-400">Sem imagem</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">{m.nome}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${ativo ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {ativo ? "Ativo" : "Disponível"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 min-h-9">{m.descricao || "Módulo pronto para ampliar os recursos da sua operação."}</p>
                  <div className="text-sm font-semibold text-slate-900">
                    {(Number(m.preco_centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    <span className="text-xs font-normal text-slate-500">/mês</span>
                  </div>

                  {ativo ? (
                    <Link href={moduloHref(m.codigo)} className="inline-flex px-3 py-1.5 rounded-md border border-slate-300 text-xs hover:bg-white">
                      Acessar
                    </Link>
                  ) : (
                    <Link href={`/configuracoes/meu-plano?modulo=${m.codigo}`} className="inline-flex px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-500">
                      Saber mais
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <FiltroAnuncios value={filtro} categorias={categorias} onChange={setFiltro} />

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando anúncios...</div>
      ) : anuncios.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Nenhum anúncio encontrado.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {anuncios.map((a) => (
            <CardAnuncio key={a.id} anuncio={a} onToggleFavorito={handleFavorito} />
          ))}
        </div>
      )}
    </div>
  );
}
