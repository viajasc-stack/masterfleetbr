# Status de Progresso — 18/03/2026

## Escopo da varredura realizada

Varredura técnica focada em integrações entre:
- Fretamento recorrente
- Ordens de serviço (OS)
- Financeiro (`contas_financeiras`)
- Menu/configurações
- Rotinas automáticas (SQL + pg_cron)

---

## ✅ Implementado e conectado

### 1) Fretamento recorrente (operacional)
- Listagem por contrato com expansão de horários.
- Link no nome do contrato direcionando para tela dedicada de edição da recorrência.
- Tela de edição dedicada criada em:
  - `src/app/(painel)/fretamentos/recorrente/[id]/page.tsx`
- Tela “novo recorrente” com padrão de contrato/horários (motorista, veículo, dias da semana, roteiro por horário).
- Geração manual de OS no recorrente com ações rápidas:
  - hoje / 3 dias / 7 dias
  - respeitando vigência do contrato.

### 2) Configuração de auto geração recorrente
- Novo submenu em Configurações:
  - `Configurações > Fretamento recorrente`
- Tela criada em:
  - `src/app/(painel)/configuracoes/fretamento-recorrente/page.tsx`
- Controle de ativação de geração automática salvo na empresa.

### 3) Banco para auto geração recorrente
- Migration criada:
  - `supabase/migrations/20260318065000_auto_geracao_fretamento_recorrente.sql`
- Inclui colunas em `empresas`:
  - `fretamento_recorrente_auto_geracao_ativo`
  - `fretamento_recorrente_auto_limiar_dias` (default 2)
  - `fretamento_recorrente_auto_janela_dias` (default 7)
- Inclui função:
  - `public.processar_auto_geracao_fretamento_recorrente(...)`
- Inclui agendamento diário via `pg_cron` (com fallback por NOTICE quando indisponível).

### 4) Financeiro automático para OS eventual cancelada
- Migration criada:
  - `supabase/migrations/20260318071000_eventual_cancelada_remove_financeiro.sql`
- Regra implementada:
  - ao mudar OS para `cancelada` e `tipo='eventual'`, remove lançamentos financeiros vinculados da categoria operacional (`receber` + `ordem_servico`) com status `pendente`/`cancelado`.

---

## ⚠️ Pendências / pontos que ainda faltam conectar

### A) Exclusão de OS em telas ainda pode falhar por FK com financeiro
Há pontos no frontend que ainda tentam `delete` direto em `ordens_servico`, por exemplo:
- `src/app/(painel)/ordens-servico/page.tsx`
- `src/app/(painel)/fretamentos/eventual/page.tsx`
- `src/app/(painel)/agenda/[date]/page.tsx`

Com vínculo em `contas_financeiras.os_id`, pode ocorrer erro de FK.

**Recomendação para próxima sessão:**
- padronizar fluxo para cancelar OS (ao invés de excluir) quando houver financeiro vinculado;
- bloquear exclusão e orientar usuário com mensagem clara.

### B) Regra de cancelamento automático no financeiro foi iniciada só para OS eventual
- recorrente ainda não recebeu regra automática específica por tipo de cobrança (como combinado).

### C) Conferência em produção das migrations
- garantir execução das migrations novas no ambiente alvo.

---

## Arquivos principais alterados nesta frente

- `src/components/layout/Sidebar.tsx`
- `src/app/(painel)/fretamentos/recorrente/page.tsx`
- `src/app/(painel)/fretamentos/recorrente/[id]/page.tsx`
- `src/app/(painel)/configuracoes/fretamento-recorrente/page.tsx`
- `supabase/migrations/20260318065000_auto_geracao_fretamento_recorrente.sql`
- `supabase/migrations/20260318071000_eventual_cancelada_remove_financeiro.sql`

---

## Próximo passo sugerido (retomada)

1. Aplicar migrations no banco de homologação/produção.
2. Ajustar as telas que ainda fazem exclusão direta de OS para fluxo seguro (cancelamento orientado por vínculo financeiro).
3. Expandir automação de cancelamento financeiro para OS recorrente com regras por tipo de cobrança (fixo/km/mensal), mantendo segurança contábil.
