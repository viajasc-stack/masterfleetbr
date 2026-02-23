"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Cliente = { id: string; nome: string };
type Motorista = { id: string; nome: string };

type Contrato = {
  id: string;
  cliente_id: string;
  nome: string;
  descricao: string | null;
  dias_semana: number[];
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
};

type Horario = {
  id: string;
  contrato_id: string;
  hora: string;
  observacao: string | null;
  ordem: number;
  ativo: boolean;
  motorista_id: string | null;
  created_at: string;
};

const DIAS = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
];

export default function ContratoDetalhePage() {
  const router = useRouter();
  const params = useParams();
  const contratoId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);

  // Form rápido para adicionar horário
  const [novoHorario, setNovoHorario] = useState({
    hora: "07:00",
    motorista_id: "" as string, // guarda "" no select; ao inserir vira null
    observacao: "",
    ordem: 1,
    ativo: true,
  });

  async function carregarTudo() {
    setLoading(true);

    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome", { ascending: true });

    setClientes((clientesData ?? []) as Cliente[]);

    const { data: motoristasData } = await supabase
      .from("motoristas")
      .select("id, nome")
      .order("nome", { ascending: true });

    setMotoristas((motoristasData ?? []) as Motorista[]);

    const { data: contratoData, error: cErr } = await supabase
      .from("contratos")
      .select("id, cliente_id, nome, descricao, dias_semana, data_inicio, data_fim, ativo, created_at")
      .eq("id", contratoId)
      .single();

    if (cErr || !contratoData) {
      console.error(cErr);
      setLoading(false);
      router.push("/contratos");
      return;
    }

    setContrato(contratoData as Contrato);

    const { data: horariosData, error: hErr } = await supabase
      .from("contrato_horarios")
      .select("id, contrato_id, hora, observacao, ordem, ativo, motorista_id, created_at")
      .eq("contrato_id", contratoId)
      .order("ordem", { ascending: true })
      .order("hora", { ascending: true });

    if (hErr) {
      console.error(hErr);
      setHorarios([]);
    } else {
      setHorarios((horariosData ?? []) as Horario[]);
    }

    const maxOrdem = (horariosData ?? []).reduce((m: number, x: any) => Math.max(m, x.ordem ?? 0), 0);
    setNovoHorario((prev) => ({ ...prev, ordem: maxOrdem + 1 }));

    setLoading(false);
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  function toggleDia(v: number) {
    if (!contrato) return;

    const has = contrato.dias_semana?.includes(v);
    const next = has
      ? contrato.dias_semana.filter((x) => x !== v)
      : [...(contrato.dias_semana ?? []), v].sort((a, b) => a - b);

    setContrato({ ...contrato, dias_semana: next });
  }

  async function salvarContrato() {
    if (!contrato) return;

    if (!contrato.cliente_id) return alert("Selecione um cliente.");
    if (!contrato.nome.trim()) return alert("Informe o nome do contrato.");
    if (!contrato.dias_semana || contrato.dias_semana.length === 0)
      return alert("Selecione pelo menos 1 dia da semana.");

    setSaving(true);

    const { error } = await supabase
      .from("contratos")
      .update({
        cliente_id: contrato.cliente_id,
        nome: contrato.nome.trim(),
        descricao: contrato.descricao?.trim() || null,
        dias_semana: contrato.dias_semana,
        data_inicio: contrato.data_inicio || null,
        data_fim: contrato.data_fim || null,
        ativo: contrato.ativo,
      })
      .eq("id", contrato.id);

    if (error) {
      console.error(error);
      setSaving(false);
      return alert("Erro ao salvar contrato: " + error.message);
    }

    setSaving(false);
    router.push("/contratos?ok=" + encodeURIComponent("Contrato salvo com sucesso."));
  }

  async function gerarOSHoje() {
    if (!contratoId) return;

    const ok = confirm("Gerar as OS de HOJE para este contrato? (uma OS por horário ativo)");
    if (!ok) return;

    setGerando(true);

    const { error } = await supabase.rpc("gerar_os_do_contrato", { p_contrato_id: contratoId });

    if (error) {
      console.error(error);
      setGerando(false);
      return alert("Erro ao gerar OS: " + error.message);
    }

    setGerando(false);

    router.push(
      "/ordens-servico?ok=" +
        encodeURIComponent("OS geradas com sucesso a partir do contrato.")
    );
  }

  async function adicionarHorario() {
    if (!/^\d{2}:\d{2}$/.test(novoHorario.hora)) return alert("Hora inválida. Use HH:MM.");

    const { error } = await supabase.from("contrato_horarios").insert({
      contrato_id: contratoId,
      hora: novoHorario.hora,
      observacao: novoHorario.observacao.trim() || null,
      ordem: Number(novoHorario.ordem || 1),
      ativo: !!novoHorario.ativo,
      motorista_id: novoHorario.motorista_id ? novoHorario.motorista_id : null, // ✅
    });

    if (error) {
      console.error(error);
      return alert("Erro ao adicionar horário: " + error.message);
    }

    setNovoHorario((prev) => ({ ...prev, observacao: "", motorista_id: "" }));
    await carregarTudo();
  }

  async function salvarHorario(h: Horario) {
    const { error } = await supabase
      .from("contrato_horarios")
      .update({
        hora: h.hora,
        observacao: h.observacao?.trim() || null,
        ordem: h.ordem,
        ativo: h.ativo,
        motorista_id: h.motorista_id || null, // ✅
      })
      .eq("id", h.id);

    if (error) {
      console.error(error);
      return alert("Erro ao salvar horário: " + error.message);
    }

    alert("Horário salvo!");
    await carregarTudo();
  }

  async function removerHorario(h: Horario) {
    const ok = confirm(`Remover o horário ${h.hora}?`);
    if (!ok) return;

    const { error } = await supabase.from("contrato_horarios").delete().eq("id", h.id);
    if (error) {
      console.error(error);
      return alert("Erro ao remover horário: " + error.message);
    }

    await carregarTudo();
  }

  async function excluirContrato() {
    const ok = confirm("Excluir este contrato? (os horários serão apagados junto)");
    if (!ok) return;

    const { error } = await supabase.from("contratos").delete().eq("id", contratoId);
    if (error) {
      console.error(error);
      return alert("Erro ao excluir contrato: " + error.message);
    }

    router.push("/contratos?ok=" + encodeURIComponent("Contrato excluído."));
  }

  const clienteNome = useMemo(() => {
    if (!contrato) return "";
    return clientes.find((c) => c.id === contrato.cliente_id)?.nome ?? "";
  }, [clientes, contrato]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrato"
        description={clienteNome ? `Cliente: ${clienteNome}` : "Editar contrato e gerenciar horários."}
        actions={
          <>
            <Link
              href="/contratos"
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Voltar
            </Link>

            <button
              onClick={gerarOSHoje}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition disabled:opacity-60"
              disabled={loading || gerando}
            >
              {gerando ? "Gerando..." : "Gerar OS de hoje"}
            </button>

            <button
              onClick={salvarContrato}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
              disabled={saving || loading || gerando}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>

            <button
              onClick={excluirContrato}
              className="border border-red-300 text-red-700 px-4 py-2 rounded-md hover:bg-red-50 transition"
              disabled={loading || gerando}
            >
              Excluir
            </button>
          </>
        }
      />

      {/* Dados do contrato */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading || !contrato ? (
          <div className="text-slate-600">Carregando...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Cliente</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={contrato.cliente_id}
                onChange={(e) => setContrato({ ...contrato, cliente_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome do contrato</label>
              <input
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={contrato.nome}
                onChange={(e) => setContrato({ ...contrato, nome: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição (opcional)</label>
              <textarea
                className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]"
                value={contrato.descricao ?? ""}
                onChange={(e) => setContrato({ ...contrato, descricao: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contrato.ativo}
                  onChange={(e) => setContrato({ ...contrato, ativo: e.target.checked })}
                />
                <span className="text-sm">{contrato.ativo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dias da semana</label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => {
                  const active = contrato.dias_semana?.includes(d.v);
                  return (
                    <button
                      type="button"
                      key={d.v}
                      onClick={() => toggleDia(d.v)}
                      className={`px-3 py-1 rounded-md border text-sm transition ${
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data início (opcional)</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={contrato.data_inicio ?? ""}
                onChange={(e) => setContrato({ ...contrato, data_inicio: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data fim (opcional)</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={contrato.data_fim ?? ""}
                onChange={(e) => setContrato({ ...contrato, data_fim: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Adicionar horário */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="text-sm font-medium mb-3">Adicionar horário</div>

        <div className="grid gap-4 md:grid-cols-12 md:items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Hora</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={novoHorario.hora}
              onChange={(e) => setNovoHorario((p) => ({ ...p, hora: e.target.value }))}
              placeholder="07:00"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Motorista padrão</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={novoHorario.motorista_id}
              onChange={(e) => setNovoHorario((p) => ({ ...p, motorista_id: e.target.value }))}
            >
              <option value="">— Sem motorista —</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium mb-1">Observação / roteiro</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={novoHorario.observacao}
              onChange={(e) => setNovoHorario((p) => ({ ...p, observacao: e.target.value }))}
              placeholder="Ex: Paradas: ponto 1, ponto 3, ponto 5"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Ordem</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={novoHorario.ordem}
              onChange={(e) => setNovoHorario((p) => ({ ...p, ordem: Number(e.target.value || 1) }))}
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Ativo</label>
            <div className="h-[42px] flex items-center">
              <input
                type="checkbox"
                checked={novoHorario.ativo}
                onChange={(e) => setNovoHorario((p) => ({ ...p, ativo: e.target.checked }))}
              />
            </div>
          </div>

          <div className="md:col-span-12 flex justify-end">
            <button
              onClick={adicionarHorario}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
              disabled={loading || gerando}
            >
              + Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela horários */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : horarios.length === 0 ? (
          <div className="text-slate-600">Nenhum horário cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Hora</th>
                  <th className="py-2 pr-4">Motorista padrão</th>
                  <th className="py-2 pr-4">Observação / roteiro</th>
                  <th className="py-2 pr-4">Ordem</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {horarios.map((h) => (
                  <tr key={h.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                    <td className="py-2 pr-4">
                      <input
                        className="w-[110px] border border-slate-300 rounded-md px-3 py-2"
                        value={h.hora}
                        onChange={(e) =>
                          setHorarios((prev) => prev.map((x) => (x.id === h.id ? { ...x, hora: e.target.value } : x)))
                        }
                      />
                    </td>

                    <td className="py-2 pr-4">
                      <select
                        className="w-[240px] border border-slate-300 rounded-md px-3 py-2"
                        value={h.motorista_id ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setHorarios((prev) => prev.map((x) => (x.id === h.id ? { ...x, motorista_id: v } : x)));
                        }}
                      >
                        <option value="">— Sem motorista —</option>
                        {motoristas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-2 pr-4">
                      <input
                        className="w-full min-w-[320px] border border-slate-300 rounded-md px-3 py-2"
                        value={h.observacao ?? ""}
                        onChange={(e) =>
                          setHorarios((prev) => prev.map((x) => (x.id === h.id ? { ...x, observacao: e.target.value } : x)))
                        }
                      />
                    </td>

                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        className="w-[90px] border border-slate-300 rounded-md px-3 py-2"
                        value={h.ordem}
                        onChange={(e) =>
                          setHorarios((prev) => prev.map((x) => (x.id === h.id ? { ...x, ordem: Number(e.target.value || 1) } : x)))
                        }
                      />
                    </td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${
                          h.ativo
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-slate-200 text-slate-700 bg-slate-50"
                        }`}
                      >
                        {h.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="py-2 pr-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => salvarHorario(h)}
                          className="border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-50 transition"
                          disabled={gerando}
                        >
                          Salvar
                        </button>

                        <button
                          onClick={() => removerHorario(h)}
                          className="border border-red-300 text-red-700 px-3 py-2 rounded-md hover:bg-red-50 transition"
                          disabled={gerando}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 text-xs text-slate-500">
              As OS geradas vão herdar automaticamente o motorista padrão do horário (e você pode trocar na OS em caso de substituição).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}