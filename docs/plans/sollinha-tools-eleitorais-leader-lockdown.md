# B180 — Sollinha: travar tools eleitorais legadas contra leader (lockdown)

Status: plano
Atualizado em: 2026-08-09
Issue: (registrar com depends: [B177])
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (sem UI; gate no execute das tools)
Canvas UI: N/A
Appetite: ~0,5 dia eng; editar duas tools + orientar prompt; sem migration / Consent / collection

## Intenção

A B177 introduziu a tool `getLeadingMunicipalities` com o gate fail-closed `assertCanReadElectionData(ctx.user)` no topo do `execute` (leader lockdown: "liderança não tem essa conversa sobre municípios"). As duas tools eleitorais legadas do chat — `getTopDeputies` (quem foi o mais votado num município) e `getMunicipalityVotes` (votação de Solla num município) — usam `overrideAccess: true` nas queries **sem** gate de papel, então um usuário com role `leader` consegue invocá-las no chat e ler dados eleitorais (o route `api/ai-chat` expõe todas as tools a todos os papéis; o prompt só desencoraja).

Não é uma regressão recente nem vazamento de dado sensível (dados TSE públicos), mas contraria o lockdown de produto: liderança não recebe conversa de municípios/dados eleitorais no Sollinha.

## Objetivo e aceite

- `getTopDeputies` e `getMunicipalityVotes` fazem `assertCanReadElectionData(ctx.user)` no topo do `execute` (try/catch → `{ error: 'Leitura de dados eleitorais negada.' }`, fail-closed, mesmo padrão da B177).
- Nenhum outro comportamento muda (staff continua idêntico).
- Sem migration / Consent / collection / UI.

## Direção no codebase

- `src/utilities/ai/tools/getTopDeputies.ts` e `getMunicipalityVotes.ts`: adicionar o gate no `execute`.
- Registrar gate compartilhado? B177 inlinou try/catch no execute; se o padrão replicar em 3 tools, um helper `withElectionDataGate` pode valer — avaliar no momento (regra: 2 call sites = inline; 3+ = extrair; aqui já são 3 com a nova).
- Sem mudança no system prompt (já orienta leader a não receber links; o gate agora é enforcement).

## Já resolvido no simplify da B177 (não reabrir)

- Tool nova `getLeadingMunicipalities` já nasce com o gate (e `assertCanReadElectionData` também dentro do loader, defesa em profundidade).
- Guard de convenção `codebaseConventions` alargado para exigir `server-only` em quem importa `@payloadcms/db-postgres`.

## Explicitamente fora

- Flake de CI `testDatabaseLease.int.spec.ts` (consent restore sob int paralelo) — descartado no triage da B177 (S2); reavaliar se recorrer.
- Consertar `searchEntities`/outras tools não-eleitorais para leader (fora do escopo: só as eleitorais).
