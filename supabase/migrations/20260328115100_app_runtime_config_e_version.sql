-- Runtime config dinâmica para app motorista (multiempresa)

CREATE TABLE IF NOT EXISTS public.app_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave text NOT NULL,
  valor jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_configuracoes_empresa_chave_created
  ON public.app_configuracoes (empresa_id, chave, created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_versao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_minima text NOT NULL,
  versao_atual text NOT NULL,
  obrigar_atualizacao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_versao_created
  ON public.app_versao (created_at DESC);

ALTER TABLE public.app_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_configuracoes_empresa" ON public.app_configuracoes;
CREATE POLICY "app_configuracoes_empresa"
ON public.app_configuracoes
USING (
  empresa_id IS NULL OR empresa_id = public.minha_empresa_id()
);

DROP POLICY IF EXISTS "app_configuracoes_insert" ON public.app_configuracoes;
CREATE POLICY "app_configuracoes_insert"
ON public.app_configuracoes
FOR INSERT
WITH CHECK (
  public.is_super_admin() OR empresa_id = public.minha_empresa_id()
);

DROP POLICY IF EXISTS "app_configuracoes_update" ON public.app_configuracoes;
CREATE POLICY "app_configuracoes_update"
ON public.app_configuracoes
FOR UPDATE
USING (
  public.is_super_admin() OR empresa_id = public.minha_empresa_id()
);

DROP POLICY IF EXISTS "app_configuracoes_delete" ON public.app_configuracoes;
CREATE POLICY "app_configuracoes_delete"
ON public.app_configuracoes
FOR DELETE
USING (
  public.is_super_admin() OR empresa_id = public.minha_empresa_id()
);

DROP POLICY IF EXISTS "app_versao_read" ON public.app_versao;
CREATE POLICY "app_versao_read"
ON public.app_versao
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "app_versao_write_super_admin" ON public.app_versao;
CREATE POLICY "app_versao_write_super_admin"
ON public.app_versao
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- defaults globais (empresa_id null)
INSERT INTO public.app_configuracoes (empresa_id, chave, valor)
VALUES
  (NULL, 'checklist_obrigatorio', 'true'::jsonb),
  (NULL, 'exigir_foto', 'true'::jsonb),
  (NULL, 'exigir_assinatura', 'true'::jsonb),
  (NULL, 'modo_offline_ativo', 'true'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.app_versao (versao_minima, versao_atual, obrigar_atualizacao)
VALUES ('1.0.0', '1.0.0', false)
ON CONFLICT DO NOTHING;
