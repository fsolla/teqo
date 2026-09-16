# OPS: knip local quebra com o importMap (artefato gitignored) no working tree

Status: rascunho
Atualizado em: 2026-09-16
Issue: a registrar — OPS124
Priority: P3
Impeccable: A — sem UI
Appetite: ~30 min eng; sem schema, sem deploy

## Intenção

`pnpm knip` falha localmente com `ERROR: Error loading src/payload.config.ts (This module cannot be imported from a Client Component module. It should only be used from a Server Component.)` quando `src/app/(payload)/admin/importMap.js` existe no working tree — artefato gitignored gerado por `pnpm predev`/build (OPS99), que `knip.json` ainda lista em `entry`. Sem o artefato, o knip completa (com os 2 unresolved imports esperados de `[[...segments]]`). No CI o knip roda antes do build (sem o artefato) e passa — confirmado no run `35099887216`; reproduzido idêntico no worktree `main` (`/home/fsolla/Code/teqo`), então **não é regressão de entrega nenhuma**. Efeito: `pnpm push`/`gate:ci` local quebra depois de rodar dev.

## Fases verificáveis

1. **Diagnóstico + fix** — decidir entre remover `src/app/(payload)/admin/importMap.js` do `entry` do `knip.json` (o arquivo é artefato de build; os unresolved imports de `[[...segments]]` apontam para um artefato inexistente) ou `ignore`-á-lo com justificativa. Provar: `pnpm predev` (gera o artefato) → `pnpm knip` verde; e `pnpm knip` verde sem o artefato.
2. **Gate** — `pnpm gate:fast` + `pnpm push`; sem tocar no pipeline de CI (o CI já passa).

## Já resolvido no simplify/critique (não reabrir)

- Confirmado que o erro é pré-existente e independente do C178 (mesmo erro em `main` com o artefato presente).

## Explicitamente fora

- Mudar a ordem do CI (knip antes do build já é o caso).
- Commitar o `importMap.js` (OPS99 proíbe; é artefato de build).
- Qualquer outra limpeza de `knip.json`.

## Self-score (decisão)

4/5 — fix barato e reversível, causa-raiz nomeada, prova verde clara, sem risco de produção.
