-- Módulos adicionais: BI rentabilidade, telemetria, portal cliente, compliance e escalas

CREATE TABLE IF NOT EXISTS public.telemetria_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NULL REFERENCES public.veiculos(id) ON DELETE SET NULL,
  motorista_id uuid NULL REFERENCES public.motoristas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'info',
  velocidade_kmh numeric(10,2) NULL,
  latitude numeric(10,7) NULL,
  longitude numeric(10,7) NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetria_eventos_empresa_ocorrido_em
  ON public.telemetria_eventos(empresa_id, ocorrido_em DESC);

CREATE TABLE IF NOT EXISTS public.portal_cliente_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamptz NULL,
  ultimo_acesso_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_cliente_acessos_empresa_cliente
  ON public.portal_cliente_acessos(empresa_id, cliente_id);

CREATE TABLE IF NOT EXISTS public.compliance_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  categoria text NOT NULL,
  numero text NULL,
  emissao date NULL,
  validade date NULL,
  status text NOT NULL DEFAULT 'valido',
  arquivo_url text NULL,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_documentos_empresa_validade
  ON public.compliance_documentos(empresa_id, validade);

CREATE TABLE IF NOT EXISTS public.escalas_motoristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
  inicio_em timestamptz NOT NULL,
  fim_em timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planejada',
  origem text NOT NULL DEFAULT 'manual',
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escalas_motoristas_periodo_valido CHECK (fim_em > inicio_em)
);

CREATE INDEX IF NOT EXISTS idx_escalas_motoristas_empresa_inicio
  ON public.escalas_motoristas(empresa_id, inicio_em DESC);

-- Views de BI
CREATE OR REPLACE VIEW public.v_bi_rentabilidade_contrato AS
SELECT
  c.empresa_id,
  c.id AS contrato_id,
  c.nome AS contrato_nome,
  COALESCE(SUM(os.valor_total), 0)::numeric(14,2) AS receita_total,
  COALESCE(SUM(CASE WHEN cf.tipo = 'pagar' THEN cf.valor ELSE 0 END), 0)::numeric(14,2) AS custo_total,
  (
    COALESCE(SUM(os.valor_total), 0) -
    COALESCE(SUM(CASE WHEN cf.tipo = 'pagar' THEN cf.valor ELSE 0 END), 0)
  )::numeric(14,2) AS margem_total
FROM public.contratos c
LEFT JOIN public.ordens_servico os
  ON os.contrato_id = c.id
LEFT JOIN public.contas_financeiras cf
  ON cf.contrato_id = c.id
GROUP BY c.empresa_id, c.id, c.nome;

CREATE OR REPLACE VIEW public.v_bi_rentabilidade_veiculo AS
SELECT
  os.empresa_id,
  os.veiculo_id,
  COALESCE(v.placa, v.prefixo, 'Sem identificação') AS veiculo,
  COUNT(*)::int AS total_os,
  COALESCE(SUM(os.valor_total), 0)::numeric(14,2) AS receita_total,
  COALESCE(SUM(m.custo), 0)::numeric(14,2) AS custo_manutencao,
  (
    COALESCE(SUM(os.valor_total), 0) - COALESCE(SUM(m.custo), 0)
  )::numeric(14,2) AS margem_estimada
FROM public.ordens_servico os
LEFT JOIN public.veiculos v ON v.id = os.veiculo_id
LEFT JOIN public.manutencoes m ON m.veiculo_id = os.veiculo_id
GROUP BY os.empresa_id, os.veiculo_id, COALESCE(v.placa, v.prefixo, 'Sem identificação');

-- RLS
ALTER TABLE public.telemetria_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS telemetria_eventos_select ON public.telemetria_eventos;
CREATE POLICY telemetria_eventos_select ON public.telemetria_eventos
  FOR SELECT USING (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS telemetria_eventos_insert ON public.telemetria_eventos;
CREATE POLICY telemetria_eventos_insert ON public.telemetria_eventos
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS telemetria_eventos_update ON public.telemetria_eventos;
CREATE POLICY telemetria_eventos_update ON public.telemetria_eventos
  FOR UPDATE USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());

ALTER TABLE public.portal_cliente_acessos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_cliente_acessos_select ON public.portal_cliente_acessos;
CREATE POLICY portal_cliente_acessos_select ON public.portal_cliente_acessos
  FOR SELECT USING (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS portal_cliente_acessos_insert ON public.portal_cliente_acessos;
CREATE POLICY portal_cliente_acessos_insert ON public.portal_cliente_acessos
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS portal_cliente_acessos_update ON public.portal_cliente_acessos;
CREATE POLICY portal_cliente_acessos_update ON public.portal_cliente_acessos
  FOR UPDATE USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());

ALTER TABLE public.compliance_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compliance_documentos_select ON public.compliance_documentos;
CREATE POLICY compliance_documentos_select ON public.compliance_documentos
  FOR SELECT USING (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS compliance_documentos_insert ON public.compliance_documentos;
CREATE POLICY compliance_documentos_insert ON public.compliance_documentos
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS compliance_documentos_update ON public.compliance_documentos;
CREATE POLICY compliance_documentos_update ON public.compliance_documentos
  FOR UPDATE USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS compliance_documentos_delete ON public.compliance_documentos;
CREATE POLICY compliance_documentos_delete ON public.compliance_documentos
  FOR DELETE USING (empresa_id = public.minha_empresa_id());

ALTER TABLE public.escalas_motoristas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escalas_motoristas_select ON public.escalas_motoristas;
CREATE POLICY escalas_motoristas_select ON public.escalas_motoristas
  FOR SELECT USING (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS escalas_motoristas_insert ON public.escalas_motoristas;
CREATE POLICY escalas_motoristas_insert ON public.escalas_motoristas
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS escalas_motoristas_update ON public.escalas_motoristas;
CREATE POLICY escalas_motoristas_update ON public.escalas_motoristas
  FOR UPDATE USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS escalas_motoristas_delete ON public.escalas_motoristas;
CREATE POLICY escalas_motoristas_delete ON public.escalas_motoristas
  FOR DELETE USING (empresa_id = public.minha_empresa_id());

-- updated_at helpers
CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_documentos_updated_at ON public.compliance_documentos;
CREATE TRIGGER trg_compliance_documentos_updated_at
BEFORE UPDATE ON public.compliance_documentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS trg_escalas_motoristas_updated_at ON public.escalas_motoristas;
CREATE TRIGGER trg_escalas_motoristas_updated_at
BEFORE UPDATE ON public.escalas_motoristas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
