# Post-mortem: build da imagem mudo desde o OPS99 — importmap sem `react-server` e envs presos no prefixo

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Data do post-mortem | 2026-09-12                                                                                             |
| Severidade          | alta (nenhum build de imagem completou desde o OPS99; nenhum dado/PII afetado; prod no build anterior) |
| Ambiente            | prod (build da imagem no homeserver, via `deploy.yml`)                                                 |
| Issue(s)            | sem Issue (fluxo `/bug-fix`)                                                                           |
| PR do fix           | #953 (importmap + stale run) e #952 (envs do standalone + guards + docs)                               |
| Detectado por       | humano (resultado do deploy manual) + log do run 34696817841                                           |

## Timeline

| Momento                   | Data/hora                  | Evento                                                                                                                                                                                                                                      |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável           | 2026-08-27 16:05 -0300     | commit `493f4ba9` (OPS99) encadeia o gerador no RUN do builder sem `--conditions=react-server` e deixa os prefixos de env presos no primeiro comando da cadeia                                                                              |
| Detecção                  | 2026-09-12 13:34–14:00 UTC | run 34696817841 do `deploy.yml`: `verify` verde (16m56s), `deploy homeserver (teqo-1313)` falha em 9m34s no `docker build` — `Error: This module cannot be imported from a Client Component module` no passo do importmap                   |
| Correção parcial mergeada | 2026-09-12 14:50 UTC       | PR #953 (commit `52a2ef6d`): o gerador passa a usar `pnpm generate:importmap` e o guard de stale run deixa de sair 0 em falso verde                                                                                                         |
| Segunda falha confirmada  | 2026-09-12 15:07–15:33 UTC | run 34701266297 (dispatch pós-#953): importmap passa, `next build` completa (399s) sem `.next/standalone` e o stage `runner` morre em `COPY --from=builder /app/.next/standalone ./` → `"/app/.next/standalone": not found` (Dockerfile:73) |
| Correção completa         | pendente                   | PR #952 — envs do standalone no comando do `next build`, guards de invariantes e este documento; CI em andamento                                                                                                                            |
| Deploy                    | pendente                   | dispatch manual do `deploy.yml` pelo humano após o merge (o deploy é manual; nenhum merge publica sozinho)                                                                                                                                  |
| Verificado em prod        | pendente                   | confirmação do humano após o deploy                                                                                                                                                                                                         |

Antes do OPS99, o último build real de imagem que passou foi o run 33074305879 (2026-08-27 12:56 UTC, prod no commit `4d6533c04` conforme o commit do #953). O "sucesso" das 05:22 (run 34675436246) foi falso verde do guard de stale run: main avançou durante o verify (`087635d0` vs `ccc8d6ea`) e o script saiu 0 sem deployar — comportamento corrigido no #953. Desde o OPS99 nenhum build de imagem completou, e o primeiro rebuild real (dispatch das 13:34) expôs os dois defeitos do mesmo RUN.

## O bug

O deploy manual de 2026-09-12 13:34 UTC não chegou ao fim: o job `deploy homeserver (teqo-1313)` falhou no `docker build` (target `builder`), no passo `pnpm exec payload generate:importmap`, com `Error: This module cannot be imported from a Client Component module` (`node_modules/server-only/index.js`). Produção continuou no build anterior; nenhum dado, PII ou migration foi tocado. **Sintoma — não a causa.**

A correção do #953 destravou o primeiro obstáculo e desarmou o falso verde do stale run, mas deixou o segundo defeito latente no mesmo RUN: `NEXT_OUTPUT_STANDALONE=1` e `NODE_OPTIONS` continuavam prefixando o primeiro comando da cadeia (o gerador), então o `next build` sairia sem `output: 'standalone'` e o stage `runner` falharia no `COPY /app/.next/standalone` — o deploy seguiria sem publicar. O run 34701266297 (dispatch pós-#953) confirmou a segunda falha em produção: o importmap passou, o `next build` completou (399s) sem gerar `.next/standalone` e o build morreu no `COPY --from=builder /app/.next/standalone ./` → `"/app/.next/standalone": not found` (Dockerfile:73).

## Causa-raiz

Os dois defeitos têm a mesma raiz: o RUN do builder executa o gerador e o `next build` na **mesma cadeia `&&`**, e o OPS99 (commit `493f4ba9`) montou essa cadeia reimplementando a invocação do CLI no Dockerfile em vez de chamar o script dono (`package.json` → `generate:importmap`), sem atentar para a semântica de prefixos do shell. Cada defeito é uma face disso:

1. **Importmap sem `react-server` (corrigido no #953):** o script do repo define `NODE_OPTIONS="--no-deprecation --conditions=react-server"` (`package.json`; mesmo contrato em `scripts/predev-importmap.mjs:41`), mas o Dockerfile chamou `pnpm exec payload generate:importmap` direto. Sem a condição, `server-only` resolve para o módulo que lança; com ela, para o `empty.js`. O CLI carrega o `payload.config.ts` inteiro — que importa `src/utilities/campaignAccess.ts` → `src/utilities/access/campaignStaffAdvisors.ts:5` (`import 'server-only'`) — e o build morria na avaliação do config.
2. **Envs presos no prefixo (corrigido neste PR):** em shell POSIX, atribuições-prefixo (`VAR=x cmd1 && cmd2`) valem **só para o primeiro comando** (reproduzido: `sh -c 'FOO=1 sh -c "echo first=\$FOO" && sh -c "echo second=\$FOO"'` → `first=1`, `second=`). Ao prepender o gerador, o OPS99 deixou `NEXT_OUTPUT_STANDALONE=1` (lido em `next.config.mjs:8`) e `NODE_OPTIONS="--max-old-space-size=8000"` aplicados ao gerador; o `next build` rodaria sem standalone.

5-whys:

1. **Por que o deploy falhou?** O `generate:importmap` do Docker build estourou num `import 'server-only'` do grafo do `payload.config.ts`.
2. **Por que estourou?** O Payload CLI rodou sem `--conditions=react-server`, a condição que faz `server-only` virar módulo vazio.
3. **Por que rodou sem a condição?** O Dockerfile re-escreveu a chamada do CLI em vez de usar o script `pnpm generate:importmap`, que é o dono da flag — divergiu do contrato sem ninguém notar.
4. **Por que o PR CI não pegou?** O CI de PR não builda a imagem Docker; o único lugar que exerce o stage `builder` é o deploy manual, e os dispatches pós-OPS99 não tinham feito rebuild real (o das 05:22 foi stale skip).
5. **Por que a divergência ficou 2 semanas escondida?** O contrato do RUN (comando canônico + escopo dos envs) vivia só na cabeça de quem escreveu o OPS99: nada pinava o Dockerfile aos scripts donos nem cobria o encadeamento do build da imagem em teste.

**Evidência:** falha de produção do importmap reproduzida localmente em 2026-09-12 com o comando exato do Dockerfile (mesma stack, `server-only/index.js:1`); a mesma invocação via script (`pnpm generate:importmap`) passa. A semântica de prefixo foi reproduzida com o one-liner acima; o build de produção local sem `NEXT_OUTPUT_STANDALONE=1` deixa de gerar `.next/standalone`, e o run 34701266297 confirmou a falha no `COPY` do stage `runner`.

## Correção

- **#953 (commit `52a2ef6d`, já em main):** o Dockerfile passa a chamar `pnpm generate:importmap` (script dono da flag `react-server`, o mesmo do `predev`); o guard de stale run passa de `say … exit 0` para `fatal` nos dois pontos, sem falso verde.
- **#952 (este PR):** cada lado da cadeia declara seu próprio env — `pnpm generate:importmap && NEXT_OUTPUT_STANDALONE=1 NODE_OPTIONS="--no-deprecation --max-old-space-size=8000" pnpm exec next build`. O `next build` volta a produzir `.next/standalone` para o stage `runner` e mantém o teto de memória.
- **Guards (`tests/unit/deployScript.unit.spec.ts`):** (a) o script `generate:importmap` do `package.json` contém `--conditions=react-server` e o Dockerfile usa o script, não o CLI inline (#953, estendido com o pin do script); (b) `NEXT_OUTPUT_STANDALONE=1`/`max-old-space-size=8000` ficam no lado do `next build` e não no lado do gerador (#952); (c) os dois pontos de stale run são `fatal` (#953).

Resolve a causa: o build da imagem volta a usar a invocação canônica do CLI e não depende mais de onde o `&&` corta os envs. Sem migration, sem mudança de access ou Consent.

## Verificação

- Teste de regressão do importmap (#953): `Dockerfile: generates the importMap via the canonical script` — **falha** com o Dockerfile do OPS99 restaurado (mutação, 1 failed / 11 passed) e **passa** com o fix
- Teste de regressão dos envs (#952): `Dockerfile: NEXT_OUTPUT_STANDALONE and NODE_OPTIONS reach next build (shell prefix scoping)` — **falha** com o Dockerfile do #953 (main atual, 1 failed / 11 passed) e **passa** com o fix (12 passed)
- Reprodução: comando exato do OPS99 falha localmente (mesma stack `server-only`); `pnpm generate:importmap` passa; one-liner de shell prova a semântica de prefixo
- Produção-equivalente local: `pnpm generate:importmap` (S3 dummy) gera o importMap com o `S3ClientUploadHandler` (entrada que o OPS99 protegia) e `NEXT_OUTPUT_STANDALONE=1 NODE_OPTIONS="--no-deprecation --max-old-space-size=8000" pnpm exec next build` completa e produz `.next/standalone/server.js`
- Suíte: `pnpm gate:fast` verde (lint + typecheck + unit); `pnpm push` verde no gate:ci local (int 78 files / 712 tests, docs guards)
- CI: pendente — PR #952
- Prod: run 34701266297 (pós-#953) confirmou a segunda falha — `"/app/.next/standalone": not found` no stage `runner` (Dockerfile:73); deploy verificado pendente — dispatch manual do `deploy.yml` pelo humano após o merge deste PR, confirmação do humano pendente

## Prevenção

| Estratégia                                                                                                           | Custo  | Estado                                 |
| -------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------- |
| Gerador via script canônico (`pnpm generate:importmap`) e stale run fatal, pinados por unit                          | barata | implementada no #953                   |
| Guard unit pinando o escopo dos envs no lado do `next build` da cadeia                                               | barata | implementada agora (PR #952)           |
| Job de CI que builda o stage `builder` da imagem (Docker + DB migrado + secrets) a cada mudança de Dockerfile/script | cara   | documentada — não implementada         |
| Lint que proíbe invocação inline de CLI Payload em Dockerfile (fora dos scripts donos)                               | cara   | documentada — candidata a Issue futura |
| Destrackear `src/app/(payload)/admin/importMap.js` (segue tracked no git apesar do `.gitignore` da OPS99)            | barata | documentada — fora deste fluxo         |

**Estratégia implementada:** guards unitários dos invariantes do caminho de build Docker (comando canônico do importmap, escopo dos envs no `next build`, stale run fatal) — a classe "o Dockerfile divergiu do contrato dos scripts" vira falha de teste no PR, não falha de deploy em produção.

**Estratégia documentada (cara):** job de CI que executa o build da imagem (ou ao menos `docker build --target builder`) a cada mudança de Dockerfile/scripts, e lint que bane invocação inline do CLI Payload no Dockerfile. Exigem runner com Docker + banco migrado + secrets de build — candidatas a Issue futura. O destracking do `importMap.js` também fica registrado como limpeza fora do escopo.

## Lições

- **Uma causa, duas falhas latentes:** o mesmo `&&` do OPS99 quebrou o importmap e roubou os envs do `next build`. Corrigir a primeira (importmap) **não** zerou o incidente — o run seguinte mostrou que metade do problema continuava armada. Um fix completo remove a causa (o encadeamento mal montado), não só o sintoma visível.
- **Cadeia com `&&` muda o dono dos prefixos de env:** no shell, `VAR=x cmd1 && cmd2` dá `VAR` só ao `cmd1`. Flags de build devem ficar explícitas no comando que as consome.
- **"Deploy verde" pode não ter deployado:** o stale run das 05:22 saiu 0 em 19s e o GitHub mostrou sucesso — prod ficou duas semanas num build antigo. Falso verde de pipeline é pior que falha explícita; o #953 corrigiu o stale run e o run pós-#953 comprovou a segunda falha em vez de escondê-la.
- **Reimplementar a invocação em vez de chamar o script dono é uma twin barata de nascer e cara de pagar:** o `predev-importmap.mjs` já usava a condição `react-server`; o Dockerfile duplicou o comando e perdeu a flag. Chamar o script teria custado zero.
- **O único lugar que exercita o Dockerfile não era o PR CI:** guards de invariantes do arquivo de build são o mínimo para compensar a ausência de um job de imagem no CI.
