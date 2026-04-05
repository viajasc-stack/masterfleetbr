"use client";

import type { NegocioContato } from "@/lib/centralNegocios";

type ContatoAnuncioProps = {
  contatos: NegocioContato[];
};

export function ContatoAnuncio({ contatos }: ContatoAnuncioProps) {
  if (!contatos.length) {
    return <div className="text-sm text-slate-500">Sem contatos informados.</div>;
  }

  return (
    <div className="space-y-2">
      {contatos.map((c, idx) => (
        <div key={`${c.canal}-${idx}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide">{c.canal}</div>
          <div className="font-medium text-slate-900">{c.valor}</div>
        </div>
      ))}
    </div>
  );
}
