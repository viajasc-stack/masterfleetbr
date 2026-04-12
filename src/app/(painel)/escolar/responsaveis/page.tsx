"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchResponsaveis } from "@/lib/escolar";
import type { EscolarResponsavel } from "@/types/escolar.types";

export default function EscolarResponsaveisPage() {
  const [responsaveis, setResponsaveis] = useState<EscolarResponsavel[]>([]);

  useEffect(() => {
    void fetchResponsaveis().then(setResponsaveis).catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Escolar · Responsáveis" description="Gestão de responsáveis" />
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th>Nome</th><th>CPF</th><th>Telefone</th><th>E-mail</th><th>Parentesco</th><th>Status</th></tr></thead>
          <tbody>
            {responsaveis.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0"><td>{r.nome}</td><td>{r.cpf ?? "—"}</td><td>{r.telefone ?? "—"}</td><td>{r.email ?? "—"}</td><td>{r.parentesco ?? "—"}</td><td>{r.ativo ? "Ativo" : "Inativo"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
