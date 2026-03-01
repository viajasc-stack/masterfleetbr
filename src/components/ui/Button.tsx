import Link from "next/link";

type Props = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  className?: string;
};

export function Button({ children, href, onClick, variant = "primary", disabled, className }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition " +
    (disabled ? "opacity-60 cursor-not-allowed " : "");
  const styles =
    variant === "primary"
      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
      : variant === "secondary"
      ? "border border-slate-300 bg-white hover:bg-slate-50 text-slate-900"
      : "text-slate-700 hover:text-slate-900";
  const cls = `${base} ${styles} ${className ?? ""}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}
