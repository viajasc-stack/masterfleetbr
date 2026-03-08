-- Relatório agregado da empresa (painel master)

CREATE OR REPLACE FUNCTION public.master_empresa_relatorio(
  p_empresa_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clientes bigint := 0;
  v_veiculos bigint := 0;
  v_motoristas bigint := 0;
  v_usuarios bigint := 0;
  v_contratos bigint := 0;
  v_ordens_servico bigint := 0;
  v_os_pendentes bigint := 0;
  v_os_em_execucao bigint := 0;
  v_os_concluidas bigint := 0;
  v_orcamentos bigint := 0;
  v_produtos bigint := 0;
  v_manutencoes bigint := 0;
  v_faturas bigint := 0;
  v_faturas_abertas bigint := 0;
  v_faturas_pagas bigint := 0;
  v_faturas_abertas_valor bigint := 0;
  v_faturas_pagas_valor bigint := 0;
  v_contas bigint := 0;
  v_contas_pagar_pendentes numeric := 0;
  v_contas_receber_pendentes numeric := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = p_empresa_id) THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF to_regclass('public.clientes') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_clientes FROM public.clientes WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.veiculos') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_veiculos FROM public.veiculos WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.motoristas') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_motoristas FROM public.motoristas WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_usuarios FROM public.profiles WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.contratos') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_contratos FROM public.contratos WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.ordens_servico') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ordens_servico FROM public.ordens_servico WHERE empresa_id = p_empresa_id;
    SELECT COUNT(*) INTO v_os_pendentes FROM public.ordens_servico WHERE empresa_id = p_empresa_id AND status = 'pendente';
    SELECT COUNT(*) INTO v_os_em_execucao FROM public.ordens_servico WHERE empresa_id = p_empresa_id AND status = 'em_execucao';
    SELECT COUNT(*) INTO v_os_concluidas FROM public.ordens_servico WHERE empresa_id = p_empresa_id AND status = 'concluida';
  END IF;

  IF to_regclass('public.orcamentos') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_orcamentos FROM public.orcamentos WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.produtos') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_produtos FROM public.produtos WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.manutencoes') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_manutencoes FROM public.manutencoes WHERE empresa_id = p_empresa_id;
  END IF;

  IF to_regclass('public.faturas') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_faturas FROM public.faturas WHERE empresa_id = p_empresa_id;
    SELECT COUNT(*) INTO v_faturas_abertas FROM public.faturas WHERE empresa_id = p_empresa_id AND status = 'aberta';
    SELECT COUNT(*) INTO v_faturas_pagas FROM public.faturas WHERE empresa_id = p_empresa_id AND status = 'paga';
    SELECT COALESCE(SUM(valor_centavos), 0) INTO v_faturas_abertas_valor FROM public.faturas WHERE empresa_id = p_empresa_id AND status = 'aberta';
    SELECT COALESCE(SUM(valor_centavos), 0) INTO v_faturas_pagas_valor FROM public.faturas WHERE empresa_id = p_empresa_id AND status = 'paga';
  END IF;

  IF to_regclass('public.contas_financeiras') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_contas FROM public.contas_financeiras WHERE empresa_id = p_empresa_id;
    SELECT COALESCE(SUM(valor), 0) INTO v_contas_pagar_pendentes
    FROM public.contas_financeiras
    WHERE empresa_id = p_empresa_id AND tipo = 'pagar' AND status = 'pendente';

    SELECT COALESCE(SUM(valor), 0) INTO v_contas_receber_pendentes
    FROM public.contas_financeiras
    WHERE empresa_id = p_empresa_id AND tipo = 'receber' AND status = 'pendente';
  END IF;

  RETURN jsonb_build_object(
    'clientes', v_clientes,
    'veiculos', v_veiculos,
    'motoristas', v_motoristas,
    'usuarios', v_usuarios,
    'contratos', v_contratos,
    'ordens_servico', v_ordens_servico,
    'os_pendentes', v_os_pendentes,
    'os_em_execucao', v_os_em_execucao,
    'os_concluidas', v_os_concluidas,
    'orcamentos', v_orcamentos,
    'produtos', v_produtos,
    'manutencoes', v_manutencoes,
    'faturas', v_faturas,
    'faturas_abertas', v_faturas_abertas,
    'faturas_pagas', v_faturas_pagas,
    'faturas_abertas_valor_centavos', v_faturas_abertas_valor,
    'faturas_pagas_valor_centavos', v_faturas_pagas_valor,
    'contas_financeiras', v_contas,
    'contas_pagar_pendentes', v_contas_pagar_pendentes,
    'contas_receber_pendentes', v_contas_receber_pendentes
  );
END;
$$;
