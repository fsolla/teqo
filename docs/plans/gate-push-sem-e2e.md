# Pre-push sem e2e: e2e roda uma vez, no CI (gate local fica com os outros testes)

Status: entregue (2026-08-18)
Atualizado em: 2026-08-18
Issue: #46
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável (push não roda e2e; CI continua gateando merge/deploy)
Responsável: —

## Intenção

O CI agora roda na nossa própria máquina (Forgejo + runner self-hosted, OPS50/OPS53), com o e2e completo gateando PRs e deploy em main. O pre-push local (`pnpm push` → `gate:ci`) ainda roda a suíte e2e inteira — playwright install, build `.next-e2e`, testes — **antes** do push, duplicando o trabalho mais pesado do fluxo duas vezes: local e CI. O custo por push é de dezenas de minutos que não decidem nada que o CI já não decida.

Decisão de produto: e2e roda **uma vez, no CI** (para todo PR e no merge em main). O pre-push mantém todos os outros testes/checagens (lint, format, typecheck, knip, cycles, unit, int, build). O agente continua dono do PR até o merge e é responsável por consertar falhas de e2e que aparecerem no CI — política existente, que este item reforça em vez de enfraquecer.

## Persona e fluxo

- **Persona / contexto:** agente (ou humano) fechando um PR de feature/chore — quer feedback rápido do gate local antes do push, sem pagar 2× o teste mais caro.
- **Job principal:** saber antes do push que o PR não quebra o que o CI vai verificar — com a confiança de que o e2e (não rodado localmente) será rodado pelo CI e bloqueia merge/deploy se falhar.
- **Fluxo desejado:**
  1. Agente termina a feature e roda `pnpm push` (ou `git push` via hook).
  2. O gate local roda os testes/checagens que continuam no pre-push — **sem e2e** — e deixa o push passar.
  3. O CI roda o e2e no PR (full ou afetado, conforme o blast radius); se falhar, o job `checks` falha, o merge não acontece e o agente conserta no mesmo PR (sem abrir mão — política "Dono do PR, dono do CI").
  4. No merge em main, o CI roda o e2e completo de novo; `checks` verde é pré-requisito do deploy.
- **Anti-goals de produto:**
  - Não remover e2e do CI (nem de PR nem de main) — só do gate local de push.
  - Não criar gate/flag novo de "pular e2e" por PR (o escape `--no-verify` documentado continua sendo o único bypass).
  - Não enfraquecer a responsabilidade do agente pelo CI do PR (o e2e de CI falhou → agente conserta, até o merge).

## Objetivo e aceite

- `pnpm push` / `.husky/pre-push` **não** rodam mais e2e (sem playwright install, sem build `.next-e2e`, sem `test:e2e`) — mantêm lint, format:check, typecheck, knip, check:cycles, test:unit e test:int/build (na cascata e escopo atuais).
- O e2e do CI continua como está e comprovadamente gateia: (a) todo PR de código para main (job `e2e` em ci-pr.yml; docs-only segue sem e2e, por design do classificador), e (b) todo merge em main antes do deploy (job `e2e` full em ci.yml, `checks` → `deploy`).
- O agente segue acompanhando o PR até o merge: falha de e2e no CI é do dono do PR (política já documentada em `docs/AGENT-OPS.md` e `.agents/rules/engineering-standards.mdc` — não muda).
- A documentação do fluxo (regras/skills/AGENT-OPS) deixa de citar e2e como etapa do pre-push e passa a dizer que e2e é verificado no CI após o push (local opcional, ex. `pnpm test:e2e:affected` para feedback rápido).

## Dados (intenção)

Dados: N/A — chore de DX/processo; sem métricas de produto. (O ganho é tempo de push e carga da máquina; medição fica a critério da execução.)

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/gate-ci.mjs` (o bloco e2e do espelho local — remover da cascata local), `package.json` (scripts `gate:*` — provavelmente sem mudança, `gate:ci` continua), `.husky/pre-push` / `scripts/git-push.mjs` (devem continuar delegando a `gate:ci` — sem duplicação de lógica), `.forgejo/workflows/ci-pr.yml` e `ci.yml` (**intocados** — verificação de que continuam corretos, não mudança).
- **Precedente a olhar:** `docs/plans/gate-push-local.md` (criou o gate; entregue — o novo item ajusta a decisão), `docs/plans/politica-ci-dono-do-pr.md` (política que permanece), `docs/plans/ci-e2e-paralelizar-job.md` (shards do e2e no CI — intocados).
- **Risco de acoplamento:** `scripts/gate-ci.mjs` espelha `ci-pr.yml` em cascata — ao remover o bloco e2e, manter o restante da cascata com os mesmos skips do classificador (`scripts/ci-scope.mjs`); não tocar no CI em si. Docs que citam o gate: `engineering-standards.mdc`, `agent-pr-workflow.mdc`, skills (`work-issue`, `agent-work-issue`, `worktree-next-issue`, `local-database`) — atualizar citações de "gate:push roda e2e" para o novo contrato.

## Dependências

- Nenhuma. (Não serializa com outras Issues; CI/classificador são donos de outra área e ficam intactos.)

## Fora de escopo

- Mudar o que o CI roda (full/selected/none, shards, deploy) → CI atual é o verificado e fica como está.
- Alterar os scripts de teste em si (`test:e2e`, `test:all`, `test:e2e:affected`) — continuam disponíveis para uso manual/verificação.
- Mexer na política "Dono do PR, dono do CI" → permanece.

## Rabbit holes de produto

- **"Já que removo e2e, removo o build pesado também / simplifico o gate".** Não: o build segue necessário para as outras etapas e o espelho deve continuar fiel ao CI no que permanece. **Corte:** remover só o bloco e2e, sem redesenhar a cascata.
- **"Adiciono um flag `--skip-e2e` no gate".** Faria do bypass um recurso; o escape `--no-verify` documentado já cobre casos de transição. **Corte:** nenhum flag novo.

## Questões em aberto (produto)

- **Manter a citação de e2e na checklist de verificação de entregas (AGENTS.md / skills)?** **Opções:** A) tirar e2e da checklist local obrigatória (fica "e2e = responsabilidade do CI; local opcional") | B) manter como passo recomendado quando o agente quiser feedback antecipado. **Recomendação:** A — e2e no pre-push sai por decisão deste item; a verificação passa a ser "push → acompanhar CI até checks verde", com `test:e2e:affected` opcional para o agente que preferir rodar antes. _(assumido — validar com produto)_
- **O agente deve rodar e2e local antes de abrir o PR em caso de dúvida?** **Opções:** A) nunca obrigatório — CI decide | B) obrigatório só quando o diff toca área sem e2e mapeado (unmapped). **Recomendação:** A — o classificador já força full nesses casos no CI; rodar local duplicaria a exceção que estamos eliminando. _(assumido — validar com produto)_

## Referências

- `docs/plans/gate-push-local.md` — origem do gate (entregue; decisão ajustada por este item)
- `docs/plans/politica-ci-dono-do-pr.md` — política que permanece (CI do PR é do dono até o merge)
- `docs/plans/ci-e2e-paralelizar-job.md` — como o e2e do CI roda (intocado)
- `.forgejo/workflows/ci-pr.yml` / `ci.yml` — o e2e do CI que este item preserva (verificação, não mudança)
- `scripts/gate-ci.mjs`, `scripts/ci-scope.mjs`, `scripts/git-push.mjs`, `.husky/pre-push`
- `docs/AGENT-OPS.md`, `.agents/rules/engineering-standards.mdc`, `.agents/rules/agent-pr-workflow.mdc`
