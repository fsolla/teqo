# Escala e DRY pós-C2 (apoiadores + listas)

Status: implementado e mesclado em `main` (2026-07-19)
Atualizado em: 2026-07-19
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha C, item C6)
Responsável: —

## Contexto

O C2 ([cadastro-nominal-apoiadores.md](cadastro-nominal-apoiadores.md)) entregou a engenharia do cadastro nominal: collection `supporter`, actions de create/intenção/import/remover, UI em `/campanha/apoiadores`. A terceira passagem de `/simplify` (2026-07-18) limpou dead code e churns baratos, mas **deixou de fora** refactors e ganhos de escala que os revisores marcaram como importantes e fora do escopo de “cleanup pontual”:

1. Extrair shells compartilhados com a lista de núcleos (`nucleusUi` / `NucleusFilters` / `NucleusPagination`).
2. Unificar `fieldError` / mapeador de erro de form actions (hoje clone de leadership).
3. Import CSV em massa com insert via drizzle + bypass do invariante de telefone quando o caller já segura os locks.
4. Preview/confirm sem round-trip de até 5k linhas na action.
5. KPIs da lista com um único agregado SQL em vez de 3× `count`.
6. UX alinhada: `StrictCombobox` no município do create e `AlertDialog` no “Remover dados”.

Este plano é o registro canônico desses follow-ups. Sem ele, a base nominal funciona para volume baixo, mas o import de 5k linhas e o DRY com núcleos ficam como dívida implícita.

## Objetivos

- Listas de núcleos e apoiadores compartilham primitivos de URL/paginação/filtro e helpers de form error, sem regressão nas rotas já entregues.
- Import CSV de até `MAX_IMPORT_ROWS` (5000) completa dentro do timeout Vercel/DB, com locks de telefone corretos e sem N× hooks redundantes em `Contact`.
- Preview/confirm não serializam o conjunto completo `ok` duas vezes pela fronteira da Server Action.
- Overview de apoiadores: um round-trip de agregação (ou reuso de `totalDocs` + um agregado) em vez de três `count` paralelos sem `req` compartilhado.
- Create de apoiador usa o mesmo `StrictCombobox` de município dos filtros/núcleos; remoção destrutiva usa `AlertDialog` (padrão `ArchiveNucleusDialog`).
- Guardrails: `overrideAccess: false` quando houver `user`; escrita multi-collection continua transacional; qualquer bypass de `enforceUniqueContactPhone` só sob locks já adquiridos na mesma txn; sem novo `Consent` / sem collection nova (salvo staging efêmero de import, se a Fase 4 exigir).

## Decisões travadas

- **Um item C6, cinco fases ordenadas.** Não criar seis itens de roadmap; o custo de coordenação supera o benefício. Fases podem ser PRs separados, mas a ordem abaixo é a recomendada (UX barata → DRY → KPI → import pesado → preview token).
- **Dependência dura de C2.** Este item só faz sentido com o código C2 mesclado; não reabre o escopo de v1 do cadastro nominal.
- **Cortável se a base permanecer pequena.** Se a campanha não importar milhares de linhas antes de 16/08, as fases 3–5 podem escorregar; as fases 1–2 (UX + DRY) continuam baratas e valem a pena cedo.
- **Bypass do invariante de telefone é opt-in por `context`, nunca global.** Precedente: locks em `contactPhoneInvariant.ts` / hook `enforceUniqueContactPhone` em `Contact.ts`. Caller que já rodou `acquireContactPhoneLocks` na mesma txn pode passar `context: { skipContactPhoneInvariant: true }`; o hook só respeita se a txn já segura os locks (falha fechado caso contrário — validar na implementação).
- **Bulk insert segue o padrão TSE seed.** `payload.db.drizzle` em txn (como `pnpm db:seed:tse` / `scripts/seed-tse-results.mjs`), com `ON CONFLICT` / tratamento de unique `supporter_contact_nucleus`, não milhares de `payload.create` sob um único `acquireContactPhoneLocks` de 5k phones.
- **Preview token: sem Redis novo no v1 do C6.** Preferir blob assinado curto (HMAC + expiry) ou staging em memória/`unstable_cache` com TTL curto no processo; se insuficiente na Vercel, staging em tabela efêmera com TTL + job de limpeza. Decisão final na Fase 4 com medição.
- **i18n e naming** (AGENTS.md): identificadores em inglês (`campaignListUrl`, `CampaignListPagination`, `mapCampaignFormActionError`, `skipContactPhoneInvariant`, `importToken`), strings visíveis em pt-BR.

