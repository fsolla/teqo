---
name: testing-audit
description: 'Auditoria autônoma noturna da suíte de testes do Teqo — retrato honesto (contagens, tempos, duplicatas por camada), melhorias seguras aplicadas com prova verde antes/depois e revert fail-closed, entregues num único PR ready SEM auto-merge armado cuja descrição é o relatório final.'
---

# Skill: testing-audit

Auditoria autônoma da suíte de testes com implementação das melhorias seguras. Disparo humano à noite (`/testing-audit`) e a máquina trabalha sozinha; pela manhã existe UM relatório que explica toda a noite — cada ação tomada e o porquê — e um diff revisável em pedaços lógicos.

## Contrato de entrega (inviolável)

- **Um único PR ready** (não draft) contra `main`, **CI green**, **mergeable** (sem conflitos). Conflito com `main` ao amanhecer → NÃO rebasar depois do desarme (rearmaria o automerge): registrar no topo do relatório que rebasar é passo humano.
- **SEM auto-merge armado.** Esta skill NÃO herda o contrato "PR Ready + auto-merge" de `engineering-audit` — aqui o humano decide o merge pela manhã. O safety-net do repo (`agent-pr-ready-automerge.yml`) arma automerge em TODO PR ready contra main e REARMA a cada push (`synchronize`); por isso o desarme é SEMPRE o último passo da noite (Fase 5).
- A **descrição do PR é o relatório final** (integral ou condensado com ponteiro para o artefato); o relatório vive como artefato commitado em `docs/testing-audits/<YYYY-MM-DD>.md`.
- Melhorias em commits separados quando possível (preferência, não requisito duro).
- **Não registrar Issues no tracker**: propostas vivem só no relatório; a decisão humana de capturar débitos vem depois.

## Intocáveis absolutos

Nunca remover nem enfraquecer autonomamente (nem com prova forte):
1. Testes de consentimento/LGPD fail-closed (`Consent`, chave estável, falha fechada).
2. Access control/RBAC (`src/utilities/access/*`).
3. Lockdown de liderança (`leader`; `estimatedVotes` nunca visível à liderança).

Duplicata aparente envolvendo intocável vira proposta no relatório, sempre.

Intocáveis estruturais (nenhum diff toca): `scripts/ci-scope.mjs`, `scripts/lib/e2e-affected-manifest.mjs`, `.github/workflows/`, `.husky/`, qualquer gate ou política de seleção e2e (OPS72/OPS86). Zero edições em arquivos `tests/e2e/` — e2e é inventariado, não executado nem editado à noite.

## Critérios de nível (aponte, não redefina)

A pirâmide das três camadas já está codificada: `.agents/skills/test-driven-development/SKILL.md` (seção da pirâmide, "as três camadas do repo" — hoje §144–198) e `docs/TESTING.md`. As disposições da auditoria julgam contra esses critérios existentes — nunca criem critérios novos paralelos.

## Tetos duros da noite

| Teto | Valor |
|---|---|
| Budget global | ~6h |
| Inventário paralelo (Fase 1) | ≤45min |
| Rubrica (Fase 2) | ≤30min |
| Melhorias aplicadas (Fase 3) | ≤6 passos, ≤30min cada |
| Debug de AFTER falho | ≤10min, 1 retry, senão revert |

Estourou teto → o candidato vira proposta no relatório; faltou tempo no fim → pular direto ao fecho com o que há. **A auditoria TERMINA antes de implementar** — nada de ler até amanhecer.

## Ferramentas (first-party apenas)

- Retrato unit/int: `node scripts/testing-audit-metrics.mjs unit|int [--top N]` (reporters JSON nativos; imprime totais + tabela markdown dos arquivos mais lentos; propaga exit code).
- Inventário e2e estático: `node scripts/testing-audit-metrics.mjs e2e-inventory` (contagem de describe/test por arquivo; duração "não medido").
- Cobertura diagnóstica sob flag: `pnpm vitest run --config ./vitest.unit.config.mts --coverage <filtro>` (plugin @vitest/coverage-v8; opcional, sem meta percentual, nunca regra dura).
- Proibido: instalar outras ferramentas de análise de suíte, mutation testing na rotina, dashboards.

