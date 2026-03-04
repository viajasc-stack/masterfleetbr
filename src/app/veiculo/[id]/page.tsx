"use client";

import { useEffect, useState } from "react";
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
  observacoes: string | null;
};

export default function VeiculoSharePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id;
  const codigo = search.get("codigo") || "";

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [veiculo, setVeiculo] = useState<VeiculoShare | null>(null);

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

  if (loading) return <div className="min-h-screen bg-slate-100 p-8">Carregando veículo...</div>;

  if (erro || !veiculo) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold">Veículo</h1>
          <p className="text-slate-600 mt-2">{erro || "Não encontrado."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-2xl font-semibold">{veiculo.placa ?? "Veículo"}</h1>
          <p className="text-slate-600 mt-1">
            {[veiculo.marca, veiculo.modelo].filter(Boolean).join(" ") || "Detalhes do veículo"}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {veiculo.imagem_url ? (
            <div className="relative w-full h-[320px] rounded-lg overflow-hidden border border-slate-200">
              <Image
                src={veiculo.imagem_url}
                alt="Veículo"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1024px"
                unoptimized
              />
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Prefixo:</span> <span className="font-medium">{veiculo.prefixo ?? "—"}</span></div>
            <div><span className="text-slate-500">Tipo:</span> <span className="font-medium">{veiculo.tipo ?? "—"}</span></div>
            <div><span className="text-slate-500">Ano fabricação:</span> <span className="font-medium">{veiculo.ano_fabricacao ?? "—"}</span></div>
            <div><span className="text-slate-500">Ano modelo:</span> <span className="font-medium">{veiculo.ano_modelo ?? "—"}</span></div>
            <div><span className="text-slate-500">Cor:</span> <span className="font-medium">{veiculo.cor ?? "—"}</span></div>
            <div><span className="text-slate-500">Capacidade:</span> <span className="font-medium">{veiculo.capacidade_passageiros != null ? `${veiculo.capacidade_passageiros} pax` : "—"}</span></div>
            <div><span className="text-slate-500">Combustível:</span> <span className="font-medium">{veiculo.combustivel ?? "—"}</span></div>
            <div><span className="text-slate-500">ARLA 32:</span> <span className="font-medium">{veiculo.arla32 ? "Sim" : "Não"}</span></div>
            <div><span className="text-slate-500">KM atual:</span> <span className="font-medium">{veiculo.km_atual ?? "—"}</span></div>
            <div><span className="text-slate-500">Status:</span> <span className="font-medium">{veiculo.status ?? "—"}</span></div>
          </div>

          <div>
            <div className="text-sm text-slate-500 mb-2">Observações</div>
            <div className="text-slate-800 whitespace-pre-wrap">{veiculo.observacoes ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
