# OPS43: migration-lock do CI bloqueia PRs sem schema quando 2+ PRs com schema estão abertos

Status: registrado
Atualizado em: 2026-08-12
Issue: #723 (a registrar)

## Intenção

O check `migration-lock` do `ci-pr.yml` conta **todos os PRs abertos** que tocam `src/migrations/` ou `payload-types.ts` e falha quando o total é >1 — **inclusive para PRs que não tocam schema nenhum**. Observado em 2026-08-12: o PR #720 (OPS42, 100% test-infra, zero migrations) ficou `BLOCKED` por colateral — seus 12 checks próprios verdes, o merge só esperando o lock global segurar por 2+ PRs de schema (#709 C129 e #701 C115) que estavam travados entre si.

## Objetivo e aceite

- Um PR **sem** mudanças em schema passa no `migration-lock` independente de quantos PRs com schema estão abertos.
- A serialização entre PRs com schema permanece (a proteção original: no máximo 1 cadeia de migração aberta).
- Aceite verificável: com 2 PRs de schema abertos, um PR de teste/UI (sem schema) fica `MERGEABLE`; e um PR de schema continua `BLOCKED` quando outro PR de schema está aberto.

## Dados (intenção)

N/A — CI workflow.

## Direção no codebase (hipótese)

- `ci-pr.yml`, job `migration-lock`: hoje conta o total global e falha se `count > 1`. Deve falhar **só quando o PR que dispara o workflow** toca schema **e** o total global é >1 (ou alternativamente: falhar quando `count > 1` **e** o PR atual está no conjunto). A forma exata (jq com `github.event.pull_request` + o mesmo `test`) fica para o impl.

## Dependências

- Nenhuma (não depende do OPS42; observado na sessão dele).

## Fora de escopo

- Repensar o mecanismo de serialização em si (fila, lock por milestone etc.) — o fix mínimo restaura a intenção do guard.
- PRs antigos de schema já abertos.

## Rabbit holes

- **Blindar demais:** deixar 2 PRs de schema mergearem por corrida (o guard global pega ambos no push-time). **Corte:** o fix condiciona a falha ao PR atual tocar schema — o guard original segue intacto para quem toca schema.

## Questões em aberto

- Nenhuma — infra de CI.

## Referências

- `ci-pr.yml` job `migration-lock` (falha global `count > 1`).
- PR #720 observado `BLOCKED` com checks próprios verdes (2026-08-12 00:30–01:05 UTC-3).
