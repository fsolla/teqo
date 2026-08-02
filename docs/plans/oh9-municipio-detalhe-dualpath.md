# OH9 — Detalhe de município dual-path (views + Local + OfflineBoundary)

Status: entregue (PR)
Atualizado em: 2026-08-02
Issue: #172
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — mesma rota `/campanha/municipios/[slug]`, fallback Local offline
Appetite: ~2–3 dias eng
Depends: OH8, OH5
Responsável: —

## Freshness audit (2026-08-02)

- OH5 (#168) e OH8 (#170) `done`+`in-prod`. Provider expõe `useOpsOffline()`; collections mirror em `opsMirrorClient` (`municipalitiesCollection`, `votePledgesCollection`; `leadershipsCollection` exportada neste lote).
- Página detalhe intacta em `[slug]/page.tsx` (header inline); pins OH8 em `municipalityDetailCharacterization.int.spec.ts` + e2e characterization.
- **Sem `@tanstack/react-db`:** só `@tanstack/db@0.6.17`. Local usa `subscribeChanges` nas 3 collections (sem dep nova — Ask first do OH1).
- Snapshot **não** inclui `campaignUser` — Local usa “Assessoria: indisponível offline” quando há advisor IDs.
- Rota já tem `gate: 'noLeader'`; Local é staff-only na prática; pledges Local reusam `MunicipalityPledgesPanel` + outbox OH6.
- E2e airplane: ficheiro novo `campaignOpsOffline.e2e.spec.ts` (OH11 alarga depois); skip sem `OPS_HYBRID` como OH6.

## Premissas

1. Pins de caracterização (OH8) verdes antes de extrair views.
2. SSR/primeiro paint **sempre** RSC; Local só renderiza com `OPS_HYBRID` ON + offline.
3. Sem mini-router: `OfflineBoundary` declarado só nesta rota no v1.

→ Confirmadas; sigo.

## Objetivos

- Presentational extraído: `MunicipalityDetailHeaderView` (+ painel de pledges por props) partilhado entre RSC e Local.
- `MunicipalityDetailLocal` lê do mirror (município + pledges + leaderships via joins `useLiveQuery`).
- `OfflineBoundary` na rota: offline + flag → Local; senão → RSC actual.
- Regiões online-only (mapa/TSE, tabs pesadas) mostram estado honesto offline.

## Dados → decisão → apresentação

Dados: N/A — mesma superfície de dados; fonte alternativa offline.

## Abordagem proposta

```mermaid
flowchart LR
  Page[[slug]/page.tsx RSC] --> Bound[OfflineBoundary]
  Bound -->|online / SSR| RSC[Header RSC + tabs actuais]
  Bound -->|offline + flag| Local[MunicipalityDetailLocal]
  Local --> Q[useLiveQuery municipalities/pledges/leaderships]
  Q --> HeaderView[MunicipalityDetailHeaderView]
  RSC --> HeaderView
```

Componentes:

- **`src/components/campaign/opsSync/OfflineBoundary.tsx`** (novo): SSR sempre children; após mount, `OPS_HYBRID` + `navigator.onLine === false` → fallback. Falha de sync **não** troca para Local (chrome cobre).
- **`src/components/campaign/municipality/MunicipalityDetailHeaderView.tsx`** (extração): recebe `view` + `advisorSummaries` por props — o JSX actual do header (h1, `Badge` de kind, `formatMunicipalityGeographyLabel`, linha “Assessoria/Última atualização”).
- **`src/components/campaign/municipality/MunicipalityDetailLocal.tsx`** (novo). Mapeamento mirror → view (travado):
  - **Header:** alimentado pelo DTO `OpsMunicipality` (nome, `kind`, geography, advisors ids, `lastUpdateAt`) — `toDetailHeaderView(municipalityDto)` (helper puro novo em `src/lib/campaignOps/`); `advisorSummaries` vêm da collection `campaignUsers`/advisors do mirror quando presente; se ausente → linha “Assessoria: indisponível offline”.
  - **Pledges:** join `votePledges` × `leaderships` do mirror via `subscribeChanges` (sem `@tanstack/react-db`) → mesmo shape de props do painel (`declaredVotes`, faixa de estimativa para staff). Liderança nunca vê `estimatedVotes` — o Local **não monta** o painel de estimativa para role leader (view model por papel, igual ao RSC).
  - **Online-only (mensagem honesta, não crash):** tabs (Visão geral/Tarefas/Atualizações), updates feed, dossiê eleitoral/TSE, mapa. Renderiza placeholder pt-BR: “Disponível quando estiveres online.”
- **Page** (alterado): envolve o conteúdo actual com `OfflineBoundary` passando `fallback={<MunicipalityDetailLocal slug={slug} />}`.

## Fases verificáveis

### Fase 1 — Tracer: extração presentational (pins passam)

- **Quota:** ~0,4
- **Entrega:** header extraído; RSC renderiza pela view nova; pins OH8 verdes.
- **Aceite:**
  - [x] `pnpm gate:fast` + pins caracterização verdes
  - [x] diff visual zero (check manual)
- **Verify:** gate + specs OH8
- **Files:** `MunicipalityDetailHeaderView.tsx`, page
- **Tamanho:** M

### Fase 2 — Local + boundary offline

- **Quota:** ~0,6
- **Entrega:** `MunicipalityDetailLocal` + `OfflineBoundary` ligados; e2e airplane.
- **Aceite:**
  - [x] online: Network mostra Flight; UI igual
  - [x] offline (flag ON): header + pledges do mirror; empty state fora do mirror
  - [x] tabs/regiões online-only com mensagem honesta (não crash)
  - [x] leader nunca vê `estimatedVotes` (view model por papel mantido no Local)
- **Verify:** `pnpm gate:fast` + `tests/e2e/campaignOpsOffline.e2e.spec.ts`
- **Files:** Local, boundary, page, spec e2e
- **Tamanho:** M

## Dependências

- OH8 (pins), OH5 (mirror). Reusa view models de [`municipalityPageData.ts`](src/utilities/municipality/municipalityPageData.ts) como forma de referência.

## Não escopo

- Listas Local (OH12). Outras rotas detalhe. Patch do mirror com props RSC.

## Rabbit holes

- **Boundary genérico para todas as rotas já.** Só detalhe — generalizar vem com OH12 (listas) e prova.
- **Hidratar Local com props RSC.** Drift. **Mitigação:** mirror só por sync/writes.

## Referências

- [`src/app/(campaign)/campanha/(app)/municipios/[slug]/page.tsx`](<src/app/(campaign)/campanha/(app)/municipios/[slug]/page.tsx>)
- [`src/components/campaign/municipality/MunicipalityPledgesPanel.tsx`](src/components/campaign/municipality/MunicipalityPledgesPanel.tsx)
- OH5 (mirror), OH8 (pins)
