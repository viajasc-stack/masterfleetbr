-- Adiciona o módulo Passageiros ao catálogo global para ficar disponível
-- no painel master (catálogo) e no Meu Plano da empresa.

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
  'passageiros',
  'Passageiros',
  'Cadastro e gestão de passageiros em módulo separado.',
  true,
  'operacional',
  4900,
  35,
  true,
  jsonb_build_object(
    'icone', '👥',
    'highlight', 'Módulo dedicado para gestão de passageiros'
  )
)
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ativo = true,
  categoria = EXCLUDED.categoria,
  preco_centavos = EXCLUDED.preco_centavos,
  ordem = EXCLUDED.ordem,
  venda_ativa = true,
  metadata = COALESCE(public.modulos_globais.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

-- Ajusta a descrição do módulo operacional para refletir o desmembramento.
UPDATE public.modulos_globais
SET
  descricao = 'Dashboard, OS, veículos, motoristas, fretamentos, contratos e clientes',
  updated_at = now()
WHERE codigo = 'operacional';
