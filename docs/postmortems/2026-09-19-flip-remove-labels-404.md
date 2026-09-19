# Post-mortem: flip pós-merge abortava com 404 ao remover label ausente — fix idempotente revertido sem teste

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Data do post-mortem | 2026-09-19                                                                                                   |
| Severidade          | alta (flip pós-merge aborta no primeiro item; labels de status mentem e as demais Issues do lote não fecham) |
| Ambiente            | CI (GitHub Actions) + tracker GitHub                                                                         |
| Issue(s)            | sem Issue (descoberto no `/bug-fix` do ready-automerge; evidência viva em #1155/#1169 e #1176/#1177/#1184)   |
| PR do fix           | (este PR)                                                                                                    |
| Detectado por       | log (run 35425762455, flip do PR #1202) + investigação do `/bug-fix`                                         |

## Timeline

| Momento         | Data/hora            | Evento                                                                                                                                                                                                                                                                 |
| --------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Introdução      | 2026-08-23           | `4486c05b` adiciona `ignoreNotFound` ao `request` e o usa em `removeLabels` (idempotência do flip). Horas depois, `9467e0f2` (C140 — 70+ arquivos) reverte `scripts/lib/github-api.mjs` ao blob pré-fix (`7be10d1e` → `2ae14a50`) sem que nada pinasse o comportamento |
| Falhas vivas    | 2026-09-19T02:40Z    | Runs 35416333242 (PR #1183 → #1155) e 35416350778 (PR #1175 → #1169) falham `DELETE .../labels/in-progress → 404` — inclusive o flip do PR que corrigiu o 401 (post-mortem irmão)                                                                                      |
| Detecção        | 2026-09-19T06:07:43Z | Flip do PR #1202 (run 35425762455): #1176 fecha só pelo keyword do GitHub (sem `done`/`in-prod`), o run falha no 404 e #1177/#1184 ficam abertas — o defeito aparece na verificação do fix do ready-automerge                                                          |
| Correção        | (este PR)            | Restaura `4486c05b` + 2 pins unitários (o fix original não tinha teste)                                                                                                                                                                                                |
| Verificação e2e | a confirmar          | Recovery `workflow_dispatch` do `issue-done-on-main-merge.yml` com `pr=1202` após o merge; esperado: #1176/#1177/#1184 fechadas com `done`/`in-prod`                                                                                                                   |
| Deploy          | não se aplica        | Mudança em scripts de CI/tracker; nenhum deploy de aplicação                                                                                                                                                                                                           |

## O bug

O job `issue-done-on-main-merge` (flip pós-merge) falhava com `GitHub API DELETE /repos/fsolla/teqo/issues/<n>/labels/in-progress → 404: {"message":"Label does not exist"}` sempre que a Issue citada não tinha o label `in-progress` — caso comum: Issue já fechada por keyword do GitHub, re-run do dispatch de recuperação, ou Issue que nunca entrou em `in-progress`. O `issue-transition-on-merge.mjs` processa as Issues citadas em ordem e aborta no primeiro erro: as seguintes não são processadas, os labels de status ficam mentirosos e o job fica vermelho (fail-closed, OPS61). Evidência viva: #1176 (fechada sem `done`/`in-prod`) e #1177/#1184 (abertas) no merge do PR #1202; antes, #1155 e #1169.

## Causa-raiz

5-whys:

1. O GitHub devolve 404 ao remover um label que a Issue não tem (estado final desejado, não erro).
2. `removeLabels` (`scripts/lib/github-api.mjs`) não pedia tolerância a 404 — o `request` só tolera 404 em GET.
3. A tolerância existia (`ignoreNotFound`, `4486c05b`) e foi **revertida** por `9467e0f2` (C140): o commit grande levou o blob antigo de `github-api.mjs` (`git show 9467e0f2 -- scripts/lib/github-api.mjs`) — artefato de rebase que resolve conflito escolhendo o lado velho.
4. Nenhum teste pinava a idempotência — o fix original entrou sem teste e o revert passou silencioso por ~4 semanas.
5. O flip depende da idempotência para re-run/recovery (dispatch manual com label já removido) e aborta o lote no primeiro erro: uma regressão pequena derruba o flip inteiro.

**Evidência:** `git show 4486c05b` e `git show 9467e0f2 -- scripts/lib/github-api.mjs` (blob `7be10d1e` → `2ae14a50`); runs 35416333242, 35416350778 e 35425762455.

## Correção

Restauração exata de `4486c05b` em `scripts/lib/github-api.mjs`: `ignoreNotFound` no `request` (404 → `null`) e `removeLabels` passando `ignoreNotFound: true`, com o comentário de intenção. Mais 2 testes unitários em `tests/unit/githubApi.unit.spec.ts`: 404 tolerado (idempotência do re-run) e não-404 ainda lança (não engolir erro real). O pin é o que faltava no fix original.

## Verificação

- Teste de regressão: `removeLabels tolerates 404 on an already-absent label` — RED pré-fix (reproduz o erro exato de `github-api.mjs:138`), GREEN pós-fix; 31/31 na spec
- Suíte: `pnpm gate:ci` (a confirmar)
- CI: a confirmar no PR (este PR)
- Live: recovery dispatch do flip do PR #1202 após o merge (a confirmar; #1176/#1177/#1184 fechadas com labels)
- Prod: não se aplica (script de CI/tracker)

## Prevenção

| Estratégia                                                                                               | Custo  | Estado                                             |
| -------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| 2 pins unitários da idempotência de `removeLabels` (o fix original não tinha)                            | barata | implementada agora (este PR)                       |
| Guard contra "revert silencioso" de blob em commits grandes (ou Merge Queue / branch protection estrita) | cara   | documentada — não implementada (candidata a Issue) |

**Estratégia implementada:** os dois pinos unitários — reverter o `ignoreNotFound` de novo agora quebra o CI.

**Estratégia documentada (cara):** detecção automática de blob regredido em arquivos não relacionados de um commit (caro e ruidoso); a rede barata é manter fix pequeno com teste na mesma entrega. O guard de conflito semântico de rebase (branch protection estrita/Merge Queue) segue candidato registrado no post-mortem irmão de 2026-09-18.

## Lições

Um fix de uma linha sem teste é um fix que um commit vizinho pode desfazer sem ninguém notar — e foi o que aconteceu: `9467e0f2` (C140) reverteu `github-api.mjs` inteiro para o blob de horas antes, e o único sinal vivo foi um 404 no flip, quatro semanas depois. O design fail-closed do flip está certo (nunca mentir), mas ele processa o lote em ordem e aborta no primeiro erro: idempotência é pré-requisito do recovery, não luxo. Trilha: `4486c05b`, `9467e0f2`, runs 35416333242/35416350778/35425762455, PR #1202 e #1175.
