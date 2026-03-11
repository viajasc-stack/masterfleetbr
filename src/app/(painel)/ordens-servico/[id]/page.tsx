"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type ClienteOpt = { id: string; nome: string };
type VeiculoOpt = { id: string; placa: string; marca: string | null; modelo: string | null; status?: string };
type MotoristaOpt = { id: string; nome: string; ativo?: boolean | null };

type TipoOS = "eventual" | "recorrente";
type StatusOS =
  | "pendente"
  | "em_execucao"
  | "concluida"
  | "cancelada";

type StatusPg = "pendente" | "parcial" | "pago" | "cancelado";
type StatusPresenca = "PENDENTE" | "EMBARCOU" | "FALTOU" | "EXTRA";

type OsDb = {
  id: string;
  contrato_id: string | null;

  numero: number | null;
  tipo: TipoOS;
  status: StatusOS;

  cliente_id: string | null;
  veiculo_id: string | null;
  motorista_id: string | null;

  inicio_em: string | null;
  fim_em: string | null;

  origem: string | null;
  destino: string | null;
  roteiro: string | null;
  observacoes: string | null;

  qtd_passageiros: number | null;

  valor_total: number | null;
  valor_sinal: number | null;
  forma_pagamento: string | null;
  status_pagamento: StatusPg | null;

  local_saida: string | null;
  local_chegada: string | null;
  rota_referencia_lat: number | null;
  rota_referencia_lng: number | null;
  raio_desvio_m: number | null;

  aprovado_em: string | null;
  aprovado_por: string | null;

  created_at: string;
  updated_at: string;
};

type PresencaRow = {
  id: string;
  passageiro_id: string;
  status: StatusPresenca;
  hora_registro: string | null;
};

type PassageiroMini = { id: string; nome: string };

