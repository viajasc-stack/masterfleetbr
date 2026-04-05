"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAnuncio } from "@/components/central-negocios/FormAnuncio";
import {
  criarAnuncio,
  listarCategorias,
  listarSubcategorias,
  type NegocioCategoria,
  type NegocioSubcategoria,
} from "@/lib/centralNegocios";

export default function NovoAnuncioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<NegocioCategoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<NegocioSubcategoria[]>([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [cats, subs] = await Promise.all([listarCategorias(), listarSubcategorias()]);
        setCategorias(cats);
        setSubcategorias(subs);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar formulário.");
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Novo anúncio" description="Publique uma oportunidade na Central de Negócios." />

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}

      <FormAnuncio
        categorias={categorias}
        subcategorias={subcategorias}
        loading={loading}
        onSubmit={async (payload) => {
          try {
            setLoading(true);
            setErro("");
            const id = await criarAnuncio(payload);
            router.push(`/central-negocios/${id}`);
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao salvar anúncio.");
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
