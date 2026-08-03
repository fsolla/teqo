# Impl: Município v2 — ações secundárias no FAB

Status: aprovado
Atualizado em: 2026-08-03
Issue: #334
Intenção: docs/plans/municipio-v2-fab-secundario.md
Appetite restante: ~0,5 dia eng (herdado)

## Leitura da intenção

- **Outcome:** na rota v2, secundárias (dossiê, eleições, nova liderança, compositor de giros) alcançáveis via FAB B126, sem tab nav de 6 itens; papel respeitado; dobra de operação intacta; print/dossiê sem FAB.
- **O que NÃO negociar:** leader lockdown; não replicar wizard de operação no FAB v2; não omitir `print:hidden` do chassis; não duplicar segundo FAB; registrar sinal omitido (assunção A — select na faixa B147).
- **O que reavaliar:** hipótese de “integrar no chassis global” — confirmado: estender `resolveQuickActionsForPath` com superfície v2, não componente paralelo.

## Abordagem recomendada

```mermaid
flowchart LR
  V2Page["municipio/[slug]/v2/page.tsx"]
  Sync["CampaignQuickActionContextSync"]
  Registry["resolveQuickActionsForPath"]
  V2QA["resolveMunicipalityV2QuickActions"]
  Host["CampaignQuickActionsHost"]
  V2Page --> Sync
  Host --> Registry --> V2QA
  Sync --> Host
```

**Opções consideradas:**

|     | A — Reusar `resolveMunicipalityDetailQuickActions` (wizard) | B — Catálogo v2 dedicado de navegação secundária | C — Segundo FAB só na v2 |
| --- | ----------------------------------------------------------- | ------------------------------------------------ | ------------------------ |
|     | Já existe                                                   | Alinha com aceite (secundárias ≠ operação)       | Viola anti-goal          |

**Recomendação:** B — because v2 operational edits live in the status strip / future dobra; the old detail FAB ships wizard actions that would compete with B147–B150. A dedicated client-safe resolver returns navigation hrefs to existing surfaces.

**Rejeitadas:** A (wizard noise on v2). C (twin FAB).

### Componentes / mudanças

- **`campaignMunicipalityV2QuickActions.ts`** (`src/lib/`): `parseMunicipalityV2Slug`, `resolveMunicipalityV2QuickActions`, `resolveMunicipalityV2QuickActionsForPath`; links via `buildMunicipalityDetailTabHref`, `buildTourComposerHref` + catalog `region`, `/campanha/liderancas/nova?municipality=`.
- **`campaignQuickActionRegistry.ts`:** early branch for v2 path before plural `municipios` resolver.
- **`municipio/[slug]/v2/page.tsx`:** `CampaignQuickActionContextSync` with `municipalitySlug` + `municipalityId` from loader context.
- **Migration:** nenhuma.
- **Access / Consent:** staff-only via page gate `noLeader`; same as v2 shell.
- **UI:** Impeccable B — reuse B126 host; no new chrome. Print: existing `print:hidden` on FAB suffices when user opens dossier on old tab route.

### Catálogo FAB v2 (staff)

| id                       | label           | destino                                       |
| ------------------------ | --------------- | --------------------------------------------- |
| `municipality-dossier`   | Preparar visita | `/campanha/municipios/{slug}?tab=dossie`      |
| `municipality-elections` | Ver eleições    | `/campanha/municipios/{slug}?tab=elections`   |
| `new-leadership`         | Nova liderança  | `/campanha/liderancas/nova?municipality={id}` |
| `plan-tour`              | Planejar giro   | `/campanha/atividades/giros?region={TI}`      |

Omitido: `register-signal` (assunção A).

## Fases verificáveis

1. **Lib + registry** — resolver + unit tests.
2. **Page wire** — context sync on v2 RSC.
3. **Gates** — `pnpm gate:fast`; entrega via `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Cutover URLs (B152).
- Reescrever dossiê/eleições.
- Atualizações/demandas no FAB (rede/agora nas fatias B149–B150).
- `returnPath` de volta à v2 nos links do detalhe antigo.

## Riscos e mitigação

- **Slug singular vs plural:** parser dedicado `^/campanha/municipio/([^/]+)/v2$` — não colide com `municipios`.
- **Giros sem TI:** `buildTourComposerHref({ region: null })` se catalog miss (defensivo).

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto
- [ ] Invariantes AGENTS/engineering-standards
- [ ] Testes unitários do resolver v2

Self-score decision-quality: 4/5
