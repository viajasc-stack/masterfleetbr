-- Regras e automações do fretamento compartilhado em contratos

ALTER TABLE public.contrato_horarios
  ADD COLUMN IF NOT EXISTS contrato_rota_id uuid REFERENCES public.contrato_rotas(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_empresa_id_passageiros()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.minha_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_contrato_rotas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_empresa_id uuid;
BEGIN
  SELECT c.empresa_id INTO v_empresa_id FROM public.contratos c WHERE c.id = NEW.contrato_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Contrato inválido para rota.';
  END IF;
  NEW.empresa_id := v_empresa_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_contrato_rota_pontos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_empresa_id uuid;
BEGIN
  SELECT r.empresa_id INTO v_empresa_id FROM public.contrato_rotas r WHERE r.id = NEW.contrato_rota_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Rota inválida para ponto.';
  END IF;
  NEW.empresa_id := v_empresa_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_contrato_passageiros()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_empresa_id uuid;
BEGIN
  SELECT c.empresa_id INTO v_empresa_id FROM public.contratos c WHERE c.id = NEW.contrato_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Contrato inválido para vínculo de passageiro.';
  END IF;
  NEW.empresa_id := v_empresa_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_contrato_passageiro_participacoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_empresa_id uuid;
BEGIN
  SELECT cp.empresa_id INTO v_empresa_id FROM public.contrato_passageiros cp WHERE cp.id = NEW.contrato_passageiro_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Vínculo de passageiro inválido para participação.';
  END IF;
  NEW.empresa_id := v_empresa_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_os_passageiros_presenca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_empresa_id uuid;
BEGIN
  SELECT os.empresa_id INTO v_empresa_id FROM public.ordens_servico os WHERE os.id = NEW.os_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'OS inválida para presença.';
  END IF;
  NEW.empresa_id := v_empresa_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_contrato_passageiros_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo_pagante = 'EMPRESA' AND NEW.empresa_pagante_id IS NULL THEN
    RAISE EXCEPTION 'empresa_pagante_id é obrigatório quando tipo_pagante = EMPRESA';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_contrato_passageiro_participacoes_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_rota_embarque uuid;
  v_rota_desembarque uuid;
  v_rota_horario uuid;
BEGIN
  SELECT p.contrato_rota_id INTO v_rota_embarque FROM public.contrato_rota_pontos p WHERE p.id = NEW.ponto_embarque_id;
  SELECT p.contrato_rota_id INTO v_rota_desembarque FROM public.contrato_rota_pontos p WHERE p.id = NEW.ponto_desembarque_id;

  IF v_rota_embarque IS NULL OR v_rota_desembarque IS NULL THEN
    RAISE EXCEPTION 'Ponto de embarque/desembarque inválido';
  END IF;

  IF v_rota_embarque <> NEW.contrato_rota_id OR v_rota_desembarque <> NEW.contrato_rota_id THEN
    RAISE EXCEPTION 'Pontos de embarque/desembarque devem pertencer à mesma rota da participação';
  END IF;

  IF NEW.contrato_horario_id IS NOT NULL THEN
    SELECT h.contrato_rota_id INTO v_rota_horario FROM public.contrato_horarios h WHERE h.id = NEW.contrato_horario_id;
    IF v_rota_horario IS NOT NULL AND v_rota_horario <> NEW.contrato_rota_id THEN
      RAISE EXCEPTION 'Horário informado não pertence à rota da participação';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_passageiros_empresa ON public.passageiros;
CREATE TRIGGER trg_passageiros_empresa BEFORE INSERT ON public.passageiros FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_passageiros();
DROP TRIGGER IF EXISTS trg_contrato_rotas_empresa ON public.contrato_rotas;
CREATE TRIGGER trg_contrato_rotas_empresa BEFORE INSERT ON public.contrato_rotas FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_contrato_rotas();
DROP TRIGGER IF EXISTS trg_contrato_rota_pontos_empresa ON public.contrato_rota_pontos;
CREATE TRIGGER trg_contrato_rota_pontos_empresa BEFORE INSERT ON public.contrato_rota_pontos FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_contrato_rota_pontos();
DROP TRIGGER IF EXISTS trg_contrato_passageiros_empresa ON public.contrato_passageiros;
CREATE TRIGGER trg_contrato_passageiros_empresa BEFORE INSERT ON public.contrato_passageiros FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_contrato_passageiros();
DROP TRIGGER IF EXISTS trg_contrato_passageiro_participacoes_empresa ON public.contrato_passageiro_participacoes;
CREATE TRIGGER trg_contrato_passageiro_participacoes_empresa BEFORE INSERT ON public.contrato_passageiro_participacoes FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_contrato_passageiro_participacoes();
DROP TRIGGER IF EXISTS trg_os_passageiros_presenca_empresa ON public.os_passageiros_presenca;
CREATE TRIGGER trg_os_passageiros_presenca_empresa BEFORE INSERT ON public.os_passageiros_presenca FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_os_passageiros_presenca();

DROP TRIGGER IF EXISTS trg_contrato_passageiros_validate ON public.contrato_passageiros;
CREATE TRIGGER trg_contrato_passageiros_validate BEFORE INSERT OR UPDATE ON public.contrato_passageiros FOR EACH ROW EXECUTE FUNCTION public.validate_contrato_passageiros_rules();
DROP TRIGGER IF EXISTS trg_contrato_passageiro_participacoes_validate ON public.contrato_passageiro_participacoes;
CREATE TRIGGER trg_contrato_passageiro_participacoes_validate BEFORE INSERT OR UPDATE ON public.contrato_passageiro_participacoes FOR EACH ROW EXECUTE FUNCTION public.validate_contrato_passageiro_participacoes_rules();
