# Sistema de Suporte (Empresa + Master)

## O que foi implementado

- **Painel da empresa**
  - `/suporte`: abrir chamados, listar e filtrar tickets.
  - `/suporte/[id]`: acompanhar conversa e responder ticket.
- **Painel master**
  - `/master/suporte`: fila geral com filtros por status/prioridade e busca.
  - `/master/suporte/[id]`: atendimento completo (responder, nota interna, alterar status/prioridade).

## Banco de dados (migration)

Arquivo: `supabase/migrations/20260305203000_support_system.sql`

- Tabelas:
  - `public.support_tickets`
  - `public.support_messages`
- RLS para empresa e super admin.
- Triggers para sincronizar atualização do ticket ao inserir mensagem.
- RPCs:
  - `support_create_ticket`
  - `support_add_message`
  - `master_support_list_tickets`
  - `master_support_get_ticket`
  - `master_support_reply`
  - `master_support_set_status`

## Navegação e acesso

- Item **Suporte** adicionado no sidebar do painel da empresa.
- Item **Suporte** adicionado no menu do painel master.
- Módulo `suporte` incluído no controle de acesso (`moduleAccess`).

## Como validar rápido

1. Aplicar migrations no Supabase.
2. Entrar como empresa e abrir um ticket em `/suporte`.
3. Entrar como super admin e responder em `/master/suporte`.
4. Voltar na empresa e confirmar atualização da conversa/status.
