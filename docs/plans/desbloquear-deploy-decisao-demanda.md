# Desbloquear deploy: decisão de demanda em /campanha parou de gravar (regressão pós-react-audit)

Status: rascunho
Atualizado em: 2026-08-25
Issue: #921
Priority: P1
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável (decisão de demanda gravando + deploy verde)
Responsável: —

## Intenção

3 deploys manuais seguidos falharam em 2026-08-25 — o último verde foi 9c5cd783 (2026-08-24). O motivo não é infra: é um **bug de produto real** que o e2e full do deploy pegou. Desde o react-audit (família 4), o assessor/coordenador que abre uma demanda, escreve a nota e clica em Aprovar/Rejeitar não consegue decidir nada: a ação cai em erro de validação, os botões continuam na tela e a decisão nunca grava. Nenhuma decisão de produto está em jogo — o comportamento correto já existia e precisa voltar, sem desfazer o ganho do C139 (nota digitada preservada em erro de validação).

## Persona e fluxo

- **Persona / contexto:** assessor e coordenador de campanha, na mesa, triando as demandas que chegam dos municípios no `/campanha`.
- **Job principal:** decidir uma demanda — aprovar ou rejeitar, com nota registrada.
- **Fluxo desejado:** abre a demanda → escreve a nota → clica em Aprovar (ou Rejeitar) → a transição grava, os botões de decisão somem e a tela mostra "Esta demanda já foi decidida.".
- **Anti-goals de produto:** (1) não desfazer o C139 — a nota digitada não pode sumir em erro de validação; (2) não reduzir cobertura e2e (nada de skip, remoção ou rebaixamento do teste); (3) não entrar na família de flakes #882 — é outro trabalho, já rastreado.

## Objetivo e aceite

1. Decidir demanda volta a gravar: com nota preenchida, Aprovar/Rejeitar conclui a transição e a tela passa a exibir "Esta demanda já foi decidida.".
2. O teste determinístico volta a passar: `tests/e2e/campaignMunicipalities.e2e.spec.ts:764` ("advisor opens a demand and decides it") verde em execução local e no verify do deploy.
3. **Critério final da Issue:** um deploy manual a partir de main termina com job `verify` verde **e** job `deploy` concluído — app novo no ar (jorgesolla1313.com.br).

Guardrails de produto: o comportamento do C139 vale para todos os formulários do padrão; nenhum outro formulário muda nesta entrega; nada de tocar retries/workers da suíte.

## Dados (intenção)

N/A — sem decisão de dado. É correção de regressão: o "dado" do aceite é o comportamento do fluxo e o resultado do workflow (verify verde + deploy concluído), não uma superfície nova de informação.

## Dados da decisão (literais)