## Questões em aberto

- **Onde vive o staging do preview?** Blob assinado vs tabela `supporterImportBatch` vs cache em processo. **Recomendação:** começar com blob assinado (sem migration); só promover a tabela se o payload + HMAC estourar limites práticos da action.
- **Chunk size do bulk import.** **Recomendação:** 200–500 rows por commit interno, com progresso retornado ao wizard; calibrar com teste de carga local contra `teqo_test`.
- **KPI: drizzle raw vs Payload `count` + group.** **Recomendação:** um `SELECT … COUNT(*) FILTER` (ou `GROUP BY vote_intention`) via drizzle com o mesmo `where` de acesso que `buildSupporterListWhere` + constraint de `canReadSupporter`; reusar `result.totalDocs` da listagem para o total quando a página já carregou o find.
- **Extrair filter shell agora ou só URL + pagination?** **Recomendação:** extrair URL helpers + pagination no primeiro PR; filter shell (`valuesRef` + `useTransition` + disclosure) no segundo — o shell é o mais arriscado para regressão de núcleos.
- **Migrar leadership forms para o mapper compartilhado no mesmo PR?** **Recomendação:** sim para o mapper/`fieldError` (poucas linhas); não obrigar leadership a mudar copy de mensagens.

## Abordagem proposta

```mermaid
flowchart TD
    F1["Fase 1 — UX<br/>StrictCombobox + AlertDialog"]
    F2["Fase 2 — DRY listas/forms<br/>campaignListUrl · pagination · fieldError"]
    F3["Fase 3 — KPI agregado SQL"]
    F4["Fase 4 — Import bulk<br/>drizzle + skipContactPhoneInvariant"]
    F5["Fase 5 — Preview token<br/>sem round-trip 5k"]

    C2["C2 apoiadores ✓ eng."] --> F1
    F1 --> F2
    F2 --> F3
    F3 --> F4
    F4 --> F5
```

### Fase 1 — UX alinhada (barata)

- **`SupporterForm`**: município via `StrictCombobox` + `municipalityComboboxOptions()` (já usado em `SupporterFilters` / `NucleusFilters`); validação continua em `resolveBahiaMunicipality` / `optionalBahiaCity`.
- **`RemoveSupporterDataButton`**: trocar `window.confirm` por `AlertDialog` no padrão de `ArchiveNucleusDialog.tsx`.

### Fase 2 — DRY com núcleos / leadership

- **`src/utilities/campaignListUrl.ts`** (novo): `firstValue`, `normalizedText`, `strictDecimalInteger`, `inspectRaw*ListParams`, shape de `resolve*ListUrl` — hoje clonados em `nucleusUi.ts` e `supporterUi.ts`. Domínio (`parse*ListParams`, `build*ListWhere`) permanece nos módulos de domínio.
- **`CampaignListPagination`**: `SupporterPagination` já reusa `getNucleusPaginationPages`; extrair o markup Pagination compartilhado com `hrefForPage`.
- **`fieldError` / `errorProps`**: módulo pequeno (ex. `src/utilities/campaignFormFields.ts`) usado por `LeadershipForm` e `SupporterForm`.
- **`mapCampaignFormActionError`**: consolidar o catch FormDataBoundaryError → Zod → safelist → genérico de `novo/formActions.ts`, `[id]/formActions.ts` e `leadershipFormActions.ts`.
- **Filter shell** (opcional neste PR ou PR seguinte): `CampaignListFiltersShell` a partir de `NucleusFilters` / `SupporterFilters`.

