# Pinagem das superfícies de lista (Pass 2 — W0)

Status: **entregue** (Pass 2, 2026-07-25)
Atualizado em: 2026-07-25
Item pai: [IMPROVE-CODE-QUALITY-PLAN.md](../IMPROVE-CODE-QUALITY-PLAN.md) — Pass 2, W0 (GATE de W1)
Appetite: ~1 dia; sem migration, sem UI

## Contexto

W1 vai generalizar o sistema de listas e migrar todas as superfícies. A auditoria de safety net (2026-07-25) mostrou que só a lista de municípios está fortemente pinada (`municipalityUi` unit + `municipalityPageData` int). Os parsers de URL e loaders de apoiadores, planos, assessores, lideranças, organizações, dobradinhas e demandas estão fracos ou sem pin — refatorá-los sem pin é mudar comportamento sem rede.

## Escopo (conjunto mínimo de pinagem)

**Unit (parsers/href — contrato de URL byte-idêntico):**

- `campaignListUrl.ts` — canonicalização, param desconhecido ignorado, clamp de página, geração de href.
- `supporterUi.ts` — parse de URL (intenção de voto, território, busca) + hrefs.
- `actionPlanUi.ts` — default de tab, matriz tab→where, parse de filtros (kind/municipality).
- Um spec compartilhado para os 5 parsers simples de lista (advisor / leadership / organization / stateDeputy / demand) — hoje cada página tem um parser local de `first`/`page`/`q`.

**Int (5 smokes finos de loader — escopo, `q` vazia, shape da paginação):**

- `advisorData.ts`, `leadershipData.ts`, `organizationData.ts`, `stateDeputyData.ts`, `campaignDemandData.ts`.

**Truth-up de documentação (mesma entrega):**

- `TESTING.md`: contagens reais (41 unit / 46 int / 7 e2e), item do backlog do artefato eleitoral (entregue no Pass 1 fase 2) marcado, novo mapa de pin das listas.
- `TECH-DEBT.md`: "Praça" ~96 hits em 53 arquivos (não ~15); e2e 7 specs (não 5); resolver o conflito de status do C8 F4 (ledger diz "partially done", plano diz remainder aberto — o remainder É o W4d).

## Regras

- Bug achado durante a pinagem é **ledgerado, nunca corrigido silenciosamente** (o pin registra o comportamento atual).
- Sem refactor nesta entrega — só testes + docs.

## Impacto no roadmap

Nenhum item bloqueado; é o gate de W1 (que precisa terminar antes da janela 3, ~16/08).
