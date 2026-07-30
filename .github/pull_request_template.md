## O que é

<!-- 2–4 linhas: o que muda e por quê. Link do plano se houver. -->

Closes #<!-- número da Issue (claim) -->

## Contrato da entrega

- [ ] Fast gate local passou: `pnpm lint` (0 warnings), `pnpm exec tsc --noEmit`, `pnpm test:unit`
- [ ] `pnpm format:check` e `pnpm check:cycles` limpos
- [ ] Órfãos da mudança deletados na mesma entrega (knip em CI confirma)
- [ ] **Se tocou schema** (migration, collection, campo, Consent key, dado de boot): `db:seed:minimal` atualizado **neste PR** (`scripts/lib/seed-minimal-manifest.mjs` + pin unit) — senão a label `needs:migration` está errada
- [ ] Nenhum `DATABASE_URL`/`ALLOW_REMOTE_DB` de stage/prod em script ou workflow
- [ ] `pnpm build` NÃO aparece em workflow que carregue `STAGE_DATABASE_URL`
- [ ] Se muda o que o agente precisa saber sempre: `AGENTS.md`/kernels atualizados; entregas registram UMA entrada curta em `docs/CHANGELOG-AGENTS.md` (nunca no AGENTS.md)

## Notas para review

<!-- Riscos, decisões, o que ficou de foro (registrar como Issue follow-up). -->
