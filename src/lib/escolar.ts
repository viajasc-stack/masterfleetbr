import { supabase } from "@/lib/supabase/client";
import type {
  EscolarAluno,
  EscolarFamilia,
  EscolarKPIs,
  EscolarLinha,
  EscolarMensalidade,
  EscolarOcorrencia,
  EscolarPresenca,
  EscolarResponsavel,
} from "@/types/escolar.types";

export async function fetchEscolarKPIs(): Promise<EscolarKPIs> {
  const { data, error } = await supabase.rpc("escolar_kpis");
  if (error) throw new Error(error.message);
  return (data ?? {
    linhas_ativas: 0,
    alunos_ativos: 0,
    presencas_hoje: 0,
    mensalidades_abertas: 0,
    mensalidades_atrasadas: 0,
    ocorrencias_abertas: 0,
  }) as EscolarKPIs;
}

export async function fetchLinhas() {
  const { data, error } = await supabase.from("escolar_linhas").select("*").order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as EscolarLinha[];
}

export async function fetchFamilias() {
  const { data, error } = await supabase.from("escolar_familias").select("*").order("nome_referencia");
  if (error) throw new Error(error.message);
  return (data ?? []) as EscolarFamilia[];
}

export async function fetchResponsaveis() {
  const { data, error } = await supabase.from("escolar_responsaveis").select("*").order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as EscolarResponsavel[];
}

export async function fetchAlunos() {
  const { data, error } = await supabase
    .from("escolar_alunos")
    .select("*, escolar_linhas(nome), escolar_familias(nome_referencia)")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as EscolarAluno[];
}

export async function fetchPresencasHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("escolar_presencas")
    .select("*, escolar_alunos(nome)")
    .eq("data_referencia", hoje)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EscolarPresenca[];
}

export async function fetchMensalidades() {
  const { data, error } = await supabase
    .from("escolar_mensalidades")
    .select("*, escolar_alunos(nome)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as EscolarMensalidade[];
}

export async function fetchOcorrencias() {
  const { data, error } = await supabase
    .from("escolar_ocorrencias")
    .select("*, escolar_alunos(nome)")
    .order("data_ocorrencia", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as EscolarOcorrencia[];
}