- **Runs falhas de 2026-08-25:** https://github.com/fsolla/teqo/actions/runs/32896463144 (main 618e37ee — verify falhou no E2E full), https://github.com/fsolla/teqo/actions/runs/32864831565 (verify verde 195 passed/10 flaky; deploy falhou: "The job was not acquired by Runner of type self-hosted"), https://github.com/fsolla/teqo/actions/runs/32870455856 (verify verde 197 passed/8 flaky; deploy cancelado).
- **Último deploy verde:** 9c5cd783 (2026-08-24).
- **Teste determinístico:** `tests/e2e/campaignMunicipalities.e2e.spec.ts:764` "advisor opens a demand and decides it", asserção na linha 817: `expect(page.getByText('Esta demanda já foi decidida.')).toBeVisible()` — falhou 3× (inicial + 2 retries), 10s timeout. As outras 6 falhas da run foram flaky e passaram no retry (família #882, fora de escopo).
- **Commit causador:** e273e9ec (react-audit família 4, C139 leftover "dispatch manual preserva texto digitado em erro de validação") trocou `action={submitTransition}` por `onSubmit` manual em `src/components/campaign/demand/DemandWorkflowCard.tsx`. O handler (linhas 70-73) monta `new FormData(event.currentTarget)`, que **não** inclui o botão submetido; os botões de transição têm `name="status" value={target}` (linhas 131-135: `em_analise` | `escalada` | `aprovada` | `rejeitada`). A server action `transitionDemandFormAction` (`src/app/(campaign)/campanha/(app)/demandas/[slug]/formActions.ts:45`) lê `requiredFormText(formData, 'status')` → ausente → erro de validação → transição nunca grava.
- **Comando repro (worktree provisionado):** `pnpm test:e2e --no-deps -- tests/e2e/campaignMunicipalities.e2e.spec.ts -g "advisor opens a demand and decides it"` (`--workers=1` se colidir no seedTestUser; `E2E_PROD=1` espelha o verify).
- **Cobertura do CI (por isso o e2e é obrigatório antes do push, política OPS72):** o PR CI **não** roda esse spec — `src/components/campaign/demand` cai na entrada final do manifest (`scripts/lib/e2e-affected-manifest.mjs:246-281`) → smoke fallback `campaignHomeActions`; o spec só roda no full do deploy verify. O aceite final é o deploy.
- **Fatos verificados:** único formulário do padrão com botões nomeados é o DemandWorkflowCard (verificado nos ~20 arquivos com `startTransition`+`new FormData`); TS 6.0.3 lib.dom aceita `new FormData(form, submitter)` (2º arg `HTMLElement | null`); React 19.2.4; zero usos atuais de `.submitter` no repo; sem cobertura unit/int do glue FormData→registro (`tests/int/campaignDemandWorkflow.int.spec.ts` cobre só a camada de registro).
- **Runner:** conferir que o runner self-hosted do homeserver está online antes de disparar o deploy (falha "job was not acquired" é de disponibilidade, não deste item).
- **Precedente de aceite:** `docs/plans/desbloquear-deploy-e2e-verify.md` (OPS83, #824).
- **ID reservado:** E2E-DEMAND-DECIDE (registrar via `pnpm agent:register` ao criar a Issue).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/demand/DemandWorkflowCard.tsx` (handler de submit das transições) e `src/app/(campaign)/campanha/(app)/demandas/[slug]/formActions.ts` (server action que lê `status`).
- **Precedente a olhar:** `docs/plans/desbloquear-deploy-e2e-verify.md` (OPS83, #824) — mesmo formato de critério: deploy manual verde como aceite final.
- **Risco de acoplamento:** manter o dispatch manual do C139 em **todos** os outros formulários (só o DemandWorkflowCard tem botões nomeados); não reverter a família 4 inteira.

## Dependências

Nenhuma dura. Referência soft: #882 (família de flakes) — citada como contexto, não como dependência nem alvo.

## Fora de escopo

- Família de flakes da #882 (as 6 falhas que passaram no retry).
- Corrigir a cobertura do manifest de e2e afetados (`e2e-affected-manifest.mjs`) — item sucessor sugerido, não neste.
- Consertar a infra do runner self-hosted do homeserver — checar que está online é parte do critério; consertar o homeserver não é.

## Rabbit holes de produto

- **Reverter toda a família 4 do react-audit.** Se alguém "só completar" revertendo o commit, o C139 (nota preservada em erro de validação) some junto. **Corte neste item:** correção local no card de demanda.
- **Converter todos os formulários do padrão para outra abordagem.** Explosão de escopo em ~20 arquivos sem benefício agora. **Corte neste item:** um único formulário — o único com botões nomeados.
- **Caçar os flakes da #882 nesta entrega.** Trabalho paralelo com rastreio próprio. **Corte neste item:** foco no teste determinístico; flakes são só ruído a ignorar.

## Questões em aberto (produto)

- **(a) Incluir o submitter também no formulário de custo (`handleCostSubmit`) por uniformidade?** **Opções:** incluir agora | deixar como está. **Recomendação:** incluir — é barato e previne a mesma classe de bug no futuro, mesmo sem botão nomeado hoje.
- **(b) Adicionar teste unit do glue FormData→status?** **Opções:** exigir agora | decidir no impl (opcional) | não. **Recomendação:** deixar para o plano de implementação decidir — desejável, mas não bloqueia o deploy; o aceite real é o e2e no verify.

## Referências

- ID reservado: **E2E-DEMAND-DECIDE** (ainda não registrado).
- Runs: https://github.com/fsolla/teqo/actions/runs/32896463144 · …/32864831565 · …/32870455856; último deploy verde 9c5cd783.
- Precedente: `docs/plans/desbloquear-deploy-e2e-verify.md` (OPS83, #824).
- Arquivos: `src/components/campaign/demand/DemandWorkflowCard.tsx`, `src/app/(campaign)/campanha/(app)/demandas/[slug]/formActions.ts`, `tests/e2e/campaignMunicipalities.e2e.spec.ts`, `tests/int/campaignDemandWorkflow.int.spec.ts`, `scripts/lib/e2e-affected-manifest.mjs`.
