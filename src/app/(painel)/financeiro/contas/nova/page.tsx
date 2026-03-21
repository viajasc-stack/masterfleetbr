"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { financeiroErrorMessage } from "@/lib/financeiro";
import { logError, logInfo } from "@/lib/observability";

 

const CATEGORIAS_PAGAR = ["Combustível", "Manutenção", "Salários", "Impostos", "Fornecedores", "Aluguel", "Seguros", "Outros"];
const CATEGORIAS_RECEBER = ["Frete", "Contrato", "Avulso", "Outros"];

function addMonths(isoDate: string, monthsToAdd: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(y, (m - 1) + monthsToAdd, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  const result = new Date(base.getFullYear(), base.getMonth(), day);
  return result.toISOString().slice(0, 10);
}

function splitTotalEmParcelas(total: number, qtd: number) {
  const totalCentavos = Math.round(total * 100);
  const base = Math.floor(totalCentavos / qtd);
  const resto = totalCentavos - base * qtd;
  return Array.from({ length: qtd }, (_, i) => (base + (i < resto ? 1 : 0)) / 100);
}

export default function NovaContaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    descricao: "",
    tipo: "pagar" as "pagar" | "receber",
    valor: "",
    data_vencimento: new Date().toISOString().slice(0, 10),
    categoria: "",
    observacoes: "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [modoParcela, setModoParcela] = useState<"unica" | "carne">("unica");
  const [quantidadeParcelas, setQuantidadeParcelas] = useState("12");
  const [modoValorCarne, setModoValorCarne] = useState<"parcela" | "total">("parcela");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOkMsg("");
    if (!form.descricao.trim()) { setErro("Descrição é obrigatória."); return; }
    if (!form.valor || parseFloat(form.valor) <= 0) { setErro("Valor inválido."); return; }
    if (modoParcela === "carne") {
      const qtd = Number(quantidadeParcelas);
      if (!Number.isInteger(qtd) || qtd < 2 || qtd > 120) {
        setErro("Quantidade de parcelas inválida (use de 2 a 120).");
        return;
      }
    }

    setLoading(true);

    const valor = parseFloat(form.valor);
    const baseDescricao = form.descricao.trim();
    const baseObservacoes = form.observacoes.trim() || null;

    try {
      let error: { message?: string } | null = null;
      if (modoParcela === "unica") {
        const resp = await supabase.from("contas_financeiras").insert({
          descricao: baseDescricao,
          tipo: form.tipo,
          valor,
          data_vencimento: form.data_vencimento,
          categoria: form.categoria || null,
          observacoes: baseObservacoes,
          status: "pendente",
        });
        error = resp.error;
      } else {
        const qtd = Number(quantidadeParcelas);
        const grupoId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
          ? crypto.randomUUID()
          : `carne-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const valoresParcelas = modoValorCarne === "total"
          ? splitTotalEmParcelas(valor, qtd)
          : Array.from({ length: qtd }, () => valor);
        const valorTotalCarne = modoValorCarne === "total"
          ? valor
          : Number((valor * qtd).toFixed(2));

        const linhas = Array.from({ length: qtd }, (_, i) => ({
          descricao: `${baseDescricao} (${i + 1}/${qtd})`,
          tipo: form.tipo,
          valor: valoresParcelas[i],
          data_vencimento: addMonths(form.data_vencimento, i),
          categoria: form.categoria || null,
          observacoes: [
            baseObservacoes,
            `Carnê/parcelado: parcela ${i + 1} de ${qtd}`,
            `Grupo: ${grupoId}`,
          ].filter(Boolean).join(" • "),
          status: "pendente",
          carne_grupo_id: grupoId,
          parcela_numero: i + 1,
          parcela_total: qtd,
          valor_total_carne: valorTotalCarne,
        }));

        const resp = await supabase.from("contas_financeiras").insert(linhas);
        error = resp.error;
      }

      if (error) {
        logError("financeiro.contas_nova", "Erro ao salvar conta", error, {
          tipo: form.tipo,
          modo_parcela: modoParcela,
        });
        setErro(error.message ?? "Erro ao salvar conta.");
        return;
      }

      logInfo("financeiro.contas_nova", "Conta salva com sucesso", {
        tipo: form.tipo,
        modo_parcela: modoParcela,
        quantidade_parcelas: modoParcela === "carne" ? Number(quantidadeParcelas) : 1,
      });
      setOkMsg(modoParcela === "carne" && form.tipo === "pagar" ? "Carnê criado com sucesso." : "Conta criada com sucesso.");
    } catch (e) {
      logError("financeiro.contas_nova", "Exceção ao salvar conta", e, {
        tipo: form.tipo,
        modo_parcela: modoParcela,
      });
      setErro(financeiroErrorMessage(e, "Erro ao salvar conta."));
      return;
    } finally {
      setLoading(false);
    }

    router.push("/financeiro");
  }

  const categorias = form.tipo === "pagar" ? CATEGORIAS_PAGAR : CATEGORIAS_RECEBER;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="text-sm text-slate-500 hover:text-slate-800">← Financeiro</Link>
        <h1 className="text-xl font-semibold text-slate-900">Nova Conta</h1>
      </div>

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{erro}</div>}
        {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded px-3 py-2">{okMsg}</div>}

        <div>
          <label className="block font-medium mb-1">Tipo *</label>
          <div className="flex gap-3">
            {(["pagar", "receber"] as const).map((t) => (
              <label key={t} className={`flex-1 flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition ${form.tipo === t ? t === "pagar" ? "border-red-400 bg-red-50 text-red-700" : "border-green-400 bg-green-50 text-green-700" : "border-slate-300"}`}>
                <input type="radio" name="tipo" value={t} checked={form.tipo === t} onChange={() => { set("tipo", t); set("categoria", ""); }} className="sr-only" />
                {t === "pagar" ? "A Pagar" : "A Receber"}
              </label>
            ))}
          </div>
        </div>

        {form.tipo === "pagar" && (
          <div>
            <label className="block font-medium mb-1">Forma de lançamento</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition ${modoParcela === "unica" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-300"}`}>
                <input
                  type="radio"
                  name="modoParcela"
                  value="unica"
                  checked={modoParcela === "unica"}
                  onChange={() => setModoParcela("unica")}
                  className="sr-only"
                />
                Parcela única
              </label>
              <label className={`flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition ${modoParcela === "carne" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-300"}`}>
                <input
                  type="radio"
                  name="modoParcela"
                  value="carne"
                  checked={modoParcela === "carne"}
                  onChange={() => setModoParcela("carne")}
                  className="sr-only"
                />
                Carnê / parcelado
              </label>
            </div>
          </div>
        )}

        <div>
          <label className="block font-medium mb-1">Descrição *</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Valor (R$) *</label>
            <input type="number" step="0.01" min="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.valor} onChange={(e) => set("valor", e.target.value)} required />
          </div>
          <div>
            <label className="block font-medium mb-1">Vencimento *</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.data_vencimento} onChange={(e) => set("data_vencimento", e.target.value)} required />
          </div>
        </div>

        {form.tipo === "pagar" && modoParcela === "carne" && (
          <div className="space-y-3">
            <div>
              <label className="block font-medium mb-1">Valor informado representa</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition ${modoValorCarne === "parcela" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-300"}`}>
                  <input
                    type="radio"
                    name="modoValorCarne"
                    value="parcela"
                    checked={modoValorCarne === "parcela"}
                    onChange={() => setModoValorCarne("parcela")}
                    className="sr-only"
                  />
                  Valor da parcela
                </label>
                <label className={`flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition ${modoValorCarne === "total" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-300"}`}>
                  <input
                    type="radio"
                    name="modoValorCarne"
                    value="total"
                    checked={modoValorCarne === "total"}
                    onChange={() => setModoValorCarne("total")}
                    className="sr-only"
                  />
                  Valor total do financiamento
                </label>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Quantidade de parcelas *</label>
              <input
                type="number"
                min={2}
                max={120}
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={quantidadeParcelas}
                onChange={(e) => setQuantidadeParcelas(e.target.value)}
                required
              />
            </div>

            <p className="text-xs text-slate-500 mt-1">
              O sistema criará {quantidadeParcelas || 0} contas mensais com vínculo de grupo único do carnê.
              {modoValorCarne === "total" ? " O valor total será dividido automaticamente entre as parcelas." : " O valor informado será repetido em cada parcela."}
            </p>
          </div>
        )}

        <div>
          <label className="block font-medium mb-1">Categoria</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.categoria}
            onChange={(e) => set("categoria", e.target.value)}>
            <option value="">— Selecione —</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Observações</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2}
            value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? "Salvando..." : modoParcela === "carne" && form.tipo === "pagar" ? "Salvar carnê" : "Salvar Conta"}
          </button>
          <Link href="/financeiro" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
