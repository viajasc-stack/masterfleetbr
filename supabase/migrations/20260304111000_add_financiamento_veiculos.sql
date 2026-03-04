-- Dados de financiamento de veículo para integração com contas a pagar

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS financiado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parcelas_financiamento_restantes int,
  ADD COLUMN IF NOT EXISTS valor_parcela_financiamento numeric,
  ADD COLUMN IF NOT EXISTS dia_vencimento_financiamento int;
