type EstoqueStatusBadgeProps = {
  status: string;
};

const MAP: Record<string, string> = {
  ativo: "border-emerald-200 text-emerald-700 bg-emerald-50",
  inativo: "border-slate-200 text-slate-600 bg-slate-50",
  rascunho: "border-slate-200 text-slate-700 bg-slate-50",
  aguardando_aprovacao: "border-amber-200 text-amber-700 bg-amber-50",
  aprovado: "border-indigo-200 text-indigo-700 bg-indigo-50",
  pedido_enviado: "border-sky-200 text-sky-700 bg-sky-50",
  recebido_parcial: "border-violet-200 text-violet-700 bg-violet-50",
  recebido_total: "border-emerald-200 text-emerald-700 bg-emerald-50",
  cancelado: "border-rose-200 text-rose-700 bg-rose-50",
  aberto: "border-sky-200 text-sky-700 bg-sky-50",
  em_contagem: "border-amber-200 text-amber-700 bg-amber-50",
  concluido: "border-indigo-200 text-indigo-700 bg-indigo-50",
  ajustado: "border-emerald-200 text-emerald-700 bg-emerald-50",
};

export function EstoqueStatusBadge({ status }: EstoqueStatusBadgeProps) {
  const normalized = (status || "").toLowerCase();
  const cls = MAP[normalized] ?? "border-slate-200 text-slate-700 bg-slate-50";

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs border ${cls}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