## Fase 0 — Baseline (antes de editar qualquer arquivo)

1. Validar ambiente do worktree: `.env.test.local` aponta para `teqo_wt<slot>_test` (nunca produção; guards locais intactos) e Postgres local acessível.
2. Rodar `pnpm test:unit` e `pnpm test:int` (bare, nunca piped) — ambos devem estar verdes.
3. Registrar no rascunho do relatório: contagens de arquivos/testes e durações por camada (baseline da noite).

## Fase 1 — Inventário paralelo (≤45min)

Despache **três leitores Task read-only em paralelo**, um por camada. Cada leitor recebe: a lista de intocáveis acima, os critérios de nível (§144–198 + `docs/TESTING.md`) e esta instrução fixa:

> "Leia os specs de `<tests/unit|tests/int|tests/e2e>` e devolva candidatos com evidência `caminho:linha`: (a) duplicatas prováveis — mesmo comportamento pinado duas vezes, citando as assertions gêmeas; (b) teste de integração que não toca DB/rede/Payload e poderia ser unitário (ou vice-versa, teste unitário que mocka tanto que testa mocks); (e para e2e) fluxo que camadas inferiores já garantem. Para cada candidato: prova literal citada, por quê, risco. Read-only: não escreva código nem planos."

Regras dos leitores: read-only obrigatório; todo achado cita caminho:linha; achado sem citação é descartado.

## Fase 2 — Rubrica de disposições (≤30min)

Consolide os achados validando CADA um contra o fonte antes de virar disposição (leitor pode alucinar; implementação nunca é delegada). Cada candidato recebe UMA disposição:

| Disposição | Exige | Vira |
|---|---|---|
| **mover** | prova de que a camada atual está errada pelos critérios OPS90 | melhoria aplicável |
| **reforçar** | assertion faltante dentro de escopo JÁ testado | melhoria aplicável |
| **remover** | PROVA FORTE: duplicata demonstrada (comportamento idêntico, diff das assertions) ou teste morto de feature removida (referência verificada morta no codebase) | melhoria aplicável |
| **manter** | valor claro / intocável / custo > benefício | linha no retrato |
| **proposta** | dúvida, prova insuficiente ou toque em intocável/e2e | seção de propostas do relatório |

Na dúvida entre remover e proposta → proposta. Priorize por: risco coberto × custo de execução × confiança da prova.

## Fase 3 — Loop de melhorias (≤6 passos × 30min)

Para cada melhoria aplicável, EM SEQUÊNCIA (nunca paralelo):

1. **Prova ANTES:** rodar `pnpm test:unit` + `pnpm test:int` (passo confinado a arquivos unit pode provar unit-only) — registrar contagens literais ("Test Files X passed", "Tests Y passed") no relatório.
2. **Editar** o mínimo necessário (uma melhoria = um commit; sem misturar melhorias).
3. **Prova DEPOIS:** mesma suíte verde com contagens coerentes (ex.: mover não muda totais; remover-com-prova-forte reduz exatamente o número documentado).
4. **Commit próprio** com mensagem que nomeia a disposição (ex.: `test(ops96-audit): mover X para unit — puro, sem Payload`).
5. **AFTER falhou** → debug ≤10min, 1 retry; persistindo → `git reset --hard HEAD~1`, registrar como REVERTIDO no relatório com o motivo da falha. Nada fica quebrado.

Evidência por passo no relatório: timestamp, hash curto, linhas-resumo antes/depois. JSON bruto é efêmero (fora do git).

## Fase 4 — Fecho (relatório + PR)

