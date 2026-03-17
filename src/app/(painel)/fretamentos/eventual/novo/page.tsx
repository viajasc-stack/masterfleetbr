"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type ClienteOpt = { id: string; nome: string };
type VeiculoOpt = { id: string; placa: string; marca: string | null; modelo: string | null };
type MotoristaOpt = { id: string; nome: string };
type VeiculoRaw = { id: string; placa: string; marca: string | null; modelo: string | null; status?: string | null };
type MotoristaRaw = { id: string; nome: string; ativo?: boolean | null };

type StatusOS = "pendente" | "em_execucao" | "concluida" | "cancelada";
type StatusPg = "pendente" | "parcial" | "pago" | "cancelado";
type ModoCobranca = "fixo" | "km";
type TipoExtra = "fixo" | "hora";

export default function NovoFretamentoEventualPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaOpt[]>([]);

  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [buscaMotorista, setBuscaMotorista] = useState("");

  const [status, setStatus] = useState<StatusOS>("pendente");
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");

  const [inicioEm, setInicioEm] = useState("");
  const [fimData, setFimData] = useState("");

  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [roteiro, setRoteiro] = useState("");
  const [localSaida, setLocalSaida] = useState("");
  const [localChegada, setLocalChegada] = useState("");

  const [modoCobranca, setModoCobranca] = useState<ModoCobranca>("fixo");
  const [valorFixo, setValorFixo] = useState("0");
  const [valorKm, setValorKm] = useState("0");
  const [valorSinal, setValorSinal] = useState("0");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [statusPagamento, setStatusPagamento] = useState<StatusPg>("pendente");

  const [pagarExtraMotorista, setPagarExtraMotorista] = useState(false);
  const [extraTipo, setExtraTipo] = useState<TipoExtra>("fixo");
  const [valorExtraFixo, setValorExtraFixo] = useState("0");
  const [valorHoraExtra, setValorHoraExtra] = useState("0");
  const [qtdHorasExtra, setQtdHorasExtra] = useState("1");

  const [observacoes, setObservacoes] = useState("");

  async function carregarEmpresaId() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setEmpresaId(null);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();

    setEmpresaId(profile?.empresa_id ?? null);
  }

  async function carregarCombos() {
    const c = await supabase.from("clientes").select("id, nome").order("nome");
    setClientes((c.data ?? []) as ClienteOpt[]);

    const v = await supabase.from("veiculos").select("id, placa, marca, modelo, status").order("placa");
    setVeiculos(
      ((v.data ?? []) as VeiculoRaw[])
        .filter((x) => (x.status || "").toLowerCase() !== "inativo")
        .map((x) => ({ id: x.id, placa: x.placa, marca: x.marca, modelo: x.modelo }))
    );

    const m = await supabase.from("motoristas").select("id, nome, ativo").order("nome");
    setMotoristas(
      ((m.data ?? []) as MotoristaRaw[])
        .filter((x) => x.ativo !== false)
        .map((x) => ({ id: x.id, nome: x.nome }))
    );
  }

  useEffect(() => {
    (async () => {
      await carregarEmpresaId();
      await carregarCombos();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setInicioEm(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    })();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    return q ? clientes.filter((x) => x.nome.toLowerCase().includes(q)) : clientes;
  }, [clientes, buscaCliente]);

  const veiculosFiltrados = useMemo(() => {
    const q = buscaVeiculo.trim().toLowerCase();
    if (!q) return veiculos;
    return veiculos.filter((x) => [x.placa, x.marca ?? "", x.modelo ?? ""].join(" ").toLowerCase().includes(q));
  }, [veiculos, buscaVeiculo]);

  const motoristasFiltrados = useMemo(() => {
    const q = buscaMotorista.trim().toLowerCase();
    return q ? motoristas.filter((x) => x.nome.toLowerCase().includes(q)) : motoristas;
  }, [motoristas, buscaMotorista]);

  function toMoney(v: string, fallback = 0) {
    const raw = v.trim().replace(/\s+/g, "");
    if (!raw) return fallback;
    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");
    let normalized = raw;
    if (hasComma && hasDot) {
      normalized = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
    } else if (hasComma) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
  }

  function toIsoOrNullLocal(v: string) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function toNumberOrNull(v: string) {
    const n = Number((v || "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function fimIsoCalculado() {
    if (fimData) {
      const d = new Date(`${fimData}T00:00:00`);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (!inicioEm) return null;
    const d = new Date(inicioEm);
    if (isNaN(d.getTime())) return null;
    const dataSomente = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    return dataSomente.toISOString();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) return alert("Sem empresa vinculada.");
    if (!clienteId) return alert("Cliente é obrigatório.");
    if (!inicioEm) return alert("Data/hora de início é obrigatória.");

    setLoading(true);

    const payload = {
      empresa_id: empresaId,
      tipo: "eventual",
      status,
      cliente_id: clienteId,
      veiculo_id: veiculoId || null,
      motorista_id: motoristaId || null,
      inicio_em: toIsoOrNullLocal(inicioEm),
      fim_em: fimIsoCalculado(),
      origem: origem.trim() || null,
      destino: destino.trim() || null,
      roteiro: roteiro.trim() || null,
      local_saida: localSaida.trim() || null,
      local_chegada: localChegada.trim() || null,
      modo_cobranca: modoCobranca,
      valor_fixo: modoCobranca === "fixo" ? toMoney(valorFixo, 0) : null,
      valor_km: modoCobranca === "km" ? toMoney(valorKm, 0) : null,
      valor_total: modoCobranca === "fixo" ? toMoney(valorFixo, 0) : 0,
      valor_sinal: modoCobranca === "fixo" ? toMoney(valorSinal, 0) : 0,
      forma_pagamento: formaPagamento.trim() || null,
      status_pagamento: statusPagamento,
      pagar_extra_motorista: pagarExtraMotorista,
      extra_motorista_tipo: pagarExtraMotorista ? extraTipo : null,
      valor_extra_motorista: pagarExtraMotorista && extraTipo === "fixo" ? toMoney(valorExtraFixo, 0) : null,
      valor_hora_extra_motorista: pagarExtraMotorista && extraTipo === "hora" ? toMoney(valorHoraExtra, 0) : null,
      qtd_horas_extra_motorista: pagarExtraMotorista && extraTipo === "hora" ? toNumberOrNull(qtdHorasExtra) : null,
      observacoes: observacoes.trim() || null,
    };

    const { data, error } = await supabase.from("ordens_servico").insert(payload).select("id").single();
    setLoading(false);

    if (error) {
      alert("Erro ao salvar fretamento eventual: " + error.message);
      return;
    }

    router.push(`/ordens-servico/${data.id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Fretamento Eventual"
        description="Cadastro operacional e financeiro do fretamento eventual."
        actions={
          <Link href="/fretamentos/eventual" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
            Voltar
          </Link>
        }
      />

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as StatusOS)}>
              <option value="pendente">Pendente</option>
              <option value="em_execucao">Em execução</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Início (obrigatório)</label>
            <input type="datetime-local" className="w-full border border-slate-300 rounded-md px-3 py-2" value={inicioEm} onChange={(e) => setInicioEm(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Data fim (opcional)</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={fimData} onChange={(e) => setFimData(e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Se vazio, assume mesma data do início (sem horário definido).</p>
          </div>
        </div>

        <div className="border-t pt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-1">Cliente *</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 mb-2" value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar cliente..." />
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
              <option value="">Selecione...</option>
              {clientesFiltrados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Veículo (opcional)</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 mb-2" value={buscaVeiculo} onChange={(e) => setBuscaVeiculo(e.target.value)} placeholder="Buscar veículo..." />
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
              <option value="">Selecione...</option>
              {veiculosFiltrados.map((v) => <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `- ${v.modelo}` : ""}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Motorista (opcional)</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 mb-2" value={buscaMotorista} onChange={(e) => setBuscaMotorista(e.target.value)} placeholder="Buscar motorista..." />
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)}>
              <option value="">Selecione...</option>
              {motoristasFiltrados.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t pt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Origem (cidade)</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Cidade de origem" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Destino (cidade)</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Cidade de destino" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Local de saída</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={localSaida} onChange={(e) => setLocalSaida(e.target.value)} placeholder="Ex.: Escola COC" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Local de chegada</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={localChegada} onChange={(e) => setLocalChegada(e.target.value)} placeholder="Ex.: Beto Carreiro" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Roteiro (detalhes para o app do motorista)</label>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]" value={roteiro} onChange={(e) => setRoteiro(e.target.value)} placeholder="Paradas, horários, orientações etc." />
          </div>
        </div>

        <div className="border-t pt-6 grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">Forma de cobrança</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={modoCobranca} onChange={(e) => setModoCobranca(e.target.value as ModoCobranca)}>
              <option value="fixo">Valor fixo</option>
              <option value="km">Por KM</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{modoCobranca === "fixo" ? "Valor fixo" : "Valor por KM"}</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={modoCobranca === "fixo" ? valorFixo : valorKm} onChange={(e) => (modoCobranca === "fixo" ? setValorFixo(e.target.value) : setValorKm(e.target.value))} placeholder="0,00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sinal recebido</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={valorSinal} onChange={(e) => setValorSinal(e.target.value)} placeholder="0,00" disabled={modoCobranca !== "fixo"} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Forma de pagamento</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} placeholder="pix, boleto..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status pagamento</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={statusPagamento} onChange={(e) => setStatusPagamento(e.target.value as StatusPg)}>
              <option value="pendente">Pendente</option>
              <option value="parcial">Parcial</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="border-t pt-6 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={pagarExtraMotorista} onChange={(e) => setPagarExtraMotorista(e.target.checked)} disabled={!motoristaId} />
              Motorista vai receber extra neste fretamento
            </label>
          </div>

          {pagarExtraMotorista ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Forma do extra</label>
                <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={extraTipo} onChange={(e) => setExtraTipo(e.target.value as TipoExtra)}>
                  <option value="fixo">Valor fixo</option>
                  <option value="hora">Por hora</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{extraTipo === "fixo" ? "Valor extra" : "Valor por hora extra"}</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={extraTipo === "fixo" ? valorExtraFixo : valorHoraExtra}
                  onChange={(e) => (extraTipo === "fixo" ? setValorExtraFixo(e.target.value) : setValorHoraExtra(e.target.value))}
                  placeholder="0,00"
                />
              </div>

              {extraTipo === "hora" ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Qtd. horas extra</label>
                  <input
                    className="w-full border border-slate-300 rounded-md px-3 py-2"
                    value={qtdHorasExtra}
                    onChange={(e) => setQtdHorasExtra(e.target.value)}
                    placeholder="1"
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-medium mb-1">Observações internas</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Conferência interna da equipe" />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading || !empresaId} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60">
            {loading ? "Salvando..." : "Salvar fretamento"}
          </button>
          <Link href="/fretamentos/eventual" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
