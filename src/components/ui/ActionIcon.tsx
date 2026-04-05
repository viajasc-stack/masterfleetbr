"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "neutral" | "primary" | "danger" | "success" | "warning";

function variantClass(variant: Variant) {
  if (variant === "primary") return "border-blue-200 text-blue-700 hover:bg-blue-50";
  if (variant === "danger") return "border-red-200 text-red-700 hover:bg-red-50";
  if (variant === "success") return "border-emerald-200 text-emerald-700 hover:bg-emerald-50";
  if (variant === "warning") return "border-amber-200 text-amber-700 hover:bg-amber-50";
  return "border-slate-300 text-slate-700 hover:bg-slate-50";
}

const baseClass = "inline-flex h-8 w-8 items-center justify-center rounded border text-sm transition disabled:opacity-50";

type ActionIconButtonProps = {
  title: string;
  children: ReactNode;
  onClick: () => void;
  variant?: Variant;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export function ActionIconButton({
  title,
  children,
  onClick,
  variant = "neutral",
  disabled,
  type = "button",
}: ActionIconButtonProps) {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variantClass(variant)}`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

type ActionIconLinkProps = {
  title: string;
  href: string;
  children: ReactNode;
  variant?: Variant;
};

export function ActionIconLink({ title, href, children, variant = "neutral" }: ActionIconLinkProps) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={`${baseClass} ${variantClass(variant)}`}
    >
      <span aria-hidden="true">{children}</span>
    </Link>
  );
}
