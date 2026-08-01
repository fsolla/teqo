# CL8 — Contrato, saved filters, cleanup e decisão de canonical redirect

Status: rascunho
Atualizado em: 2026-08-01
Issue: #162
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI nova; pins e limpeza)
Appetite: ~1 dia eng
Depends: CL4, CL5, CL6, CL7
Responsável: —

## Premissas

1. Todas as 8 listas v1 já migraram (CL3–CL7) com flag.
2. Demandas e organizações entraram com `canonicalRedirect: false`.

→ Corrija agora ou sigo com estas.

## Objetivos

- Pin estrutural: todo slug `status: 'v1'` do registry corresponde a uma rota real que delega à factory; saved filters municípios intactos.
- Decisão medida sobre canonical redirect em demandas/organizações (implementar se < 0,5d/domínio; senão documentar como adiado com gatilho).
- Código morto removido (componentes/páginas substituídos); docs actualizados.

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

- **`tests/unit/opsListRegistryRoutes.unit.spec.ts`** (novo): para cada slug v1, existe ficheiro de rota e a page referencia `OpsListPage`/`resolveListUnifiedEnabled`.
- **Saved filters:** e2e de criar/aplicar/apagar em municípios com flag ON; sidebar `MunicipalityNavSavedFilters` intacta (não importa serializador novo).
- **Canonical redirect (demandas/organizações):** medir custo de `resolve<Domain>ListUrl` (parse já existe; redirect segue padrão de `resolveLeadershipListUrl`). Se ≤ 0,5d por domínio: implementar + pins; senão: doc “Adiado com gatilho” no registry (`canonicalRedirect: false` permanece).
- **Cleanup:** `pnpm exec knip` (exports/ficheiros órfãos das tabelas antigas), `pnpm check:cycles`, remover componentes substituídos (ex.: versões antigas de `AdvisorsTable`).
- **Docs:** entrada curta em `docs/CHANGELOG-AGENTS.md` + nota no plano-mãe.

## Fases verificáveis

### Fase 1 — Pins de contrato

- **Quota:** ~0,4
- **Aceite:**
  - [ ] spec slug↔rota verde
  - [ ] e2e saved filters municípios verde com flag ON
- **Verify:** `pnpm gate:fast` + e2e saved filters
- **Files:** `tests/unit/opsListRegistryRoutes.unit.spec.ts`, e2e existente
- **Tamanho:** S

### Fase 2 — Redirect (se barato) + cleanup + docs

- **Quota:** ~0,6
- **Aceite:**
  - [ ] redirect implementado ou adiado documentado (com gatilho) por domínio
  - [ ] `pnpm exec knip` sem novos erros; 0 ciclos
  - [ ] CHANGELOG actualizado
- **Verify:** `pnpm gate:fast` + `pnpm exec knip` + `pnpm check:cycles`
- **Files:** parsers (se implementado), docs
- **Tamanho:** M

## Dependências

- CL4–CL7. Reusa padrão `resolveLeadershipListUrl` para o redirect medido.

## Não escopo

- Generalizar saved filters para outros domínios (B18 futuro). Atividades.

## Rabbit holes

- **“Aproveitar” para generalizar saved filters.** B18 é projecto próprio (sidebar purity, `lib/listQueryMatch`). **Mitigação:** fora.
- **Apagar componentes “parecidos” sem knip + grep.** Verificar cada remoção com `git grep -w <symbol>` antes (regra do repo).

## Referências

- [`src/utilities/municipality/municipalitySavedFilters.ts`](src/utilities/municipality/municipalitySavedFilters.ts)
- [`src/lib/listQueryMatch.ts`](src/lib/listQueryMatch.ts)
- [`src/utilities/leadership/leadershipListUrl.ts`](src/utilities/leadership/leadershipListUrl.ts)
- [`docs/CHANGELOG-AGENTS.md`](docs/CHANGELOG-AGENTS.md)
