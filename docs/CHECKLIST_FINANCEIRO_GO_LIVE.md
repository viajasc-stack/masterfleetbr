# Checklist de Homologação · Módulo Financeiro

## 1) Dashboard (`/financeiro`)
- [ ] Carrega sem erro e exibe cards principais.
- [ ] Exibe seção de assinatura (status/plano/próxima cobrança).
- [ ] Lista “Próximos vencimentos” com links para detalhe.

## 2) Contas (`/financeiro/contas`)
- [ ] Filtros por tipo/status funcionam corretamente.
- [ ] Busca por descrição/categoria funciona.
- [ ] Marcar como pago/recebido altera status e data de pagamento.
- [ ] Exclusão individual funciona com confirmação.
- [ ] Exclusão em lote funciona com confirmação.

## 3) Nova conta (`/financeiro/contas/nova`)
- [ ] Cria conta única a pagar.
- [ ] Cria conta única a receber.
- [ ] Cria carnê (parcelado) com quantidade válida.
- [ ] Validações de campos obrigatórios aparecem corretamente.

## 4) Detalhe da conta (`/financeiro/contas/[id]`)
- [ ] Exibe dados completos da conta.
- [ ] Registrar pagamento/recebimento atualiza status.
- [ ] Cancelar conta atualiza status para `cancelado`.

## 5) Assinatura (`/financeiro/assinatura`)
- [ ] Carrega planos ativos.
- [ ] Alteração de plano via RPC funciona e atualiza resumo.
- [ ] Geração manual de fatura funciona e mostra retorno.

## 6) Faturas e pagamentos (`/financeiro/faturas`)
- [ ] Lista faturas da empresa logada.
- [ ] Geração de PIX funciona para fatura aberta.
- [ ] Pagamento por cartão exige dados obrigatórios e retorna status.
- [ ] Geração de boleto exige documento do pagador.
- [ ] Faturas não abertas bloqueiam tentativa de novo pagamento.

## 7) Segurança e sessão
- [ ] Fluxos de pagamento falham com mensagem amigável quando sessão expira.
- [ ] Nenhum fluxo de pagamento usa fallback de token anônimo.

## 8) Regressão rápida
- [ ] Módulo inventário segue funcionando (smoke manual).
- [ ] Sem erros de lint no escopo financeiro alterado.
