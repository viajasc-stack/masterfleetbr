"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionIconLink } from "@/components/ui/ActionIcon";
import { supabase } from "@/lib/supabase/client";

type Passageiro = {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  status: string;
  cidade: string | null;
  uf: string | null;
  created_at: string;
};

type ResponsavelPagamento = {
  passageiro_id: string;
  texto: string;
};

export default function PassageirosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [passageiros, setPassageiros] = useState<Passageiro[]>([]);
  const [responsaveisPagamento, setResponsaveisPagamento] = useState<Record<string, string>>({});

  const [busca, setBusca] = useState("");
  const [filtroPagante, setFiltroPagante] = useState<"todos" | "particular" | "empresa">("todos");

  async function carregarPassageiros() {
    setLoading(true);
    setErro("");

    const { data, error } = await supabase
      .from("passageiros")
      .select("id, nome, email, cpf, rg, data_nascimento, telefone, status, cidade, uf, created_at")
      .order("nome", { ascending: true });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    const passageirosRows = (data ?? []) as Passageiro[];
    setPassageiros(passageirosRows);

    if (passageirosRows.length === 0) {
      setResponsaveisPagamento({});
      setLoading(false);
      return;
    }

    const passageiroIds = passageirosRows.map((p) => p.id);
    const { data: vinculosData } = await supabase
      .from("contrato_passageiros")
      .select("passageiro_id, contrato_id, tipo_pagante, empresa_pagante_id, status, created_at")
      .in("passageiro_id", passageiroIds)
      .order("created_at", { ascending: true });

    const vinculos =
      (vinculosData ?? []) as Array<{
        passageiro_id: string;
        contrato_id: string;
        tipo_pagante: "PARTICULAR" | "EMPRESA";
        empresa_pagante_id: string | null;
        status: "ATIVO" | "INATIVO";
        created_at: string;
      }>;

    const contratoIds = Array.from(new Set(vinculos.map((v) => v.contrato_id)));
    const empresaPaganteIds = Array.from(new Set(vinculos.map((v) => v.empresa_pagante_id).filter(Boolean))) as string[];

    const contratosRows: Array<{ id: string; cliente_id: string | null }> =
      contratoIds.length > 0
        ? (((await supabase.from("contratos").select("id, cliente_id").in("id", contratoIds)).data ?? []) as Array<{
            id: string;
            cliente_id: string | null;
          }>)
        : [];
    const clienteIdsDosContratos = Array.from(new Set(contratosRows.map((c) => c.cliente_id).filter(Boolean))) as string[];

    const clientesDiretosData: Array<{ id: string; nome: string }> =
      empresaPaganteIds.length > 0
        ? (((await supabase.from("clientes").select("id, nome").in("id", empresaPaganteIds)).data ?? []) as Array<{
            id: string;
            nome: string;
          }>)
        : [];

    const { data: clientesContratosData } =
      clienteIdsDosContratos.length > 0
        ? await supabase.from("clientes").select("id, nome").in("id", clienteIdsDosContratos)
        : { data: [] };

    const clientesRows = [
      ...clientesDiretosData,
      ...((clientesContratosData ?? []) as Array<{ id: string; nome: string }>),
    ];

    const clienteNomeById = new Map<string, string>(clientesRows.map((c) => [c.id, c.nome]));
    const contratoClienteById = new Map<string, string | null>(contratosRows.map((c) => [c.id, c.cliente_id]));

    const porPassageiro = new Map<string, typeof vinculos>();
    for (const v of vinculos) {
      porPassageiro.set(v.passageiro_id, [...(porPassageiro.get(v.passageiro_id) ?? []), v]);
    }

    const responsavelList: ResponsavelPagamento[] = passageirosRows.map((p) => {
      const lista = porPassageiro.get(p.id) ?? [];
      if (lista.length === 0) return { passageiro_id: p.id, texto: "—" };

      const escolhido = lista.find((v) => v.status === "ATIVO") ?? lista[0];
      if (escolhido.tipo_pagante === "PARTICULAR") return { passageiro_id: p.id, texto: "Particular" };

      const nomeEmpresaDireta = escolhido.empresa_pagante_id ? clienteNomeById.get(escolhido.empresa_pagante_id) : null;
      if (nomeEmpresaDireta) return { passageiro_id: p.id, texto: `Empresa: ${nomeEmpresaDireta}` };

      const clienteContratoId = contratoClienteById.get(escolhido.contrato_id);
      const nomeClienteContrato = clienteContratoId ? clienteNomeById.get(clienteContratoId) : null;
      if (nomeClienteContrato) return { passageiro_id: p.id, texto: `Empresa: ${nomeClienteContrato}` };

      return { passageiro_id: p.id, texto: "Empresa" };
    });

    setResponsaveisPagamento(Object.fromEntries(responsavelList.map((r) => [r.passageiro_id, r.texto])));
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregarPassageiros();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const passageirosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return passageiros.filter((p) => {
      const pagante = responsaveisPagamento[p.id] ?? "";
      if (filtroPagante === "particular" && !pagante.toLowerCase().startsWith("particular")) return false;
      if (filtroPagante === "empresa" && !pagante.toLowerCase().startsWith("empresa")) return false;

      if (!q) return true;
      const alvo = [
        p.nome,
        p.email ?? "",
        p.cpf ?? "",
        p.rg ?? "",
        p.telefone ?? "",
        p.cidade ?? "",
        p.uf ?? "",
        p.status,
      ]
        .join(" ")
        .toLowerCase();
      return alvo.includes(q);
    });
  }, [passageiros, busca, responsaveisPagamento, filtroPagante]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passageiros"
        description="Listagem de passageiros cadastrados no sistema."
        actions={
          <div className="flex items-center">
            <Link href="/passageiros/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Adicionar passageiro
            </Link>
          </div>
        }
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Passageiros cadastrados</h2>
          <div className="flex w-full max-w-2xl gap-2">
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              placeholder="Buscar passageiro por nome/CPF/telefone"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              className="border border-slate-300 rounded-md px-3 py-2"
              value={filtroPagante}
              onChange={(e) => setFiltroPagante(e.target.value as "todos" | "particular" | "empresa")}
            >
              <option value="todos">Todos pagantes</option>
              <option value="particular">Particular</option>
              <option value="empresa">Empresa</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-600">Carregando...</div>
        ) : passageirosFiltrados.length === 0 ? (
          <div className="text-sm text-slate-600">Nenhum passageiro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Passageiro</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Pagante</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Localidade</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {passageirosFiltrados.map((p) => {
                  return (
                    <tr key={p.id} className="border-b last:border-b-0 align-top">
                      <td className="py-2 pr-4">
                        <Link href={`/passageiros/${p.id}`} className="font-medium text-slate-900 hover:underline">
                          {p.nome}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-slate-700">{p.telefone ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-700">
                        {(() => {
                          const pagante = responsaveisPagamento[p.id] ?? "—";
                          const isParticular = pagante.toLowerCase().startsWith("particular");
                          const cls = isParticular
                            ? "border-slate-300 text-slate-700 bg-slate-50"
                            : "border-blue-200 text-blue-700 bg-blue-50";
                          return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${cls}`}>{pagante}</span>;
                        })()}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">{p.status}</td>
                      <td className="py-2 pr-4 text-slate-700">{[p.cidade, p.uf].filter(Boolean).join("/") || "—"}</td>
                      <td className="py-2 pr-0 text-right">
                        <div className="inline-flex items-center gap-2">
                          <ActionIconLink href={`/passageiros/${p.id}`} title="Associar operação" variant="success">
                            🛣️
                          </ActionIconLink>
                          <ActionIconLink href={`/passageiros/${p.id}/cadastro`} title="Editar cadastro" variant="primary">
                            ✏️
                          </ActionIconLink>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
