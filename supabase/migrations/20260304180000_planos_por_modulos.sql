-- Modelo de planos por módulos (sem cobrança por usuário)

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS modulos jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planos_codigo_unique'
  ) THEN
    ALTER TABLE public.planos
      ADD CONSTRAINT planos_codigo_unique UNIQUE (codigo);
  END IF;
END $$;

-- Mantém apenas array JSON em modulos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planos_modulos_is_array'
  ) THEN
    ALTER TABLE public.planos
      ADD CONSTRAINT planos_modulos_is_array
      CHECK (jsonb_typeof(modulos) = 'array');
  END IF;
END $$;

INSERT INTO public.planos (codigo, nome, descricao, valor_centavos, ordem, ativo, modulos)
VALUES
  (
    'basico',
    'Básico',
    'Operação essencial para pequenas frotas.',
    9900,
    10,
    true,
    '["dashboard","ordens_servico","clientes","veiculos","motoristas"]'::jsonb
  ),
  (
    'intermediario',
    'Intermediário',
    'Controle operacional + gestão financeira e estoque.',
    19900,
    20,
    true,
    '["dashboard","ordens_servico","clientes","veiculos","motoristas","financeiro","inventario","relatorios"]'::jsonb
  ),
  (
    'top',
    'Top',
    'Pacote completo com todos os módulos e recursos avançados.',
    29900,
    30,
    true,
    '["dashboard","ordens_servico","clientes","veiculos","motoristas","financeiro","inventario","relatorios","manutencao","agenda","api_integracoes","automacoes"]'::jsonb
  )
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  valor_centavos = EXCLUDED.valor_centavos,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo,
  modulos = EXCLUDED.modulos;
