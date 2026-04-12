"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchAlunos } from "@/lib/escolar";
import type { EscolarAluno } from "@/types/escolar.types";

export default function EscolarAlunosPage() {
  const [alunos, setAlunos] = useState<EscolarAluno[]>([]);

  useEffect(() => {
    void fetchAlunos().then(setAlunos).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Escolar · Alunos" description="Cadastro e gestão de alunos" />
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Nome</th><th>Escola</th><th>Série</th><th>Linha</th><th>Família</th><th>Status</th></tr></thead>
          <tbody>
            {alunos.map((a) => (
              <tr key={a.id} className="border-b last:border-b-0"><td>{a.nome}</td><td>{a.escola ?? "—"}</td><td>{a.serie ?? "—"}</td><td>{a.escolar_linhas?.nome ?? "—"}</td><td>{a.escolar_familias?.nome_referencia ?? "—"}</td><td>{a.ativo ? "Ativo" : "Inativo"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
