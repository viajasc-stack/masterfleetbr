-- Seed de dados de TESTE para homologação do fluxo web/app motorista
-- Empresa alvo: e2baf0e3-1fdd-4ef8-b0e8-5c09e1939620
-- Motorista alvo: 59165444-baf4-45e7-8a61-21dfeb3250e3

DO $$
DECLARE
  v_empresa_id constant uuid := 'e2baf0e3-1fdd-4ef8-b0e8-5c09e1939620';
  v_motorista_id constant uuid := '59165444-baf4-45e7-8a61-21dfeb3250e3';

  v_cliente_teste_a uuid := '5d3378a1-8fbb-4d22-8f5a-57ed4d0fa111';
  v_cliente_teste_b uuid := '5d3378a1-8fbb-4d22-8f5a-57ed4d0fa112';

  v_veiculo_teste_a uuid := '7f7cb6d9-c7eb-4cb5-a72f-0dc89fab2111';
  v_veiculo_teste_b uuid := '7f7cb6d9-c7eb-4cb5-a72f-0dc89fab2112';

  v_contrato_teste_a uuid := '15ab93ef-c6a3-499e-bf02-4d6af6f2f111';
  v_contrato_teste_b uuid := '15ab93ef-c6a3-499e-bf02-4d6af6f2f112';
  v_contrato_teste_c uuid := '15ab93ef-c6a3-499e-bf02-4d6af6f2f113';

  v_os_teste_01 uuid := '8f488c56-7d71-44b8-846d-71bd5b313111';
  v_os_teste_02 uuid := '8f488c56-7d71-44b8-846d-71bd5b313112';
  v_os_teste_03 uuid := '8f488c56-7d71-44b8-846d-71bd5b313113';
  v_os_teste_04 uuid := '8f488c56-7d71-44b8-846d-71bd5b313114';
  v_os_teste_05 uuid := '8f488c56-7d71-44b8-846d-71bd5b313115';
  v_os_teste_06 uuid := '8f488c56-7d71-44b8-846d-71bd5b313116';

  v_motorista_empresa_id uuid;
