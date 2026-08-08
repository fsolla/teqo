# Purge de resíduo de assessores nos fixtures de município (OPS19)

## Objetivo

`purgeMunicipalityResidue` (`tests/helpers/campaignFixtures.ts`) limpa pledges/updates/demandas/lideranças/apoiadores/atividades no claim de um município, mas **não limpa `municipality.advisors`** (hasMany na própria linha do município). Um run da suite int interrompido no meio de um spec que atribui assessores deixa o resíduo, e o próximo run da suite completa flaka nos specs de cap: "Cada município aceita no máximo 10 assessores" dispara no índice < 10 do loop de setup.

## Contexto (repro observado em 2026-08-08)

- `tests/int/campaignMunicipalityAdvisorMembership.int.spec.ts` (dois describes) falhou 2× num run completo da suite após resíduo pré-existente; o mesmo spec isolado passou (o claim de run seguinte purgeia o resíduo dos demais coletores — mas não advisors).
- Com agentes em paralelo (worktrees/envs isoladas, ver `scripts/lib/worktree-env.mjs`), runs interrompidos ficam mais prováveis: um run morto por agente diferente pode envenenar `teqo_test` compartilhado ou o `teqo_wt<slot>_test` próprio.
- Alocação é por sequência sobre o catálogo seedado — o município alocado pode conter advisors de um run morto anterior.

## Direção suave

- No claim, estender `purgeMunicipalityResidue` para limpar a relação `municipality.advisors` do município recém-alocado (padrão dos demais coletores: batch `payload.find` + update/SQL em transação).
- Não remover os `campaignUser` advisor órfãos por padrão: os fixtures já rastreiam contas criadas para cleanup no fim do spec; o resíduo que envenena é a RELAÇÃO no município.
- Não tocar na lógica de cap (`relationMembershipDelta` / `nextAdvisorIdsAfterMembership`) nem no allocator — só no purge.

## Aceite

- `pnpm test:int` completo (75 files) verde mesmo quando um run anterior foi morto no meio de `campaignMunicipalityAdvisorMembership.int.spec.ts` (repro: matar o run após atribuir ≥1 assessor e rodar a suite inteira de novo).
- Specs de cap continuam passando isolados e em suite.
- Sem migration, sem mudança de produto/RBAC.

## Appetite

~meio dia (mudança localizada em fixture helper; risco baixo).
