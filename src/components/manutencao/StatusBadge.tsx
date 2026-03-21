type StatusBadgeProps = {
  status: string;
};

function classes(status: string) {
  if (["finalizada", "concluida", "aprovada", "convertida", "em_dia"].includes(status)) {
    return "bg-emerald-50 border-emerald-200 text-emerald-700";
  }
  if (["andamento", "analise", "em_analise", "vencendo"].includes(status)) {
    return "bg-blue-50 border-blue-200 text-blue-700";
  }
  if (["aguardando_pecas", "nova"].includes(status)) {
    return "bg-amber-50 border-amber-200 text-amber-700";
  }
  if (["vencida", "rejeitada"].includes(status)) {
    return "bg-rose-50 border-rose-200 text-rose-700";
  }
  return "bg-slate-50 border-slate-200 text-slate-700";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs border ${classes(status)}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
