"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SuccessRedirectModal } from "@/components/ui/SuccessRedirectModal";
import { supabase } from "@/lib/supabase/client";

type ContratoOpt = { id: string; nome: string; ativo: boolean };
type VeiculoOpt = { id: string; placa: string; modelo: string | null };
type MotoristaOpt = { id: string; nome: string };

type HorarioDraft = {
  key: string;
  hora: string;
  rota_nome: string;
  roteiro: string;
  motorista_id: string;
  veiculo_id: string;
  dias_semana: number[];
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

function novoHorario(seed = Date.now()): HorarioDraft {
  return {
    key: String(seed + Math.random()),
    hora: "",
    rota_nome: "",
    roteiro: "",
    motorista_id: "",
    veiculo_id: "",
    dias_semana: [1, 2, 3, 4, 5],
  };
}

export default function NovoFretamentoRecorrentePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const [contratos, setContratos] = useState<ContratoOpt[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaOpt[]>([]);

  const [contratoId, setContratoId] = useState("");
  const [motoristaPadraoId, setMotoristaPadraoId] = useState("");
  const [veiculoPadraoId, setVeiculoPadraoId] = useState("");
  const [horarios, setHorarios] = useState<HorarioDraft[]>([novoHorario()]);

  function confirmarSucesso() {
    router.push("/fretamentos/recorrente");
    router.refresh();
  }

  async function carregarCombos() {
    setLoading(true);

    const [contratosRes, veiculosRes, motoristasRes] = await Promise.all([
      supabase.from("contratos").select("id, nome, ativo").order("nome", { ascending: true }),
      supabase.from("veiculos").select("id, placa, modelo, status").order("placa", { ascending: true }),
      supabase.from("motoristas").select("id, nome, ativo").order("nome", { ascending: true }),
    ]);

    setContratos(((contratosRes.data ?? []) as ContratoOpt[]).filter((c) => c.ativo !== false));

    setVeiculos(
      ((veiculosRes.data ?? []) as Array<VeiculoOpt & { status?: string | null }>).filter(
        (v) => (v.status ?? "").toLowerCase() !== "inativo"
      )
    );

    setMotoristas(
      ((motoristasRes.data ?? []) as Array<MotoristaOpt & { ativo?: boolean | null }>).filter((m) => m.ativo !== false)
    );

    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregarCombos();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const contratoSelecionado = useMemo(() => contratos.find((c) => c.id === contratoId) ?? null, [contratoId, contratos]);

  function atualizarHorario(key: string, patch: Partial<HorarioDraft>) {
    setHorarios((prev) => prev.map((h) => (h.key === key ? { ...h, ...patch } : h)));
  }

  function toggleDiaHorario(key: string, dia: number) {
    setHorarios((prev) =>
      prev.map((h) => {
        if (h.key !== key) return h;
        const tem = h.dias_semana.includes(dia);
        return {
          ...h,
          dias_semana: tem ? h.dias_semana.filter((d) => d !== dia) : [...h.dias_semana, dia].sort((a, b) => a - b),
        };
      })
    );
  }

  function adicionarHorario() {
    setHorarios((prev) => [
      ...prev,
      {
        ...novoHorario(),
        motorista_id: motoristaPadraoId,
        veiculo_id: veiculoPadraoId,
      },
    ]);
  }

  function removerHorario(key: string) {
    setHorarios((prev) => (prev.length <= 1 ? prev : prev.filter((h) => h.key !== key)));
  }

  function aplicarPadraoEmTodos() {
    setHorarios((prev) => prev.map((h) => ({ ...h, motorista_id: motoristaPadraoId, veiculo_id: veiculoPadraoId })));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!contratoId) return alert("Selecione o contrato.");

    const semHora = horarios.find((h) => !h.hora);
    if (semHora) return alert("Todos os horários devem ter hora.");

    const semRotaNome = horarios.find((h) => !h.rota_nome.trim());
    if (semRotaNome) return alert("Todos os horários devem ter o nome da rota.");

    const semDias = horarios.find((h) => (h.dias_semana?.length ?? 0) === 0);
    if (semDias) return alert("Todos os horários precisam ter pelo menos 1 dia da semana.");

    setSaving(true);

    const payload = horarios.map((h, idx) => ({
      contrato_id: contratoId,
      hora: h.hora,
      horario: h.hora,
      rota_nome: h.rota_nome.trim(),
      observacao: h.roteiro.trim() || null,
      motorista_id: h.motorista_id || null,
      veiculo_id: h.veiculo_id || null,
      dias_semana: h.dias_semana,
      ordem: idx + 1,
      ativo: true,
    }));

    const { error } = await supabase.from("contrato_horarios").insert(payload);
    setSaving(false);

    if (error) {
      alert("Erro ao salvar fretamento recorrente: " + error.message);
      return;
    }

    setSuccessModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Fretamento Recorrente"
        description="Selecione o contrato e cadastre os horários com motorista/veículo padrão e dias da semana."
        actions={
          <Link href="/fretamentos/recorrente" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm">
            Voltar
          </Link>
        }
      />

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">Contrato *</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={contratoId}
                  onChange={(e) => setContratoId(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {!contratoSelecionado ? (
                  <p className="text-xs text-slate-500 mt-1">Selecione o contrato para vincular os horários recorrentes.</p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Motorista padrão</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={motoristaPadraoId}
                  onChange={(e) => setMotoristaPadraoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Veículo padrão</label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                  value={veiculoPadraoId}
                  onChange={(e) => setVeiculoPadraoId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} {v.modelo ? `- ${v.modelo}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={aplicarPadraoEmTodos}
                  className="w-full border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-50 transition"
                >
                  Aplicar padrão em todos
                </button>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Horários recorrentes</h2>
                <button
                  type="button"
                  onClick={adicionarHorario}
                  className="border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-50 transition text-sm"
                >
                  + Adicionar horário
                </button>
              </div>

              {horarios.map((h, idx) => (
                <div key={h.key} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700">Horário #{idx + 1}</div>
                    <button
                      type="button"
                      onClick={() => removerHorario(h.key)}
                      disabled={horarios.length <= 1}
                      className="text-xs px-2 py-1 border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-40"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Hora *</label>
                      <input
                        type="time"
                        className="w-full border border-slate-300 rounded-md px-3 py-2"
                        value={h.hora}
                        onChange={(e) => atualizarHorario(h.key, { hora: e.target.value })}
                        required
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium mb-1">Nome da rota *</label>
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-md px-3 py-2"
                        value={h.rota_nome}
                        onChange={(e) => atualizarHorario(h.key, { rota_nome: e.target.value })}
                        placeholder="Ex: Centro - Margem Esquerda"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Motorista</label>
                      <select
                        className="w-full border border-slate-300 rounded-md px-3 py-2"
                        value={h.motorista_id}
                        onChange={(e) => atualizarHorario(h.key, { motorista_id: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {motoristas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Veículo</label>
                      <select
                        className="w-full border border-slate-300 rounded-md px-3 py-2"
                        value={h.veiculo_id}
                        onChange={(e) => atualizarHorario(h.key, { veiculo_id: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {veiculos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.placa} {v.modelo ? `- ${v.modelo}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Roteiro / observações</label>
                    <textarea
                      className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[90px]"
                      value={h.roteiro}
                      onChange={(e) => atualizarHorario(h.key, { roteiro: e.target.value })}
                      placeholder="Detalhes/instruções para o motorista seguir em caso de substituição"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Dias da semana *</label>
                    <div className="flex flex-wrap gap-2">
                      {DIAS.map((d) => {
                        const ativo = h.dias_semana.includes(d.v);
                        return (
                          <button
                            key={d.v}
                            type="button"
                            onClick={() => toggleDiaHorario(h.key, d.v)}
                            className={`px-3 py-1 rounded-md border text-sm transition ${
                              ativo
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
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !contratoId}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar fretamento recorrente"}
              </button>
              <Link href="/fretamentos/recorrente" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
                Cancelar
              </Link>
            </div>
          </>
        )}
      </form>

      <SuccessRedirectModal
        open={successModalOpen}
        title="Fretamento recorrente criado com sucesso"
        description="Cadastro concluído."
        seconds={5}
        onConfirm={confirmarSucesso}
      />
    </div>
  );
}
