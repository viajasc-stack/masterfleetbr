"use client";

import { useMemo, useState } from "react";
import type {
  NegocioCategoria,
  NegocioContato,
  NegocioImagem,
  NegocioSubcategoria,
  NegocioTipoOportunidade,
} from "@/lib/centralNegocios";

type FormAnuncioProps = {
  categorias: NegocioCategoria[];
  subcategorias: NegocioSubcategoria[];
  initial?: {
    tipo?: NegocioTipoOportunidade;
    categoriaId?: string;
    subcategoriaId?: string;
    titulo?: string;
    descricao?: string;
    precoCentavos?: number | null;
    precoACombinar?: boolean;
    cidade?: string;
    estado?: string;
    contatos?: NegocioContato[];
    imagens?: NegocioImagem[];
  };
  loading?: boolean;
  onSubmit: (payload: {
    tipo: NegocioTipoOportunidade;
    categoriaId: string;
    subcategoriaId?: string | null;
    titulo: string;
    descricao: string;
    precoCentavos: number | null;
    precoACombinar: boolean;
    cidade: string;
    estado: string;
    contatos: NegocioContato[];
    imagens: NegocioImagem[];
    publicar: boolean;
  }) => Promise<void>;
};

export function FormAnuncio({ categorias, subcategorias, initial, loading = false, onSubmit }: FormAnuncioProps) {
  const [tipo, setTipo] = useState<NegocioTipoOportunidade>(initial?.tipo ?? "venda");
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId ?? "");
  const [subcategoriaId, setSubcategoriaId] = useState(initial?.subcategoriaId ?? "");
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [precoACombinar, setPrecoACombinar] = useState(initial?.precoACombinar ?? false);
  const [precoReais, setPrecoReais] = useState(
    typeof initial?.precoCentavos === "number" ? String(initial.precoCentavos / 100) : ""
  );
  const [cidade, setCidade] = useState(initial?.cidade ?? "");
  const [estado, setEstado] = useState(initial?.estado ?? "");

  const [whatsapp, setWhatsapp] = useState(initial?.contatos?.find((c) => c.canal === "whatsapp")?.valor ?? "");
  const [telefone, setTelefone] = useState(initial?.contatos?.find((c) => c.canal === "telefone")?.valor ?? "");
  const [email, setEmail] = useState(initial?.contatos?.find((c) => c.canal === "email")?.valor ?? "");
  const [imagensText, setImagensText] = useState((initial?.imagens ?? []).map((i) => i.storage_path).join("\n"));

  const subcategoriasDaCategoria = useMemo(
    () => subcategorias.filter((s) => s.categoria_id === categoriaId),
    [subcategorias, categoriaId]
  );

  async function handleSubmit(publicar: boolean) {
    const precoNumerico = precoACombinar
      ? null
      : Math.max(0, Math.round(Number(String(precoReais).replace(",", ".")) * 100));

    const contatos: NegocioContato[] = [
      whatsapp ? { canal: "whatsapp", valor: whatsapp } : null,
      telefone ? { canal: "telefone", valor: telefone } : null,
      email ? { canal: "email", valor: email } : null,
    ].filter(Boolean) as NegocioContato[];

    const imagens: NegocioImagem[] = imagensText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((storage_path) => ({ storage_path }));

    await onSubmit({
      tipo,
      categoriaId,
      subcategoriaId: subcategoriaId || null,
      titulo,
      descricao,
      precoCentavos: Number.isFinite(precoNumerico as number) ? precoNumerico : null,
      precoACombinar,
      cidade,
      estado,
      contatos,
      imagens,
      publicar,
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as NegocioTipoOportunidade)}>
          <option value="venda">Venda</option>
          <option value="compra">Compra</option>
          <option value="permuta">Permuta</option>
          <option value="procura_parceiro">Procura parceiro</option>
          <option value="prestacao_servico">Prestação serviço</option>
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Selecione categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={subcategoriaId} onChange={(e) => setSubcategoriaId(e.target.value)}>
          <option value="">Subcategoria (opcional)</option>
          {subcategoriasDaCategoria.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>

      <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-28" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

      <div className="grid md:grid-cols-3 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={precoACombinar} onChange={(e) => setPrecoACombinar(e.target.checked)} />
          Preço a combinar
        </label>
        <input
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          placeholder="Preço (R$)"
          value={precoReais}
          onChange={(e) => setPrecoReais(e.target.value)}
          disabled={precoACombinar}
        />
        <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="UF" value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} />
        <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
      </div>

      <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-20" placeholder="Imagens (1 storage_path por linha)" value={imagensText} onChange={(e) => setImagensText(e.target.value)} />

      <div className="flex gap-2 justify-end">
        <button type="button" disabled={loading || !categoriaId || !titulo || !descricao || !cidade || estado.length !== 2} onClick={() => handleSubmit(false)} className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-60">Salvar rascunho</button>
        <button type="button" disabled={loading || !categoriaId || !titulo || !descricao || !cidade || estado.length !== 2} onClick={() => handleSubmit(true)} className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60">Publicar</button>
      </div>
    </div>
  );
}
