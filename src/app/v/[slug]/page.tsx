"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type ViagemPublica = {
  id: string;
  titulo: string;
  categoria: string;
  status: string;
  data_ida: string;
  hora_saida: string | null;
  data_retorno: string | null;
  hora_retorno_prevista: string | null;
  prazo_final_venda_online: string | null;
  cidade_saida: string | null;
  local_embarque: string | null;
  cidade_destino: string | null;
  valor: number;
  valor_promocional: number | null;
  descricao_curta: string | null;
  descricao_completa: string | null;
  inclui: string | null;
  nao_inclui: string | null;
  observacoes: string | null;
  documentos_obrigatorios: string | null;
  politica_cancelamento: string | null;
  imagem_principal_url: string | null;
  banner_url: string | null;
  slug_publico: string;
  vagas_disponiveis_texto: string;
  venda_online_aberta: boolean;
};

function fmtData(data: string | null, hora?: string | null) {
  if (!data) return "—";
  const d = new Date(`${data}T00:00:00`);
  const base = d.toLocaleDateString("pt-BR");
  if (!hora) return base;
  return `${base} às ${String(hora).slice(0, 5)}`;
}

export default function ViagemPublicaPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [viagem, setViagem] = useState<ViagemPublica | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!slug) {
          setErro("Link inválido.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.rpc("public_get_viagem_by_slug", {
          p_slug: slug,
        });

        if (error) {
          setErro("Não foi possível carregar a viagem.");
          setLoading(false);
          return;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          setErro("Viagem não encontrada ou não publicada.");
          setLoading(false);
          return;
        }

        setViagem(row as ViagemPublica);
        setLoading(false);
      })();
    }, 0);

    return () => clearTimeout(id);
  }, [slug]);

  const valorExibicao = useMemo(() => {
    if (!viagem) return "—";
    const v = viagem.valor_promocional ?? viagem.valor;
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [viagem]);

  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-6 text-slate-700">Carregando viagem...</div>;
  }

  if (erro || !viagem) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold text-slate-900">Viagem</h1>
          <p className="mt-2 text-slate-600">{erro || "Não encontrada."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <section className="max-w-5xl mx-auto p-4 md:p-8 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {viagem.banner_url || viagem.imagem_principal_url ? (
            <div className="h-52 md:h-72 bg-slate-200" style={{ backgroundImage: `url(${viagem.banner_url ?? viagem.imagem_principal_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          ) : null}

          <div className="p-6">
            <div className="text-xs uppercase tracking-wider text-slate-500">{viagem.categoria}</div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{viagem.titulo}</h1>
            {viagem.descricao_curta ? <p className="text-slate-600 mt-3">{viagem.descricao_curta}</p> : null}

            <div className="mt-5 grid md:grid-cols-3 gap-3 text-sm">
              <Info label="Ida" value={fmtData(viagem.data_ida, viagem.hora_saida)} />
              <Info label="Retorno" value={fmtData(viagem.data_retorno, viagem.hora_retorno_prevista)} />
              <Info label="Preço" value={valorExibicao} strong />
              <Info label="Saída" value={viagem.cidade_saida ?? "—"} />
              <Info label="Destino" value={viagem.cidade_destino ?? "—"} />
              <Info label="Vagas" value={viagem.vagas_disponiveis_texto} />
              <Info label="Local de embarque" value={viagem.local_embarque ?? "—"} />
              <Info
                label="Vendas até"
                value={viagem.prazo_final_venda_online ? new Date(viagem.prazo_final_venda_online).toLocaleString("pt-BR") : "Sem prazo definido"}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                disabled={!viagem.venda_online_aberta}
                onClick={() => router.push(`/v/${viagem.slug_publico}/checkout`)}
              >
                {viagem.venda_online_aberta ? "Comprar agora" : "Vendas indisponíveis"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Olá! Quero informações sobre a viagem ${viagem.titulo}`)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
              >
                Falar no WhatsApp
              </a>
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    alert("Link copiado!");
                  } catch {
                    alert("Não foi possível copiar o link.");
                  }
                }}
              >
                Compartilhar
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          {viagem.descricao_completa ? <Bloco titulo="Descrição" texto={viagem.descricao_completa} /> : null}
          {viagem.inclui ? <Bloco titulo="O que está incluso" texto={viagem.inclui} /> : null}
          {viagem.nao_inclui ? <Bloco titulo="O que não está incluso" texto={viagem.nao_inclui} /> : null}
          {viagem.documentos_obrigatorios ? <Bloco titulo="Documentos obrigatórios" texto={viagem.documentos_obrigatorios} /> : null}
          {viagem.politica_cancelamento ? <Bloco titulo="Política de cancelamento" texto={viagem.politica_cancelamento} /> : null}
          {viagem.observacoes ? <Bloco titulo="Observações" texto={viagem.observacoes} /> : null}
        </div>

        <div className="text-center text-xs text-slate-500 py-2">
          Página pública da viagem • MasterFleetBR
          <div className="mt-1">
            <Link href="/" className="hover:underline">masterfleetbr.com</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-slate-900 ${strong ? "font-semibold" : ""}`}>{value}</div>
    </div>
  );
}

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900 mb-1">{titulo}</h2>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{texto}</p>
    </div>
  );
}
