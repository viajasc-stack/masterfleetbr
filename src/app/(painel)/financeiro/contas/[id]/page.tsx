"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { financeiroErrorMessage } from "@/lib/financeiro";
import { supabase } from "@/lib/supabase/client";
import { logError, logInfo } from "@/lib/observability";

type Conta = {
  id: string;
  descricao: string;
  tipo: "pagar" | "receber";
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  categoria: string | null;
  observacoes: string | null;
  created_at: string;
};

export default function DetalheContaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conta, setConta] = useState<Conta | null>(null);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState(false);
  const [dataPag, setDataPag] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;

      setErro("");
      try {
        const { data, error } = await supabase.from("contas_financeiras").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) {
          router.replace("/financeiro/contas");
          return;
        }

        setConta(data as Conta);
      } catch (e) {
        logError("financeiro.contas_detalhe", "Falha ao carregar conta", e, { conta_id: id });
        setErro(financeiroErrorMessage(e, "Falha ao carregar conta."));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  async function marcarPago() {
    if (!conta) return;
    if (!dataPag) {
      setErro("Informe a data de liquidação.");
      return;
    }

    setErro("");
    setOkMsg("");
    setAcao(true);
    const novoStatus = conta.tipo === "pagar" ? "pago" : "recebido";
    const { error } = await supabase.from("contas_financeiras").update({ status: novoStatus, data_pagamento: dataPag }).eq("id", id);
    if (error) {
      logError("financeiro.contas_detalhe", "Falha ao registrar liquidação", error, {
        conta_id: id,
        novo_status: novoStatus,
      });
      setErro(financeiroErrorMessage(error, "Falha ao atualizar conta."));
      setAcao(false);
      return;
    }
    logInfo("financeiro.contas_detalhe", "Liquidação registrada", {
      conta_id: id,
      novo_status: novoStatus,
      data_pagamento: dataPag,
    });
    setConta((prev) => prev ? { ...prev, status: novoStatus, data_pagamento: dataPag } : prev);
    setOkMsg(conta.tipo === "pagar" ? "Pagamento registrado com sucesso." : "Recebimento registrado com sucesso.");
    setAcao(false);
  }

  async function cancelar() {
    if (!conta) return;
    setErro("");
    setOkMsg("");
    setAcao(true);
    const { error } = await supabase.from("contas_financeiras").update({ status: "cancelado" }).eq("id", id);
    if (error) {
      logError("financeiro.contas_detalhe", "Falha ao cancelar conta", error, { conta_id: id });
      setErro(financeiroErrorMessage(error, "Falha ao cancelar conta."));
      setAcao(false);
      return;
    }
    logInfo("financeiro.contas_detalhe", "Conta cancelada", { conta_id: id });
    setConta((prev) => prev ? { ...prev, status: "cancelado" } : prev);
    setOkMsg("Conta cancelada com sucesso.");
    setCancelOpen(false);
    setAcao(false);
  }

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;
  if (!conta) return null;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hoje = new Date().toISOString().slice(0, 10);
  const vencida = conta.status === "pendente" && conta.data_vencimento < hoje;

  return (
    <div className="max-w-xl space-y-6">
      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {okMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</div> : null}

      <div className="flex items-center gap-3">
        <Link href="/financeiro/contas" className="text-sm text-slate-500 hover:text-slate-800">← Contas</Link>
        <h1 className="text-xl font-semibold text-slate-900">{conta.descricao}</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-slate-500">Tipo</span>
            <div>
              <span className={`text-xs px-2 py-1 rounded border ${conta.tipo === "pagar" ? "border-red-200 text-red-700 bg-red-50" : "border-green-200 text-green-700 bg-green-50"}`}>
                {conta.tipo === "pagar" ? "A Pagar" : "A Receber"}
              </span>
            </div>
          </div>
          <div>
            <span className="text-slate-500">Status</span>
            <div>
              <span className={`text-xs px-2 py-1 rounded border ${
                conta.status === "pago" || conta.status === "recebido" ? "border-green-200 text-green-700 bg-green-50"
                : conta.status === "cancelado" ? "border-slate-200 text-slate-500 bg-slate-50"
                : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                {conta.status}
              </span>
            </div>
          </div>
          <div>
            <span className="text-slate-500">Valor</span>
            <div className={`font-bold text-lg ${conta.tipo === "pagar" ? "text-red-600" : "text-green-600"}`}>{fmt(conta.valor)}</div>
          </div>
          <div>
            <span className="text-slate-500">Vencimento</span>
            <div className={`font-medium ${vencida ? "text-red-600" : ""}`}>
              {new Date(conta.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
              {vencida && " ⚠ Vencida"}
            </div>
          </div>
          {conta.data_pagamento && (
            <div>
              <span className="text-slate-500">Pago em</span>
              <div className="font-medium">{new Date(conta.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}</div>
            </div>
          )}
          {conta.categoria && (
            <div>
              <span className="text-slate-500">Categoria</span>
              <div>{conta.categoria}</div>
            </div>
          )}
        </div>
        {conta.observacoes && (
          <div>
            <span className="text-slate-500">Observações</span>
            <div>{conta.observacoes}</div>
          </div>
        )}
      </div>

      {conta.status === "pendente" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
          <h2 className="font-semibold text-slate-900">Registrar {conta.tipo === "pagar" ? "pagamento" : "recebimento"}</h2>
          <div>
            <label className="block font-medium mb-1">Data</label>
            <input type="date" className="border border-slate-300 rounded-md px-3 py-2"
              value={dataPag} onChange={(e) => setDataPag(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={marcarPago} disabled={acao}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-60 transition">
              {acao ? "Processando..." : conta.tipo === "pagar" ? "Marcar como Pago" : "Marcar como Recebido"}
            </button>
            <button onClick={() => setCancelOpen(true)} disabled={acao}
              className="border border-red-300 text-red-600 px-4 py-2 rounded-md hover:bg-red-50 disabled:opacity-60 transition">
              Cancelar conta
            </button>
            <Link href="/financeiro/contas" className="border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Voltar
            </Link>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={cancelOpen}
        title="Cancelar conta"
        description="Deseja cancelar esta conta? Essa ação altera o status para cancelado."
        confirmLabel="Cancelar conta"
        loading={acao}
        onCancel={() => setCancelOpen(false)}
        onConfirm={cancelar}
      />
    </div>
  );
}
