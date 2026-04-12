"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchLinhas } from "@/lib/escolar";
import type { EscolarLinha } from "@/types/escolar.types";

export default function EscolarLinhasPage() {
  const [linhas, setLinhas] = useState<EscolarLinha[]>([]);

  useEffect(() => {
    void fetchLinhas().then(setLinhas).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Escolar · Linhas" description="Gestão das linhas escolares" />
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Nome</th><th>Turno</th><th>Monitor</th><th>Capacidade</th><th>Status</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b last:border-b-0"><td>{l.nome}</td><td>{l.turno}</td><td>{l.monitor_nome ?? "—"}</td><td>{l.capacidade}</td><td>{l.ativo ? "Ativa" : "Inativa"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