BEGIN
  -- Em contexto de migration (service role), funções minha_empresa_id() podem retornar NULL.
  -- Para permitir seed deterministicamente, desativamos temporariamente triggers que sobrescrevem empresa_id.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'clientes' AND t.tgname = 'trg_clientes_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.clientes DISABLE TRIGGER trg_clientes_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'veiculos' AND t.tgname = 'trg_veiculos_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.veiculos DISABLE TRIGGER trg_veiculos_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'contratos' AND t.tgname = 'trg_contratos_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.contratos DISABLE TRIGGER trg_contratos_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_numero' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico DISABLE TRIGGER trg_os_numero';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_sync_financeiro_km_fixo_insert' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico DISABLE TRIGGER trg_os_sync_financeiro_km_fixo_insert';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_sync_financeiro_km_fixo_update' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico DISABLE TRIGGER trg_os_sync_financeiro_km_fixo_update';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_sync_financeiro_contrato_mensal' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico DISABLE TRIGGER trg_os_sync_financeiro_contrato_mensal';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_extra_motorista_after_insert' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico DISABLE TRIGGER trg_os_extra_motorista_after_insert';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_extra_motorista_after_update' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico DISABLE TRIGGER trg_os_extra_motorista_after_update';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'abastecimentos' AND t.tgname = 'trg_abastecimentos_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.abastecimentos DISABLE TRIGGER trg_abastecimentos_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'abastecimentos' AND t.tgname = 'trg_abastecimentos_enforce_business_rules' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.abastecimentos DISABLE TRIGGER trg_abastecimentos_enforce_business_rules';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'motorista_notificacao_preferencias' AND t.tgname = 'trg_pref_notif_motorista_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.motorista_notificacao_preferencias DISABLE TRIGGER trg_pref_notif_motorista_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'motorista_extras' AND t.tgname = 'trg_motorista_extras_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.motorista_extras DISABLE TRIGGER trg_motorista_extras_empresa';
  END IF;

  SELECT m.empresa_id
    INTO v_motorista_empresa_id
  FROM public.motoristas m
  WHERE m.id = v_motorista_id
  LIMIT 1;

  IF v_motorista_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Motorista % não encontrado.', v_motorista_id;
  END IF;

  IF v_motorista_empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Motorista % não pertence à empresa %.', v_motorista_id, v_empresa_id;
  END IF;

  -- Garante permissão para cenários de abastecimento de teste
  UPDATE public.motoristas
     SET pode_abastecer = true
   WHERE id = v_motorista_id;

  -- CLIENTES DE TESTE
  INSERT INTO public.clientes (
    id,
    empresa_id,
    nome,
    tipo,
    cpf_cnpj,
    email,
    telefone,
    whatsapp,
    endereco,
    cidade,
    estado,
    cep,
    observacoes,
    ativo
  ) VALUES
    (
      v_cliente_teste_a,
      v_empresa_id,
      'CLIENTE TESTE A - MOTORISTA QA',
      'empresa',
      '00.000.000/0001-01',
      'cliente.teste.a+motorista@masterfleetbr.test',
      '(48) 3000-1001',
      '(48) 99999-1001',
      'Rua Teste Contrato A, 100',
      'Florianópolis',
      'SC',
      '88000-001',
      'DADO DE TESTE - CLIENTE PARA CENÁRIOS DO MOTORISTA',
      true
    ),
    (
      v_cliente_teste_b,
      v_empresa_id,
      'CLIENTE TESTE B - MOTORISTA QA',
      'empresa',
      '00.000.000/0001-02',
      'cliente.teste.b+motorista@masterfleetbr.test',
      '(48) 3000-1002',
      '(48) 99999-1002',
      'Rua Teste Contrato B, 200',
      'São José',
      'SC',
      '88100-002',
      'DADO DE TESTE - CLIENTE SECUNDÁRIO PARA OS DE TESTE',
      true
    )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    cpf_cnpj = EXCLUDED.cpf_cnpj,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    whatsapp = EXCLUDED.whatsapp,
    endereco = EXCLUDED.endereco,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    cep = EXCLUDED.cep,
    observacoes = EXCLUDED.observacoes,
    ativo = EXCLUDED.ativo;

  -- VEÍCULOS DE TESTE
  INSERT INTO public.veiculos (
    id,
    empresa_id,
    placa,
    tipo,
    marca,
    modelo,
    ano_fabricacao,
    ano_modelo,
    cor,
    capacidade_passageiros,
    status,
    km_atual,
    observacoes
  ) VALUES
    (
      v_veiculo_teste_a,
      v_empresa_id,
      'TST-1101',
      'micro-onibus',
      'Mercedes-Benz',
      'LO 916 TESTE',
      2021,
      2022,
      'Branco',
      27,
      'ativo',
      125000,
      'DADO DE TESTE - VEÍCULO A PARA ROTAS/OS DO MOTORISTA'
    ),
    (
      v_veiculo_teste_b,
      v_empresa_id,
      'TST-2202',
      'van',
      'Renault',
      'Master TESTE',
      2020,
      2021,
      'Prata',
      16,
      'ativo',
      98500,
      'DADO DE TESTE - VEÍCULO B PARA CENÁRIOS ALTERNATIVOS'
    )
  ON CONFLICT (id) DO UPDATE SET
    placa = EXCLUDED.placa,
    tipo = EXCLUDED.tipo,
    marca = EXCLUDED.marca,
    modelo = EXCLUDED.modelo,
    ano_fabricacao = EXCLUDED.ano_fabricacao,
    ano_modelo = EXCLUDED.ano_modelo,
    cor = EXCLUDED.cor,
    capacidade_passageiros = EXCLUDED.capacidade_passageiros,
    status = EXCLUDED.status,
    km_atual = EXCLUDED.km_atual,
    observacoes = EXCLUDED.observacoes;

  -- CONTRATOS DE TESTE
  INSERT INTO public.contratos (
    id,
    empresa_id,
    cliente_id,
    nome,
    descricao,
    dias_semana,
    data_inicio,
    data_fim,
    ativo,
    forma_cobranca,
    valor_cobranca,
    dia_fechamento,
    dia_vencimento,
    contrato_fisico_url,
    licenca_intermunicipal_url,
    licenca_interestadual_url
  ) VALUES
    (
      v_contrato_teste_a,
      v_empresa_id,
      v_cliente_teste_a,
      'CONTRATO TESTE A - LINHA ESCOLAR MOTORISTA',
      'DADO DE TESTE - CONTRATO RECORRENTE PARA O MOTORISTA INFORMADO',
      ARRAY[1,2,3,4,5],
      CURRENT_DATE - 30,
      CURRENT_DATE + 365,
      true,
      'mensal',
      12500,
      25,
      5,
      'https://example.test/contratos/TESTE-A.pdf',
      'https://example.test/licencas/TESTE-A-intermunicipal.pdf',
      'https://example.test/licencas/TESTE-A-interestadual.pdf'
    ),
    (
      v_contrato_teste_b,
      v_empresa_id,
      v_cliente_teste_a,
      'CONTRATO TESTE B - FRETAMENTO EMPRESARIAL',
      'DADO DE TESTE - CONTRATO COM COBRANÇA POR DIA',
      ARRAY[1,2,3,4,5,6],
      CURRENT_DATE - 10,
      CURRENT_DATE + 180,
      true,
      'dia',
      850,
      25,
      5,
      'https://example.test/contratos/TESTE-B.pdf',
      'https://example.test/licencas/TESTE-B-intermunicipal.pdf',
      'https://example.test/licencas/TESTE-B-interestadual.pdf'
    ),
    (
      v_contrato_teste_c,
      v_empresa_id,
      v_cliente_teste_b,
      'CONTRATO TESTE C - RESERVA OPERACIONAL',
      'DADO DE TESTE - CONTRATO PARA OS EVENTUAIS DE APOIO',
      ARRAY[0,6],
      CURRENT_DATE,
      CURRENT_DATE + 120,
      true,
      'km',
      6.75,
      25,
      5,
      'https://example.test/contratos/TESTE-C.pdf',
      'https://example.test/licencas/TESTE-C-intermunicipal.pdf',
      'https://example.test/licencas/TESTE-C-interestadual.pdf'
    )
  ON CONFLICT (id) DO UPDATE SET
    cliente_id = EXCLUDED.cliente_id,
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    dias_semana = EXCLUDED.dias_semana,
    data_inicio = EXCLUDED.data_inicio,
    data_fim = EXCLUDED.data_fim,
    ativo = EXCLUDED.ativo,
    forma_cobranca = EXCLUDED.forma_cobranca,
    valor_cobranca = EXCLUDED.valor_cobranca,
    dia_fechamento = EXCLUDED.dia_fechamento,
    dia_vencimento = EXCLUDED.dia_vencimento,
    contrato_fisico_url = EXCLUDED.contrato_fisico_url,
    licenca_intermunicipal_url = EXCLUDED.licenca_intermunicipal_url,
    licenca_interestadual_url = EXCLUDED.licenca_interestadual_url;

  -- HORÁRIOS DE TESTE NOS CONTRATOS
  INSERT INTO public.contrato_horarios (
    empresa_id,
    contrato_id,
    horario,
    origem,
    destino,
    veiculo_id,
    motorista_id,
    observacao,
    hora,
    ordem,
    ativo
  )
  SELECT
    v_empresa_id,
    v_contrato_teste_a,
    t.horario,
    t.origem,
    t.destino,
    v_veiculo_teste_a,
    v_motorista_id,
    t.observacao,
    t.horario,
    t.ordem,
    true
  FROM (
    VALUES
      ('06:45:00'::time, 'GARAGEM TESTE A', 'ESCOLA TESTE A', 1, 'DADO DE TESTE - TURNO MANHÃ'),
      ('11:50:00'::time, 'ESCOLA TESTE A', 'GARAGEM TESTE A', 2, 'DADO DE TESTE - RETORNO MEIO-DIA'),
      ('17:15:00'::time, 'GARAGEM TESTE A', 'ESCOLA TESTE A', 3, 'DADO DE TESTE - TURNO TARDE')
  ) AS t(horario, origem, destino, ordem, observacao)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.contrato_horarios ch
    WHERE ch.empresa_id = v_empresa_id
      AND ch.contrato_id = v_contrato_teste_a
      AND ch.horario = t.horario
      AND ch.origem = t.origem
      AND ch.destino = t.destino
  );

  -- ORDENS DE SERVIÇO DE TESTE (DESTINADAS AO MOTORISTA INFORMADO)
  INSERT INTO public.ordens_servico (
    id,
    empresa_id,
    tipo,
    status,
    status_pagamento,
    cliente_id,
    veiculo_id,
    motorista_id,
    contrato_id,
    inicio_em,
    fim_em,
    origem,
    destino,
    valor_total,
    km_inicial,
    km_final,
    observacoes,
    modo_cobranca,
    valor_fixo,
    valor_km,
    roteiro,
    qtd_passageiros,
    local_saida,
    local_chegada,
    contratante_eh_responsavel,
    responsavel_viagem_nome,
    responsavel_viagem_contato,
    licenca_intermunicipal_url,
    licenca_interestadual_url,
    pagar_extra_motorista,
    valor_extra_motorista,
    extra_motorista_tipo,
    valor_hora_extra_motorista,
    qtd_horas_extra_motorista
  ) VALUES
    (
      v_os_teste_01,
      v_empresa_id,
      'eventual',
      'pendente',
      'pendente',
      v_cliente_teste_a,
      v_veiculo_teste_a,
      v_motorista_id,
      v_contrato_teste_b,
      now() + interval '1 day',
      now() + interval '1 day 4 hours',
      'ORIGEM TESTE 01 - EMPRESA A',
      'DESTINO TESTE 01 - CLIENTE A',
      1200,
      NULL,
      NULL,
      'OS TESTE 01 - MOTORISTA QA - PENDENTE',
      'fixo',
      1200,
      NULL,
      'ROTEIRO TESTE 01 - EVENTUAL',
      22,
      'PÁTIO TESTE A',
      'UNIDADE TESTE A',
      true,
      'RESPONSÁVEL TESTE 01',
      '(48) 98888-0101',
      'https://example.test/os/licenca-intermunicipal-01.pdf',
      'https://example.test/os/licenca-interestadual-01.pdf',
      true,
      120,
      'fixo',
      NULL,
      NULL
    ),
    (
      v_os_teste_02,
      v_empresa_id,
      'eventual',
      'pendente',
      'pendente',
      v_cliente_teste_b,
      v_veiculo_teste_b,
      v_motorista_id,
      v_contrato_teste_c,
      now() + interval '2 day',
      now() + interval '2 day 3 hours',
      'ORIGEM TESTE 02 - BAIRRO B',
      'DESTINO TESTE 02 - CENTRO',
      0,
      NULL,
      NULL,
      'OS TESTE 02 - MOTORISTA QA - COBRANÇA KM',
      'km',
      NULL,
      6.75,
      'ROTEIRO TESTE 02 - EVENTUAL KM',
      14,
      'TERMINAL TESTE B',
      'DESTINO TESTE B',
      false,
      'RESPONSÁVEL TESTE 02',
      '(48) 98888-0202',
      'https://example.test/os/licenca-intermunicipal-02.pdf',
      'https://example.test/os/licenca-interestadual-02.pdf',
      true,
      NULL,
      'hora',
      35,
      2
    ),
    (
      v_os_teste_03,
      v_empresa_id,
      'recorrente',
      'pendente',
      'pendente',
      v_cliente_teste_a,
      v_veiculo_teste_a,
      v_motorista_id,
      v_contrato_teste_a,
      now() + interval '3 day',
      now() + interval '3 day 2 hours',
      'GARAGEM TESTE A',
      'ESCOLA TESTE A',
      850,
      NULL,
      NULL,
      'OS TESTE 03 - MOTORISTA QA - RECORRENTE',
      'fixo',
      850,
      NULL,
      'ROTEIRO TESTE 03 - ESCOLAR',
      27,
      'GARAGEM TESTE A',
      'ESCOLA TESTE A',
      false,
      'COORDENAÇÃO TESTE ESCOLAR',
      '(48) 98888-0303',
      'https://example.test/os/licenca-intermunicipal-03.pdf',
      'https://example.test/os/licenca-interestadual-03.pdf',
      false,
      NULL,
      NULL,
      NULL,
      NULL
    ),
    (
      v_os_teste_04,
      v_empresa_id,
      'eventual',
      'concluida',
      'pendente',
      v_cliente_teste_b,
      v_veiculo_teste_b,
      v_motorista_id,
      v_contrato_teste_c,
      now() - interval '3 day',
      now() - interval '3 day + 3 hours',
      'ORIGEM TESTE 04 - HISTÓRICO',
      'DESTINO TESTE 04 - HISTÓRICO',
      980,
      98500,
      98620,
      'OS TESTE 04 - MOTORISTA QA - HISTÓRICO CONCLUÍDO',
      'fixo',
      980,
      NULL,
      'ROTEIRO TESTE 04 - HISTÓRICO',
      18,
      'PONTO TESTE HISTÓRICO',
      'DESTINO TESTE HISTÓRICO',
      true,
      'RESPONSÁVEL TESTE 04',
      '(48) 98888-0404',
      'https://example.test/os/licenca-intermunicipal-04.pdf',
      'https://example.test/os/licenca-interestadual-04.pdf',
      true,
      90,
      'fixo',
      NULL,
      NULL
    ),
    (
      v_os_teste_05,
      v_empresa_id,
      'recorrente',
      'concluida',
      'pendente',
      v_cliente_teste_a,
      v_veiculo_teste_a,
      v_motorista_id,
      v_contrato_teste_a,
      now() - interval '1 day',
      now() - interval '1 day + 2 hours',
      'GARAGEM TESTE A',
      'ESCOLA TESTE A',
      0,
      125000,
      125040,
      'OS TESTE 05 - MOTORISTA QA - CONCLUÍDA COBRANÇA KM',
      'km',
      NULL,
      6.75,
      'ROTEIRO TESTE 05 - KM',
      24,
      'GARAGEM TESTE A',
      'ESCOLA TESTE A',
      false,
      'RESPONSÁVEL TESTE 05',
      '(48) 98888-0505',
      'https://example.test/os/licenca-intermunicipal-05.pdf',
      'https://example.test/os/licenca-interestadual-05.pdf',
      true,
      NULL,
      'hora',
      40,
      1.5
    ),
    (
      v_os_teste_06,
      v_empresa_id,
      'eventual',
      'em_execucao',
      'pendente',
      v_cliente_teste_b,
      v_veiculo_teste_b,
      v_motorista_id,
      v_contrato_teste_b,
      now() - interval '30 minutes',
      now() + interval '3 hours',
      'ORIGEM TESTE 06 - EM EXECUÇÃO',
      'DESTINO TESTE 06 - EM EXECUÇÃO',
      1400,
      98620,
      NULL,
      'OS TESTE 06 - MOTORISTA QA - EM EXECUÇÃO',
      'fixo',
      1400,
      NULL,
      'ROTEIRO TESTE 06 - AO VIVO',
      20,
      'PÁTIO TESTE B',
      'AEROPORTO TESTE',
      true,
      'RESPONSÁVEL TESTE 06',
      '(48) 98888-0606',
      'https://example.test/os/licenca-intermunicipal-06.pdf',
      'https://example.test/os/licenca-interestadual-06.pdf',
      false,
      NULL,
      NULL,
      NULL,
      NULL
    )
  ON CONFLICT (id) DO UPDATE SET
    tipo = EXCLUDED.tipo,
    status = EXCLUDED.status,
    status_pagamento = EXCLUDED.status_pagamento,
    cliente_id = EXCLUDED.cliente_id,
    veiculo_id = EXCLUDED.veiculo_id,
    motorista_id = EXCLUDED.motorista_id,
    contrato_id = EXCLUDED.contrato_id,
    inicio_em = EXCLUDED.inicio_em,
    fim_em = EXCLUDED.fim_em,
    origem = EXCLUDED.origem,
    destino = EXCLUDED.destino,
    valor_total = EXCLUDED.valor_total,
    km_inicial = EXCLUDED.km_inicial,
    km_final = EXCLUDED.km_final,
    observacoes = EXCLUDED.observacoes,
    modo_cobranca = EXCLUDED.modo_cobranca,
    valor_fixo = EXCLUDED.valor_fixo,
    valor_km = EXCLUDED.valor_km,
    roteiro = EXCLUDED.roteiro,
    qtd_passageiros = EXCLUDED.qtd_passageiros,
    local_saida = EXCLUDED.local_saida,
    local_chegada = EXCLUDED.local_chegada,
    contratante_eh_responsavel = EXCLUDED.contratante_eh_responsavel,
    responsavel_viagem_nome = EXCLUDED.responsavel_viagem_nome,
    responsavel_viagem_contato = EXCLUDED.responsavel_viagem_contato,
    licenca_intermunicipal_url = EXCLUDED.licenca_intermunicipal_url,
    licenca_interestadual_url = EXCLUDED.licenca_interestadual_url,
    pagar_extra_motorista = EXCLUDED.pagar_extra_motorista,
    valor_extra_motorista = EXCLUDED.valor_extra_motorista,
    extra_motorista_tipo = EXCLUDED.extra_motorista_tipo,
    valor_hora_extra_motorista = EXCLUDED.valor_hora_extra_motorista,
    qtd_horas_extra_motorista = EXCLUDED.qtd_horas_extra_motorista;

  -- ABASTECIMENTOS DE TESTE (relacionados ao motorista)
  INSERT INTO public.abastecimentos (
    empresa_id,
    motorista_id,
    veiculo_id,
    ordem_servico_id,
    tipo,
    origem_abastecimento,
    km,
    litros,
    valor,
    cupom_url,
    observacao,
    status
  )
  SELECT
    v_empresa_id,
    v_motorista_id,
    x.veiculo_id,
    x.os_id,
    'registro',
    x.origem_abastecimento,
    x.km,
    x.litros,
    x.valor,
    x.cupom_url,
    x.observacao,
    x.status
  FROM (
    VALUES
      (v_veiculo_teste_a, v_os_teste_05, 'empresa'::text, 125020::numeric, 42::numeric, 298::numeric, NULL::text, 'ABASTECIMENTO TESTE 01 - MOTORISTA QA', 'concluido'::text),
      (v_veiculo_teste_b, v_os_teste_04, 'posto'::text, 98610::numeric, 36::numeric, 312::numeric, 'https://example.test/cupom/abastecimento-teste-02.jpg', 'ABASTECIMENTO TESTE 02 - MOTORISTA QA', 'aprovado'::text)
  ) AS x(veiculo_id, os_id, origem_abastecimento, km, litros, valor, cupom_url, observacao, status)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.abastecimentos a
    WHERE a.empresa_id = v_empresa_id
      AND a.motorista_id = v_motorista_id
      AND a.ordem_servico_id = x.os_id
      AND a.observacao = x.observacao
  );

  -- PREFERÊNCIAS DE NOTIFICAÇÃO DE TESTE
  INSERT INTO public.motorista_notificacao_preferencias (
    motorista_id,
    empresa_id,
    nova_os,
    alteracao_os,
    manutencao,
    abastecimento,
    mensagens,
    alertas_sistema
  ) VALUES (
    v_motorista_id,
    v_empresa_id,
    true,
    true,
    true,
    true,
    true,
    true
  )
  ON CONFLICT (motorista_id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    nova_os = EXCLUDED.nova_os,
    alteracao_os = EXCLUDED.alteracao_os,
    manutencao = EXCLUDED.manutencao,
    abastecimento = EXCLUDED.abastecimento,
    mensagens = EXCLUDED.mensagens,
    alertas_sistema = EXCLUDED.alertas_sistema,
    updated_at = now();

  -- EXTRAS DE TESTE PARA O MOTORISTA
  INSERT INTO public.motorista_extras (
    empresa_id,
    motorista_id,
    ordem_servico_id,
    tipo,
    descricao,
    valor,
    status,
    competencia
  )
  SELECT
    v_empresa_id,
    v_motorista_id,
    e.ordem_servico_id,
    e.tipo,
    e.descricao,
    e.valor,
    e.status,
    e.competencia
  FROM (
    VALUES
      (v_os_teste_04, 'bonus'::text, 'EXTRA TESTE - BÔNUS DE PONTUALIDADE MOTORISTA QA', 150::numeric, 'pendente'::text, date_trunc('month', CURRENT_DATE)::date),
      (v_os_teste_05, 'ajuste'::text, 'EXTRA TESTE - AJUSTE OPERACIONAL MOTORISTA QA', 80::numeric, 'pendente'::text, date_trunc('month', CURRENT_DATE)::date)
  ) AS e(ordem_servico_id, tipo, descricao, valor, status, competencia)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.motorista_extras me
    WHERE me.empresa_id = v_empresa_id
      AND me.motorista_id = v_motorista_id
      AND me.ordem_servico_id = e.ordem_servico_id
      AND me.descricao = e.descricao
  );

  -- Atualiza metadados do motorista para deixar explícito o contexto de teste
  UPDATE public.motoristas
     SET observacoes = CONCAT_WS(
       E'\n',
       NULLIF(observacoes, ''),
       'DADOS DE TESTE ATIVOS - MOTORISTA QA (seed 20260416052500)'
     ),
         foto_perfil_url = COALESCE(foto_perfil_url, 'https://example.test/motorista/foto-perfil-teste.jpg'),
         cnh_arquivo_url = COALESCE(cnh_arquivo_url, 'https://example.test/motorista/cnh-teste.pdf'),
         cursos_urls = CASE
           WHEN COALESCE(array_length(cursos_urls, 1), 0) = 0 THEN ARRAY[
             'https://example.test/motorista/curso-direcao-defensiva-teste.pdf',
             'https://example.test/motorista/curso-primeiros-socorros-teste.pdf'
           ]
           ELSE cursos_urls
         END
   WHERE id = v_motorista_id;

  -- Reativa os triggers desativados no início da seed
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'clientes' AND t.tgname = 'trg_clientes_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.clientes ENABLE TRIGGER trg_clientes_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'veiculos' AND t.tgname = 'trg_veiculos_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.veiculos ENABLE TRIGGER trg_veiculos_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'contratos' AND t.tgname = 'trg_contratos_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.contratos ENABLE TRIGGER trg_contratos_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_numero' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico ENABLE TRIGGER trg_os_numero';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_sync_financeiro_km_fixo_insert' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico ENABLE TRIGGER trg_os_sync_financeiro_km_fixo_insert';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_sync_financeiro_km_fixo_update' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico ENABLE TRIGGER trg_os_sync_financeiro_km_fixo_update';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_sync_financeiro_contrato_mensal' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico ENABLE TRIGGER trg_os_sync_financeiro_contrato_mensal';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_extra_motorista_after_insert' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico ENABLE TRIGGER trg_os_extra_motorista_after_insert';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ordens_servico' AND t.tgname = 'trg_os_extra_motorista_after_update' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.ordens_servico ENABLE TRIGGER trg_os_extra_motorista_after_update';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'abastecimentos' AND t.tgname = 'trg_abastecimentos_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.abastecimentos ENABLE TRIGGER trg_abastecimentos_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'abastecimentos' AND t.tgname = 'trg_abastecimentos_enforce_business_rules' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.abastecimentos ENABLE TRIGGER trg_abastecimentos_enforce_business_rules';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'motorista_notificacao_preferencias' AND t.tgname = 'trg_pref_notif_motorista_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.motorista_notificacao_preferencias ENABLE TRIGGER trg_pref_notif_motorista_empresa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'motorista_extras' AND t.tgname = 'trg_motorista_extras_empresa' AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.motorista_extras ENABLE TRIGGER trg_motorista_extras_empresa';
  END IF;
END;
$$;