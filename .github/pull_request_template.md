## O que é

<!-- 2–4 linhas: o que muda e por quê. Link do plano se houver. -->

Closes #<!-- número da Issue (claim) — omita em PRs que alteram só docs/plans/; use Related #N -->

## Contrato da entrega

- [ ] Fast gate local passou: `pnpm lint` (0 warnings), `pnpm exec tsc --noEmit`, `pnpm test:unit`
- [ ] `pnpm format:check` e `pnpm check:cycles` limpos
- [ ] Órfãos da mudança deletados na mesma entrega (knip em CI confirma)
- [ ] **Se tocou schema** (migration, collection, campo, Consent key, dado de boot): `db:seed:minimal` atualizado **neste PR** (`scripts/lib/seed-minimal-manifest.mjs` + pin unit) — senão a label `needs:migration` está errada
- [ ] Nenhum `DATABASE_URL`/`ALLOW_REMOTE_DB` de prod em script ou workflow
- [ ] Se muda o que o agente precisa saber sempre: `AGENTS.md`/kernels atualizados; entregas registram UMA entrada em `docs/changelog/<data>-<id>.md` + `pnpm changelog:build` (OPS44 — nunca editam `docs/CHANGELOG-AGENTS.md` na mão)
- [ ] Se o changelog perdeu linhas de propósito (restauração/header): `changelog-rewrite: <motivo>` no body deste PR

## Notas para review

<!-- Riscos, decisões, o que ficou de foro (registrar como Issue follow-up). -->
