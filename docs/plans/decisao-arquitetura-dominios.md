# Decisão de arquitetura: domínios vs camadas (Pass 2 — W2)

Status: **entregue** (Pass 2, 2026-07-25) — veredito D1 assinado: NO-GO no reorg, GO em convenções + correções de fronteira
Atualizado em: 2026-07-25
Item pai: [IMPROVE-CODE-QUALITY-PLAN.md](../IMPROVE-CODE-QUALITY-PLAN.md) — Pass 2, W2
Appetite: ~1,5 dia

## Pergunta

O layout layer-first (`collections/ → utilities/ → components/ → app/`) deve virar domain-first (`src/domains/{municipality,supporter,...}/`), possivelmente com ports-and-adapters? Avaliação corrida contra `domain-driven-design`, `clean-architecture` e `software-design-philosophy`.

## Veredito (D1, assinado 2026-07-25)

**NO-GO no `src/domains/` reorg e no ports-and-adapters. GO em: (a) convenções documentadas e endurecidas; (b) correções mecânicas de fronteira; (c) subpastas por domínio DENTRO da camada `components/campaign/` (por etapas); (d) subpastas em `utilities/` adiadas com gatilho.**

Racional registrado (alternativas rejeitadas):

- **`src/domains/` rejeitado:** Payload collections JÁ SÃO o modelo de domínio — a "camada de domínio" real vive em `src/collections/` + `src/utilities/access/` e não pode sair de lá (importmap do admin, convenções do framework). Um big-bang move de ~230 arquivos congela o repo no meio da janela 1–2 do calendário eleitoral e arrisca o importmap gerado. O ganho (navegação) é obtido com subpastas within-layer por fração do risco.
- **Ports-and-adapters rejeitado:** só há um adapter de verdade (Payload/Postgres) e um framework (Next). Interfaces na frente do Payload Local API duplicariam a assinatura de cada query sem segundo backend plausível — abstração especulativa (SDP: shallow module).
- **Aceito do DDD:** mapa de bounded contexts + linguagem ubíqua (glossário) — vão para `docs/ARCHITECTURE.md` (W3) independentemente do veredito; os prefixos de domínio (`municipality*`, `supporter*`, …) são a expressão within-layer disso.

## Correções de fronteira (parte mecânica desta entrega)

1. **9 inversões `lib/`→`utilities/`:** mover os helpers puros (`phone`, `slug`, `wordStartFilter`, validadores de `voteEstimate`, chave de consent do invite) de `utilities/` para `lib/` — `lib/` = puro/client-safe, `utilities/` = acoplado a Payload/Next (regra já escrita, agora cumprida).
2. **21 loaders sem `server-only`:** marcar (`actionPlanPageData`, `campaignDashboardData`, os `*Data.ts` de lista, etc.).
3. **Sidebar client importando o barrel de access:** `nav.ts` para de importar `campaignAccess` (85 exports, incl. helpers Payload); predicados de role client-safe num módulo de contrato (mesmo padrão de `municipalityMapContract.ts`).
4. **Ciclo de tipos `supporterListFilters.ts` ↔ `supporterUi.ts`:** quebrar movendo o tipo compartilhado para um dos lados (ou módulo de tipos).
5. **`votePledgeData.ts`:** separar views puras dos loaders Payload (padrão contract-module), destravando importação client-safe dos tipos de cenário.

## Subpastas por domínio em `components/campaign/` (por etapas)

106 arquivos flat é a pior dor de navegação do repo. Mover por domínio (`municipality/`, `actionPlan/`, `supporter/`, `leadership/`, `advisor/`, `demand/`, `map/`, `shared/`…), **uma entrega `git mv` por domínio em momento calmo** (branch curta, conflito improvável), imports atualizados por codemod + `tsc`. `utilities/` (92 arquivos) fica adiada: gatilho = quando um domínio ganhar o 3º módulo novo num mesmo mês, subpasta desse domínio junto.

## Impacto no roadmap

Nenhum item bloqueado (moves per-domain em branches curtas); navegação de agente melhora para todo item futuro. Sem migration, sem mudança de comportamento — apenas `git mv` + imports + marcações `server-only` (podem revelar violações latentes de client boundary; cada uma é corrigida ou documentada, nunca silenciada).

## Referências

- `.agents/rules/engineering-standards.mdc` (regra lib/utilities), AGENTS.md (estrutura), auditoria de fronteiras 2026-07-25
- `src/utilities/campaignAccess.ts` (precedente de split within-layer com re-export surface)
