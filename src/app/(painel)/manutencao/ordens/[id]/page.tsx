"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { adicionarPecaNaOS, finalizarOrdem, loadOptions, moeda, ordemStatusOptions } from "@/lib/manutencao";
import { StatusBadge } from "@/components/manutencao/StatusBadge";

type Ordem = {
  id: string;
  tipo: string;
  status: string;
  prioridade: string;
  diagnostico: string | null;
  km: number | null;
  custo_total: number;
  data_abertura: string;
  data_conclusao: string | null;
  fornecedor_id: string | null;
  anexos: unknown;
  veiculos: { placa: string | null; modelo: string | null } | null;
};

type Peca = {
  id: string;
  quantidade: number;
  valor_unitario: number;
  origem: "estoque" | "compra";
  itens_estoque: { nome: string | null } | null;
};

type Servico = {
  id: string;
  descricao: string | null;
  valor: number;
  tipos_servico: { nome: string | null } | null;
};

const abas = ["dados-gerais", "diagnostico", "pecas", "servicos", "financeiro", "anexos"] as const;
type Aba = (typeof abas)[number];

export default function OrdemManutencaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [aba, setAba] = useState<Aba>("dados-gerais");
  const [ordem, setOrdem] = useState<Ordem | null>(null);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [itensEstoque, setItensEstoque] = useState<Array<{ id: string; nome: string }>>([]);
  const [locais, setLocais] = useState<Array<{ id: string; nome: string }>>([]);
  const [tiposServico, setTiposServico] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [novoStatus, setNovoStatus] = useState("aberta");
  const [novoDiagnostico, setNovoDiagnostico] = useState("");

  const [pecaItemId, setPecaItemId] = useState("");
  const [pecaLocalId, setPecaLocalId] = useState("");
  const [pecaQtd, setPecaQtd] = useState("");
  const [pecaValor, setPecaValor] = useState("");
  const [pecaOrigem, setPecaOrigem] = useState<"estoque" | "compra">("estoque");

  const [srvTipoId, setSrvTipoId] = useState("");
  const [srvDesc, setSrvDesc] = useState("");
  const [srvValor, setSrvValor] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const [ordRes, pecRes, srvRes, itensRes, locaisRes, tiposRes] = await Promise.all([
      supabase
        .from("ordens_manutencao")
        .select("id,tipo,status,prioridade,diagnostico,km,custo_total,data_abertura,data_conclusao,fornecedor_id,anexos,veiculos(placa,modelo)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("manutencao_pecas").select("id,quantidade,valor_unitario,origem,itens_estoque(nome)").eq("ordem_id", id),
      supabase.from("manutencao_servicos").select("id,descricao,valor,tipos_servico(nome)").eq("ordem_id", id),
      loadOptions("itens_estoque", "nome", true),
      loadOptions("locais_estoque", "nome", true),
      loadOptions("tipos_servico", "nome", true),
    ]);

    const ord = (ordRes.data as Ordem | null) ?? null;
    setOrdem(ord);
    setPecas((pecRes.data as Peca[] | null) ?? []);
    setServicos((srvRes.data as Servico[] | null) ?? []);
    setItensEstoque(itensRes);
    setLocais(locaisRes);
    setTiposServico(tiposRes);

    setNovoStatus(ord?.status ?? "aberta");
    setNovoDiagnostico(ord?.diagnostico ?? "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function salvarDadosGerais() {
    await supabase.from("ordens_manutencao").update({ status: novoStatus, diagnostico: novoDiagnostico }).eq("id", id);
    await carregar();
  }

  async function addPeca() {
    if (!pecaItemId || !pecaQtd || !pecaValor) return;
    await adicionarPecaNaOS({
      ordemId: id,
      itemId: pecaItemId,
      localEstoqueId: pecaLocalId,
      quantidade: Number(pecaQtd),
      valorUnitario: Number(pecaValor),
      origem: pecaOrigem,
    });
    setPecaItemId("");
    setPecaLocalId("");
    setPecaQtd("");
    setPecaValor("");
    await carregar();
  }

  async function addServico() {
    await supabase.from("manutencao_servicos").insert({
      ordem_id: id,
      tipo_servico_id: srvTipoId || null,
      descricao: srvDesc || null,
      valor: Number(srvValor || 0),
    });
    setSrvTipoId("");
    setSrvDesc("");
    setSrvValor("");
    await carregar();
  }

  async function concluir() {
    await finalizarOrdem(id);
    await carregar();
  }

  const totalPecas = useMemo(() => pecas.reduce((acc, p) => acc + Number(p.quantidade) * Number(p.valor_unitario), 0), [pecas]);
  const totalServicos = useMemo(() => servicos.reduce((acc, s) => acc + Number(s.valor), 0), [servicos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Detalhe da Ordem"
        description={ordem ? `Veículo ${ordem.veiculos?.placa ?? "—"} • ${ordem.tipo}` : ""}
        actions={
          <>
            <Link href="/manutencao/ordens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">Voltar</Link>
            <button type="button" onClick={() => void concluir()} className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-500">Finalizar OS</button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap gap-2">
          {abas.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setAba(item)}
              className={`px-3 py-1.5 rounded-md text-sm border ${aba === item ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 hover:bg-slate-50"}`}
            >
              {item.replaceAll("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {loading || !ordem ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : null}

      {!loading && ordem && aba === "dados-gerais" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div><span className="text-slate-500">Veículo</span><p className="font-medium">{ordem.veiculos?.placa ?? "—"}</p></div>
            <div><span className="text-slate-500">Tipo</span><p>{ordem.tipo}</p></div>
            <div><span className="text-slate-500">Prioridade</span><p>{ordem.prioridade}</p></div>
            <div><span className="text-slate-500">Status</span><p><StatusBadge status={ordem.status} /></p></div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select className="border border-slate-300 rounded-md px-3 py-2" value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)}>
              {ordemStatusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Diagnóstico" value={novoDiagnostico} onChange={(e) => setNovoDiagnostico(e.target.value)} />
          </div>

          <button type="button" onClick={() => void salvarDadosGerais()} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">
            Salvar dados gerais
          </button>
        </div>
      ) : null}

      {!loading && ordem && aba === "diagnostico" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2" rows={4} value={novoDiagnostico} onChange={(e) => setNovoDiagnostico(e.target.value)} />
          <button type="button" onClick={() => void salvarDadosGerais()} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">
            Salvar diagnóstico
          </button>
        </div>
      ) : null}

      {!loading && ordem && aba === "pecas" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <select className="border border-slate-300 rounded-md px-3 py-2" value={pecaItemId} onChange={(e) => setPecaItemId(e.target.value)}>
              <option value="">Item</option>
              {itensEstoque.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
            <select className="border border-slate-300 rounded-md px-3 py-2" value={pecaLocalId} onChange={(e) => setPecaLocalId(e.target.value)}>
              <option value="">Local</option>
              {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <input type="number" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Qtd" value={pecaQtd} onChange={(e) => setPecaQtd(e.target.value)} />
            <input type="number" step="0.01" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Valor unit." value={pecaValor} onChange={(e) => setPecaValor(e.target.value)} />
            <select className="border border-slate-300 rounded-md px-3 py-2" value={pecaOrigem} onChange={(e) => setPecaOrigem(e.target.value as "estoque" | "compra")}> 
              <option value="estoque">estoque</option>
              <option value="compra">compra</option>
            </select>
          </div>

          <button type="button" onClick={() => void addPeca()} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">Adicionar peça</button>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Origem</th>
                  <th className="py-2 pr-4">Qtd</th>
                  <th className="py-2 pr-4">Valor unit.</th>
                  <th className="py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{p.itens_estoque?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{p.origem}</td>
                    <td className="py-2 pr-4">{p.quantidade}</td>
                    <td className="py-2 pr-4">{moeda(p.valor_unitario)}</td>
                    <td className="py-2">{moeda(Number(p.quantidade) * Number(p.valor_unitario))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && ordem && aba === "servicos" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="border border-slate-300 rounded-md px-3 py-2" value={srvTipoId} onChange={(e) => setSrvTipoId(e.target.value)}>
              <option value="">Tipo de serviço</option>
              {tiposServico.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Descrição" value={srvDesc} onChange={(e) => setSrvDesc(e.target.value)} />
            <input type="number" step="0.01" className="border border-slate-300 rounded-md px-3 py-2" placeholder="Valor" value={srvValor} onChange={(e) => setSrvValor(e.target.value)} />
          </div>
          <button type="button" onClick={() => void addServico()} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">Adicionar serviço</button>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Descrição</th>
                  <th className="py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{s.tipos_servico?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{s.descricao ?? "—"}</td>
                    <td className="py-2">{moeda(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && ordem && aba === "financeiro" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-slate-500">Total peças</p>
            <p className="text-lg font-semibold">{moeda(totalPecas)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-slate-500">Total serviços</p>
            <p className="text-lg font-semibold">{moeda(totalServicos)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-slate-500">Custo total OS</p>
            <p className="text-lg font-semibold">{moeda(ordem.custo_total)}</p>
          </div>
        </div>
      ) : null}

      {!loading && ordem && aba === "anexos" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm">
          <p className="text-slate-500 mb-2">Anexos (JSON)</p>
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded-md p-3 overflow-auto">{JSON.stringify(ordem.anexos ?? [], null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
