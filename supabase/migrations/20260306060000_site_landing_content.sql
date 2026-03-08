-- Conteúdo dinâmico da landing (portal de vendas)

CREATE TABLE IF NOT EXISTS public.site_landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at_site_landing_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_landing_content_updated_at ON public.site_landing_content;
CREATE TRIGGER trg_site_landing_content_updated_at
BEFORE UPDATE ON public.site_landing_content
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_site_landing_content();

ALTER TABLE public.site_landing_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_landing_content_public_read ON public.site_landing_content;
CREATE POLICY site_landing_content_public_read
  ON public.site_landing_content
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS site_landing_content_super_admin_write ON public.site_landing_content;
CREATE POLICY site_landing_content_super_admin_write
  ON public.site_landing_content
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

INSERT INTO public.site_landing_content (slug, data)
VALUES (
  'home',
  jsonb_build_object(
    'brand', jsonb_build_object(
      'name', 'MasterFleetBR',
      'tagline', 'Gestão completa para empresas de transporte de passageiros'
    ),
    'hero', jsonb_build_object(
      'badge', 'SaaS #1 para frotas de turismo e fretamento',
      'title', 'A plataforma que organiza sua operação ponta a ponta',
      'highlight', 'e acelera o lucro da sua empresa',
      'subtitle', 'Una ordens de serviço, contratos, agenda, financeiro, manutenção, inventário e suporte em um único sistema pensado para o transporte de passageiros.',
      'primaryCtaLabel', 'Começar teste grátis',
      'primaryCtaHref', '/cadastro',
      'secondaryCtaLabel', 'Entrar no sistema',
      'secondaryCtaHref', '/login',
      'trustNote', 'Sem cartão de crédito. Implantação rápida e suporte especializado.'
    ),
    'kpis', jsonb_build_array(
      jsonb_build_object('label', 'Módulos integrados', 'value', '10+'),
      jsonb_build_object('label', 'Tempo ganho na operação', 'value', 'até 40%'),
      jsonb_build_object('label', 'Visão em tempo real', 'value', '24/7')
    ),
    'featuresTitle', 'Tudo que sua empresa precisa para crescer com controle',
    'features', jsonb_build_array(
      jsonb_build_object('icon', '🧾', 'title', 'Ordens de Serviço e Orçamentos', 'desc', 'Fluxo completo de abertura, execução, aprovação e histórico com rastreabilidade total.'),
      jsonb_build_object('icon', '🗓️', 'title', 'Agenda Operacional', 'desc', 'Programação centralizada de serviços, equipes e veículos para reduzir conflitos e atrasos.'),
      jsonb_build_object('icon', '🚌', 'title', 'Frota, Veículos e Motoristas', 'desc', 'Cadastro completo, documentos, vínculo de condutor e visão operacional da frota.'),
      jsonb_build_object('icon', '🛠️', 'title', 'Manutenção Inteligente', 'desc', 'Preventivas e corretivas com controle de custos para evitar paradas inesperadas.'),
      jsonb_build_object('icon', '📦', 'title', 'Inventário e Entradas', 'desc', 'Estoque com movimentações, fornecedores e alertas para não faltar item crítico.'),
      jsonb_build_object('icon', '💳', 'title', 'Financeiro e Assinatura', 'desc', 'Contas a pagar/receber, visão de caixa e cobrança centralizada em um único painel.'),
      jsonb_build_object('icon', '📈', 'title', 'Relatórios de Gestão', 'desc', 'Indicadores para tomada de decisão com foco em eficiência operacional e margem.')
    ),
    'proofTitle', 'Por que o MasterFleetBR vende mais e opera melhor?',
    'proofItems', jsonb_build_array(
      'Processos padronizados: menos retrabalho e menos erro humano.',
      'Informação centralizada: decisões mais rápidas para diretoria e operação.',
      'Atendimento mais ágil: módulo de suporte integrado entre empresa e master.',
      'Escalabilidade: comece pequeno e evolua sem trocar de sistema.'
    ),
    'plansTitle', 'Planos para cada fase do seu crescimento',
    'plansSubtitle', 'Comece no plano ideal e evolua conforme sua operação expande.',
    'plans', jsonb_build_array(
      jsonb_build_object(
        'name', 'Starter',
        'price', 'R$ 99',
        'period', '/mês',
        'description', 'Para iniciar com organização e controle básico.',
        'highlight', false,
        'ctaLabel', 'Começar grátis',
        'ctaHref', '/cadastro',
        'features', jsonb_build_array('OS e clientes', 'Veículos e motoristas', 'Financeiro essencial')
      ),
      jsonb_build_object(
        'name', 'Profissional',
        'price', 'R$ 199',
        'period', '/mês',
        'description', 'Mais vendido para operações em crescimento.',
        'highlight', true,
        'ctaLabel', 'Começar grátis',
        'ctaHref', '/cadastro',
        'features', jsonb_build_array('Tudo do Starter', 'Inventário completo', 'Contratos recorrentes', 'Relatórios avançados')
      ),
      jsonb_build_object(
        'name', 'Enterprise',
        'price', 'Sob consulta',
        'period', '',
        'description', 'Para empresas com alta escala e necessidades especiais.',
        'highlight', false,
        'ctaLabel', 'Falar com vendas',
        'ctaHref', '/cadastro',
        'features', jsonb_build_array('Tudo do Profissional', 'Configurações avançadas', 'Suporte prioritário', 'Acompanhamento dedicado')
      )
    ),
    'finalCta', jsonb_build_object(
      'title', 'Pronto para transformar sua operação?',
      'subtitle', 'Ative seu teste grátis e veja na prática como o MasterFleetBR simplifica sua gestão.',
      'primaryLabel', 'Quero testar agora',
      'primaryHref', '/cadastro',
      'secondaryLabel', 'Já sou cliente',
      'secondaryHref', '/login'
    )
  )
)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
