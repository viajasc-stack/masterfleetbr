"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type SuccessRedirectModalProps = {
  open: boolean;
  title: string;
  description: string;
  seconds?: number;
  onConfirm: () => void;
  confirmLabel?: string;
  details?: ReactNode;
  detailsTitle?: string;
};

export function SuccessRedirectModal({
  open,
  title,
  description,
  seconds = 7,
  onConfirm,
  confirmLabel = "OK, entendi",
  details,
  detailsTitle = "Informações",
}: SuccessRedirectModalProps) {
  const [countdown, setCountdown] = useState(seconds);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      redirectedRef.current = false;
      return;
    }

    redirectedRef.current = false;

    const intervalId = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    const timeoutId = setTimeout(() => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      onConfirm();
    }, seconds * 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [open, onConfirm, seconds]);

  if (!open) return null;

  function handleConfirm() {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 h-11 w-11 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-emerald-600" aria-hidden="true">
              <path
                d="M20 7L10 17L4.5 11.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">
              {description} Você será redirecionado automaticamente em {countdown}s.
            </p>
          </div>
        </div>

        {details ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{detailsTitle}</p>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 space-y-1">
              {details}
            </div>
          </>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
