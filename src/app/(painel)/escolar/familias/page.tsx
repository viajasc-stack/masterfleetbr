"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchFamilias } from "@/lib/escolar";
import type { EscolarFamilia } from "@/types/escolar.types";

export default function EscolarFamiliasPage() {
  const [familias, setFamilias] = useState<EscolarFamilia[]>([]);

  useEffect(() => {
    void fetchFamilias().then(setFamilias).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Escolar · Famílias" description="Agrupamento familiar de alunos" />
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Referência</th><th>Observações</th><th>Status</th></tr></thead>
          <tbody>
            {familias.map((f) => (
              <tr key={f.id} className="border-b last:border-b-0"><td>{f.nome_referencia}</td><td>{f.observacoes ?? "—"}</td><td>{f.ativo ? "Ativa" : "Inativa"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
