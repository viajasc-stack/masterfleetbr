"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type EmpresaPayload = {
  id: string;
  nome: string;
  email?: string | null;
  created_at: string;
};

type AssinaturaPayload = {
  status?: string | null;
  trial_ate?: string | null;
  proxima_cobranca?: string | null;
  plano_id?: string | null;
  billing_model?: string | null;
};

type ModuloCatalogo = {
  codigo: string;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  preco_centavos: number;
};

type Relatorio = {
  clientes: number;
  veiculos: number;
  motoristas: number;
  usuarios: number;
  contratos: number;
  ordens_servico: number;
  os_pendentes: number;
  os_em_execucao: number;
  os_concluidas: number;
  orcamentos: number;
  produtos: number;
  manutencoes: number;
  faturas: number;
  faturas_abertas: number;
  faturas_pagas: number;
  faturas_abertas_valor_centavos: number;
  faturas_pagas_valor_centavos: number;
  contas_financeiras: number;
  contas_pagar_pendentes: number;
  contas_receber_pendentes: number;
};

const MODULE_LABELS: Record<string, string> = {
  operacional: "Operacional",
  configuracoes: "Configurações",
  usuarios: "Usuários",
  suporte: "Suporte",
  inventario: "Estoque",
  financeiro: "Financeiro",
  manutencao: "Manutenção",
  oficina: "Oficina",
  escolar: "Escolar",
  agenda: "Agenda",
  viagens: "Viagens",
  relatorios: "Relatórios",
};

const HIDDEN_MODULE_CODES = new Set([
  "api_integracoes",
  "automacoes",
  "configuracoes",
  "usuarios",
  "suporte",
  "relatorios",
]);

function formatModuloLabel(codigo: string) {
  return MODULE_LABELS[codigo] ?? codigo;
}

