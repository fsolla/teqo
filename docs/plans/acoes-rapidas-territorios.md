# Ações rápidas — Territórios de Identidade

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B81**)
Impeccable: B — catálogo no drawer B79 para `/campanha/territorios`
Appetite: ~0,25–0,5 dia eng; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · B21 ✓ / E12 ✓ · B79.

Na implementação: craft compacto → critique → polish + **Revisão na implementação** (abaixo).

Brief: staff olhando TIs quer ou filtrar municípios da região ou iniciar ritual sem voltar ao Início. Restrained. Anti-goal: fingir que TI é município no `?municipio=`.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

`/campanha/territorios` (B21) é lista regional; linha → `municipios?region=`. Sem entidade “município atual”.

## Objetivos

- Catálogo sugerido: ações Início **sem** prefill de município + atalho “Ver municípios deste TI” quando houver linha/seleção _(se a UI expuser TI ativo; senão só ações Início)_.
- Sem inventar wizard de TI.
- Sem migration.

## Revisão na implementação _(obrigatória)_

Agente pode reordenar/cortar ações se, no momento do implement, o uso real de Territórios for só “pular para lista filtrada” — documentar desvio.

## Decisões travadas

- **Sem `?municipio=` a partir do TI.** **Rejeitado:** pegar “primeiro município do TI” como prefill (mentira geográfica).
- **i18n:** ids B45 + `territory-municipalities` se nascer atalho.

## Questões em aberto

- **Atalho por TI exige seleção de linha?** **Opções:** A) só ações Início na v1 | B) expandir drawer ao tocar linha com atalho. **Recomendação:** **A** neste appetite.

## Abordagem proposta

Registry path `/campanha/territorios` → catálogo staff Início (hrefs B45). Opcional: deep-link `buildMunicipalityListHref({ region })` se contexto de TI existir.

## Dependências

Dura: **B79**. Soft: B21 ✓, B45 ✓.

## Não escopo

Chassis → B79. Municípios → B80.

## Rabbit holes

**Agregar ações “por TI” com meta/cobertura.** Mitigação: fora — E12 já está na tabela.

## Adiado com gatilho

Nenhum neste item.

## Referências

`territorios/page.tsx` · `municipalityListUrl` · B79 plan
