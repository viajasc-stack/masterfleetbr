"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchOcorrencias } from "@/lib/escolar";
import type { EscolarOcorrencia } from "@/types/escolar.types";

export default function EscolarOcorrenciasPage() {
  const [ocorrencias, setOcorrencias] = useState<EscolarOcorrencia[]>([]);

  useEffect(() => {
    void fetchOcorrencias().then(setOcorrencias).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Escolar · Ocorrências" description="Registro de ocorrências escolares" />
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Aluno</th><th>Tipo</th><th>Severidade</th><th>Data</th><th>Descrição</th><th>Status</th></tr></thead>
          <tbody>
            {ocorrencias.map((o) => (
              <tr key={o.id} className="border-b last:border-b-0"><td>{o.escolar_alunos?.nome ?? "—"}</td><td>{o.tipo}</td><td>{o.severidade}</td><td>{new Date(o.data_ocorrencia).toLocaleDateString("pt-BR")}</td><td>{o.descricao}</td><td>{o.resolvido_em ? "Resolvida" : "Aberta"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
