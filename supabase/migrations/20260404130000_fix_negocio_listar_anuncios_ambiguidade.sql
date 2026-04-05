-- Remove sobrecarga ambígua criada para compatibilidade.
-- Mantemos:
-- 1) Assinatura principal (p_tipo enum) já criada no MVP
-- 2) Assinatura reduzida (4 params) para clientes legados

DROP FUNCTION IF EXISTS public.negocio_listar_anuncios(
  text,
  uuid,
  text,
  text,
  int,
  int,
  boolean,
  boolean,
  text
);
