import { supabase } from "@/lib/supabase/client";

export type NegocioTipoOportunidade =
  | "venda"
  | "compra"
  | "permuta"
  | "procura_parceiro"
  | "prestacao_servico";

export type NegocioStatusAnuncio =
  | "rascunho"
  | "ativo"
  | "aguardando_confirmacao"
  | "pausado"
  | "inativo"
  | "vendido"
  | "removido";

export type NegocioMotivoDenuncia =
  | "fora_do_segmento"
  | "conteudo_invalido"
  | "ja_vendido"
  | "spam"
  | "outro";

export type NegocioRespostaConfirmacao = "ainda_disponivel" | "vendido" | "pausar";

export type NegocioCategoria = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
};

export type NegocioSubcategoria = {
  id: string;
  categoria_id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
};

export type NegocioAnuncioListItem = {
  id: string;
  empresa_id: string;
  tipo_oportunidade: NegocioTipoOportunidade;
  categoria_id: string;
  categoria_nome: string | null;
  subcategoria_id: string | null;
  subcategoria_nome: string | null;
  titulo: string;
  descricao: string;
  preco_centavos: number | null;
  preco_a_combinar: boolean;
  cidade: string;
  estado: string;
  status: NegocioStatusAnuncio;
  publicado_em: string | null;
  updated_at: string;
  favoritado: boolean;
};

export type NegocioContato = {
  id?: string;
  canal: "whatsapp" | "telefone" | "email";
  valor: string;
  ordem?: number;
};

export type NegocioImagem = {
  id?: string;
  storage_path: string;
  ordem?: number;
};

export type NegocioAnuncioDetalhe = {
  id: string;
  empresa_id: string;
  tipo_oportunidade: NegocioTipoOportunidade;
  categoria_id: string;
  categoria_nome: string | null;
  subcategoria_id: string | null;
  subcategoria_nome: string | null;
  titulo: string;
  descricao: string;
  preco_centavos: number | null;
  preco_a_combinar: boolean;
  cidade: string;
  estado: string;
  status: NegocioStatusAnuncio;
  publicado_em: string | null;
  proxima_confirmacao_em: string | null;
  confirmacao_solicitada_em: string | null;
  limite_resposta_em: string | null;
  ultima_confirmacao_em: string | null;
  created_at: string;
  updated_at: string;
  favoritado: boolean;
  contatos: NegocioContato[];
  imagens: NegocioImagem[];
};

export function formatarMoedaCentavos(valor: number | null) {
  if (valor === null) return "A combinar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor / 100);
}

export async function listarCategorias() {
  const { data, error } = await supabase
    .from("negocio_categorias")
    .select("id, nome, slug, ativa, ordem")
    .order("ordem")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as NegocioCategoria[];
}

export async function listarSubcategorias(categoriaId?: string) {
  let query = supabase
    .from("negocio_subcategorias")
    .select("id, categoria_id, nome, slug, ativa, ordem")
    .order("ordem")
    .order("nome");
  if (categoriaId) query = query.eq("categoria_id", categoriaId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NegocioSubcategoria[];
}

export async function listarAnuncios(params?: {
  busca?: string;
  tipo?: NegocioTipoOportunidade | "";
  categoriaId?: string;
  estado?: string;
  cidade?: string;
  somenteFavoritos?: boolean;
  somenteMeus?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { data, error } = await supabase.rpc("negocio_listar_anuncios", {
    p_busca: params?.busca?.trim() || null,
    p_tipo: params?.tipo || null,
    p_categoria_id: params?.categoriaId || null,
    p_estado: params?.estado?.trim() || null,
    p_cidade: params?.cidade?.trim() || null,
    p_somente_favoritos: params?.somenteFavoritos ?? false,
    p_somente_meus: params?.somenteMeus ?? false,
    p_limit: params?.limit ?? 30,
    p_offset: params?.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as NegocioAnuncioListItem[];
}

export async function detalharAnuncio(id: string) {
  const { data, error } = await supabase.rpc("negocio_detalhar_anuncio", { p_id: id });
  if (error) throw new Error(error.message);
  return (data ?? null) as NegocioAnuncioDetalhe | null;
}

export async function criarAnuncio(payload: {
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
}) {
  const { data, error } = await supabase.rpc("negocio_criar_anuncio", {
    p_tipo: payload.tipo,
    p_categoria_id: payload.categoriaId,
    p_subcategoria_id: payload.subcategoriaId || null,
    p_titulo: payload.titulo,
    p_descricao: payload.descricao,
    p_preco_centavos: payload.precoACombinar ? null : payload.precoCentavos,
    p_preco_a_combinar: payload.precoACombinar,
    p_cidade: payload.cidade,
    p_estado: payload.estado,
    p_contatos: payload.contatos,
    p_imagens: payload.imagens,
    p_publicar: payload.publicar,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function editarAnuncio(payload: {
  anuncioId: string;
  tipo: NegocioTipoOportunidade;
  categoriaId: string;
  subcategoriaId?: string | null;
  titulo: string;
  descricao: string;
  precoCentavos: number | null;
  precoACombinar: boolean;
  cidade: string;
  estado: string;
  contatos?: NegocioContato[];
  imagens?: NegocioImagem[];
  publicar?: boolean;
}) {
  const { data, error } = await supabase.rpc("negocio_editar_anuncio", {
    p_anuncio_id: payload.anuncioId,
    p_tipo: payload.tipo,
    p_categoria_id: payload.categoriaId,
    p_subcategoria_id: payload.subcategoriaId || null,
    p_titulo: payload.titulo,
    p_descricao: payload.descricao,
    p_preco_centavos: payload.precoACombinar ? null : payload.precoCentavos,
    p_preco_a_combinar: payload.precoACombinar,
    p_cidade: payload.cidade,
    p_estado: payload.estado,
    p_contatos: payload.contatos ?? null,
    p_imagens: payload.imagens ?? null,
    p_publicar: payload.publicar ?? false,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function atualizarStatusAnuncio(anuncioId: string, status: NegocioStatusAnuncio, motivo?: string) {
  const { data, error } = await supabase.rpc("negocio_atualizar_status_anuncio", {
    p_anuncio_id: anuncioId,
    p_status: status,
    p_motivo: motivo ?? null,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function toggleFavorito(anuncioId: string) {
  const { data, error } = await supabase.rpc("negocio_toggle_favorito", { p_anuncio_id: anuncioId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function registrarDenuncia(anuncioId: string, motivo: NegocioMotivoDenuncia, descricao?: string) {
  const { data, error } = await supabase.rpc("negocio_registrar_denuncia", {
    p_anuncio_id: anuncioId,
    p_motivo: motivo,
    p_descricao: descricao || null,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function confirmarDisponibilidade(anuncioId: string, resposta: NegocioRespostaConfirmacao) {
  const { data, error } = await supabase.rpc("negocio_confirmar_disponibilidade", {
    p_anuncio_id: anuncioId,
    p_resposta: resposta,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}
