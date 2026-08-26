# 2026-08-25 — E2E-DEMAND-DECIDE: decisão de demanda volta a gravar (submeter perdido na regressão C139)

A decisão de demanda em `/campanha` parou de gravar desde o react-audit família 4 (e273e9ec):
o dispatch manual do C139 montava `new FormData(form)` sem o submitter, e os botões de
transição (`name="status" value={target}`) nunca viajavam — `transitionDemandFormAction`
lia `status` vazio e toda decisão caía em erro de validação. 3 deploys manuais falharam no
e2e full do verify ("advisor opens a demand and decides it").

Correção local no único formulário do padrão com botões nomeados (`DemandWorkflowCard.tsx`):
helper `submitterFrom` (cast honesto de `nativeEvent as SubmitEvent`, comentado) e
`new FormData(form, submitter)` nos handlers de transição e custo (no-op de segurança no
custo — botão sem name/value hoje). C139 intacto: `preventDefault` + `startTransition` +
`useActionState` preservados, nota digitada não some em erro de validação.

Teste novo `tests/unit/demandWorkflowCard.unit.spec.tsx` pina o glue FormData→status
(vermelho pré-fix, verde pós-fix): `SubmitEvent` real em vez de `fireEvent.submit`
(testing-library mapeia submit para `Event` simples, sem submitter). E2E determinístico
verde local (isolado via filtro posicional `spec.ts:764` e 3× em runs de arquivo inteiro).
Descoberta de tooling registrada como #923 (`--no-deps` + `-g` não filtra em run mode).
