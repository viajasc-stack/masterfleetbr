"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type PessoaAniversariante = {
  id: string;
  nome: string;
  data_nascimento: string;
  tipo: "usuario" | "motorista";
};

function fmtData(data: string) {
  const d = new Date(`${data}T12:00:00`);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function AniversariantesPage() {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<PessoaAniversariante[]>([]);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const [{ data: usuarios }, { data: motoristas }] = await Promise.all([
        supabase.from("usuarios").select("id, nome, data_nascimento").not("data_nascimento", "is", null),
        supabase.from("motoristas").select("id, nome, data_nascimento").not("data_nascimento", "is", null),
      ]);

      const listaUsuarios = ((usuarios ?? []) as Array<{ id: string; nome: string; data_nascimento: string }>).map((u) => ({
        ...u,
        tipo: "usuario" as const,
      }));

      const listaMotoristas = ((motoristas ?? []) as Array<{ id: string; nome: string; data_nascimento: string }>).map((m) => ({
        ...m,
        tipo: "motorista" as const,
      }));

      setItens([...listaUsuarios, ...listaMotoristas]);
      setLoading(false);
    }
    carregar();
  }, []);

  const aniversariantesMes = useMemo(() => {
    const mesAtual = new Date().getMonth() + 1;
    return itens
      .filter((x) => {
        const d = new Date(`${x.data_nascimento}T12:00:00`);
        return !Number.isNaN(d.getTime()) && d.getMonth() + 1 === mesAtual;
      })
      .sort((a, b) => {
        const da = new Date(`${a.data_nascimento}T12:00:00`).getDate();
        const db = new Date(`${b.data_nascimento}T12:00:00`).getDate();
        return da - db || a.nome.localeCompare(b.nome);
      });
  }, [itens]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aniversariantes do mês"
        description="Lista completa de aniversários da empresa (usuários e motoristas)."
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : aniversariantesMes.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhum aniversariante neste mês.</div>
        ) : (
          <div className="space-y-2">
            {aniversariantesMes.map((p) => (
              <div key={`${p.tipo}-${p.id}`} className="border border-slate-200 rounded-md p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{p.nome}</div>
                  <div className="text-xs text-slate-500">{p.tipo === "usuario" ? "Usuário" : "Motorista"}</div>
                </div>
                <div className="text-sm text-slate-700 font-medium">{fmtData(p.data_nascimento)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
