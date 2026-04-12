"use client";

import Link from "next/link";

export default function MasterConfiguracoesAplicativosPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configurações • Aplicativos</h1>
        <p className="text-sm text-slate-600 mt-0.5">Gerencie configurações específicas dos apps da plataforma.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">Apps disponíveis</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/master/configuracoes/aplicativos/masterfleetbr-motorista"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            MasterFleetBR Motorista
          </Link>
        </div>
      </section>
    </div>
  );
}
