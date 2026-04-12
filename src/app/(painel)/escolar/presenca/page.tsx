"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchPresencasHoje } from "@/lib/escolar";
import type { EscolarPresenca } from "@/types/escolar.types";

export default function EscolarPresencaPage() {
  const [presencas, setPresencas] = useState<EscolarPresenca[]>([]);

  useEffect(() => {
    void fetchPresencasHoje().then(setPresencas).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Escolar · Presença" description="Presenças registradas hoje" />
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Aluno</th><th>Data</th><th>Período</th><th>Status</th><th>Obs.</th></tr></thead>
          <tbody>
            {presencas.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0"><td>{p.escolar_alunos?.nome ?? "—"}</td><td>{new Date(p.data_referencia).toLocaleDateString("pt-BR")}</td><td>{p.periodo}</td><td>{p.status}</td><td>{p.observacao ?? "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
