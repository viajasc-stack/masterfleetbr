import Link from "next/link";

type EstoqueKpiCardProps = {
  label: string;
  value: string | number;
  href?: string;
  tone?: "default" | "danger" | "warning" | "success" | "info";
};

const toneClass: Record<NonNullable<EstoqueKpiCardProps["tone"]>, string> = {
  default: "border-slate-200 bg-white",
  danger: "border-rose-200 bg-rose-50",
  warning: "border-amber-200 bg-amber-50",
  success: "border-emerald-200 bg-emerald-50",
  info: "border-sky-200 bg-sky-50",
};

export function EstoqueKpiCard({ label, value, href, tone = "default" }: EstoqueKpiCardProps) {
  const cls = `rounded-xl border p-4 shadow-sm transition hover:shadow ${toneClass[tone]}`;
  const content = (
    <>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-600 mt-1">{label}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }

  return <div className={cls}>{content}</div>;
}
