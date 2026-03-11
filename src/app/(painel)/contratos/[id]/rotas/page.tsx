"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Rota = {
  id: string;
  nome: string;
  origem: string | null;
  destino: string | null;
  ordem: number;
  ativo: boolean;
};

type Ponto = {
  id: string;
  contrato_rota_id: string;
  nome: string;
  cidade: string | null;
  ordem: number;
  ativo: boolean;
};

export default function ContratoRotasPage() {
  const params = useParams<{ id: string }>();
  const contratoId = params?.id;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [tituloContrato, setTituloContrato] = useState("");
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);

  const [rotaNome, setRotaNome] = useState("");
  const [rotaOrigem, setRotaOrigem] = useState("");
  const [rotaDestino, setRotaDestino] = useState("");

  const [rotaSel, setRotaSel] = useState("");
  const [pontoNome, setPontoNome] = useState("");
  const [pontoCidade, setPontoCidade] = useState("");

  async function carregar() {
    if (!contratoId) return;
    setLoading(true);
    setErro("");

    const [
      { data: ct, error: errCt },
      { data: rs, error: errRs },
      { data: ps, error: errPs },
    ] = await Promise.all([
      supabase.from("contratos").select("nome").eq("id", contratoId).maybeSingle(),
      supabase.from("contrato_rotas").select("id,nome,origem,destino,ordem,ativo").eq("contrato_id", contratoId).order("ordem", { ascending: true }),
      supabase.from("contrato_rota_pontos").select("id,contrato_rota_id,nome,cidade,ordem,ativo").order("ordem", { ascending: true }),
    ]);

    const firstErr = errCt ?? errRs ?? errPs;
    if (firstErr) {
      setErro(firstErr.message);
      setLoading(false);
      return;
    }

    const listRotas = (rs ?? []) as Rota[];
    setTituloContrato((ct?.nome as string) ?? "Contrato");
    setRotas(listRotas);
    setPontos((ps ?? []) as Ponto[]);
    if (!rotaSel && listRotas[0]?.id) setRotaSel(listRotas[0].id);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  const pontosDaRota = useMemo(() => pontos.filter((p) => p.contrato_rota_id === rotaSel), [pontos, rotaSel]);

  async function criarRota() {
    if (!rotaNome.trim()) return alert("Informe o nome da rota.");
    const ordem = (rotas[rotas.length - 1]?.ordem ?? 0) + 1;
    const { error } = await supabase.from("contrato_rotas").insert({
      contrato_id: contratoId,
      nome: rotaNome.trim(),
      origem: rotaOrigem.trim() || null,
      destino: rotaDestino.trim() || null,
      ordem,
      ativo: true,
    });
    if (error) return alert(error.message);
    setRotaNome("");
    setRotaOrigem("");
    setRotaDestino("");
    setMsg("Rota criada.");
    await carregar();
  }

  async function criarPonto() {
    if (!rotaSel) return alert("Selecione uma rota.");
    if (!pontoNome.trim()) return alert("Informe o nome do ponto.");
    const ordem = (pontosDaRota[pontosDaRota.length - 1]?.ordem ?? 0) + 1;
    const { error } = await supabase.from("contrato_rota_pontos").insert({
      contrato_rota_id: rotaSel,
      nome: pontoNome.trim(),
      cidade: pontoCidade.trim() || null,
      ordem,
      ativo: true,
    });
    if (error) return alert(error.message);
    setPontoNome("");
    setPontoCidade("");
    setMsg("Ponto criado.");
    await carregar();
  }

  async function salvarRota(r: Rota) {
    const { error } = await supabase
      .from("contrato_rotas")
      .update({
        nome: r.nome,
        origem: r.origem,
        destino: r.destino,
        ordem: r.ordem,
        ativo: r.ativo,
      })
      .eq("id", r.id);
    if (error) return alert(error.message);
    setMsg("Rota atualizada.");
    await carregar();
  }

  async function removerRota(r: Rota) {
    if (!confirm(`Remover rota \"${r.nome}\"?`)) return;
    const { error } = await supabase.from("contrato_rotas").delete().eq("id", r.id);
    if (error) return alert(error.message);
    setMsg("Rota removida.");
    if (rotaSel === r.id) setRotaSel("");
    await carregar();
  }

  async function salvarPonto(p: Ponto) {
    const { error } = await supabase
      .from("contrato_rota_pontos")
      .update({
        nome: p.nome,
        cidade: p.cidade,
        ordem: p.ordem,
        ativo: p.ativo,
      })
      .eq("id", p.id);
    if (error) return alert(error.message);
    setMsg("Ponto atualizado.");
    await carregar();
  }

  async function removerPonto(p: Ponto) {
    if (!confirm(`Remover ponto \"${p.nome}\"?`)) return;
    const { error } = await supabase.from("contrato_rota_pontos").delete().eq("id", p.id);
    if (error) return alert(error.message);
    setMsg("Ponto removido.");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Rotas e Pontos</h1>
          <p className="text-sm text-slate-600">{tituloContrato}</p>
        </div>
        <Link href={`/contratos/${contratoId}`} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
          Voltar
        </Link>
      </div>

      {erro ? <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</div> : null}
      {msg ? <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{msg}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid md:grid-cols-4 gap-3">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome da rota" value={rotaNome} onChange={(e) => setRotaNome(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Origem" value={rotaOrigem} onChange={(e) => setRotaOrigem(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Destino" value={rotaDestino} onChange={(e) => setRotaDestino(e.target.value)} />
        <button onClick={criarRota} className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700">+ Rota</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid md:grid-cols-4 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={rotaSel} onChange={(e) => setRotaSel(e.target.value)}>
          <option value="">Selecione a rota</option>
          {rotas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome do ponto" value={pontoNome} onChange={(e) => setPontoNome(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Cidade" value={pontoCidade} onChange={(e) => setPontoCidade(e.target.value)} />
        <button onClick={criarPonto} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">+ Ponto</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? <div className="text-slate-600">Carregando...</div> : (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h2 className="font-semibold text-slate-900 mb-2">Rotas</h2>
              <div className="space-y-2 text-sm">
                {rotas.map((r) => (
                  <div key={r.id} className="border border-slate-200 rounded-md px-3 py-2 space-y-2">
                    <div className="grid md:grid-cols-4 gap-2">
                      <input
                        className="border border-slate-300 rounded px-2 py-1"
                        value={r.nome}
                        onChange={(e) => setRotas((prev) => prev.map((x) => x.id === r.id ? { ...x, nome: e.target.value } : x))}
                      />
                      <input
                        className="border border-slate-300 rounded px-2 py-1"
                        value={r.origem ?? ""}
                        onChange={(e) => setRotas((prev) => prev.map((x) => x.id === r.id ? { ...x, origem: e.target.value || null } : x))}
                        placeholder="Origem"
                      />
                      <input
                        className="border border-slate-300 rounded px-2 py-1"
                        value={r.destino ?? ""}
                        onChange={(e) => setRotas((prev) => prev.map((x) => x.id === r.id ? { ...x, destino: e.target.value || null } : x))}
                        placeholder="Destino"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-16 border border-slate-300 rounded px-2 py-1"
                          value={r.ordem}
                          onChange={(e) => setRotas((prev) => prev.map((x) => x.id === r.id ? { ...x, ordem: Number(e.target.value || 1) } : x))}
                        />
                        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={r.ativo} onChange={(e) => setRotas((prev) => prev.map((x) => x.id === r.id ? { ...x, ativo: e.target.checked } : x))} /> Ativa</label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setRotaSel(r.id)} className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">Selecionar</button>
                      <button onClick={() => salvarRota(r)} className="px-2 py-1 text-xs border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">Salvar</button>
                      <button onClick={() => removerRota(r)} className="px-2 py-1 text-xs border border-rose-300 text-rose-700 rounded hover:bg-rose-50">Remover</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 mb-2">Pontos da rota selecionada</h2>
              <div className="space-y-2 text-sm">
                {pontosDaRota.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-md px-3 py-2 space-y-2">
                    <div className="grid md:grid-cols-4 gap-2">
                      <input className="border border-slate-300 rounded px-2 py-1" value={p.nome} onChange={(e) => setPontos((prev) => prev.map((x) => x.id === p.id ? { ...x, nome: e.target.value } : x))} />
                      <input className="border border-slate-300 rounded px-2 py-1" value={p.cidade ?? ""} onChange={(e) => setPontos((prev) => prev.map((x) => x.id === p.id ? { ...x, cidade: e.target.value || null } : x))} />
                      <input type="number" className="border border-slate-300 rounded px-2 py-1" value={p.ordem} onChange={(e) => setPontos((prev) => prev.map((x) => x.id === p.id ? { ...x, ordem: Number(e.target.value || 1) } : x))} />
                      <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={p.ativo} onChange={(e) => setPontos((prev) => prev.map((x) => x.id === p.id ? { ...x, ativo: e.target.checked } : x))} /> Ativo</label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => salvarPonto(p)} className="px-2 py-1 text-xs border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">Salvar</button>
                      <button onClick={() => removerPonto(p)} className="px-2 py-1 text-xs border border-rose-300 text-rose-700 rounded hover:bg-rose-50">Remover</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