1. Finalizar `docs/testing-audits/<YYYY-MM-DD>.md` no template abaixo.
2. Escrever `docs/changelog/<data>-ops96-testing-audit.md` (entrada append-only curta; o agregado é gitignored — nunca commitar `docs/CHANGELOG-AGENTS.md`).
3. Gate completo no SHA final, bare: `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (`tsc --noEmit`), `pnpm exec knip`, `pnpm check:cycles`, `pnpm test:unit`, `pnpm test:int`.
4. Push ÚNICO via `pnpm push -u origin HEAD` (o hook roda `gate:push`; minimiza rearms do automerge).
5. Abrir PR **ready** base `main` e desarmar o auto-merge num ÚNICO passo atômico: `GITHUB_TOKEN=<PAT> node scripts/testing-audit-disarm.mjs --head <branch> --title "<data> — testing-audit" --body-file <relatório> --draft-on-failure` (cria Ready → desarma → verifica `autoMergeRequest === null`; em falha converte a draft e sai 1 — fallback fail-closed estrutural). Body = relatório, com `Closes #898` se a Issue desta entrega ainda estiver aberta.
6. Aguardar CI green no SHA final: flake aparente → 1 rerun (`gh run rerun --failed`); quebra real → fix-forward ≤2 ciclos (cada fix é novo push e REARMA o automerge → desarmar de novo com `scripts/testing-audit-disarm.mjs --pr <N> --draft-on-failure` depois). Esgotado → CI pendente registrado como pendência conhecida (main não corre risco: automerge desarmado na Fase 5).

### Template do relatório (seções fixas)

```markdown
# Testing audit <YYYY-MM-DD>

## Sumário executivo
(números da noite: baseline → final; melhorias aplicadas/revertidas/propostas)

## Metodologia e tetos respeitados
(fases executadas, horários, tetos: 6h / 6 melhorias / 30min-passo)

## Retrato da suíte
(unit/int medidos pelo script; e2e inventário estático, duração "não medido";
 tabelas dos arquivos mais lentos; duplicatas prováveis)

## Disposições
(id, camada, arquivo, tipo mover/reforçar/remover/manter/proposta,
 prioridade alta/média/baixa, prova, decisão aplicada/proposta/revertida)

## Evidências verde antes/depois
(uma linha por passo: timestamp, hash, contagens antes → depois)

## Passos revertidos
(motivo da falha de cada revert)

## Propostas não executadas
(cada uma com a razão — prova insuficiente / intocável / teto)

## Estado final do PR
(CI, mergeable, automerge desarmado às HH:MM)
```

## Fase 5 — Desarme do auto-merge (na criação e imediatamente após CADA push, nunca depois do green)

O safety-net arma o automerge no evento de abertura e REARMA a cada push. **Errata OPS96 (falha real da 1ª noite):** desarmar DEPOIS do CI green é tarde — o GitHub mergea em segundos quando o required check fica verde; o PR da 1ª noite mergeou sozinho nesse intervalo (~40s). Desde o Pass 6 o desarme é determinístico — `scripts/testing-audit-disarm.mjs` cria→desarma→verifica e falha fechado; nada depende de lembrar a ordem:

1. A criação do PR na Fase 4 JÁ desarma e verifica (um único comando com `--draft-on-failure`).
2. Cada push novo REARMA (evento `synchronize`) → repetir o desarme logo após cada push, sempre enquanto o CI estiver pendente: `GITHUB_TOKEN=<PAT> node scripts/testing-audit-disarm.mjs --pr <N> --draft-on-failure`. **Nunca "aguardar o workflow/arquivo de checks terminar" para então desarmar** — isso chega exatamente no momento do merge.
3. Verificação final no fecho da noite (último passo): o script imprime o JSON de status — esperado `"autoMergeRequest": null, "isDraft": false` com exit 0 (exit 0 SÓ com desarmado+Ready). Qualquer outra saída é falha do passo 4.
4. **Fallback fail-closed:** verificação falhou e o `--draft-on-failure` converteu a PR para draft (draft é veto estrutural do safety-net) — registrar no relatório que o humano vira ready pela manhã. Draft protegido é preferível a main mergeado sem querer.
5. Gravar no relatório (seção estado final): hora do desarme + JSON de status da verificação.

Depois da verificação final: **nenhum push, rebase ou merge** — tudo isso rearma.

## Done when

Baseline verde registrado; inventário com achados citados por caminho:linha; toda disposição justificada; melhorias aplicadas com provas antes/depois e commits separados; reverts registrados; relatório completo commitado + changelog; PR ready, mergeable, CI green no SHA final; **automerge desarmado e verificado** (ou fallback draft registrado). Nada quebrado pela manhã.
