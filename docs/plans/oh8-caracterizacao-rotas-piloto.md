# OH8 — Caracterização das rotas piloto (detalhe município + listas-chave)

Status: rascunho
Atualizado em: 2026-08-01
Issue: #170
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (só testes)
Appetite: ~1 dia eng
Depends: OH1, CL3
Responsável: —

## Premissas

1. CL3 já provou a factory em municípios — caracterizamos o comportamento **novo**, não código que vai morrer.
2. Nenhuma linha de produção muda nesta issue: só specs.

→ Corrija agora ou sigo com estas.

## Objetivos

- Pins de caracterização para o que OH9/OH12 vão tocar: detalhe de município (header, tabs, painel de pledges, link `/editar`, a11y do painel) e 2 listas-chave via factory (municipios + liderancas: header, filtros, paginação, empty state).
- Specs verdes em `main` antes de qualquer refactor.

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

- **`tests/int/municipalityDetailCharacterization.int.spec.ts`** (novo): view model do detalhe (nome, kind badge, geography label, assessores, `lastUpdateAt`), painel de pledges (totais por cenário, faixa), tabs resolvidas.
- **`tests/e2e/campaignMunicipalityDetail.characterization.e2e.spec.ts`** (novo ou extensão da existente): header visível, tab default, painel pledges com `PledgeEstimateForm` para staff, link `/editar` visível a staff e ausente a leader.
- **Listas:** reaproveitar specs existentes como baseline — adicionar 2–3 asserts de caracterização de shell (título, search, paginação) na spec e2e de municípios e lideranças se faltarem.

## Fases verificáveis

### Fase 1 — Tracer: pins detalhe

- **Quota:** ~0,6
- **Aceite:**
  - [ ] int spec do detalhe verde em main
  - [ ] e2e caracterização verde em main (staff e leader)
- **Verify:** `pnpm gate:fast` + specs novos
- **Files:** os dois specs
- **Tamanho:** M

### Fase 2 — Pins listas-chave

- **Quota:** ~0,4
- **Aceite:**
  - [ ] asserts de shell presentes nas specs e2e de municipios e liderancas
- **Verify:** `pnpm gate:fast` + e2e
- **Files:** specs e2e existentes (edição)
- **Tamanho:** S

## Dependências

- OH1, CL3 (factory provada — os pins cobrem o JSX que OH12 vai reutilizar).

## Não escopo

- Refactor de views (OH9/OH12). Novas funcionalidades.

## Rabbit holes

- **Caracterizar tudo.** Pins no que OH9/OH12 tocam — o resto já tem cobertura.
- **Duplicar specs existentes.** Estender onde já existe e2e do domínio.

## Referências

- [`src/app/(campaign)/campanha/(app)/municipios/[slug]/page.tsx`](<src/app/(campaign)/campanha/(app)/municipios/[slug]/page.tsx>)
- [`tests/e2e/campaignMunicipalities.e2e.spec.ts`](tests/e2e/campaignMunicipalities.e2e.spec.ts)
- [`tests/int/municipalityPageData.int.spec.ts`](tests/int/municipalityPageData.int.spec.ts)