function isoToInputLocal(iso: string | null) {
  if (!iso) return "";
  // transforma ISO -> "YYYY-MM-DDTHH:mm"
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function inputLocalToIso(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function EditarOSPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [presencas, setPresencas] = useState<PresencaRow[]>([]);
  const [passageirosMap, setPassageirosMap] = useState<Record<string, string>>({});
  const [syncingPresencas, setSyncingPresencas] = useState(false);

  const [os, setOs] = useState<OsDb | null>(null);

  // combos
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaOpt[]>([]);

  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [buscaMotorista, setBuscaMotorista] = useState("");

  // campos
  const [tipo, setTipo] = useState<TipoOS>("eventual");
  const [status, setStatus] = useState<StatusOS>("pendente");

  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");

  const [inicioEm, setInicioEm] = useState("");
  const [fimEm, setFimEm] = useState("");

  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [roteiro, setRoteiro] = useState("");

  const [qtdPassageiros, setQtdPassageiros] = useState("0");

  const [valorTotal, setValorTotal] = useState("0");
  const [valorSinal, setValorSinal] = useState("0");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [statusPagamento, setStatusPagamento] = useState<StatusPg>("pendente");

  const [localSaida, setLocalSaida] = useState("");
  const [localChegada, setLocalChegada] = useState("");
  const [rotaReferenciaLat, setRotaReferenciaLat] = useState("");
  const [rotaReferenciaLng, setRotaReferenciaLng] = useState("");
  const [raioDesvioM, setRaioDesvioM] = useState("1500");
  const [observacoes, setObservacoes] = useState("");

  async function carregarCombos() {
    const c = await supabase.from("clientes").select("id, nome").order("nome");
    setClientes((c.data ?? []) as ClienteOpt[]);

    const v = await supabase
      .from("veiculos")
      .select("id, placa, marca, modelo, status")
      .order("placa");
    setVeiculos((v.data ?? []) as VeiculoOpt[]);

    const m = await supabase
      .from("motoristas")
      .select("id, nome, ativo")
      .order("nome");
    setMotoristas(
      ((m.data ?? []) as MotoristaOpt[]).filter((x) => x.ativo !== false)
    );
  }

  async function carregarOS() {
    if (!id) return;

    setLoading(true);
    setStatusMsg("Carregando OS...");

    const { data, error } = await supabase
      .from("ordens_servico")
      .select(
        "id, contrato_id, numero, tipo, status, cliente_id, veiculo_id, motorista_id, inicio_em, fim_em, origem, destino, roteiro, observacoes, qtd_passageiros, valor_total, valor_sinal, forma_pagamento, status_pagamento, local_saida, local_chegada, rota_referencia_lat, rota_referencia_lng, raio_desvio_m, aprovado_em, aprovado_por, created_at, updated_at"
      )
      .eq("id", id)
      .limit(1);

    if (error) {
      setStatusMsg("❌ Erro ao carregar: " + error.message);
      setOs(null);
      setLoading(false);
      return;
    }

    const row = (data ?? [])[0] as OsDb | undefined;

    if (!row) {
      setStatusMsg("⚠️ OS não encontrada (ou você não tem acesso).");
      setOs(null);
      setLoading(false);
      return;
    }

    const o = row;
    setOs(o);
    await carregarPresencas(o.id);

    setTipo(o.tipo ?? "eventual");
    setStatus(o.status ?? "pendente");

    setClienteId(o.cliente_id ?? "");
    setVeiculoId(o.veiculo_id ?? "");
    setMotoristaId(o.motorista_id ?? "");

    setInicioEm(isoToInputLocal(o.inicio_em));
    setFimEm(isoToInputLocal(o.fim_em));

    setOrigem(o.origem ?? "");
    setDestino(o.destino ?? "");
    setRoteiro(o.roteiro ?? "");

    setQtdPassageiros(
      typeof o.qtd_passageiros === "number" ? String(o.qtd_passageiros) : "0"
    );

    setValorTotal(typeof o.valor_total === "number" ? String(o.valor_total) : "0");
    setValorSinal(typeof o.valor_sinal === "number" ? String(o.valor_sinal) : "0");
    setFormaPagamento(o.forma_pagamento ?? "");
    setStatusPagamento((o.status_pagamento ?? "pendente") as StatusPg);

    setLocalSaida(o.local_saida ?? "");
    setLocalChegada(o.local_chegada ?? "");
    setRotaReferenciaLat(
      typeof o.rota_referencia_lat === "number" ? String(o.rota_referencia_lat) : ""
    );
    setRotaReferenciaLng(
      typeof o.rota_referencia_lng === "number" ? String(o.rota_referencia_lng) : ""
    );
    setRaioDesvioM(
      typeof o.raio_desvio_m === "number" ? String(o.raio_desvio_m) : "1500"
    );
    setObservacoes(o.observacoes ?? "");

    setStatusMsg("");
    setLoading(false);
  }

  async function carregarPresencas(osId: string) {
    const { data, error } = await supabase
      .from("os_passageiros_presenca")
      .select("id, passageiro_id, status, hora_registro")
      .eq("os_id", osId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const rows = (data ?? []) as PresencaRow[];
    setPresencas(rows);

    const ids = rows.map((r) => r.passageiro_id);
    if (ids.length === 0) {
      setPassageirosMap({});
      return;
    }

    const { data: pData } = await supabase
      .from("passageiros")
      .select("id, nome")
      .in("id", ids);

    const map: Record<string, string> = {};
    ((pData ?? []) as PassageiroMini[]).forEach((p) => {
      map[p.id] = p.nome;
    });
    setPassageirosMap(map);
  }

  async function sincronizarPassageirosFretamento() {
    if (!os?.id) return;
    setSyncingPresencas(true);
    const { error } = await supabase.rpc("rpc_os_sync_passageiros_fretamento", {
      p_os_id: os.id,
    });
    setSyncingPresencas(false);
    if (error) {
      alert("Erro ao sincronizar passageiros: " + error.message);
      return;
    }
    await carregarPresencas(os.id);
  }

  async function marcarPresenca(passageiroId: string, novoStatus: StatusPresenca) {
    if (!os?.id) return;
    const { error } = await supabase.rpc("rpc_os_atualizar_presenca_passageiro", {
      p_os_id: os.id,
      p_passageiro_id: passageiroId,
      p_status: novoStatus,
    });
    if (error) {
      alert("Erro ao atualizar presença: " + error.message);
      return;
    }
    await carregarPresencas(os.id);
  }

  useEffect(() => {
    (async () => {
      await carregarCombos();
      await carregarOS();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((x) => x.nome.toLowerCase().includes(q));
  }, [clientes, buscaCliente]);

  const veiculosFiltrados = useMemo(() => {
    const q = buscaVeiculo.trim().toLowerCase();
    if (!q) return veiculos;
    return veiculos.filter((x) => {
      const alvo = [x.placa, x.marca ?? "", x.modelo ?? ""].join(" ").toLowerCase();
      return alvo.includes(q);
    });
  }, [veiculos, buscaVeiculo]);

  const motoristasFiltrados = useMemo(() => {
    const q = buscaMotorista.trim().toLowerCase();
    if (!q) return motoristas;
    return motoristas.filter((x) => x.nome.toLowerCase().includes(q));
  }, [motoristas, buscaMotorista]);

  const resumoPresencas = useMemo(() => {
    return presencas.reduce(
      (acc, p) => {
        acc.total += 1;
        acc[p.status] += 1;
        return acc;
      },
      { total: 0, PENDENTE: 0, EMBARCOU: 0, FALTOU: 0, EXTRA: 0 } as Record<"total" | StatusPresenca, number>
    );
  }, [presencas]);

  function toInt(v: string, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  function toMoney(v: string, fallback = 0) {
    const raw = v.trim().replace(/\s+/g, "");
    if (!raw) return fallback;

    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    let normalized = raw;
    if (hasComma && hasDot) {
      normalized =
        raw.lastIndexOf(",") > raw.lastIndexOf(".")
          ? raw.replace(/\./g, "").replace(",", ".")
          : raw.replace(/,/g, "");
    } else if (hasComma) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    }

    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
  }

  function toNullableNumber(v: string) {
    const s = v.trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    if (!clienteId) {
      alert("Selecione um cliente.");
      return;
    }

    setSaving(true);
    setStatusMsg("Salvando...");

    const payload = {
      tipo,
      status,

      cliente_id: clienteId || null,
      veiculo_id: veiculoId || null,
      motorista_id: motoristaId || null,

      inicio_em: inputLocalToIso(inicioEm),
      fim_em: inputLocalToIso(fimEm),

      origem: origem.trim() || null,
      destino: destino.trim() || null,
      roteiro: roteiro.trim() || null,

      qtd_passageiros: toInt(qtdPassageiros, 0),

      valor_total: toMoney(valorTotal, 0),
      valor_sinal: toMoney(valorSinal, 0),
      forma_pagamento: formaPagamento.trim() || null,
      status_pagamento: statusPagamento,

      local_saida: localSaida.trim() || null,
      local_chegada: localChegada.trim() || null,
      rota_referencia_lat: toNullableNumber(rotaReferenciaLat),
      rota_referencia_lng: toNullableNumber(rotaReferenciaLng),
      raio_desvio_m: Math.max(50, toMoney(raioDesvioM, 1500)),
      observacoes: observacoes.trim() || null,
    };

    const { error } = await supabase
      .from("ordens_servico")
      .update(payload)
      .eq("id", id);

    setSaving(false);

    if (error) {
      setStatusMsg("❌ Erro ao salvar: " + error.message);
      return;
    }

    router.push("/ordens-servico");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">
        Carregando...
      </div>
    );
  }

  if (!os) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold">Ordem de Serviço</h1>
          <p className="text-slate-600 text-sm">{statusMsg || "Não encontrada."}</p>
        </div>

        <Link
          href="/ordens-servico"
          className="inline-block border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
        >
          Voltar para OS
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar OS"
        description={`ID: ${os.id}${os.numero ? ` • OS #${os.numero}` : ""}`}
        actions={
          <Link
            href="/ordens-servico"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm"
          >
            Voltar
          </Link>
        }
      />

      {statusMsg ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
          {statusMsg}
        </div>
      ) : null}

      <form
        onSubmit={salvar}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        {/* Básico */}
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Básico</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoOS)}
              >
                <option value="eventual">Eventual</option>
                <option value="recorrente">Recorrente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusOS)}
              >
                <option value="pendente">Pendente</option>
                <option value="em_execucao">Em execução</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Qtd. passageiros
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={qtdPassageiros}
                onChange={(e) => setQtdPassageiros(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Relacionamentos */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Cliente / Veículo / Motorista
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2 mb-2"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Buscar cliente..."
              />
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {clientesFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Veículo</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2 mb-2"
                value={buscaVeiculo}
                onChange={(e) => setBuscaVeiculo(e.target.value)}
                placeholder="Buscar placa/marca/modelo..."
              />
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={veiculoId}
                onChange={(e) => setVeiculoId(e.target.value)}
              >
                <option value="">(opcional)</option>
                {veiculosFiltrados.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa}{" "}
                    {v.marca || v.modelo
                      ? `— ${[v.marca, v.modelo].filter(Boolean).join(" ")}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Motorista</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2 mb-2"
                value={buscaMotorista}
                onChange={(e) => setBuscaMotorista(e.target.value)}
                placeholder="Buscar motorista..."
              />
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={motoristaId}
                onChange={(e) => setMotoristaId(e.target.value)}
              >
                <option value="">(opcional)</option>
                {motoristasFiltrados.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Datas */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Datas</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Início</label>
              <input
                type="datetime-local"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={inicioEm}
                onChange={(e) => setInicioEm(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fim</label>
              <input
                type="datetime-local"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={fimEm}
                onChange={(e) => setFimEm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Roteiro */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Roteiro</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Origem</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Destino</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Roteiro</label>
              <textarea
                className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]"
                value={roteiro}
                onChange={(e) => setRoteiro(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Local de saída</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={localSaida}
                onChange={(e) => setLocalSaida(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Local de chegada</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={localChegada}
                onChange={(e) => setLocalChegada(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lat. referência rota</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={rotaReferenciaLat}
                onChange={(e) => setRotaReferenciaLat(e.target.value)}
                placeholder="-23.5505"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lng. referência rota</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={rotaReferenciaLng}
                onChange={(e) => setRotaReferenciaLng(e.target.value)}
                placeholder="-46.6333"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Raio de desvio (m)</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={raioDesvioM}
                onChange={(e) => setRaioDesvioM(e.target.value)}
                placeholder="1500"
              />
            </div>
          </div>
        </div>

        {/* Financeiro */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Valores / Pagamento
          </h2>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor total</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sinal</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={valorSinal}
                onChange={(e) => setValorSinal(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Forma de pagamento
              </label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                placeholder="pix, boleto, transferência..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Status pagamento
              </label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={statusPagamento}
                onChange={(e) => setStatusPagamento(e.target.value as StatusPg)}
              >
                <option value="pendente">Pendente</option>
                <option value="parcial">Parcial</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Observações
          </h2>

          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        {/* Presença de passageiros (fretamento compartilhado) */}
        <div className="border-t pt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Presença de passageiros</h2>
            <button
              type="button"
              onClick={sincronizarPassageirosFretamento}
              className="border border-indigo-300 text-indigo-700 px-3 py-2 rounded-md hover:bg-indigo-50 text-sm disabled:opacity-60"
              disabled={syncingPresencas}
            >
              {syncingPresencas ? "Sincronizando..." : "Sincronizar da programação"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded border border-slate-300">Total: {resumoPresencas.total}</span>
            <span className="px-2 py-1 rounded border border-slate-300">Pendente: {resumoPresencas.PENDENTE}</span>
            <span className="px-2 py-1 rounded border border-emerald-300 text-emerald-700 bg-emerald-50">Embarcou: {resumoPresencas.EMBARCOU}</span>
            <span className="px-2 py-1 rounded border border-rose-300 text-rose-700 bg-rose-50">Faltou: {resumoPresencas.FALTOU}</span>
            <span className="px-2 py-1 rounded border border-amber-300 text-amber-700 bg-amber-50">Extra: {resumoPresencas.EXTRA}</span>
          </div>

          {presencas.length === 0 ? (
            <div className="text-xs text-slate-500">Nenhum passageiro sincronizado para esta OS.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Passageiro</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Hora</th>
                    <th className="py-2 pr-0 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {presencas.map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{passageirosMap[p.passageiro_id] ?? p.passageiro_id.slice(0, 8)}</td>
                      <td className="py-2 pr-4">{p.status}</td>
                      <td className="py-2 pr-4">{p.hora_registro ? new Date(p.hora_registro).toLocaleString("pt-BR") : "—"}</td>
                      <td className="py-2 pr-0 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => marcarPresenca(p.passageiro_id, "EMBARCOU")} className="px-2 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50">Embarcou</button>
                          <button type="button" onClick={() => marcarPresenca(p.passageiro_id, "FALTOU")} className="px-2 py-1 text-xs rounded border border-rose-300 text-rose-700 hover:bg-rose-50">Faltou</button>
                          <button type="button" onClick={() => marcarPresenca(p.passageiro_id, "EXTRA")} className="px-2 py-1 text-xs rounded border border-amber-300 text-amber-700 hover:bg-amber-50">Extra</button>
                          <button type="button" onClick={() => marcarPresenca(p.passageiro_id, "PENDENTE")} className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50">Pendente</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

          <Link
            href="/ordens-servico"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>

        <div className="text-xs text-slate-500">
          Criado em: {new Date(os.created_at).toLocaleString("pt-BR")} • Atualizado
          em: {new Date(os.updated_at).toLocaleString("pt-BR")}
        </div>
      </form>
    </div>
  );
}
        
