"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ClienteOpt = { id: string; nome: string };
type VeiculoOpt = { id: string; placa: string; marca: string | null; modelo: string | null };
type MotoristaOpt = { id: string; nome: string };

type TipoOS = "eventual" | "recorrente";
type StatusOS =
  | "rascunho"
  | "aguardando_aprovacao"
  | "aprovada"
  | "em_execucao"
  | "concluida"
  | "cancelada";

type StatusPg = "pendente" | "parcial" | "pago" | "cancelado";

export default function NovaOSPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const [loading, setLoading] = useState(false);

  // dropdowns
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaOpt[]>([]);

  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [buscaMotorista, setBuscaMotorista] = useState("");

  // campos OS
  const [tipo, setTipo] = useState<TipoOS>("eventual");
  const [status, setStatus] = useState<StatusOS>("rascunho");

  const [clienteId, setClienteId] = useState<string>("");
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [motoristaId, setMotoristaId] = useState<string>("");

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
  const [observacoes, setObservacoes] = useState("");

  async function carregarEmpresaId() {
    setStatusMsg("Carregando sessão...");
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setStatusMsg("❌ Você não está logado. Vá para /login.");
      setEmpresaId(null);
      return;
    }

    setStatusMsg("Lendo seu profile (empresa_id)...");
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", sessionData.session.user.id)
      .maybeSingle();

    if (error) {
      setStatusMsg("❌ Erro ao ler profile: " + error.message);
      setEmpresaId(null);
      return;
    }

    if (!profile?.empresa_id) {
      setStatusMsg("⚠️ Você está logado, mas não tem empresa vinculada.");
      setEmpresaId(null);
      return;
    }

    setEmpresaId(profile.empresa_id);
    setStatusMsg("");
  }

  async function carregarCombos() {
    // Clientes
    const c = await supabase.from("clientes").select("id, nome").order("nome");
    setClientes((c.data ?? []) as ClienteOpt[]);

    // Veículos (apenas ativos por padrão)
    const v = await supabase
      .from("veiculos")
      .select("id, placa, marca, modelo, status")
      .order("placa");
    setVeiculos(
      ((v.data ?? []) as any[])
        .filter((x) => (x.status || "").toLowerCase() !== "inativo")
        .map((x) => ({ id: x.id, placa: x.placa, marca: x.marca, modelo: x.modelo }))
    );

    // Motoristas (apenas ativos por padrão)
    const m = await supabase
      .from("motoristas")
      .select("id, nome, status")
      .order("nome");
    setMotoristas(
      ((m.data ?? []) as any[])
        .filter((x) => (x.status || "").toLowerCase() !== "inativo")
        .map((x) => ({ id: x.id, nome: x.nome }))
    );
  }

  useEffect(() => {
    (async () => {
      await carregarEmpresaId();
      await carregarCombos();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function toInt(v: string, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  function toMoney(v: string, fallback = 0) {
    const normalized = v.replace(",", ".").trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
  }

  function toIsoOrNullLocal(v: string) {
    // input datetime-local -> ISO
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) {
      alert("Sem empresa vinculada.");
      return;
    }

    if (!clienteId) {
      alert("Selecione um cliente.");
      return;
    }

    setLoading(true);

    const payload = {
      empresa_id: empresaId,

      tipo,
      status,

      cliente_id: clienteId || null,
      veiculo_id: veiculoId || null,
      motorista_id: motoristaId || null,

      inicio_em: toIsoOrNullLocal(inicioEm),
      fim_em: toIsoOrNullLocal(fimEm),

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
      observacoes: observacoes.trim() || null,
    };

    const { data, error } = await supabase
      .from("ordens_servico")
      .insert(payload)
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    router.push(`/ordens-servico/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nova OS"
        description="Crie uma ordem de serviço."
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
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-700 whitespace-pre-wrap">
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
                <option value="rascunho">Rascunho</option>
                <option value="aguardando_aprovacao">Aguardando aprovação</option>
                <option value="aprovada">Aprovada</option>
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
                    {v.placa} {v.marca || v.modelo ? `— ${[v.marca, v.modelo].filter(Boolean).join(" ")}` : ""}
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
                placeholder="Cidade/bairro/local..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Destino</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Cidade/bairro/local..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Roteiro</label>
              <textarea
                className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[110px]"
                value={roteiro}
                onChange={(e) => setRoteiro(e.target.value)}
                placeholder="Pontos de parada, horários, instruções..."
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
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sinal</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={valorSinal}
                onChange={(e) => setValorSinal(e.target.value)}
                placeholder="0,00"
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
            placeholder="Anotações internas..."
          />
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !empresaId}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Criar OS"}
          </button>

          <Link
            href="/ordens-servico"
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
