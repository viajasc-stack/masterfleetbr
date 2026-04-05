"use client";

import type { NegocioCategoria, NegocioTipoOportunidade } from "@/lib/centralNegocios";

export type FiltroAnunciosState = {
  busca: string;
  tipo: NegocioTipoOportunidade | "";
  categoriaId: string;
  estado: string;
  cidade: string;
};

type FiltroAnunciosProps = {
  value: FiltroAnunciosState;
  categorias: NegocioCategoria[];
  onChange: (next: FiltroAnunciosState) => void;
};

export function FiltroAnuncios({ value, categorias, onChange }: FiltroAnunciosProps) {
  function patch<K extends keyof FiltroAnunciosState>(key: K, val: FiltroAnunciosState[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 grid md:grid-cols-5 gap-3">
      <input
        className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm"
        placeholder="Buscar por título ou descrição"
        value={value.busca}
        onChange={(e) => patch("busca", e.target.value)}
      />

      <select
        className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        value={value.tipo}
        onChange={(e) => patch("tipo", e.target.value as NegocioTipoOportunidade | "")}
      >
        <option value="">Todos os tipos</option>
        <option value="venda">Venda</option>
        <option value="compra">Compra</option>
        <option value="permuta">Permuta</option>
        <option value="procura_parceiro">Procura parceiro</option>
        <option value="prestacao_servico">Prestação serviço</option>
      </select>

      <select
        className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        value={value.categoriaId}
        onChange={(e) => patch("categoriaId", e.target.value)}
      >
        <option value="">Todas as categorias</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <input
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          placeholder="UF"
          value={value.estado}
          onChange={(e) => patch("estado", e.target.value.toUpperCase())}
          maxLength={2}
        />
        <input
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          placeholder="Cidade"
          value={value.cidade}
          onChange={(e) => patch("cidade", e.target.value)}
        />
      </div>
    </div>
  );
}
