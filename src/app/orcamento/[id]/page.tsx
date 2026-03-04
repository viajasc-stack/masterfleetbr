"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

type OrcamentoShare = {
  id: string;
  nome: string | null;
  descricao: string | null;
  tipo: string | null;
  valor_centavos: number | null;
  status: string | null;
  inicio_em: string | null;
  retorno_em: string | null;
  local_saida: string | null;
  local_chegada: string | null;
  cliente_nome: string | null;
  veiculo_placa: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_imagem_url: string | null;
};

function fmtDt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

function fmtMoney(v: number | null) {
  const n = typeof v === "number" ? v / 100 : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OrcamentoSharePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();

  const id = params?.id;
  const codigo = search.get("codigo") || "";

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string>("");
  const [orcamento, setOrcamento] = useState<OrcamentoShare | null>(null);
  const [respondendo, setRespondendo] = useState(false);

  function statusLabel(status: string | null) {
    if (!status) return "—";
    if (status === "criado") return "Criado";
    if (status === "enviado") return "Enviado";
    if (status === "aguardando_resposta") return "Aguardando resposta";
    if (status === "aprovado") return "Aprovado";
    if (status === "negado") return "Negado";
    return status;
  }

  async function responder(status: "aprovado" | "negado") {
    if (!id || !codigo) return;
    setRespondendo(true);
    const { data, error } = await supabase.rpc("public_respond_orcamento", {
      p_orcamento_id: id,
      p_codigo_acesso: codigo,
      p_status: status,
    });
    setRespondendo(false);

    if (error || !data) {
      alert("Não foi possível registrar sua resposta.");
      return;
    }

    setOrcamento((prev) => (prev ? { ...prev, status } : prev));
    alert(status === "aprovado" ? "Orçamento aprovado com sucesso." : "Orçamento recusado com sucesso.");
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (!id || !codigo) {
          setErro("Link inválido. Verifique o código de acesso.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.rpc("public_get_orcamento_share", {
          p_orcamento_id: id,
          p_codigo_acesso: codigo,
        });

        if (error) {
          setErro("Não foi possível carregar o orçamento.");
          setLoading(false);
          return;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          setErro("Orçamento não encontrado ou código inválido.");
          setLoading(false);
          return;
        }

        setOrcamento(row as OrcamentoShare);

        await supabase.rpc("public_mark_orcamento_opened", {
          p_orcamento_id: id,
          p_codigo_acesso: codigo,
        });

        setLoading(false);
      })();
    }, 0);

    return () => clearTimeout(t);
  }, [id, codigo]);

  const titulo = useMemo(() => {
    if (!orcamento?.nome) return "Orçamento";
    return orcamento.nome;
  }, [orcamento]);

  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-8">Carregando orçamento...</div>;
  }

  if (erro || !orcamento) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold">Orçamento</h1>
          <p className="text-slate-600 mt-2">{erro || "Não encontrado."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          <p className="text-slate-600 mt-1">Orçamento para: <span className="font-medium text-slate-800">{orcamento.cliente_nome ?? "Cliente"}</span></p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Tipo:</span> <span className="font-medium">{orcamento.tipo ?? "—"}</span></div>
            <div><span className="text-slate-500">Status:</span> <span className="font-medium">{statusLabel(orcamento.status)}</span></div>
            <div><span className="text-slate-500">Início:</span> <span className="font-medium">{fmtDt(orcamento.inicio_em)}</span></div>
            <div><span className="text-slate-500">Retorno:</span> <span className="font-medium">{fmtDt(orcamento.retorno_em)}</span></div>
            <div><span className="text-slate-500">Local de saída:</span> <span className="font-medium">{orcamento.local_saida ?? "—"}</span></div>
            <div><span className="text-slate-500">Local de chegada:</span> <span className="font-medium">{orcamento.local_chegada ?? "—"}</span></div>
            <div><span className="text-slate-500">Veículo:</span> <span className="font-medium">{orcamento.veiculo_placa ?? "—"} {orcamento.veiculo_marca || orcamento.veiculo_modelo ? `— ${[orcamento.veiculo_marca, orcamento.veiculo_modelo].filter(Boolean).join(" ")}` : ""}</span></div>
            <div><span className="text-slate-500">Valor:</span> <span className="font-semibold text-lg text-green-700">{fmtMoney(orcamento.valor_centavos)}</span></div>
          </div>

          {orcamento.veiculo_imagem_url ? (
            <div>
              <div className="text-sm text-slate-500 mb-2">Imagem do veículo</div>
              <div className="relative w-full h-[320px] rounded-lg overflow-hidden border border-slate-200">
                <Image
                  src={orcamento.veiculo_imagem_url}
                  alt="Veículo"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1024px"
                  unoptimized
                />
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-sm text-slate-500 mb-2">Descrição detalhada</div>
            <div className="text-slate-800 whitespace-pre-wrap">{orcamento.descricao ?? "—"}</div>
          </div>

          {(orcamento.status === "criado" || orcamento.status === "enviado" || orcamento.status === "aguardando_resposta") ? (
            <div className="pt-2 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => responder("aprovado")}
                disabled={respondendo}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm"
              >
                {respondendo ? "Enviando..." : "Aprovar orçamento"}
              </button>
              <button
                type="button"
                onClick={() => responder("negado")}
                disabled={respondendo}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm"
              >
                {respondendo ? "Enviando..." : "Recusar orçamento"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