### Fase 3 — KPI da lista

- **`loadSupporterListOverviewData`**: substituir 3× `payload.count` por um agregado SQL (drizzle) com o mesmo escopo de acesso; alinhar total com `totalDocs` da listagem quando possível.
- Opcional: `createLocalReq` uma vez e passar `req` aos loaders da página para reutilizar cache de access em `req.context`.

### Fase 4 — Import em escala

- **`confirmSupporterImportRecord`**: após locks + lookup em batch, insert de contacts/supporters via `payload.db.drizzle` (espelhar seed TSE), com tratamento de conflito unique.
- **`Contact` hook**: honrar `context.skipContactPhoneInvariant` somente quando seguro.
- Chunking / `maxDuration` se um único txn de 5k ainda estourar timeout.

### Fase 5 — Preview sem round-trip

- **`previewSupporterImport`**: retorna `{ counts, sampleRows, importToken }` (amostra para UI; hoje `slice(0, 100)`).
- **`confirmSupporterImport`**: aceita token (ou id de batch) em vez do array completo de rows `ok`.
- **`SupporterImportWizard`**: para de guardar/reenviar todas as rows.

**Migration:** só se a Fase 5 escolher tabela de staging — `pnpm migrate:create add_supporter_import_batch` (TTL + cleanup). Fases 1–4: sem migration de schema de produto.

## Dependências

- **Dura:** C2 cadastro nominal (código em `supporter*` / `/campanha/apoiadores`).
- **Suave:** nenhuma. Produção com dados reais ainda espera Onda 0 (Consent keys) — C6 não cria chave nova.
- Reusa: `nucleusUi.ts`, `NucleusFilters.tsx`, `NucleusPagination.tsx`, `LeadershipForm.tsx`, `ArchiveNucleusDialog.tsx`, `contactPhoneInvariant.ts`, `Contact.ts`, padrão drizzle do seed TSE, `territoryComboboxOptions.ts`.

## Não escopo

- Reabrir decisões de v1 do C2 (telefone obrigatório, kit mínimo, import só `geral`, etc.) — [cadastro-nominal-apoiadores.md](cadastro-nominal-apoiadores.md).
- Agregado de apoiadores no overview de núcleos — follow-up de B1.
- GOTV / dia D — C5.
- Escala/DRY de planos de ação (`actionPlan`) — C7 / [escala-dry-pos-c3.md](escala-dry-pos-c3.md) (consome `campaignListUrl` da Fase 2 deste plano quando existir).
- Push/notificações — D2 / [notifications.md](notifications.md).
- Índices `pg_trgm` / FTS em `contact` (mencionado na review de perf; só se busca ILIKE virar gargalo medido).

## Referências

- `docs/roadmap.md` — Trilha C, item C6; sequência Janela 2
- [cadastro-nominal-apoiadores.md](cadastro-nominal-apoiadores.md) — C2 v1
- Review `/simplify` 2026-07-18 (quality / reuse / performance) — origem da lista de fases
- `src/app/(campaign)/campanha/actions/supporter.ts` — preview/confirm import
- `src/utilities/supporterUi.ts` / `supporterPageData.ts` — lista + KPIs
- `src/utilities/nucleusUi.ts` / `src/components/campaign/NucleusFilters.tsx` / `NucleusPagination.tsx` — padrões a extrair
- `src/components/campaign/LeadershipForm.tsx` / `ArchiveNucleusDialog.tsx` — fieldError / AlertDialog
- `src/collections/Contact.ts` — `enforceUniqueContactPhone`
- `scripts/seed-tse-results.mjs` — bulk drizzle em txn
- AGENTS.md — `overrideAccess: false`, transações, Contact + locks, naming

## Implementação (2026-07-19)

Todas as cinco fases foram implementadas e validadas localmente (`tsc --noEmit`, `pnpm lint`, `pnpm test:int`, `pnpm test:unit`) contra `teqo_test`. Sem regressões nas rotas de núcleos/apoiadores/planos já entregues.

