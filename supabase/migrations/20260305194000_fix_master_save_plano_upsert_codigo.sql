-- Ajuste: salvar plano deve atualizar por código quando já existir

CREATE OR REPLACE FUNCTION public.master_save_plano(
  p_id uuid DEFAULT NULL,
  p_codigo text DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_valor_centavos bigint DEFAULT 0,
  p_ordem int DEFAULT 0,
  p_ativo boolean DEFAULT true,
  p_modulos jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_codigo text := NULLIF(btrim(p_codigo), '');
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'nome_required';
  END IF;

  IF jsonb_typeof(COALESCE(p_modulos, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'modulos_must_be_array';
  END IF;

  IF p_id IS NULL THEN
    IF v_codigo IS NOT NULL THEN
      SELECT id INTO v_id FROM public.planos WHERE codigo = v_codigo LIMIT 1;
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO public.planos (codigo, nome, descricao, valor_centavos, ordem, ativo, modulos)
      VALUES (
        v_codigo,
        btrim(p_nome),
        NULLIF(btrim(p_descricao), ''),
        COALESCE(p_valor_centavos, 0),
        COALESCE(p_ordem, 0),
        COALESCE(p_ativo, true),
        COALESCE(p_modulos, '[]'::jsonb)
      )
      RETURNING id INTO v_id;
    ELSE
      UPDATE public.planos
      SET
        nome = btrim(p_nome),
        descricao = NULLIF(btrim(p_descricao), ''),
        valor_centavos = COALESCE(p_valor_centavos, 0),
        ordem = COALESCE(p_ordem, 0),
        ativo = COALESCE(p_ativo, ativo),
        modulos = COALESCE(p_modulos, '[]'::jsonb)
      WHERE id = v_id
      RETURNING id INTO v_id;
    END IF;
  ELSE
    UPDATE public.planos
    SET
      codigo = COALESCE(v_codigo, codigo),
      nome = btrim(p_nome),
      descricao = NULLIF(btrim(p_descricao), ''),
      valor_centavos = COALESCE(p_valor_centavos, 0),
      ordem = COALESCE(p_ordem, 0),
      ativo = COALESCE(p_ativo, ativo),
      modulos = COALESCE(p_modulos, '[]'::jsonb)
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'plano_not_found';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;
