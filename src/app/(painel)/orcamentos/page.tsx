"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";

type Orcamento = {
  id: string;
  cliente_id: string | null;
  codigo_acesso: string | null;
  nome: string | null;
  descricao: string | null;
  inicio_em: string | null;
  retorno_em: string | null;
  local_saida: string | null;
  local_chegada: string | null;
  tipo: string;
  valor_centavos: number | null;
  status: string;
  negociacao: boolean;
  created_at: string;
  clientes?: { nome: string } | Array<{ nome: string }> | null;
  veiculos?:
    | { placa: string; marca: string | null; modelo: string | null; imagem_url: string | null }
    | Array<{ placa: string; marca: string | null; modelo: string | null; imagem_url: string | null }>
    | null;
};

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selected, setSelected] = useState<Orcamento | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Orcamento | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, cliente_id, codigo_acesso, nome, descricao, inicio_em, retorno_em, local_saida, local_chegada, tipo, valor_centavos, status, negociacao, created_at, clientes:cliente_id(nome), veiculos:veiculo_id(placa, marca, modelo, imagem_url)")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const lista = data as unknown as Orcamento[];
      setOrcamentos(lista);
      setSelectedIds((prev) => prev.filter((id) => lista.some((o) => o.id === id)));
      setLoading(false);
      return lista;
    } else {
      setOrcamentos([]);
      setErro(error?.message ?? "Falha ao carregar orçamentos.");
      setLoading(false);
      return [] as Orcamento[];
    }
  }

  function nomeCliente(o: Orcamento) {
    if (!o.clientes) return "—";
    if (Array.isArray(o.clientes)) return o.clientes[0]?.nome ?? "—";
    return o.clientes.nome ?? "—";
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const contador = orcamentos.length;
  const allSelected = contador > 0 && selectedIds.length === contador;

  function toggleSelecionado(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelecionarTodos() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orcamentos.map((o) => o.id));
    }
  }

  async function atualizarStatus(id: string, status: string) {
    setUpdatingStatus(true);

    const patch: { status: string; negociacao?: boolean } = { status };
    if (status === "negado") patch.negociacao = true;

    let { error } = await supabase.from("orcamentos").update(patch).eq("id", id);

    // Compatibilidade com bancos ainda no status antigo ('recusado'/'pendente')
    if (error && status === "negado") {
      const fallback = await supabase
        .from("orcamentos")
        .update({ status: "recusado", negociacao: true })
        .eq("id", id);
      error = fallback.error;
    }

    if (error) {
      console.error(error);
      alert("Não foi possível atualizar o status do orçamento.");
      setUpdatingStatus(false);
      return;
    }

    setUpdatingStatus(false);
    const atualizados = await carregar();

    if (selected?.id === id) {
      const novo = atualizados.find((o) => o.id === id) ?? null;
      setSelected(novo);
    }
  }

  async function compartilhar(o: Orcamento) {
    if (!o.codigo_acesso) {
      alert("Este orçamento ainda não possui código de acesso.");
      return;
    }

    const base = window.location.origin;
    const link = `${base}/orcamento/${o.id}?codigo=${o.codigo_acesso}`;

    try {
      await navigator.clipboard.writeText(link);
      if (o.status === "criado" || o.status === "pendente") {
        await supabase.from("orcamentos").update({ status: "enviado" }).eq("id", o.id);
        await carregar();
      }
      alert(`Link copiado!\nCódigo de acesso: ${o.codigo_acesso}`);
    } catch {
      prompt(`Copie o link e envie ao cliente (código: ${o.codigo_acesso})`, link);
    }
  }

  function statusLabel(status: string) {
    if (status === "criado") return "Criado";
    if (status === "enviado") return "Enviado";
    if (status === "aguardando_resposta") return "Aguardando resposta";
    if (status === "aprovado") return "Aprovado";
    if (status === "negado") return "Negado";
    if (status === "recusado") return "Negado";
    if (status === "pendente") return "Pendente";
    return status;
  }

  function getVeiculo(o: Orcamento) {
    if (!o.veiculos) return null;
    if (Array.isArray(o.veiculos)) return o.veiculos[0] ?? null;
    return o.veiculos;
  }

  function veiculoLabel(o: Orcamento) {
    const v = getVeiculo(o);
    if (!v) return "—";
    const desc = [v.marca, v.modelo].filter(Boolean).join(" ");
    return `${v.placa}${desc ? ` — ${desc}` : ""}`;
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("orcamentos").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir orçamento: " + error.message);
      return;
    }

    setDeleteTarget(null);
    setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
    await carregar();
  }

  async function excluirSelecionados() {
    if (selectedIds.length === 0) return;

    setBulkDeleting(true);
    const { error } = await supabase.from("orcamentos").delete().in("id", selectedIds);
    setBulkDeleting(false);

    if (error) {
      alert("Erro ao excluir orçamentos selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos"
        description="Listagem de orçamentos recebidos. Aprove, recuse ou negocie."
        actions={
          <>
            <Link href="/orcamentos/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">+ Novo Orçamento</Link>
            <button onClick={carregar} className="ml-2 border border-slate-300 px-4 py-2 rounded-md">Recarregar</button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Mostrando <span className="font-semibold">{contador}</span> orçamentos.
          </div>

          {selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="px-3 py-2 text-sm border border-red-200 text-red-700 rounded-md hover:bg-red-50"
            >
              Excluir selecionados ({selectedIds.length})
            </button>
          ) : null}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {erro ? (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            Erro ao carregar orçamentos: {erro}
          </div>
        ) : null}

        {loading ? (
          <div>Carregando...</div>
        ) : orcamentos.length === 0 ? (
          <div className="text-slate-600">Nenhum orçamento encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelecionarTodos}
                      title="Selecionar todos"
                    />
                  </th>
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-0">Criado em</th>
                  <th className="py-2 pr-0">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orcamentos.map((o) => (
                  <tr key={o.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(o.id)}
                        onChange={() => toggleSelecionado(o.id)}
                        title="Selecionar orçamento"
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <button
                        type="button"
                        onClick={() => setSelected(o)}
                        className="text-left hover:underline"
                        title="Ver informações do orçamento"
                      >
                        {o.nome ?? "(Sem nome)"}
                      </button>
                    </td>
                    <td className="py-2 pr-4">{nomeCliente(o)}</td>
                    <td className="py-2 pr-4">{veiculoLabel(o)}</td>
                    <td className="py-2 pr-4">{o.tipo}</td>
                    <td className="py-2 pr-4">{o.valor_centavos != null ? `R$ ${(o.valor_centavos/100).toFixed(2)}` : '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${o.status==='aprovado'? 'border-green-200 text-green-700 bg-green-50' : o.status==='negado'? 'border-red-200 text-red-700 bg-red-50' : 'border-slate-200 text-slate-700 bg-slate-50'}`}>
                        {statusLabel(o.status)}{o.negociacao? ' • negociação':''}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{o.codigo_acesso ?? '—'}</td>
                    <td className="py-2 pr-0">{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                    <td className="py-2 pr-0">
                      <div className="flex gap-2">
                        <button
                          onClick={() => compartilhar(o)}
                          className="px-2 py-1 border border-slate-300 rounded-md text-sm"
                          title="Compartilhar orçamento"
                        >
                          🔗
                        </button>
                        <button
                          onClick={() => setDeleteTarget(o)}
                          className="px-3 py-1 border border-red-200 text-red-700 rounded-md text-sm"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Informações do orçamento</h2>
                <p className="text-sm text-slate-600">{selected.nome ?? "(Sem nome)"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/orcamentos/${selected.id}`}
                  className="px-3 py-1 border border-blue-200 text-blue-700 rounded-md text-sm hover:bg-blue-50"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-3 py-1 border border-slate-300 rounded-md text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div><span className="text-slate-500">Cliente:</span> {nomeCliente(selected)}</div>
              <div><span className="text-slate-500">Veículo:</span> {veiculoLabel(selected)}</div>
              <div><span className="text-slate-500">Tipo:</span> {selected.tipo}</div>
              <div>
                <span className="text-slate-500">Valor:</span>{" "}
                {selected.valor_centavos != null ? `R$ ${(selected.valor_centavos / 100).toFixed(2)}` : "—"}
              </div>
              <div><span className="text-slate-500">Saída:</span> {selected.local_saida ?? "—"}</div>
              <div><span className="text-slate-500">Chegada:</span> {selected.local_chegada ?? "—"}</div>
              <div>
                <span className="text-slate-500">Início:</span>{" "}
                {selected.inicio_em ? new Date(selected.inicio_em).toLocaleString("pt-BR") : "—"}
              </div>
              <div>
                <span className="text-slate-500">Retorno:</span>{" "}
                {selected.retorno_em ? new Date(selected.retorno_em).toLocaleString("pt-BR") : "—"}
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500">Descrição:</span>
                <p className="mt-1 whitespace-pre-wrap">{selected.descricao ?? "—"}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {selected.status !== "aprovado" ? (
                <button
                  type="button"
                  onClick={() => atualizarStatus(selected.id, "aprovado")}
                  disabled={updatingStatus}
                  className="px-3 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-60"
                >
                  {updatingStatus ? "Salvando..." : "Aceitar orçamento"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => atualizarStatus(selected.id, "negado")}
                disabled={updatingStatus}
                className="px-3 py-2 bg-amber-600 text-white rounded-md text-sm disabled:opacity-60"
              >
                {updatingStatus ? "Salvando..." : "Entrar em negociação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir orçamentos selecionados"
        description={`Deseja excluir ${selectedIds.length} orçamento(s) selecionado(s)?`}
        confirmLabel="Excluir selecionados"
        loading={bulkDeleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionados}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={`Deseja excluir o orçamento "${deleteTarget?.nome ?? deleteTarget?.id ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />
    </div>
  );
}
