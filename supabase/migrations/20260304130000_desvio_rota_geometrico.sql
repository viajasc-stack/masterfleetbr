-- V2 desvio de rota geométrico: posição de motorista + cálculo de distância da referência da OS

-- 1) Referência geográfica da rota por OS
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS rota_referencia_lat numeric,
  ADD COLUMN IF NOT EXISTS rota_referencia_lng numeric,
  ADD COLUMN IF NOT EXISTS raio_desvio_m numeric NOT NULL DEFAULT 1500;

-- 2) Última posição conhecida do motorista
CREATE TABLE IF NOT EXISTS public.motoristas_geo (
  motorista_id uuid PRIMARY KEY REFERENCES public.motoristas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy_m numeric,
  speed_m_s numeric,
  heading_deg numeric,
  captured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.motoristas_geo ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'motoristas_geo' AND policyname = 'motoristas_geo_empresa'
  ) THEN
    CREATE POLICY "motoristas_geo_empresa" ON public.motoristas_geo
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'motoristas_geo' AND policyname = 'motoristas_geo_insert'
  ) THEN
    CREATE POLICY "motoristas_geo_insert" ON public.motoristas_geo
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'motoristas_geo' AND policyname = 'motoristas_geo_update'
  ) THEN
    CREATE POLICY "motoristas_geo_update" ON public.motoristas_geo
      FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_motoristas_geo_empresa_updated
  ON public.motoristas_geo(empresa_id, updated_at DESC);

-- 3) Haversine (sem PostGIS)
CREATE OR REPLACE FUNCTION public.distance_m_haversine(
  p_lat1 numeric,
  p_lng1 numeric,
  p_lat2 numeric,
  p_lng2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_r numeric := 6371000; -- raio médio da Terra em metros
  v_dlat numeric;
  v_dlng numeric;
  v_a numeric;
  v_c numeric;
BEGIN
  IF p_lat1 IS NULL OR p_lng1 IS NULL OR p_lat2 IS NULL OR p_lng2 IS NULL THEN
    RETURN NULL;
  END IF;

  v_dlat := radians(p_lat2 - p_lat1);
  v_dlng := radians(p_lng2 - p_lng1);

  v_a := sin(v_dlat / 2)^2
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * sin(v_dlng / 2)^2;

  v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
  RETURN v_r * v_c;
END;
$$;

-- 4) RPC de ping de geolocalização do motorista + geração automática de evento de desvio
CREATE OR REPLACE FUNCTION public.rpc_motorista_geo_ping(
  p_motorista_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_accuracy_m numeric DEFAULT NULL,
  p_speed_m_s numeric DEFAULT NULL,
  p_heading_deg numeric DEFAULT NULL,
  p_captured_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_os record;
  v_dist_m numeric;
  v_raio_m numeric;
  v_last_event_at timestamptz;
BEGIN
  IF p_motorista_id IS NULL THEN
    RAISE EXCEPTION 'motorista_id é obrigatório';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'latitude/longitude são obrigatórios';
  END IF;

  SELECT m.empresa_id
    INTO v_empresa_id
    FROM public.motoristas m
   WHERE m.id = p_motorista_id
   LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;

  -- Garante isolamento multi-tenant
  IF v_empresa_id <> public.minha_empresa_id() THEN
    RAISE EXCEPTION 'Sem permissão para atualizar geolocalização deste motorista';
  END IF;

  INSERT INTO public.motoristas_geo (
    motorista_id,
    empresa_id,
    latitude,
    longitude,
    accuracy_m,
    speed_m_s,
    heading_deg,
    captured_at,
    updated_at
  ) VALUES (
    p_motorista_id,
    v_empresa_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    p_speed_m_s,
    p_heading_deg,
    COALESCE(p_captured_at, now()),
    now()
  )
  ON CONFLICT (motorista_id)
  DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy_m = EXCLUDED.accuracy_m,
    speed_m_s = EXCLUDED.speed_m_s,
    heading_deg = EXCLUDED.heading_deg,
    captured_at = EXCLUDED.captured_at,
    updated_at = now();

  -- Busca OS ativa com referência de rota para cálculo geométrico
  SELECT
    os.id,
    os.numero,
    os.rota_referencia_lat,
    os.rota_referencia_lng,
    COALESCE(os.raio_desvio_m, 1500) AS raio_desvio_m
  INTO v_os
  FROM public.ordens_servico os
  WHERE os.empresa_id = v_empresa_id
    AND os.motorista_id = p_motorista_id
    AND lower(COALESCE(os.status, '')) IN ('em_andamento', 'em_execucao')
    AND os.rota_referencia_lat IS NOT NULL
    AND os.rota_referencia_lng IS NOT NULL
  ORDER BY os.updated_at DESC
  LIMIT 1;

  IF v_os.id IS NOT NULL THEN
    v_dist_m := public.distance_m_haversine(
      p_lat,
      p_lng,
      v_os.rota_referencia_lat,
      v_os.rota_referencia_lng
    );
    v_raio_m := COALESCE(v_os.raio_desvio_m, 1500);

    IF v_dist_m IS NOT NULL AND v_dist_m > v_raio_m THEN
      SELECT max(e.created_at)
        INTO v_last_event_at
        FROM public.os_eventos e
       WHERE e.empresa_id = v_empresa_id
         AND e.ordem_servico_id = v_os.id
         AND e.evento = 'desvio_rota_geom';

      -- throttle de 15 minutos por OS
      IF v_last_event_at IS NULL OR v_last_event_at < now() - interval '15 minutes' THEN
        PERFORM public.log_os_evento(
          v_empresa_id,
          v_os.id,
          p_motorista_id,
          'desvio_rota_geom',
          'warning',
          format('Possível desvio de rota (%.0f m da referência)', v_dist_m),
          jsonb_build_object(
            'distancia_m', round(v_dist_m),
            'raio_m', v_raio_m,
            'lat', p_lat,
            'lng', p_lng,
            'captured_at', COALESCE(p_captured_at, now())
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'empresa_id', v_empresa_id,
    'ordem_servico_id', COALESCE(v_os.id, NULL),
    'distancia_m', COALESCE(v_dist_m, NULL),
    'raio_m', COALESCE(v_raio_m, NULL)
  );
END;
$$;
