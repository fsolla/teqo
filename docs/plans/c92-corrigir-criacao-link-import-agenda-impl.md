# Impl: C92 — Link de import da agenda: corrigir criação do feed

Status: em execução
Atualizado em: 2026-08-08
Issue: #436
Intenção: docs/plans/c92-corrigir-criacao-link-import-agenda.md
Appetite restante: ~0,5–1 dia eng (herdado; entrega menor que o appetite)

## Leitura da intenção

- **Outcome:** staff (coordenador, assessor, candidato) gera o link de import nomeando o feed, sem erro; o link responde; revogar e listar continuam; erro real não é engolido; não vaza município fora do escopo do criador.
- **O que NÃO negociar:** leader lockdown; fail-closed no read do feed (o segredo não vaza); credencial revogável; sem sync bidirecional; invariante C16 de escopo do criador.
- **O que reavaliar:** a "forma do create" — a hipótese da intenção (ajuste de acesso vs forma) foi respondida por repro: o padrão que já funciona no repo é **hook-stamp do `createdBy` + acesso de campo relaxado onde o servidor minta o valor**, exatamente como `Organization`/`Leadership`/`StateDeputy` (que criam com `overrideAccess:false`).

## Causa raiz (reproduzida localmente com actor real `campaignUser`)

`createCalendarFeedLinkRecord` cria com `overrideAccess: false` + `user: campaignUser`, `data` inclui `secretSlug` e `createdBy` — ambos `required` com `access.create: canSetCalendarFeedSystemField` (só Payload admin). Payload **strip** os campos negados → `ValidationError` (400) → catch engole numa mensagem genérica.

**Prova (repro em `tests/int`, DB local `teqo_wt92`):**

- `payload.create(calendarFeed, { secretSlug, createdBy }, user: coordinator, overrideAccess:false)` → `ValidationError: ... Secret Slug, Criado por` (o bug).
- Mesmo create **com `beforeChange` hook que grava `createdBy = req.user.id`** (e sem passar `createdBy` do lado da action) → **OK**, `createdBy` gravado = id do actor. ← o fix (padrão `stampCampaignCreatedBy`).
- **Bug nº 2 (mesma raiz, silencioso):** `revokeCalendarFeedRecord` faz `payload.update({ revokedAt })` com `overrideAccess:false`; `revokedAt.access.update` é admin-only → `revokedAt` é stripado → update retorna ok mas **nunca revoga**. Aceite C16 "revogar continua funcionando" está quebrado. Prova: `revokedAt set? false` com update `overrideAccess:false`.
- Leader create → bloqueado (acesso de collection já OK). Confirmado.

## Componentes / mudanças

### 1. `src/utilities/access/calendarFeeds.ts`

- **Manter** `canSetCalendarFeedSystemField` (admin-only) — continua para `secretSlug.update`, `revokedAt.create` e `createdBy`.
- **`canCreateCalendarFeed`** agora recebe `data` e verifica `filterMunicipality` no escopo do assessor (precedente `canCreateSupporter` em `supporters.ts`), fail-closed — fecha o bypass por REST/`payload.create` cru, não só pela action.
- **Novo `canSetCalendarFeedSecret: FieldAccess`** — `isPayloadAdmin || isCampaignStaff(getFreshCampaignUser)`; usado só em `secretSlug.access.create` (staff minta o segredo **no create**; `read: () => false` e `update` admin-only inalterados → segredo nunca re-lido, nunca rotacionado).
- **Novo `canSetCalendarFeedRevocation: FieldAccess`** — `isPayloadAdmin || isCampaignStaff(getFreshCampaignUser)`; usado só em `revokedAt.access.update` (staff marca revogado; `canUpdateCalendarFeed` já escopa advisor a `createdBy` próprio → staff só revoga feed próprio).

### 2. `src/collections/CalendarFeed.ts`

- `secretSlug.access.create` → `canSetCalendarFeedSecret` (`read` e `update` inalterados).
- `revokedAt.access.update` → `canSetCalendarFeedRevocation` (`create` admin-only inalterado).
- Adicionar `hooks.beforeChange: [stampCampaignCreatedBy]` (mesmo hook de Organization/Leadership/StateDeputy — `campaignAuditFields.ts`).
- **Sem migration** — mudança de config, não de schema.

### 3. `src/app/(campaign)/campanha/actions/calendarFeed.ts`

- Núcleo testável `createCalendarFeedLinkRecord(payload, actor, input)` + wrappers `createCalendarFeedLink`/`revokeCalendarFeed`/`listCalendarFeeds` (padrão `*Record` do repo — `createActivity`/`createSupporter`; `/simplify` corrigiu a inversão `With`).
- **Parar de passar `createdBy`** no create → `hookFilledCreateData<'calendarFeed'>` (tipos: campo `required` preenchido pelo hook; mesmo cast de Organization).
- **Escopo de assessor no create (fechar furo do filtro):** validar fail-closed que `filterMunicipality` está no escopo — espelhando o precedente de tour (`activity.ts:166-185`): `payload.find` scoped (`user`, `overrideAccess:false`) e conferir `docs.length === 1`; senão retorna erro amigável. A defesa principal hoje está no acesso de collection (item 1); esta checagem dá a mensagem específica e cobre o caminho da action.
- **Não engolir o erro real:** catch do create/revoke passa a `console.error` no servidor (rastro: quebra de acesso/configuração) mantendo a mensagem amigável para o usuário (contrato de UX inalterado; a mensagem de fora-de-escopo é preservada via `error.message`).

