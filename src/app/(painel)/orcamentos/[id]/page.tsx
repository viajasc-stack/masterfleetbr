"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type OrcamentoDb = {
  id: string;
  nome: string | null;
  descricao: string | null;
  tipo: string;
  cliente_id: string | null;
  veiculo_id: string | null;
  valor_centavos: number | null;
  inicio_em: string | null;
  retorno_em: string | null;
  local_saida: string | null;
  local_chegada: string | null;
  status: string;
  negociacao: boolean;
};

function isoToDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function EditarOrcamentoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("eventual");
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [inicioEm, setInicioEm] = useState("");
  const [retornoEm, setRetornoEm] = useState("");
  const [localSaida, setLocalSaida] = useState("");
  const [localChegada, setLocalChegada] = useState("");
  const [valor, setValor] = useState("");

  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaVeiculo, setBuscaVeiculo] = useState("");

  const [clientes, setClientes] = useState<Array<{ id: string; nome: string }>>([]);
  const [veiculos, setVeiculos] = useState<
    Array<{ id: string; placa: string; marca: string | null; modelo: string | null }>
  >([]);

  async function carregarTudo() {
    if (!id) return;
    setLoading(true);
    setErro("");

    const [{ data: o, error: oErr }, c, v] = await Promise.all([
      supabase
        .from("orcamentos")
        .select(
          "id, nome, descricao, tipo, cliente_id, veiculo_id, valor_centavos, inicio_em, retorno_em, local_saida, local_chegada, status, negociacao"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.from("veiculos").select("id, placa, marca, modelo").order("placa"),
    ]);

    if (oErr || !o) {
      setErro(oErr?.message ?? "Orçamento não encontrado.");
      setLoading(false);
      return;
    }

    const row = o as OrcamentoDb;
    setNome(row.nome ?? "");
    setDescricao(row.descricao ?? "");
    setTipo(row.tipo ?? "eventual");
    setClienteId(row.cliente_id ?? "");
    setVeiculoId(row.veiculo_id ?? "");
    setInicioEm(isoToDatetimeLocal(row.inicio_em));
    setRetornoEm(isoToDatetimeLocal(row.retorno_em));
    setLocalSaida(row.local_saida ?? "");
    setLocalChegada(row.local_chegada ?? "");
    setValor(row.valor_centavos != null ? String(row.valor_centavos / 100).replace(".", ",") : "");

    setClientes((c.data ?? []) as Array<{ id: string; nome: string }>);
    setVeiculos(
      (v.data ?? []) as Array<{ id: string; placa: string; marca: string | null; modelo: string | null }>
    );
    setLoading(false);
  }

  useEffect(() => {
    void carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(q));
  }, [clientes, buscaCliente]);

  const veiculosFiltrados = useMemo(() => {
    const q = buscaVeiculo.trim().toLowerCase();
    if (!q) return veiculos;
    return veiculos.filter((v) => `${v.placa} ${v.marca ?? ""} ${v.modelo ?? ""}`.toLowerCase().includes(q));
  }, [veiculos, buscaVeiculo]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    if (!clienteId) {
      alert("Selecione o cliente.");
      return;
    }

    setSaving(true);

    const valorCentavos = valor ? Math.round(parseFloat(valor.replace(",", ".")) * 100) : null;

    const payload = {
      nome: nome.trim() || null,
      descricao: descricao.trim() || null,
      tipo,
      cliente_id: clienteId,
      veiculo_id: veiculoId || null,
      valor_centavos: valorCentavos,
      inicio_em: datetimeLocalToIso(inicioEm),
      retorno_em: datetimeLocalToIso(retornoEm),
      local_saida: localSaida.trim() || null,
      local_chegada: localChegada.trim() || null,
      // importante: NÃO alterar status/negociacao aqui
    };

    const { error } = await supabase.from("orcamentos").update(payload).eq("id", id);
    setSaving(false);

    if (error) {
      alert("Erro ao atualizar orçamento: " + error.message);
      return;
    }

    router.push("/orcamentos");
    router.refresh();
  }

  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6">Carregando...</div>;
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-red-200 text-red-700 rounded-xl p-6">{erro}</div>
        <Link href="/orcamentos" className="inline-block border border-slate-300 px-4 py-2 rounded-md">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Orçamento"
        description="Atualize os dados do orçamento sem alterar status/negociação."
        actions={
          <Link href="/orcamentos" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">
            Voltar
          </Link>
        }
      />

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Cliente *</div>
            <input
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-2"
              placeholder="Buscar cliente..."
            />
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              required
            >
              <option value="">Selecione...</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Veículo</div>
            <input
              value={buscaVeiculo}
              onChange={(e) => setBuscaVeiculo(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-2"
              placeholder="Buscar por placa/marca/modelo..."
            />
            <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="">(opcional)</option>
              {veiculosFiltrados.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} {v.marca || v.modelo ? `— ${[v.marca, v.modelo].filter(Boolean).join(" ")}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Nome</div>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border rounded-md px-3 py-2" />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Valor final (R$) *</div>
            <input value={valor} onChange={(e) => setValor(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          </label>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="eventual">Fretamento eventual</option>
              <option value="recorrencia">Recorrência (contrato)</option>
            </select>
          </div>

          <label>
            <div className="text-sm font-medium mb-1">Data/hora início do serviço *</div>
            <input type="datetime-local" value={inicioEm} onChange={(e) => setInicioEm(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Data/hora retorno da viagem *</div>
            <input type="datetime-local" value={retornoEm} onChange={(e) => setRetornoEm(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Local de saída *</div>
            <input value={localSaida} onChange={(e) => setLocalSaida(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Local de chegada *</div>
            <input value={localChegada} onChange={(e) => setLocalChegada(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          </label>

          <label className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Descrição detalhada do serviço *</div>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full border rounded-md px-3 py-2 min-h-[120px]"
              required
            />
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md">
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <Link href="/orcamentos" className="border px-4 py-2 rounded-md">
              Cancelar
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
