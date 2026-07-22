# E12 — Camada Territórios de Identidade (rollups regionais com salvaguardas MAUP)

Status: rascunho
Atualizado em: 2026-07-21
Item do roadmap: [docs/roadmap.md](../roadmap.md) (seção "Inteligência de campanha", E12; plano-mestre [inteligencia-campanha.md](inteligencia-campanha.md))
Impeccable: B — agrupamento/rollup nas superfícies existentes (lista/overview, detalhe da Praça, mapa TI opcional); sem rota nova
Appetite: ~1,5 dia eng; sem migration (mapeamento praça→TI é estático)
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` (princípio 5) / `DESIGN.md` (register `product`) · `PlazaListOverview`, geometria `bahia-identity-territories.topo.json` (B2).

Na implementação: craft compacto → critique → polish.

- **Persona / contexto:** coordenador dividindo carteiras de assessores e preparando giro; "TI é a língua que o governo e o campo já falam".
- **Job principal:** ler o território em 27 unidades sem que a média regional esconda a praça crítica.
- **Estratégia de cor:** Restrained; rollup nunca aparece sem a decomposição a um clique.
- **Edit where you see:** não neste item (rollup é leitura; carteiras de assessor continuam por praça).
- **Anti-goals:** média regional decidindo alocação de praça (anti-goal 9); TI Metropolitano como uma linha entre 27; segundo agrupamento além de TI (Imediatas ficam adiadas).

## Contexto

Relatório §6.5: TI é a camada default de coordenação (decisões sobre gente e logística regional), com salvaguardas MAUP obrigatórias — razão dos agregados (nunca média das razões), agregado acompanhado de mediana+amplitude+praça crítica nomeada, Metropolitano sempre decomposto, malha congelada por ciclo, "praça manda no voto, TI manda na logística". Análises que só estabilizam no TI: balanço de portfólio, gap regional de captura, leitura da majoritária por TI, benchmark intra-TI (T4), sanity de metas. O repo já tem `bahiaTerritories.ts` (município→TI oficial) e a geometria dos 27 TIs (B2); `plaza.region` já existe no catálogo.

## Objetivos

- **Rollup por TI** sobre o bundle existente: votos em jogo, meta/cobertura (Σ), captura regional (Σ nominais ÷ Σ teto — razão dos agregados), nº de praças por classe/nível, praça crítica (pior déficit/frescor) nomeada, mediana e amplitude da captura.
- **Agrupamento na lista:** modo "por Território" na lista de Praças (grupos colapsáveis com o rollup no header do grupo) — mesma URL/filtros.
- **Benchmark intra-TI (T4):** no detalhe da Praça, comparação com a mediana do TI ("captura 2,1× a mediana do seu território") + praça-farol nomeada.
- **Metropolitano decomposto:** o grupo "Metropolitano de Salvador" sempre expande zonas SSA + municípios RMS; nunca agrega num número único sem breakdown visível.
- **Malha congelada:** constante de versão da composição TI usada no ciclo (já é estática em `bahiaTerritories.ts` — documentar como frozen 2026).
- Opcional barato (se couber no appetite): modo TI no mapa usando a geometria B2 (fills por rollup, mesmas escalas B13).

## Decisões travadas

- **TI como única camada regional do produto neste ciclo** (default operacional — relatório H4). **Rejeitado:** Regiões Imediatas IBGE como camada paralela (teste de sensibilidade fica manual/ad-hoc — G10 adiado); cluster empírico como camada operacional (instável e ilegível; vira exercício de auditoria única fora do produto).
- **Razão dos agregados, nunca média das razões** — regra de implementação com teste unit dedicado (divergência entre as duas contas exposta como alarme de heterogeneidade). **Rejeitado:** médias simples (a média que mente — §6.5).
- **i18n e naming:** `territoryRollup`, `computeTerritoryRollups`, `criticalPlaza`, `medianCapture`; labels pt-BR ("Território", "Praça crítica").

## Questões em aberto

- **Padrões T1–T3/T5 entram aqui ou no E11 fase 2?** Opções: avaliador TI neste item | tudo no motor. **Recomendação:** os rollups (insumo) aqui; os gatilhos T no E11 fase 2 — evita duplicar o mecanismo de sugestão.
- **Mapa TI na v1?** **Recomendação:** sim se sobrar ½ dia (geometria pronta, `BahiaMap` aceita features de TI); senão adiado com gatilho.

## Abordagem proposta

```mermaid
flowchart LR
    Bundle["loadPlazaListPageBundle"]
    Terr["bahiaTerritories.ts<br/>(município→TI, frozen 2026)"]
    Roll["computeTerritoryRollups<br/>(Σ, mediana, amplitude, crítica)"]
    List["PlazaList agrupada + headers de grupo"]
    Detail["benchmark intra-TI no detalhe"]
    Map["(opcional) fills TI no BahiaMap"]
    Bundle --> Roll
    Terr --> Roll
    Roll --> List
    Roll --> Detail
    Roll --> Map