### Access / Consent

- Sem `Consent` novo (nenhuma PII nova; leitura de dados com acesso já controlado).
- `secretSlug`: create=staff, read=fail-closed (`() => false`), update=admin (credencial só nasce no create).
- `createdBy`: hook grava de `req.user.id` (inauthenticável por client); admin de /admin ainda seta manualmente via `canSetCalendarFeedSystemField`.

## Decisões de engenharia

- **Opções:** A) relaxar `create` do `secretSlug` + `update` do `revokedAt` para staff e hook-stamp `createdBy`; B) `overrideAccess:true` no create (como `Supporter`); C) hook que gera o segredo e action relê com override.
- **Recomendação: A** — porque mantém `overrideAccess:false` (invariante: Local API com user → sem override), `read` do segredo continuamente fechado, autor atomizado por hook (sem spoof), e revoga de novo funcionando. Alinha com Organization/Leadership/StateDeputy, os irmãos do mesmo padrão `systemStampedActorField`.
- **Rejeitadas:** B porque `overrideAccess:true` desliga TODO o access control do doc (inclui create de leader se a action falhar em checar; e esconde que o write depende de RBAC); C porque o create response strip `secretSlug` (prova: `hasSecret:false` no retorno com `read:false`) — a action não consegue ler o segredo que o hook gerou sem override, então o servidor deve fornecê-lo (como hoje, `randomUUID()`).

## Fases verificáveis

1. **Schema/server** — access novo (incl. `canCreateCalendarFeed` com `data` scope) + collection hooks + action (núcleo `*Record`, drop `createdBy`, scope-check advisor, `console.error` no catch).
2. **Testes (int)** — `tests/int/calendarFeed.int.spec.ts` novo (10 testes), estilo `campaignSupporter.int.spec.ts` com `installCampaignFixtures`:
   - coordinator cria → ok, `createdBy` = actor, URL com secret;
   - candidate cria;
   - `createdBy` forjado (create cru com `createdBy` de outro) sobrescrito pelo hook;
   - revoke → `revokedAt` setado (update staff OK);
   - advisor with `filterMunicipality` no escopo → ok;
   - advisor fora do escopo → erro (pela action) e `payload.create` cru negado (acesso de collection);
   - leader → negado;
   - advisor não revoga feed de outro;
   - secret nunca retornado em leitura não-admin.
   - fixture: `calendarFeed` adicionado a `CampaignCollection`/`emptyOwnedIDs`/cleanup loop/`purgeMunicipalityResidue`.
3. **Gates** — `pnpm gate:fast` (lint/types/unit), `pnpm test` (unit+int), `pnpm build` local.

## Rabbit holes / Não escopo (engenharia)

- **Refactor de todos os `canSet*SystemField` do repo** — corte: mudança local em `calendarFeed` (a intenção manda).
- **Fechar o furo de `filterMunicipality` também no read** (`buildFeedWhere` interseptar escopo no GET) — **registrado como Issue #455 (C96)** via capture-review-debts (gate humano aprovado): defesa em profundidade, `depends: [436]`, destrava sozinha quando o C92 flipar `done`.
- **Create via `/admin` UI** — `secretSlug` hidden+required e `createdBy` readOnly+required: `stampCampaignCreatedBy` só grava `campaignUser`, então admin pelos forms do painel não preenche esses campos. Pré-existente ao C92 (não regressão), fora do escopo (staff cria pelo diálogo da agenda, não pelo painel). Anotado como nota, sem Issue.
- **UI (diálogo/lista)** — C94.

## Riscos e mitigação

- **Regressão no read do feed:** nenhum toque em `calendarFeed.ts`/route iCal — read intacto.
- **Field access relaxado abre escape de `createdBy`?** Não: `createdBy` permanece com `setAccess` admin-only; o hook grava de `req.user` (prova local); client não atinge o valor.
- **CampaignUser admin (Users) cria por /admin:** ok — admin tem `canSetCalendarFeedSystemField`.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (create staff ok, URL responde, revogar ok, erro não engolido, sem leak de escopo)
- [ ] Invariantes AGENTS/engineering-standards (`overrideAccess:false` com user, copy pt-BR, identificadores EN)
- [ ] Testes int de access/write (staff cria; leader não; revoke grava; advisor escopo fail-closed; secret não lido)
- [ ] `pnpm gate:fast` + `pnpm test` + `pnpm build` verdes
