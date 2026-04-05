"use client";

import { useState } from "react";
import type { NegocioMotivoDenuncia } from "@/lib/centralNegocios";

type ModalDenunciaProps = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: { motivo: NegocioMotivoDenuncia; descricao?: string }) => Promise<void>;
};

export function ModalDenuncia({ open, loading = false, onClose, onSubmit }: ModalDenunciaProps) {
  const [motivo, setMotivo] = useState<NegocioMotivoDenuncia>("fora_do_segmento");
  const [descricao, setDescricao] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Denunciar anúncio</h3>
          <p className="text-sm text-slate-500">A denúncia será enviada para moderação master.</p>
        </div>

        <select
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as NegocioMotivoDenuncia)}
        >
          <option value="fora_do_segmento">Fora do segmento</option>
          <option value="conteudo_invalido">Conteúdo inválido</option>
          <option value="ja_vendido">Já vendido</option>
          <option value="spam">Spam</option>
          <option value="outro">Outro</option>
        </select>

        <textarea
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-24"
          placeholder="Detalhes (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60"
            disabled={loading}
            onClick={() => onSubmit({ motivo, descricao: descricao.trim() || undefined })}
          >
            {loading ? "Enviando..." : "Enviar denúncia"}
          </button>
        </div>
      </div>
    </div>
  );
}
