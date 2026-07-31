# Escala e DRY pós-B68 (sugestões na busca aberta)

Status: **absorvido em O0+ (#35)** — 2026-07-31
Atualizado em: 2026-07-31
Issue: #39 (fechada) → fases vivas em [escala-dry-pos-onda0.md](escala-dry-pos-onda0.md) (§ Absorvido de B68+)
Priority: P2
Model: kimi-k3-low

## Motivo da absorção

Consolidação humana (project-status 2026-07-31): mesmo domínio/prio heurístico (escala dry/P2) e **mesmo `model: kimi-k3-low`**. A regra de merge era: só consolidar se a complexidade de modelo não subir — aqui permanece Kimi K3 (simplify/DRY).

Não reabrir este plano; trabalhar as fases B68-F1/F2 no plano consolidado O0+.

## Referência histórica (pré-merge)

O `/simplify` de B68 mediu que, no Início staff (coordenador/candidato), cada focus do empty-state dispara POST que repete `loadMunicipalityScope` + `loadMunicipalityGoalCoverageBundle` já pagos no RSC. Mitigação: embed `initialSuggest` no mesmo request da página.

Detalhe completo das fases e rabbit holes: ver § Absorvido de B68+ em [escala-dry-pos-onda0.md](escala-dry-pos-onda0.md).
