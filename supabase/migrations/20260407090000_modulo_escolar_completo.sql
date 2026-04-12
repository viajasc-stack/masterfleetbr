-- =============================================================================
-- MasterFleetBR - Módulo Escolar (completo)
-- =============================================================================

INSERT INTO public.modulos_globais (
  codigo,
  nome,
  descricao,
  ativo,
  categoria,
  preco_centavos,
  ordem,
  venda_ativa,
  metadata
)
VALUES (
  'escolar',
  'Escolar',
  'Gestão escolar de linhas, alunos, responsáveis, presença, mensalidades e ocorrências',
  true,
  'operacional',
  9900,
  260,
  true,
  jsonb_build_object('segmento', 'escolar')
)
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  preco_centavos = EXCLUDED.preco_centavos,
  ordem = EXCLUDED.ordem,
  venda_ativa = EXCLUDED.venda_ativa,
  ativo = true,
  metadata = COALESCE(public.modulos_globais.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.escolar_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  turno text NOT NULL DEFAULT 'manha' CHECK (turno IN ('manha', 'tarde', 'noite', 'integral')),
  monitor_nome text,
  capacidade integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escolar_familias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_referencia text NOT NULL,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escolar_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  telefone text,
  email text,
  parentesco text,
  endereco text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escolar_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  familia_id uuid REFERENCES public.escolar_familias(id) ON DELETE SET NULL,
  linha_id uuid REFERENCES public.escolar_linhas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  data_nascimento date,
  escola text,
  serie text,
  periodo text NOT NULL DEFAULT 'manha' CHECK (periodo IN ('manha', 'tarde', 'noite', 'integral')),
  endereco text,
  ponto_referencia text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escolar_aluno_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.escolar_alunos(id) ON DELETE CASCADE,
  responsavel_id uuid NOT NULL REFERENCES public.escolar_responsaveis(id) ON DELETE CASCADE,
  principal boolean NOT NULL DEFAULT false,
  recebe_alertas boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, responsavel_id)
);

CREATE TABLE IF NOT EXISTS public.escolar_presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.escolar_alunos(id) ON DELETE CASCADE,
  linha_id uuid REFERENCES public.escolar_linhas(id) ON DELETE SET NULL,
  data_referencia date NOT NULL,
  periodo text NOT NULL CHECK (periodo IN ('ida', 'volta')),
  status text NOT NULL CHECK (status IN ('presente', 'falta', 'atraso', 'justificado')),
  observacao text,
  registrado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, data_referencia, periodo)
);

CREATE TABLE IF NOT EXISTS public.escolar_mensalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.escolar_alunos(id) ON DELETE CASCADE,
  referencia_mes date NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  multa numeric(12,2) NOT NULL DEFAULT 0,
  juros numeric(12,2) NOT NULL DEFAULT 0,
  valor_final numeric(12,2) NOT NULL DEFAULT 0,
  vencimento date,
  pago_em date,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'paga', 'atrasada', 'cancelada')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escolar_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.escolar_alunos(id) ON DELETE CASCADE,
  linha_id uuid REFERENCES public.escolar_linhas(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'outros' CHECK (tipo IN ('disciplina', 'saude', 'transporte', 'comunicado', 'outros')),
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa', 'media', 'alta')),
  descricao text NOT NULL,
  acao_tomada text,
  comunicado_responsavel boolean NOT NULL DEFAULT false,
  data_ocorrencia timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escolar_linhas_empresa ON public.escolar_linhas(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_escolar_familias_empresa ON public.escolar_familias(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_escolar_responsaveis_empresa ON public.escolar_responsaveis(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_escolar_alunos_empresa ON public.escolar_alunos(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_escolar_presencas_empresa_data ON public.escolar_presencas(empresa_id, data_referencia DESC);
CREATE INDEX IF NOT EXISTS idx_escolar_mensalidades_empresa_status ON public.escolar_mensalidades(empresa_id, status, vencimento);
CREATE INDEX IF NOT EXISTS idx_escolar_ocorrencias_empresa_data ON public.escolar_ocorrencias(empresa_id, data_ocorrencia DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at_escolar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'escolar_linhas',
    'escolar_familias',
    'escolar_responsaveis',
    'escolar_alunos',
    'escolar_mensalidades',
    'escolar_ocorrencias'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_escolar()', t, t);
  END LOOP;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'escolar_linhas',
    'escolar_familias',
    'escolar_responsaveis',
    'escolar_alunos',
    'escolar_aluno_responsaveis',
    'escolar_presencas',
    'escolar_mensalidades',
    'escolar_ocorrencias'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);

    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin())', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin()) WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin())', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())', t, t);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.escolar_kpis(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_linhas int := 0;
  v_alunos int := 0;
  v_presencas_hoje int := 0;
  v_mensalidades_abertas int := 0;
  v_mensalidades_atrasadas int := 0;
  v_ocorrencias_abertas int := 0;
BEGIN
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object(
      'linhas_ativas', 0,
      'alunos_ativos', 0,
      'presencas_hoje', 0,
      'mensalidades_abertas', 0,
      'mensalidades_atrasadas', 0,
      'ocorrencias_abertas', 0
    );
  END IF;

  SELECT COUNT(*) INTO v_linhas
  FROM public.escolar_linhas
  WHERE empresa_id = v_empresa_id AND ativo = true;

  SELECT COUNT(*) INTO v_alunos
  FROM public.escolar_alunos
  WHERE empresa_id = v_empresa_id AND ativo = true;

  SELECT COUNT(*) INTO v_presencas_hoje
  FROM public.escolar_presencas
  WHERE empresa_id = v_empresa_id
    AND data_referencia = CURRENT_DATE;

  SELECT COUNT(*) INTO v_mensalidades_abertas
  FROM public.escolar_mensalidades
  WHERE empresa_id = v_empresa_id
    AND status = 'aberta';

  SELECT COUNT(*) INTO v_mensalidades_atrasadas
  FROM public.escolar_mensalidades
  WHERE empresa_id = v_empresa_id
    AND status IN ('aberta', 'atrasada')
    AND vencimento IS NOT NULL
    AND vencimento < CURRENT_DATE;

  SELECT COUNT(*) INTO v_ocorrencias_abertas
  FROM public.escolar_ocorrencias
  WHERE empresa_id = v_empresa_id
    AND resolvido_em IS NULL
    AND (p_data_inicio IS NULL OR data_ocorrencia::date >= p_data_inicio)
    AND (p_data_fim IS NULL OR data_ocorrencia::date <= p_data_fim);

  RETURN jsonb_build_object(
    'linhas_ativas', v_linhas,
    'alunos_ativos', v_alunos,
    'presencas_hoje', v_presencas_hoje,
    'mensalidades_abertas', v_mensalidades_abertas,
    'mensalidades_atrasadas', v_mensalidades_atrasadas,
    'ocorrencias_abertas', v_ocorrencias_abertas
  );
END;
$$;