### Fase 1 — UX alinhada

- `SupporterForm` agora usa `StrictCombobox` + `municipalityComboboxOptions()` no município (validação continua em `optionalBahiaCity`).
- `RemoveSupporterDataButton` trocou `window.confirm` por `AlertDialog` no padrão de `ArchiveNucleusDialog.tsx`.

### Fase 2 — DRY com núcleos / leadership

- `src/utilities/campaignListUrl.ts` (novo): `firstValue`, `normalizedText`, `strictDecimalInteger`, `inspectRawListParams`, `resolveListUrl`, `buildListHref`. `nucleusUi.ts`, `supporterUi.ts` e `actionPlanUi.ts` delegam para ele (domínio permanece nos módulos de domínio).
- `src/components/campaign/CampaignListPagination.tsx` (novo) + `getPaginationPages`: substitui `NucleusPagination`, `SupporterPagination` e `ActionPlanPagination` (os três foram removidos). Listagens de núcleos/apoiadores/planos e o teste unitário `campaignNucleusUi` apontam para o novo componente.
- `src/utilities/campaignFormFields.ts` (novo): `fieldError` / `errorProps` compartilhados por `SupporterForm` e `LeadershipForm` (cada form liga um `errorProps` local ao seu prefixo de id).
- `src/utilities/campaignFormActionError.ts` (novo): `mapCampaignFormActionError` consolida FormDataBoundaryError → Zod → safelist → genérico. `apoiadores/novo/formActions.ts`, `apoiadores/[id]/formActions.ts` e `nucleos/[slug]/leadershipFormActions.ts` usam o mapper.

### Fase 3 — KPI da lista

- `src/utilities/supporterListOverviewAggregate.ts` (novo): `computeSupporterListOverviewAggregate` faz um único `SELECT COUNT(*) FILTER (...)` via drizzle na sessão da txn Payload, espelhando `buildSupporterListWhere` + a constraint de acesso (`nucleus_id IN (...)` para coordenador, sem constraint para geral, `none` para liderança). `loadSupporterListOverviewData` passou de 3× `payload.count` para um round-trip. Testes int cobrem geral, coordenador (escopo + filtro de cidade) e base vazia.

### Fase 4 — Import em escala

- `src/utilities/supporterImportBulk.ts` (novo): `bulkInsertSupporterImport` insere contacts e supporters via `payload.db.drizzle` na sessão da txn Payload (`getPostgresTransactionDatabase`), em chunks de 500, com `ON CONFLICT DO NOTHING` no índice unique `(contact_id, nucleus_id)`. Substitui até 10k `payload.create` por poucos inserts bulk.
- `src/collections/Contact.ts`: `enforceUniqueContactPhone` honra `context.skipContactPhoneInvariant` **fail-closed** — só respeita quando `req.transactionID` está ativo (sem txn, os locks xact-level não podem estar segurados → throw). `upsertContactByPhone` passa o context (o caller já segurou os locks), eliminando o re-lock/re-check redundante do path single-create.

### Fase 5 — Preview sem round-trip

- `src/collections/SupporterImportBatch.ts` (novo, admin hidden, acesso `geral`/admin) + migration `20260719_011015_add_supporter_import_batch`: staging efêmero do conjunto `ok` no servidor.
- `src/utilities/supporterImportToken.ts` (novo): token HMAC-SHA256(`${batchId}.${actorID}.${expiresAt}`, PAYLOAD_SECRET) com `timingSafeEqual` e TTL 10 min. `previewSupporterImportText` agora retorna `{ counts, sampleRows (100), errorReportCsv, importToken }` e estageia o conjunto `ok` em `supporterImportBatch`. `confirmSupporterImportRecord` aceita `importToken` (schema trocou `rows` por `importToken`), verifica HMAC + ator + expiração, consome o lote (single-use, delete após commit) e alimenta o bulk insert. O wizard parou de guardar/reenviar as rows.
- Testes int: fluxo preview→confirm; token tampered (assinatura alterada) rejeitado; token de outro ator rejeitado; reuso de token consumido rejeitado.