function fmtMoney(v: number) {
  return (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function statusClass(status?: string | null) {
  if (status === "ativa") return "bg-green-50 text-green-700 border-green-200";
  if (status === "trial") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "past_due") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "bloqueada") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function MasterEmpresaDetalhePage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [empresa, setEmpresa] = useState<EmpresaPayload | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaPayload | null>(null);
  const [catalogo, setCatalogo] = useState<ModuloCatalogo[]>([]);
  const [empresaModulos, setEmpresaModulos] = useState<string[]>([]);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);

  const modulosAtivos = catalogo.filter(
    (m) => empresaModulos.includes(m.codigo) && !HIDDEN_MODULE_CODES.has(m.codigo),
  );
  const valorMensal = modulosAtivos.reduce((total, modulo) => total + (modulo.preco_centavos ?? 0), 0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");

      const [editorRes, relatorioRes] = await Promise.all([
        supabase.rpc("master_get_empresa_editor", { p_empresa_id: id }),
        supabase.rpc("master_empresa_relatorio", { p_empresa_id: id }),
      ]);

      if (editorRes.error || !editorRes.data) {
        setErro(editorRes.error?.message ?? "Erro ao carregar empresa.");
        setLoading(false);
        return;
      }

      if (relatorioRes.error || !relatorioRes.data) {
        setErro(relatorioRes.error?.message ?? "Erro ao carregar relatório da empresa.");
        setLoading(false);
        return;
      }

      const payload = editorRes.data as {
        empresa: EmpresaPayload;
        assinatura: AssinaturaPayload;
        modulos_catalogo: ModuloCatalogo[];
        empresa_modulos: string[];
      };

      setEmpresa(payload.empresa ?? null);
      setAssinatura(payload.assinatura ?? null);
      setCatalogo(payload.modulos_catalogo ?? []);
      setEmpresaModulos(payload.empresa_modulos ?? []);
      setRelatorio(relatorioRes.data as Relatorio);
      setLoading(false);
    }

    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [id]);

  async function acessarPainelEmpresa() {
    const { data, error } = await supabase.rpc("master_assume_empresa", { p_empresa_id: id });
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível acessar o painel da empresa.");
      return;
    }
    window.location.href = "/dashboard";
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando relatório da empresa...</div>;
  if (!empresa) return <div className="text-sm text-slate-500">Empresa não encontrada.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/master/empresas" className="text-xs text-slate-500 hover:text-slate-700">← Voltar para empresas</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">{empresa.nome}</h1>
          <p className="text-sm text-slate-500">{empresa.email ?? "sem email"} • criada em {fmtDate(empresa.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={acessarPainelEmpresa} className="px-4 py-2 rounded-lg text-sm border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50">
            Acessar painel da empresa
          </button>
          <Link href={`/master/empresas/${id}/editar`} className="px-4 py-2 rounded-lg text-sm bg-slate-900 text-white hover:bg-slate-800">
            Editar empresa
          </Link>
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Status assinatura</div>
          <div className={`inline-flex mt-2 text-xs px-2 py-1 rounded border ${statusClass(assinatura?.status)}`}>{assinatura?.status ?? "sem assinatura"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Plano</div>
          <div className="mt-2 text-sm font-semibold text-slate-900 capitalize">{assinatura?.billing_model ?? "modular"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Módulos ativos</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{modulosAtivos.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Valor mensal</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{fmtMoney(valorMensal)}</div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Módulos contratados</h2>
            <p className="text-sm text-slate-500">Composição comercial atual da empresa.</p>
          </div>
          <div className="text-sm text-slate-600">Próximo vencimento: <span className="font-medium text-slate-900">{fmtDate(assinatura?.proxima_cobranca)}</span></div>
        </div>
        {modulosAtivos.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhum módulo ativo.</div>
        ) : (
          <div className="space-y-3">
            {empresaModulos.includes("operacional") ? (
              <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                <strong>Operacional</strong> cobre dashboard, OS, veículos, motoristas, fretamentos, contratos, clientes, relatórios, configurações, usuários e suporte.
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
            {modulosAtivos.map((modulo) => (
              <span key={modulo.codigo} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                {formatModuloLabel(modulo.codigo)} • {fmtMoney(modulo.preco_centavos ?? 0)}
              </span>
            ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Relatório operacional completo</h2>
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Clientes</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.clientes ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Veículos</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.veiculos ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Motoristas</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.motoristas ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Usuários</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.usuarios ?? 0}</div></div>

          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Contratos</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.contratos ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Ordens de serviço</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.ordens_servico ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">OS pendentes</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.os_pendentes ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">OS em execução</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.os_em_execucao ?? 0}</div></div>

          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">OS concluídas</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.os_concluidas ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Orçamentos</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.orcamentos ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Produtos</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.produtos ?? 0}</div></div>
          <div className="rounded-lg border border-slate-200 p-3"><div className="text-slate-500 text-xs">Manutenções</div><div className="font-semibold text-slate-900 mt-1">{relatorio?.manutencoes ?? 0}</div></div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Resumo financeiro</h2>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Faturas abertas</div>
            <div className="font-semibold text-slate-900 mt-1">{relatorio?.faturas_abertas ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">{fmtMoney(relatorio?.faturas_abertas_valor_centavos ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Faturas pagas</div>
            <div className="font-semibold text-slate-900 mt-1">{relatorio?.faturas_pagas ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">{fmtMoney(relatorio?.faturas_pagas_valor_centavos ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Total de faturas</div>
            <div className="font-semibold text-slate-900 mt-1">{relatorio?.faturas ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Contas financeiras</div>
            <div className="font-semibold text-slate-900 mt-1">{relatorio?.contas_financeiras ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">A pagar pendente</div>
            <div className="font-semibold text-slate-900 mt-1">{(relatorio?.contas_pagar_pendentes ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">A receber pendente</div>
            <div className="font-semibold text-slate-900 mt-1">{(relatorio?.contas_receber_pendentes ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