```

Componentes:

- **`src/utilities/territoryRollup.ts`**: rollup puro sobre as linhas do bundle + derivados E8; salvaguardas como invariantes testadas (razão de agregados, Metropolitano flagged).
- **`PlazaList.tsx`**: modo de agrupamento (param `?group=territorio`) com headers de grupo; `PlazaListOverview` ganha corte por TI quando agrupado.
- **Detalhe da Praça:** linha de benchmark no card de baseline (reusa `PlazaBaselineCard`).
- **Mapa (opcional):** `bahiaTerritoryGeometries.ts`/`getTerritoryFeature` já existem; modo TI colore os 27 polígonos pelo rollup.
- **Sem migration.**

## Dependências

- Dura: **E8** (captura/meta/cobertura por praça para agregar). Suaves: E9 (agrupamento compõe com as colunas da fila), E14 (nível no rollup), B13 (escalas do mapa TI).
- Reusa: `bahiaTerritories.ts`, `bahiaTerritoryGeometries.ts`/`bahiaGeometries.ts` (B2), bundle A9+.

## Não escopo

- Gatilhos T1–T5 como sugestões (E11 fase 2); malha Regiões Imediatas (G10 — adiado no plano-mestre); carteiras de assessor como entidade (continua `plaza.advisors`); qualquer edição em nível TI.

## Rabbit holes

- **Rollup virar segunda página de analytics.** É um agrupamento da lista + números no header — não um dashboard regional novo.
- **Zonas de Salvador no rollup do Metropolitano.** As 19 Praças-zona têm `region` = Metropolitano; agregar por soma funciona, mas o breakdown obrigatório precisa listar zonas E municípios RMS separados — não "resolver" juntando tudo.
- **Comparação entre TIs virar ranking público.** Mesmo risco de gaming do benchmark (T4-contraindicação): benchmark é para aprender mecanismo, não régua punitiva — copy da UI reflete isso.

## Adiado com gatilho

- **Mapa TI** (se não couber na v1). Gatilho: primeiro giro regional planejado com o mapa municipal se mostrando insuficiente.
- **Teste de sensibilidade TI×Imediatas.** Gatilho: decisão cara sustentada por leitura regional divergente (§6.5 salvaguarda 4).

## Referências

- `docs/roadmap.md` (Inteligência de campanha, E12) · [plano-mestre](inteligencia-campanha.md)
- `docs/research/relatorio-entrevista-persona-campanha.md` §6.5 (veredito TI, análises, T1–T5, salvaguardas MAUP)
- `src/lib/bahiaTerritories.ts`, `src/lib/bahiaTerritoryGeometries.ts`, `src/lib/geometries/bahia-identity-territories.topo.json` (B2)
- `src/components/campaign/PlazaList.tsx`, `PlazaListOverview.tsx`, `PlazaBaselineCard.tsx`, `src/utilities/plazaPageData.ts`
- AGENTS.md — B2 as-built, naming
