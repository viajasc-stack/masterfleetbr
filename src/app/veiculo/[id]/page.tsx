"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

type VeiculoShare = {
  id: string;
  placa: string | null;
  prefixo: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  capacidade_passageiros: number | null;
  combustivel: string | null;
  arla32: boolean | null;
  km_atual: number | null;
  status: string | null;
  imagem_url: string | null;
  galeria_urls: string[] | null;
  observacoes: string | null;
  descricao_compartilhamento: string | null;
};

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string | null | undefined) {
  if (status === "ativo") return "text-emerald-300 border-emerald-400/40 bg-emerald-500/10";
  if (status === "manutencao") return "text-amber-200 border-amber-400/40 bg-amber-500/10";
  return "text-slate-200 border-slate-500/40 bg-slate-700/30";
}

export default function VeiculoSharePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id;
  const codigo = search.get("codigo") || "";

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [veiculo, setVeiculo] = useState<VeiculoShare | null>(null);
  const [galeriaIndex, setGaleriaIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (!id || !codigo) {
          setErro("Link inválido. Verifique o código de acesso.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.rpc("public_get_veiculo_share", {
          p_veiculo_id: id,
          p_codigo_acesso: codigo,
        });

        if (error) {
          setErro("Não foi possível carregar os dados do veículo.");
          setLoading(false);
          return;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          setErro("Veículo não encontrado ou código inválido.");
          setLoading(false);
          return;
        }

        setVeiculo(row as VeiculoShare);
        setLoading(false);
      })();
    }, 0);

    return () => clearTimeout(t);
  }, [id, codigo]);

  const tituloVeiculo = useMemo(() => {
    if (!veiculo) return "Veículo premium";
    return [veiculo.marca, veiculo.modelo].filter(Boolean).join(" ") || "Veículo premium";
  }, [veiculo]);

  const mensagemInteresse = useMemo(() => {
    if (!veiculo) return "Olá! Tenho interesse neste veículo.";
    return `Olá! Tenho interesse no veículo ${veiculo.placa ?? ""} (${tituloVeiculo}). Pode me enviar as condições?`;
  }, [veiculo, tituloVeiculo]);

  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(mensagemInteresse)}`;
  const emailLink = `mailto:comercial@masterfleetbr.com?subject=${encodeURIComponent(
    `Interesse no veículo ${veiculo?.placa ?? ""}`
  )}&body=${encodeURIComponent(mensagemInteresse)}`;

  const galeriaPublica = [
    veiculo?.imagem_url,
    ...(Array.isArray(veiculo?.galeria_urls) ? veiculo.galeria_urls : []),
  ].filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i);

  function abrirLightbox(idx: number) {
    setGaleriaIndex(idx);
    setLightboxOpen(true);
  }

  function navegarGaleria(direcao: "prev" | "next") {
    if (galeriaPublica.length === 0) return;
    setGaleriaIndex((atual) => {
      if (direcao === "prev") {
        return (atual - 1 + galeriaPublica.length) % galeriaPublica.length;
      }
      return (atual + 1) % galeriaPublica.length;
    });
  }

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setLightboxOpen(false);
      if (ev.key === "ArrowLeft") navegarGaleria("prev");
      if (ev.key === "ArrowRight") navegarGaleria("next");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, galeriaPublica.length]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white p-8">Carregando veículo...</div>;
  }

  if (erro || !veiculo) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-3xl mx-auto rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h1 className="text-xl font-semibold">Veículo</h1>
          <p className="text-slate-300 mt-2">{erro || "Não encontrado."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center text-xs md:text-sm text-emerald-200">
          Oferta exclusiva • Atendimento rápido • Condições personalizadas para sua operação
        </div>

        <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 md:p-8">
          <div className="grid lg:grid-cols-5 gap-6 items-center">
            <div className="lg:col-span-3 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-emerald-300 border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 rounded-full">
                🚀 Veículo em destaque
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{tituloVeiculo}</h1>
              <p className="text-slate-300 text-base md:text-lg">
                {veiculo.placa ? `Placa ${veiculo.placa} • ` : ""}apresentação profissional com foco em conforto, performance e segurança.
              </p>
              <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-semibold w-fit ${statusTone(veiculo.status)}`}>
                Status: {formatLabel(veiculo.status)}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
              <div className="text-sm text-slate-300">Gostou deste veículo?</div>
              <h2 className="text-xl font-bold">Fale agora com o comercial</h2>
              <p className="text-sm text-slate-400">Receba mais detalhes, fotos extras e condições personalizadas.</p>
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="block w-full text-center rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 font-semibold transition">
                Chamar no WhatsApp
              </a>
              <a href={emailLink} className="block w-full text-center rounded-lg border border-slate-600 hover:bg-slate-800 px-4 py-2.5 font-semibold text-slate-200 transition">
                Solicitar proposta por e-mail
              </a>
            </div>
          </div>
        </section>

        <section id="detalhes" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6">
          {galeriaPublica.length > 0 ? (
            <button
              type="button"
              onClick={() => abrirLightbox(0)}
              className="relative w-full h-[260px] md:h-[460px] rounded-xl overflow-hidden border border-slate-700 block"
            >
              <Image src={galeriaPublica[0]} alt="Veículo" fill className="object-cover" sizes="(max-width: 768px) 100vw, 1200px" unoptimized />
            </button>
          ) : null}

          {galeriaPublica.length > 1 ? (
            <div className="overflow-x-auto">
              <div className="flex gap-3">
                {galeriaPublica.map((url, idx) => (
                  <button
                    type="button"
                    key={`${url}-${idx}`}
                    onClick={() => abrirLightbox(idx)}
                    className="relative h-24 w-36 shrink-0 rounded-lg overflow-hidden border border-slate-700"
                    title="Abrir galeria"
                  >
                    <Image src={url} alt={`Galeria ${idx + 1}`} fill className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 md:p-5">
            <div className="text-sm text-emerald-300 mb-2 font-semibold uppercase tracking-wide">Descrição comercial</div>
            <div className="text-slate-100 whitespace-pre-wrap leading-relaxed text-base">{veiculo.descricao_compartilhamento ?? "—"}</div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><span className="text-slate-400">Prefixo:</span> <span className="font-medium">{veiculo.prefixo ?? "—"}</span></div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><span className="text-slate-400">Tipo:</span> <span className="font-medium">{formatLabel(veiculo.tipo)}</span></div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><span className="text-slate-400">Cor:</span> <span className="font-medium">{veiculo.cor ?? "—"}</span></div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><span className="text-slate-400">Capacidade:</span> <span className="font-medium">{veiculo.capacidade_passageiros != null ? `${veiculo.capacidade_passageiros} pax` : "—"}</span></div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent p-6 md:p-8 text-center space-y-4">
          <h3 className="text-2xl md:text-3xl font-bold">Pronto para avançar com este veículo?</h3>
          <p className="text-slate-300 max-w-2xl mx-auto">Clique no botão e fale com nosso time comercial agora mesmo para receber atendimento prioritário.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-3 font-semibold transition">
              Quero este veículo
            </a>
            <a href={emailLink} className="inline-flex items-center justify-center rounded-lg border border-slate-600 hover:bg-slate-800 px-6 py-3 font-semibold text-slate-200 transition">
              Receber proposta completa
            </a>
          </div>
        </section>

        <div className="text-center text-xs text-slate-500 py-2">MasterFleetBR • Landing de apresentação e conversão de veículos</div>
      </div>

      {lightboxOpen && galeriaPublica.length > 0 ? (
        <div className="fixed inset-0 z-50 bg-black/90 p-3 md:p-8 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
          <button
            type="button"
            className="absolute top-4 right-4 text-white/90 hover:text-white text-2xl"
            onClick={() => setLightboxOpen(false)}
            aria-label="Fechar galeria"
          >
            ×
          </button>

          {galeriaPublica.length > 1 ? (
            <button
              type="button"
              className="absolute left-3 md:left-6 h-11 w-11 rounded-full border border-white/30 text-white text-xl hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                navegarGaleria("prev");
              }}
              aria-label="Imagem anterior"
            >
              ‹
            </button>
          ) : null}

          <div className="relative w-full max-w-5xl h-[70vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={galeriaPublica[galeriaIndex]}
              alt={`Imagem ${galeriaIndex + 1}`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>

          {galeriaPublica.length > 1 ? (
            <button
              type="button"
              className="absolute right-3 md:right-6 h-11 w-11 rounded-full border border-white/30 text-white text-xl hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                navegarGaleria("next");
              }}
              aria-label="Próxima imagem"
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
