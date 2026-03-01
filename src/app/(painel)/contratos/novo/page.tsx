"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Cliente = { id: string; nome: string };
type Motorista = { id: string; nome: string };

const DIAS = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
];

type HorarioDraft = {
  tempId: string;
  hora: string;
  observacao: string;
  ordem: number;
  ativo: boolean;
  motorista_id: string | null;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function NovoContratoPage() {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [horarios, setHorarios] = useState<HorarioDraft[]>([
    { tempId: uid(), hora: "07:00", observacao: "", ordem: 1, ativo: true, motorista_id: null },
  ]);

  async function carregarDados() {
    setLoading(true);

    const { data: clientesData, error: clientesErr } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome", { ascending: true });

    setTimeout(() => {
      if (!clientesErr && clientesData) setClientes(clientesData as Cliente[]);
      else setClientes([]);
    }, 0);

    const { data: motoristasData, error: motoristasErr } = await supabase
      .from("motoristas")
      .select("id, nome")
      .order("nome", { ascending: true });

    setTimeout(() => {
      if (!motoristasErr && motoristasData) setMotoristas(motoristasData as Motorista[]);
      else setMotoristas([]);
      setLoading(false);
    }, 0);

  }

  useEffect(() => {
    const id = setTimeout(() => { carregarDados(); }, 0);
    return () => clearTimeout(id);
  }, []);

  function toggleDia(v: number) {
    setDiasSemana((prev) => {
      const has = prev.includes(v);
      if (has) return prev.filter((x) => x !== v);
      return [...prev, v].sort((a, b) => a - b);
    });
  }

  function adicionarHorario() {
    setHorarios((prev) => [
      ...prev,
      { tempId: uid(), hora: "00:00", observacao: "", ordem: prev.length + 1, ativo: true, motorista_id: null },
    ]);
  }

  function removerHorario(tempId: string) {
    setHorarios((prev) => prev.filter((h) => h.tempId !== tempId));
  }

  async function salvar() {
    if (!clienteId) return alert("Selecione um cliente.");
    if (!nome.trim()) return alert("Informe o nome do contrato.");
    if (diasSemana.length === 0) return alert("Selecione pelo menos 1 dia da semana.");
    if (horarios.length === 0) return alert("Adicione pelo menos 1 horário.");

    for (const h of horarios) {
      if (!/^\d{2}:\d{2}$/.test(h.hora)) return alert(`Horário inválido: "${h.hora}". Use HH:MM.`);
    }

    setSaving(true);

    // empresa_id (multiempresa) via profiles
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("empresa_id")
      .single();

    if (profErr || !prof?.empresa_id) {
      console.error(profErr);
      setSaving(false);
      return alert("Não foi possível identificar sua empresa (profiles).");
    }

    const { data: contrato, error: errContrato } = await supabase
      .from("contratos")
      .insert({
        empresa_id: prof.empresa_id,
        cliente_id: clienteId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        dias_semana: diasSemana,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        ativo,
      })
      .select("id")
      .single();

    if (errContrato || !contrato?.id) {
      console.error(errContrato);
      setSaving(false);
      return alert("Erro ao criar contrato: " + (errContrato?.message ?? "desconhecido"));
    }

    const contratoId = contrato.id as string;

    const { error: errHor } = await supabase.from("contrato_horarios").insert(
      horarios.map((h) => ({
        contrato_id: contratoId,
        hora: h.hora,
        observacao: h.observacao.trim() || null,
        ordem: h.ordem ?? 1,
        ativo: h.ativo,
        motorista_id: h.motorista_id || null, // ✅ motorista padrão por horário
      }))
    );

    if (errHor) {
      console.error(errHor);
      setSaving(false);
      return alert("Contrato criado, mas deu erro ao salvar horários: " + errHor.message);
    }

    setSaving(false);
    router.push(`/contratos/${contratoId}`);
  }

  const totalHorarios = useMemo(() => horarios.length, [horarios.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Contrato"
        description="Crie um contrato recorrente com dias da semana e horários (cada horário pode ter motorista padrão)."
        actions={
          <>
            <button
              onClick={() => router.push("/contratos")}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
              disabled={saving}
            >
              Voltar
            </button>

            <button
              onClick={salvar}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      />

      {/* Dados do contrato */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Cliente</label>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
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
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder='Ex: "Prefeitura - Rota Morro Grande"'
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição (opcional)</label>
              <textarea
                className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Observação geral do contrato..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                <span className="text-sm">{ativo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dias da semana</label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => {
                  const active = diasSemana.includes(d.v);
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
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data fim (opcional)</label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Horários */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm text-slate-600">
              Horários cadastrados: <span className="font-semibold">{totalHorarios}</span>
            </div>
            <div className="text-xs text-slate-500">
              Cada horário pode ter motorista padrão + roteiro/observação diferente.
            </div>
          </div>

          <button
            onClick={adicionarHorario}
            className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
          >
            + Adicionar horário
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Hora</th>
                <th className="py-2 pr-4">Motorista padrão</th>
                <th className="py-2 pr-4">Observação / roteiro</th>
                <th className="py-2 pr-4">Ordem</th>
                <th className="py-2 pr-4">Ativo</th>
                <th className="py-2 pr-0 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {horarios.map((h) => (
                <tr key={h.tempId} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                  <td className="py-2 pr-4">
                    <input
                      className="w-[110px] border border-slate-300 rounded-md px-3 py-2"
                      value={h.hora}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHorarios((prev) => prev.map((x) => (x.tempId === h.tempId ? { ...x, hora: v } : x)));
                      }}
                      placeholder="07:00"
                    />
                  </td>

                  <td className="py-2 pr-4">
                    <select
                      className="w-[240px] border border-slate-300 rounded-md px-3 py-2"
                      value={h.motorista_id ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setHorarios((prev) => prev.map((x) => (x.tempId === h.tempId ? { ...x, motorista_id: v } : x)));
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
                      value={h.observacao}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHorarios((prev) => prev.map((x) => (x.tempId === h.tempId ? { ...x, observacao: v } : x)));
                      }}
                      placeholder="Ex: Paradas: ponto 1, ponto 3, ponto 5"
                    />
                  </td>

                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      className="w-[90px] border border-slate-300 rounded-md px-3 py-2"
                      value={h.ordem}
                      onChange={(e) => {
                        const v = Number(e.target.value || 1);
                        setHorarios((prev) => prev.map((x) => (x.tempId === h.tempId ? { ...x, ordem: v } : x)));
                      }}
                    />
                  </td>

                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      checked={h.ativo}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setHorarios((prev) => prev.map((x) => (x.tempId === h.tempId ? { ...x, ativo: v } : x)));
                      }}
                    />
                  </td>

                  <td className="py-2 pr-0 text-right">
                    <button
                      onClick={() => removerHorario(h.tempId)}
                      className="border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-50 transition"
                      disabled={horarios.length <= 1}
                      title={horarios.length <= 1 ? "Mantenha ao menos 1 horário" : "Remover"}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Exemplo: 07:00 motorista A / 12:00 motorista B / 17:00 motorista C…
        </div>
      </div>
    </div>
  );
}
