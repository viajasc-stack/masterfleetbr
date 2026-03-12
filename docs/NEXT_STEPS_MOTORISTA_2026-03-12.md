# Próximos passos — App Motorista (12/03/2026)

## Progresso salvo

- Safe area corrigida no app (`react-native-safe-area-context`).
- Tela de **Manutenção** com:
  - seleção de veículo com busca,
  - abertura de solicitação,
  - listagem de solicitações em aberto com status.
- Tela de **Abastecimento** com:
  - validação de permissão `motoristas.pode_abastecer`,
  - fluxo por modal (abastecer x solicitar),
  - interno/externo com campos condicionais,
  - persistência em `abastecimentos`.
- Migração adicionada para garantir default de permissão:
  - `supabase/migrations/20260312062500_ensure_motoristas_pode_abastecer_default_false.sql`
- Tela de **Configurações** com menu e item **Aparência (Em breve)**.
- Perfil do motorista com edição e upload (CNH/cursos) foi implementado como primeira versão.

## Anotação obrigatória para retomada

> **IMPORTANTE (pedido do usuário):** ao retomar, separar o que foi feito de perfil em **telas próprias**.
>
> Hoje a edição de perfil está acoplada na tela de Configurações. Na próxima sessão, refatorar para:
>
> - `Configurações` = apenas menu de navegação.
> - `Perfil` = tela exclusiva de dados do motorista.
> - `Arquivos` (CNH/cursos) = tela exclusiva ou seção dedicada separada do menu principal.

## Ordem sugerida para próxima sessão

1. Criar navegação interna simples para abrir telas por item de menu.
2. Extrair formulário de perfil para `PerfilScreen`.
3. Extrair uploads para `ArquivosMotoristaScreen`.
4. Manter em Configurações apenas atalhos (sem formulário inline).
5. Validar `tsc --noEmit` e fluxo no Expo Go.
