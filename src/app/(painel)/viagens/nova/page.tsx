"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ViagemStatus =
  | "rascunho"
  | "publicada"
  | "vendas_abertas"
  | "lotada"
  | "encerrada"
  | "finalizada"
  | "cancelada";

type ViagemCategoria =
  | "turismo"
  | "compras"
  | "religioso"
  | "evento"
  | "bate_volta"
  | "interestadual"
  | "outros";

export default function NovaViagemPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [erroSessao, setErroSessao] = useState("");

  const [titulo, setTitulo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [categoria, setCategoria] = useState<ViagemCategoria>("turismo");
  const [status, setStatus] = useState<ViagemStatus>("rascunho");

  const [dataIda, setDataIda] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [horaRetorno, setHoraRetorno] = useState("");
  const [prazoVendaOnline, setPrazoVendaOnline] = useState("");
  const [prazoVendaInterna, setPrazoVendaInterna] = useState("");

  const [cidadeSaida, setCidadeSaida] = useState("");
  const [localEmbarque, setLocalEmbarque] = useState("");
  const [cidadeDestino, setCidadeDestino] = useState("");

  const [valor, setValor] = useState("");
  const [valorPromocional, setValorPromocional] = useState("");
  const [vendasIlimitadas, setVendasIlimitadas] = useState(false);
  const [capacidadeTotal, setCapacidadeTotal] = useState("");

  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [descricaoCompleta, setDescricaoCompleta] = useState("");

  useEffect(() => {
    async function loadSession() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setErroSessao("Você não está logado. Faça login para criar viagens.");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        setErroSessao(error.message);
        return;
      }

      if (!profile?.empresa_id) {
        setErroSessao("Usuário sem empresa vinculada.");
        return;
      }

      setEmpresaId(profile.empresa_id);
      setErroSessao("");
    }

    const id = setTimeout(() => {
      void loadSession();
    }, 0);

    return () => clearTimeout(id);
  }, []);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!empresaId) {
      alert("Sem empresa vinculada para salvar viagem.");
      return;
    }

    if (!titulo.trim()) {
      alert("Informe o título da viagem.");
      return;
    }

    if (!dataIda) {
      alert("Informe a data de ida.");
      return;
    }

    if (!valor) {
      alert("Informe o valor da viagem.");
      return;
    }

    if (!vendasIlimitadas && (!capacidadeTotal || Number(capacidadeTotal) <= 0)) {
      alert("Informe uma capacidade total válida ou marque vendas ilimitadas.");
      return;
    }

    setLoading(true);

    const payload = {
      empresa_id: empresaId,
      codigo: codigo.trim() || null,
      titulo: titulo.trim(),
      categoria,
      status,
      data_ida: dataIda,
      hora_saida: horaSaida || null,
      data_retorno: dataRetorno || null,
      hora_retorno_prevista: horaRetorno || null,
      prazo_final_venda_online: prazoVendaOnline ? new Date(prazoVendaOnline).toISOString() : null,
      prazo_final_venda_interna: prazoVendaInterna ? new Date(prazoVendaInterna).toISOString() : null,
      cidade_saida: cidadeSaida.trim() || null,
      local_embarque: localEmbarque.trim() || null,
      cidade_destino: cidadeDestino.trim() || null,
      valor: Number(valor),
      valor_promocional: valorPromocional ? Number(valorPromocional) : null,
      vendas_ilimitadas: vendasIlimitadas,
      capacidade_total: vendasIlimitadas ? null : Number(capacidadeTotal),
      descricao_curta: descricaoCurta.trim() || null,
      descricao_completa: descricaoCompleta.trim() || null,
    };

    const { error } = await supabase.from("viagens").insert(payload);
    setLoading(false);

    if (error) {
      alert(`Erro ao salvar viagem: ${error.message}`);
      return;
    }

    router.push("/viagens");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Nova Viagem</h1>
          <p className="text-slate-600 text-sm">Cadastro inicial do módulo de viagens (fase 1).</p>
        </div>
        <Link href="/viagens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
          Voltar
        </Link>
      </div>

      {erroSessao ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{erroSessao}</div>
      ) : null}

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium mb-1">Título *</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Código</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="VIA-2026-0001" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={categoria} onChange={(e) => setCategoria(e.target.value as ViagemCategoria)}>
              <option value="turismo">Turismo</option>
              <option value="compras">Compras</option>
              <option value="religioso">Religioso</option>
              <option value="evento">Evento</option>
              <option value="bate_volta">Bate-volta</option>
              <option value="interestadual">Interestadual</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as ViagemStatus)}>
              <option value="rascunho">Rascunho</option>
              <option value="publicada">Publicada</option>
              <option value="vendas_abertas">Vendas abertas</option>
              <option value="lotada">Lotada</option>
              <option value="encerrada">Encerrada</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Data ida *</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataIda} onChange={(e) => setDataIda(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hora saída</label>
            <input type="time" className="w-full border border-slate-300 rounded-md px-3 py-2" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Data retorno</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hora retorno</label>
            <input type="time" className="w-full border border-slate-300 rounded-md px-3 py-2" value={horaRetorno} onChange={(e) => setHoraRetorno(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cidade saída</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cidadeSaida} onChange={(e) => setCidadeSaida(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Local embarque</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={localEmbarque} onChange={(e) => setLocalEmbarque(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cidade destino</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={cidadeDestino} onChange={(e) => setCidadeDestino(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor promocional</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2" value={valorPromocional} onChange={(e) => setValorPromocional(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Prazo final venda online</label>
            <input type="datetime-local" className="w-full border border-slate-300 rounded-md px-3 py-2" value={prazoVendaOnline} onChange={(e) => setPrazoVendaOnline(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Prazo final venda interna</label>
            <input type="datetime-local" className="w-full border border-slate-300 rounded-md px-3 py-2" value={prazoVendaInterna} onChange={(e) => setPrazoVendaInterna(e.target.value)} />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium mb-1">Capacidade</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={capacidadeTotal}
                onChange={(e) => setCapacidadeTotal(e.target.value)}
                disabled={vendasIlimitadas}
                placeholder={vendasIlimitadas ? "Ilimitada" : "Ex.: 46"}
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 whitespace-nowrap">
                <input type="checkbox" checked={vendasIlimitadas} onChange={(e) => setVendasIlimitadas(e.target.checked)} />
                Vendas ilimitadas
              </label>
            </div>
          </div>

          <div className="lg:col-span-4">
            <label className="block text-sm font-medium mb-1">Descrição curta</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} />
          </div>

          <div className="lg:col-span-4">
            <label className="block text-sm font-medium mb-1">Descrição completa</label>
            <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[120px]" value={descricaoCompleta} onChange={(e) => setDescricaoCompleta(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading || !empresaId} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60">
            {loading ? "Salvando..." : "Salvar viagem"}
          </button>
          <Link href="/viagens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
