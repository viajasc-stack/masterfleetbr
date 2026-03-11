"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = {
  id: string;
  codigo_acompanhamento: string;
  status: string;
  comprador_nome: string;
  comprador_cpf: string | null;
  comprador_telefone: string | null;
  comprador_email: string | null;
  quantidade_bilhetes: number;
  valor_total: number;
  created_at: string;
  expires_at: string | null;
};

type Pagamento = {
  id: string;
  status: string;
  gateway: string;
  metodo: string;
  valor: number;
  created_at: string;
};

type Passageiro = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  cidade: string | null;
  status: string;
};

export default function ViagemPedidoDetalhePage() {
  const params = useParams<{ id: string; pedidoId: string }>();
  const viagemId = params?.id;
  const pedidoId = params?.pedidoId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [passageiros, setPassageiros] = useState<Passageiro[]>([]);
  const [obsConfirmacao, setObsConfirmacao] = useState("");

  async function carregar() {
    if (!pedidoId) return;
    setLoading(true);
    setErro("");
    setMsg("");

    const [{ data: p, error: errP }, { data: pays, error: errPay }, { data: pax, error: errPax }] = await Promise.all([
      supabase
        .from("pedidos_viagem")
        .select("id,codigo_acompanhamento,status,comprador_nome,comprador_cpf,comprador_telefone,comprador_email,quantidade_bilhetes,valor_total,created_at,expires_at")
        .eq("id", pedidoId)
        .maybeSingle(),
      supabase
        .from("pagamentos_viagem")
        .select("id,status,gateway,metodo,valor,created_at")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: false }),
      supabase
        .from("passageiros_viagem")
        .select("id,nome,cpf,telefone,cidade,status")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: true }),
    ]);

    if (errP || errPay || errPax) {
      setErro(errP?.message ?? errPay?.message ?? errPax?.message ?? "Erro ao carregar");
      setLoading(false);
      return;
    }

    setPedido((p as Pedido) ?? null);
    setPagamentos((pays ?? []) as Pagamento[]);
    setPassageiros((pax ?? []) as Passageiro[]);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  async function confirmarPagamentoManual() {
    if (!pagamentos[0]?.id) {
      alert("Não há pagamento para confirmar.");
      return;
    }
    setSaving(true);
    setErro("");
    setMsg("");

    const { error } = await supabase.rpc("rpc_viagens_confirmar_pagamento_manual", {
      p_pagamento_id: pagamentos[0].id,
      p_observacao: obsConfirmacao || null,
    });

    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setMsg("Pagamento confirmado manualmente com sucesso.");
    await carregar();
  }

  if (loading) return <div className="text-slate-600">Carregando pedido...</div>;
  if (!pedido) return <div className="text-red-700">Pedido não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pedido {pedido.codigo_acompanhamento}</h1>
          <p className="text-sm text-slate-600">Comprador: {pedido.comprador_nome}</p>
        </div>
        <Link href={`/viagens/${viagemId}/pedidos`} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
          Voltar
        </Link>
      </div>

      {erro ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{erro}</div> : null}
      {msg ? <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-md px-3 py-2">{msg}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid gap-3 md:grid-cols-3 text-sm">
        <Info label="Status pedido" value={pedido.status} />
        <Info label="Bilhetes" value={String(pedido.quantidade_bilhetes)} />
        <Info label="Valor total" value={Number(pedido.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Info label="Telefone" value={pedido.comprador_telefone ?? "—"} />
        <Info label="E-mail" value={pedido.comprador_email ?? "—"} />
        <Info label="Criado em" value={new Date(pedido.created_at).toLocaleString("pt-BR")} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-slate-900">Pagamentos</h2>
        {pagamentos.length === 0 ? (
          <p className="text-sm text-slate-600">Sem pagamentos registrados.</p>
        ) : (
          <div className="space-y-2">
            {pagamentos.map((p) => (
              <div key={p.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm flex items-center justify-between">
                <span>{p.status} • {p.gateway}/{p.metodo}</span>
                <span>{Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-slate-200 space-y-2">
          <label className="block text-sm font-medium">Observação da confirmação manual</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[70px]"
            value={obsConfirmacao}
            onChange={(e) => setObsConfirmacao(e.target.value)}
            placeholder="Ex.: confirmado via PIX presencial"
          />
          <button
            type="button"
            onClick={confirmarPagamentoManual}
            disabled={saving || pagamentos.length === 0}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-60 text-sm"
          >
            {saving ? "Confirmando..." : "Confirmar pagamento manual"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Passageiros</h2>
        {passageiros.length === 0 ? (
          <p className="text-sm text-slate-600">Sem passageiros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">CPF</th>
                  <th className="py-2 pr-4">Telefone</th>
                  <th className="py-2 pr-4">Cidade</th>
                  <th className="py-2 pr-0">Status</th>
                </tr>
              </thead>
              <tbody>
                {passageiros.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{p.nome}</td>
                    <td className="py-2 pr-4">{p.cpf ?? "—"}</td>
                    <td className="py-2 pr-4">{p.telefone ?? "—"}</td>
                    <td className="py-2 pr-4">{p.cidade ?? "—"}</td>
                    <td className="py-2 pr-0">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
