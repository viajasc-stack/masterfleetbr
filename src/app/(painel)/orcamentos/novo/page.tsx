"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

export default function NovoOrcamentoPage() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("eventual");

  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");

  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaVeiculo, setBuscaVeiculo] = useState("");

  const [inicioEm, setInicioEm] = useState("");
  const [retornoEm, setRetornoEm] = useState("");
  const [localSaida, setLocalSaida] = useState("");
  const [localChegada, setLocalChegada] = useState("");

  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);

  const [showNovoClienteRapido, setShowNovoClienteRapido] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteWhatsapp, setNovoClienteWhatsapp] = useState("");
  const [salvandoClienteRapido, setSalvandoClienteRapido] = useState(false);

  const [clientes, setClientes] = useState<Array<{ id: string; nome: string }>>([]);
  const [veiculos, setVeiculos] = useState<Array<{ id: string; placa: string; marca: string | null; modelo: string | null }>>([]);

  async function carregarOpcoes() {
    setCarregandoOpcoes(true);
    const [c, v] = await Promise.all([
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.from("veiculos").select("id, placa, marca, modelo").order("placa"),
    ]);

    if (c.error) console.error("Erro ao carregar clientes:", c.error.message);
    if (v.error) console.error("Erro ao carregar veículos:", v.error.message);

    setClientes((c.data ?? []) as Array<{ id: string; nome: string }>);
    setVeiculos((v.data ?? []) as Array<{ id: string; placa: string; marca: string | null; modelo: string | null }>);
    setCarregandoOpcoes(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregarOpcoes();
    }, 0);

    return () => clearTimeout(id);
  }, []);

  async function criarClienteRapido() {
    if (novoClienteNome.trim().length < 2) {
      alert("Informe o nome do cliente.");
      return;
    }

    setSalvandoClienteRapido(true);
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nome: novoClienteNome.trim(),
        tipo: "pessoa",
        whatsapp: novoClienteWhatsapp.trim() || null,
      })
      .select("id, nome")
      .single();
    setSalvandoClienteRapido(false);

    if (error) {
      alert("Erro ao criar cliente rápido: " + error.message);
      return;
    }

    if (data) {
      const novo = data as { id: string; nome: string };
      setClientes((prev) => {
        const next = [...prev, novo];
        next.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        return next;
      });
      setClienteId(novo.id);
      setBuscaCliente(novo.nome);
    }

    setNovoClienteNome("");
    setNovoClienteWhatsapp("");
    setShowNovoClienteRapido(false);
  }

  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(q));
  }, [clientes, buscaCliente]);

  const veiculosFiltrados = useMemo(() => {
    const q = buscaVeiculo.trim().toLowerCase();
    if (!q) return veiculos;
    return veiculos.filter((v) => {
      const alvo = `${v.placa} ${v.marca ?? ""} ${v.modelo ?? ""}`.toLowerCase();
      return alvo.includes(q);
    });
  }, [veiculos, buscaVeiculo]);

  function toIsoOrNullLocal(v: string) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!clienteId) {
      alert("Selecione o cliente.");
      return;
    }

    setLoading(true);

    const valor_centavos = valor ? Math.round(parseFloat(valor.replace(',', '.')) * 100) : null;
    const payload = {
      nome: nome.trim() || null,
      descricao: descricao.trim() || null,
      tipo,
      cliente_id: clienteId,
      veiculo_id: veiculoId || null,
      valor_centavos,
      inicio_em: toIsoOrNullLocal(inicioEm),
      retorno_em: toIsoOrNullLocal(retornoEm),
      local_saida: localSaida.trim() || null,
      local_chegada: localChegada.trim() || null,
    };

    const { error } = await supabase.from('orcamentos').insert(payload).select().single();

    setLoading(false);

    if (error) {
      alert('Erro ao criar orçamento: ' + error.message);
      return;
    }
    router.push('/orcamentos');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Orçamento"
        description="Cadastre um orçamento completo para compartilhar com o cliente."
        actions={
          <Link href="/orcamentos" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
            Voltar
          </Link>
        }
      />

      <form onSubmit={salvar} className="bg-white border p-6 rounded-xl space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Cliente *</div>
            <input value={buscaCliente} onChange={(e)=>setBuscaCliente(e.target.value)} className="w-full border rounded-md px-3 py-2 mb-2" placeholder="Buscar cliente..." />
            <select value={clienteId} onChange={(e)=>setClienteId(e.target.value)} className="w-full border rounded-md px-3 py-2" required>
              <option value="">Selecione...</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowNovoClienteRapido((v) => !v)}
                className="text-xs border border-slate-300 px-2 py-1 rounded-md hover:bg-slate-50"
              >
                + Cliente rápido
              </button>
              <button
                type="button"
                onClick={carregarOpcoes}
                className="text-xs border border-slate-300 px-2 py-1 rounded-md hover:bg-slate-50"
                disabled={carregandoOpcoes}
              >
                {carregandoOpcoes ? "Atualizando..." : "Atualizar lista"}
              </button>
            </div>

            {showNovoClienteRapido ? (
              <div className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                <div className="text-xs font-medium text-slate-700">Criar cliente rápido</div>
                <input
                  value={novoClienteNome}
                  onChange={(e) => setNovoClienteNome(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Nome do cliente"
                />
                <input
                  value={novoClienteWhatsapp}
                  onChange={(e) => setNovoClienteWhatsapp(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="WhatsApp (opcional)"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={criarClienteRapido}
                    disabled={salvandoClienteRapido}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md"
                  >
                    {salvandoClienteRapido ? "Salvando..." : "Salvar cliente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNovoClienteRapido(false)}
                    className="text-xs border border-slate-300 px-3 py-1 rounded-md"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </label>

          <label className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Veículo</div>
            <input value={buscaVeiculo} onChange={(e)=>setBuscaVeiculo(e.target.value)} className="w-full border rounded-md px-3 py-2 mb-2" placeholder="Buscar por placa/marca/modelo..." />
            <select value={veiculoId} onChange={(e)=>setVeiculoId(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="">(opcional)</option>
              {veiculosFiltrados.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} {v.marca || v.modelo ? `— ${[v.marca, v.modelo].filter(Boolean).join(" ")}` : ""}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-slate-500">
              Se não aparecer veículo, clique em “Atualizar lista”.
            </div>
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Nome</div>
            <input value={nome} onChange={(e)=>setNome(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Ex: Viagem escolar para..." />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Valor final (R$) *</div>
            <input value={valor} onChange={(e)=>setValor(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="0,00" required />
          </label>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select value={tipo} onChange={(e)=>setTipo(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="eventual">Fretamento eventual</option>
              <option value="recorrencia">Recorrência (contrato)</option>
            </select>
          </div>

          <label>
            <div className="text-sm font-medium mb-1">Data/hora início do serviço *</div>
            <input type="datetime-local" value={inicioEm} onChange={(e)=>setInicioEm(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Data/hora retorno da viagem *</div>
            <input type="datetime-local" value={retornoEm} onChange={(e)=>setRetornoEm(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Local de saída *</div>
            <input value={localSaida} onChange={(e)=>setLocalSaida(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Endereço ou ponto de encontro" required />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Local de chegada *</div>
            <input value={localChegada} onChange={(e)=>setLocalChegada(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Destino final" required />
          </label>

          <label className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Descrição detalhada do serviço *</div>
            <textarea value={descricao} onChange={(e)=>setDescricao(e.target.value)} className="w-full border rounded-md px-3 py-2 min-h-[120px]" required />
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md">Salvar</button>
            <button type="button" onClick={()=>router.push('/orcamentos')} className="border px-4 py-2 rounded-md">Cancelar</button>
          </div>
        </div>
      </form>
    </div>
  );
}
