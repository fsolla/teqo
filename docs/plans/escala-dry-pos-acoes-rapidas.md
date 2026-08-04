# Escala/DRY pós-B86 — normalização de pathname de lista nas ações rápidas

Status: rascunho
Atualizado em: 2026-08-03
Issue: —
Prioridade: P2
Item do roadmap: débito do lote B80–B90 (colhido no `/simplify` de B86, triage aprovada)
Model: composer-2.5
Impeccable: A — refactor só-backend (client-safe), sem mudança de comportamento
Appetite: ~0,25–0,5 dia eng; sem migration

## Problema

O conhecimento de "normalizar pathname de lista (match exato + trailing slash)" está
duplicado em **6+ módulos** da família de ações rápidas:

- `isAdvisorsListPath` (`src/lib/campaignAdvisorQuickActions.ts`)
- `isDemandsListPath` (`src/lib/campaignQuickActionDemands.ts`)
- `isStateDeputyListPath` (`src/lib/campaignQuickActionDobradinhas.ts`)
- `isConceptsPath` / `isProfilePath` (`src/lib/campaignReferenceQuickActions.ts`)
- `isLeadershipListPath` (`src/lib/campaignQuickActionLeadership.ts`)
- `isSupportersListPath` (`src/lib/supporterQuickActions.ts` — B86)

E `src/lib/campaignQuickActionPaths.ts` já existe como home da família de path helpers
client-safe, com um `normalizePathname` **privado** fazendo exatamente o mesmo trabalho
(só usado pelos parsers de superfície activity/organization).

## Escopo

- Extrair helper compartilhado (ex. `isListPath(pathname, home)` e/ou
  `normalizePathname` exportado) em `src/lib/campaignQuickActionPaths.ts`.
- Migrar os 6+ call sites acima para o helper; manter exports públicos de cada módulo
  (`isXListPath`) para não quebrar specs/registry — os wrappers delegam.
- Se natural, derivar as regex de detalhe numérico da constante de home
  (`escapeRegExp`) — só se o diff ficar limpo; caso contrário, registrar como fase 2
  com gatilho (3º vertical com `[id]` numérico — hoje são 2: advisor + supporter).
- **Não** mexer nos parsers de superfície activity/organization além de reusar o
  `normalizePathname` exportado (mesma lógica, menos duplicação).

## Já resolvido no simplify (não reabrir)

- Pins de teste do B86 (trailing-slash no registry, `/abc` → `[]`, mount staff em
  `/apoiadores` e não-leader) — aplicados na sessão B86.

## Explicitamente fora (deste lote)

- **S2** naming polarity `import-supporters` × `SUPPORTER_IMPORT_HREF` — descartado
  (batch plural intencional; score 2).
- **S3** regex aceita `042` — descartado (espelha `parseAdvisorDetailId`; consistência).
- **S4** caso advisor direto no spec do módulo — descartado (coberto via registry).
- **S5** quirks de regex (nested tail, dígitos ilimitados, id≤0) — descartados
  (espelham siblings).
- **S6** extrair regex numérica em 2 sites — **defer com gatilho**: 3º vertical com
  `[id]` numérico.
- **S7** cache `Map<CampaignRole>` em 3 sites — **defer com gatilho**: 4º site com
  shape compatível (advisor/supporter/home divergem em gate e construção).
- **S8** id `register-supporter` sobrecarregado (leader × staff) — **defer com
  gatilho**: se algo agregar catálogos ou assert de unicidade global de id.

## Fases verificáveis

1. Helper compartilhado em `campaignQuickActionPaths.ts` + migração dos 6+ call sites.
2. `pnpm gate:fast` (unit cobre todos os módulos tocados) + `pnpm push`.

## Rabbit holes

- Renomear `isXListPath` nos specs — os wrappers mantêm o contrato, specs intactos.
- Tocar comportamento (ex. normalizar pathname em vez de comparar os dois spelling) —
  refactor é puramente estrutural; comportamento idêntico.

## Riscos e mitigação

- 6+ call sites = risco de diff ruidoso — wrappers delegando mantêm o diff mínimo.
- Algum matcher depende da ordem exata dos `===` — unit specs existentes pinam cada
  módulo; rodar `test:unit` completo no gate.
