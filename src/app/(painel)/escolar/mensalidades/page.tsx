"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchMensalidades } from "@/lib/escolar";
import type { EscolarMensalidade } from "@/types/escolar.types";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function EscolarMensalidadesPage() {
  const [mensalidades, setMensalidades] = useState<EscolarMensalidade[]>([]);

  useEffect(() => {
    void fetchMensalidades().then(setMensalidades).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Escolar · Mensalidades" description="Controle de mensalidades dos alunos" />
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Aluno</th><th>Referência</th><th>Vencimento</th><th>Valor final</th><th>Status</th></tr></thead>
          <tbody>
            {mensalidades.map((m) => (
              <tr key={m.id} className="border-b last:border-b-0"><td>{m.escolar_alunos?.nome ?? "—"}</td><td>{new Date(m.referencia_mes).toLocaleDateString("pt-BR")}</td><td>{m.vencimento ? new Date(m.vencimento).toLocaleDateString("pt-BR") : "—"}</td><td>{moeda(m.valor_final ?? 0)}</td><td>{m.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