## Achados da auditoria (decisões de implementação)

- **Nomes de coluna drizzle para relationships NÃO levam sufixo `Id`.** Em `payload.db.tables.supporter`, as colunas de relationship são `contact`, `nucleus`, `consent`, `voteIntentionConsent`, `createdBy` — não `contactId`, etc. O insert bulk inicial usou `contactId`/`createdById` e o drizzle silenciou essas chaves (gerou `default` → violação NOT NULL). Corrigido para os nomes sem sufixo. Lição para C7 e futuros inserts bulk: inspecionar `Object.keys(payload.db.tables.<slug>)` antes de montar as rows.
- **`payload-preferences` não serve de staging genérico.** Tem campo `user` (relationship users/campaignUser) obrigatório e validado em `beforeChange`, e semântica de preferência por usuário. Tentar usá-lo para o lote de importação falhou com `ValidationError: User`. Decidido pela tabela dedicada `supporterImportBatch` (migration), como o plano já previa como fallback. Não há Redis novo no v1 do C6.
- **Bulk insert deve rodar na txn Payload existente, não numa txn drizzle nova.** O seed TSE (`electionResultsImport.ts`) abre `dbAdapter.drizzle.transaction(...)` própria; para C4 isso quebraria a atomicidade com os locks advisory. Usado `getPostgresTransactionDatabase(payload, req)` para pegar a sessão drizzle vinculada à txn Payload.
- **`skipContactPhoneInvariant` é fail-closed por txn, não por introspecção de lock.** Não há maneira barata de perguntar ao PG "seguro o lock X?"; o proxy usado é `req.transactionID` ativo (o lock `pg_advisory_xact_lock` é xact-level e só existe dentro de uma txn). Sem txn + flag setado → throw 500.
- **`supporter.beforeChange` (coexistência com liderança) é no-op para import sem núcleo.** O hook só dispara quando `contactID` e `nucleusID` estão presentes; import cria supporters sem núcleo, então o bypass via drizzle insert é seguro. `createdBy` é setado explicitamente no row bulk.
- **Escopo do mapper de form errors:** `ActionPlanPagination` e os forms de planos também consomem `campaignListUrl`/`CampaignListPagination`. O mapper de form actions de planos (`planos/formActions.ts`, `planos/[slug]/updateFormActions.ts`) ficou de fora do escopo original do C7 (copy/mensagens diferentes) mas foi consolidado pelo C8 (`escala-dry-pos-c6.md`), junto com os demais `formActions` restantes — C7 Fase 3 manteve apenas os helpers de FormData/URL de território do `actionPlan`.

## Simplify (2026-07-19)

Passagem `/simplify` sobre o commit do C6 aplicou limpezas pontuais (-94/+48 linhas) sem mudar comportamento: remoção de identity maps e re-maps (`importStatusCsvValue`, re-mapeamento de `batch.okRows`), colapso de branches mortos (`typeof doc.actor === 'object'`), reuso de helpers existentes (`relationshipId`, `canManageCampaignUsers`), `base64url` nativo do Node no token HMAC, simplificação do mapeamento `doc.id` no aggregate, remoção de guarda redundante no wizard, e `req.transactionID == null`. Correção de bug latente: `created += Number(result.rowCount ?? batch.length)` → `?? 0` (over-count em conflito). Renomeado tipo local `StagedSupporterImportBatch` para não colidir com o tipo Payload gerado. Validado com `tsc --noEmit`, `pnpm lint`, `pnpm test:int`, `pnpm test:unit` e scan Aikido. Os débitos de escala/DRY que os revisores marcaram como importantes e maiores que cleanup (locks bulk em 1 round-trip, `.returning()`, leituras drizzle diretas, `pg_trgm`, helper `drizzleBulk.ts` compartilhado, assertion de colunas, migração dos `formActions` restantes) foram registrados como item **C8** — [escala-dry-pos-c6.md](escala-dry-pos-c6.md).
