# Impl: Pessoas — lista unificada da campanha (rota /campanha/pessoas)

Status: aprovado
Atualizado em: 2026-08-09
Issue: #495
Intenção: docs/plans/pessoas-lista-unificada.md
Appetite restante: ~3–4 dias eng (herdado — sem corte)

## Leitura da intenção

- **Outcome:** `/campanha/pessoas` lista e filtra todas as pessoas da campanha (lideranças, dobradinhas e staff) num lugar só; a mesma pessoa física em 2+ papéis = 1 linha (merge por `Contact`); 8 colunas (Nome, Contato, Assessora, Lidera, Aliada em, Assessorado, Base, Ações); omnibox com capacidade + município + filtros de domínio; filtros salvos no padrão B18; Ações = WhatsApp + convite (liderança) + Apagar (cascata destrutiva com confirmação explícita); sem apoiadores na v1; escopo de acesso preservado (assessor = carteira dele; leader lockdown).
- **O que NÃO negociar:** merge por `Contact` (nunca segundo cadastro de pessoa); leader lockdown (`gate: 'staff'`); apoiadores fora da v1; convite reusa `createCampaignInvite`/`LeadershipInviteRowAction` (consent fail-closed, 1:1, Res. TSE 23.610 art. 33); apagar precedido de confirmação que lista tudo; contas coordenação/candidato nunca apagáveis; nenhuma rota existente muda; escopo de acesso nunca alargado (cada query com o where do domínio).
- **O que reavaliar:** a hipótese da intenção citava B91 (busca global multi-entidade) como precedente de agregação — rejeitado para esta superfície (ver D0); "utilizadores por domínio existentes" existem para leitura individual, mas **nenhum loader existente faz union por Contact** — precisa loader novo de merge (D1); "especializar filtros salvos (2º call site)" — confirmado, com extração mínima do storage (D5).

## Decisões de engenharia

### D0 — Superfície de busca: omnibox de lista, não B91

Opções: A) reusar a máquina de busca global (`CampaignHomeSearch`/`home-search`) | B) omnibox de lista (`CampaignListOmnibox` + adaptador de domínio, padrão Municípios/Lideranças).
Recomendação: **B** — a rota é uma lista com URL canônica; o omnibox de lista é o precedente do sistema de listas (Pass 2 W1) e dá filtros salvos de graça. B91 é fortemente acoplado ao Início (context providers, exclude-current-entity, debounce 250ms, scope merge) e resolveria só a busca, não os facets.
Rejeitada: A porque acopla a rota a contextos do Início e não participa do URL state.

### D1 — Merge por `Contact`: fontes por domínio + união em memória no servidor

Opções:

- A) query em `contact` (com o escopo de `canReadContacts`) e resolver joins por pessoa;
- B) **três fontes por domínio** (leadership, stateDeputy, campaignUser-com-carteira), cada uma com o where/access existente do domínio, e **união em memória por `contact.id`** com escopo por capacidade (recomendada);
- C) UNION SQL via drizzle.

Recomendação: **B** — cada fonte já tem loader + where + access pronto (`buildLeadershipListWhere`, `loadStateDeputyListPageData`-shape, `municipalityIdsByAdvisorIds`); a união em memória é uma função pura testável; volume atual (centenas de lideranças, dezenas de dobradinhas/staff) cabe sem paginação no nível de fonte.
Rejeitadas: A porque `canReadContacts` inclui fichas de apoiadores (v1 exclui) e exige pós-filtro que quebra a semântica de paginação/facets; C porque contorna a camada de access do Payload e duplica o where de cada domínio.

**Merge (puro):** `mergePeopleSources({ leadershipRows, deputyRows, staffAccounts, municipalityIdsBy<Fonte> })` → `PeopleRow[]` — uma linha por `contactID` com capacidades preenchidas: `leadership?` (1, contato UNIQUE), `deputy?` (1, contato UNIQUE), `staff[]` (N contas por ficha — dedupe multpapel). Entram pessoas com **qualquer papel**: liderança, dobradinha ou conta staff com ficha (mesmo sem carteira — gate do humano em 2026-08-09, ver D2). Nome/telefone/e-mail/cidade vêm da **ficha** (depth-1 populate de `contact`), partido de `stateDeputy.party` (única fonte, no máximo uma dobradinha por ficha).

### D2 — Access: escopo por capacidade, nunca alargado

- **Leadership:** `payload.find` com `user` + `overrideAccess: false` → `canReadLeadership` aplica o where de carteira do assessor; filtros `q` (contact.name contains), `supportStatus`, `municipalities in` no where.
- **Dobradinha:** `user` + `overrideAccess: false` → acesso staff-wide existente; municípios da dobradinha via `municipalityIdsByStateDeputyIds` (já existe).
- **Staff (fonte de Assessora) — regra de inclusão (gate do humano 2026-08-09):** **toda conta staff** (`advisor` | `coordinator` | `candidate`) com ficha (`contact` ≠ null) entra na lista **mesmo sem carteira** — ser staff é papel; a carteira só preenche a coluna Assessora (vazia = "—"). `overrideAccess: true` **justificado e documentado** — precedente `loadAdvisorListPageData` (`/assessores`, mesmo padrão) e `canReadCampaignUserPhone` (regra same-municipality advisor); o campo `contact` de `campaignUser` tem field access `canReadCampaignUserIdentity` (self/admin) e o depth-1 populate seria cortado para assessor. O escopo de leitura é imposto **pelo merge** (D3), não pela collection access. Contas legadas sem ficha não têm identidade para o merge → fora da v1 (documentado).
- **Contato:** lido via depth-1 das fontes (nunca via `contact` collection access — `canReadContacts` não alcança ficha puramente staff; a ficha do staff entra porque a pessoa aparece por papel staff, mesma regra de `canReadCampaignUserPhone`).

### D3 — Escopo do assessor (quem vê): carteira só

Opções: A) união literal dos wheres (assessor veria TODAS as dobradinhas — staff-wide hoje) | B) **restringir a linha a pessoas com ≥1 município de capacidade na carteira do assessor** (recomendada).
Recomendação: **B** — o aceite trava "assessor vê só a carteira dele"; a dobradinha fora da carteira não é operação dele. Aplicado em memória após o merge (linha incluída sse `(lidera ∪ aliada ∪ carteira) ∩ portfolio ≠ ∅`). Consequência consistente com a regra de inclusão: staff **sem carteira** não tem município de capacidade → visível apenas a unrestricted (coordenação/candidato); `/dobradinhas` permanece staff-wide intacta (escopo é por página, não por coleção).
Rejeitada: A porque contradiz o aceite ("só a carteira dele").

### D4 — Apagar pessoa: cascata transacional com manifest de confirmação

Duas actions (`src/app/(campaign)/campanha/actions/person.ts`), só `isCampaignUnrestricted` (coordenação/candidato — ação destrutiva transversal):

1. **`getPersonDeleteManifest`** (read-only): enumera `{ contact, leaderships (com municípios), stateDeputies (partido), pledgeCount, inviteCount, supporterCount, accounts (nome+role), hasProtectedAccount (role coordinator|candidate), fichaBlockedByOtherJoins (signature/subscription), fichaWillBeAnonymized }` — o diálogo lista exatamente isto antes de confirmar (padrão preview do import de CSV, sem staging/token: o manifest é derivado do dado vivo).
2. **`deletePerson`** em `withPayloadTransaction`:
   - `reloadUnrestrictedActor` + assert; advisory lock `person-delete:{contactID}` (padrão `acquireTextAdvisoryLocks`).
   - Re-enumeração fresca dentro da tx; `hasProtectedAccount` → abortar com mensagem (conta coordenação/candidato nunca apagável → a pessoa inteira está protegida).
   - **Ordem de delete (FKs NOT NULL + `ON DELETE set null` = bloqueiam):** `votePledge` (leadership in ids) → `campaignInvite` (leadership in ids; cobre `created_by_id` NOT NULL) → `supporter` (contact = id) → `leadership` (contact = id) → `stateDeputy` (contact = id) → `campaignUser` (contact = id; o `beforeDelete` existente limpa passkeys + notificações) → limpeza de vínculos de assessoria dos usuários deletados (`municipality_rels`/`activity_rels` — verificar FK em execução; `leadership_rels`/`state_deputy_rels` já são `ON DELETE cascade`) → ficha `contact`: **delete** se nenhum outro join restar (signature/subscription), senão **anonimizar** (tombstone, precedente `removeSupporterData`). `leadership.user`, `campaign_demand.leadership_id`, `activity.leadership_id` fazem SET NULL sozinhos.
   - Contrato LGPD: `removeSupporterData` (anônima ficha quando sem joins) é o precedente da casa; aqui o gesto é de remoção total, então a ficha é deletada quando possível, anonimizada quando outro join público a referencia (declarado no diálogo).

- UI: `DeletePersonButton` (AlertDialog, fetch do manifest ao abrir, lista o que será removido, confirmação destrutiva, `router.refresh` + toast no fim) — padrão `RemoveSupporterDataButton`.

### D5 — Filtros salvos: 2º call site do padrão B18 (sem genericizar)

Opções: A) copiar o módulo de storage (155 linhas) para Pessoas | B) **extrair factory mínima `createSavedFilterStore({ storageKey, isHrefValid })`** com contrato B18 preservado, e reescrever `municipalitySavedFilters.ts` como delegado (API pública idêntica; suite `municipalitySavedFilters.unit.spec.ts` guarda) | C) sistema genérico de filtros salvos.
Recomendação: **B** — storage é mecânica pura com 2 call sites reais; o veto FD2 é sobre o SISTEMA (server-sync, config-driven), não sobre o primitivo de storage. `MAX_ENTRIES=12`, `MAX_NAME_LENGTH=60`, rename-no-teto, sort alfabético, dedupe por href, snapshot caching, evento custom derivado da key, limpeza da legacy key — tudo preservado e coberto por testes.
Rejeitadas: A porque duplica mecânica com semântica sutil (rename no teto, evento entre ilhas); C porque o veto FD2 é explícito e o padrão B18 é o teto.
Hooks/controles/submenu permanecem **especializados por página** (hrefs, i18n, active-match com `isSameListHref` ignorando `page`): `usePeopleSavedFilters` + `useActivePeopleSavedFilter`, `SavePeopleFilterControl`, `PeopleNavSavedFilters` (variants sidebar + overflow). Se a refatoração do `MunicipalityNavSavedFilters` para componente presentacional compartilhado ficar neutra em comportamento e verde no e2e, extrai-se; senão, duplica-se o submenu (JSX fino).

### D6 — URL state e canonicalização

`src/utilities/people/peopleListUrl.ts` no contrato `campaignListUrl.ts` (parse/serialize/resolve/buildHref), basePath `/campanha/pessoas`. Estado: `{ page, q, capacity (multi — chips do omnibox, OR dentro do facet, como os demais filtros; ausência = todas), municipalities (multi), supportStatus (multi) }`. Filtros em memória pós-merge (capacidade, município, supportStatus); `q` + `supportStatus` também no where da fonte leadership (contém o volume); `q` no where de dobradinha/staff. `PEOPLE_PAGE_SIZE` (padrão 25, precedente das demais listas).

### D7 — Facets da omnibox

Opções de origem: A) facets derivados do conjunto filtrado atual (como a lista de Municípios deriva do where) | B) **facet options = municípios e status presentes no conjunto mergeado (escopo-restrito), sem reagir aos filtros ativos** (recomendada).
Recomendação: **B** — os facets do merge em memória são baratos de derivar do conjunto escopo-restrito; reagir ao filtro ativo é polish de v1 posterior. Municípios rotulados via `loadMunicipalityPortfolioIndex` + `resolvedPortfolioEntriesById` (precedente lideranças); para assessor, o universo de municípios já é a carteira.
Rejeitada: A porque exige re-derivar facets a cada mudança de estado sem ganho perceptível na v1.

### D8 — Colunas, partido e células

- **Nome:** texto da ficha; sufixo `(partido)` quando a pessoa tem dobradinha (única fonte `stateDeputy.party`). Sem link próprio na v1 (sem página de pessoa).
- **Contato:** telefone em destaque + e-mail segunda linha discreta; sem telefone, e-mail como linha principal; sem nenhum → `—`.
- **Assessora / Lidera / Aliada em:** chips de município truncados "+N" (`truncatedNamesLabel` de `campaignListUrl.ts`, padrão B159) — leitura pura, sem editor (sem edição inline nesta entrega). Facet "É assessora" = **coluna Assessora preenchida** (carteira não-vazia), como diz o canvas; staff sem carteira aparece em "Todas", não em "É assessora".
- **Assessorado:** nomes de assessores responsáveis (união `leadership.advisors` + `stateDeputy.advisors`, via `loadCampaignUserNamesByIds`).
- **Base:** `contact.city`.
- **Ações:** WhatsApp (`whatsAppHrefForPhone` da ficha — só com telefone), Convite (`LeadershipInviteRowAction` reusada, só quando há engajamento de liderança), Apagar (só unrestricted, `DeletePersonButton`).
- **Column picker:** novo `CampaignListId 'pessoas'` em `CAMPAIGN_LIST_IDS` (B17).
- **Mobile (gate do humano 2026-08-09):** visual **edge-to-edge sem bordas** — omnibox sem label e sem borda, ocupando a largura toda, com a ação "Limpar" como **ícone circular com X no canto interno direito**; o feed de cards é separado por **linhas horizontais** (divide-y), não por cards bordados (padrão das outras listas); "Salvar filtro" vira **icon button no header** (chrome da página). FABs de quick actions (`CampaignQuickActionsHost` via `CampaignAppScrollChrome`) e Sollinha AI (`CampaignAISidebarShell`) são mounts globais do layout `(app)` — persistem automaticamente; verificar no craft que omnibox edge-to-edge e FABs não se sobrepõem (z-index). Desktop mantém o padrão das listas (omnibox + `CampaignTable`).

### D9 — Rota e nav

- `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` + `loading.tsx`; gate `requireCampaignPageActor({ gate: 'staff' })` (leader → `/campanha/contatos`, lockdown); metadata via catálogo de páginas (adicionar entrada `pessoas`).
- Sidebar: `Pessoas` em `staffNav` após `Dobradinhas`; constante `PEOPLE_NAV_HREF` (padrão `MUNICIPALITY_NAV_HREF`) para o submenu de filtros salvos em `CampaignSidebar` + `CampaignBottomNav` (overflow); bottom nav primária intacta (Pessoas cai no "Mais" automaticamente).

## Componentes / mudanças

- **`people/`** (novo domínio, espelhando `municipality/`):
  - `src/utilities/people/peopleListUrl.ts` — estado + parse/serialize/resolve/buildHref.
  - `src/utilities/people/peopleData.ts` — `loadPeopleListPageData` (3 fontes + merge + escopo + facets + paginação), `PeopleRowViewModel`, `mergePeopleSources` (puro).
  - `src/utilities/people/peopleSavedFilters.ts` (via factory D5) + `src/utilities/people/peopleFilters.ts` (toggle/clear/summary/hrefs) + `peopleOmnibox.ts` (chips/suggestions/apply).
- **Actions:** `src/app/(campaign)/campanha/actions/person.ts` (`getPersonDeleteManifest`, `deletePerson`); schemas em `src/lib/schemas/personDelete.ts`.
- **Componentes:** `src/components/campaign/people/PeopleFilters.tsx`, `PeopleListTable`/colunas (ou inline no page), `PeopleListMobileCards.tsx`, `DeletePersonButton.tsx`, `SavePeopleFilterControl.tsx`, `PeopleNavSavedFilters.tsx`, hooks `usePeopleSavedFilters.ts`.
- **Shell:** `nav.ts` (`Pessoas` + `PEOPLE_NAV_HREF`), `CampaignSidebar.tsx`, `CampaignBottomNav.tsx` (slot do submenu), `campaignColumnVisibility.ts` (`pessoas`), catálogo de páginas/metadata.
- **Storage:** `src/utilities/campaignSavedFilterStore.ts` (factory) + refactor delegado de `municipalitySavedFilters.ts`.
- **Migration:** nenhuma — sem mudança de schema (cascata é camada de dados; FKs existentes mapeadas em D4).
- **Access/Consent:** sem chave nova; convite reusa `lideranca-autopreenchimento` (fail-closed, intocado); overrides documentados em D2/D4.
- **UI:** Impeccable C — rota nova + tabela + omnibox + filtros salvos; shape → craft → critique → polish; tokens `data-theme='campaign'`, shells do sistema de listas.

## Dados → forma

Não aplicável (vínculos, não métricas — intenção Dados: N/A). Nenhum agregado por pessoa na superfície; votos só aparecem como contagem no manifest de apagar.

## Fases verificáveis

1. **Tracer (schema/server mínimo):** `peopleListUrl` + `mergePeopleSources` + `loadPeopleListPageData` (3 fontes + escopo) + rota com colunas Nome/Contato — valida canonicalização, gate e escopo de assessor cedo (unidades + int).
2. **Server completo:** filtros/facets/paginação + `personDelete` (manifest + cascata) + testes de domínio (unit merge/url; int escopo + cascata).
3. **UI:** filtros/omnibox, 8 colunas, mobile cards, ações (WhatsApp/Convite/Apagar), column picker, filtros salvos (factory + controle + submenu), sidebar.
4. **Gates + docs:** `pnpm gate:fast` na iteração; entrega com `pnpm push`; entrada no `docs/CHANGELOG-AGENTS.md`; commit do `*-impl.md`.

## Rabbit holes / Não escopo (engenharia)

- Sistema genérico de filtros salvos (veto FD2); merge de `Contact` duplicados (v1: linhas duplicadas visíveis); "transferir engajamentos" (pós-eleição); edição inline de células; página de detalhe de pessoa; RecentVisitTracker (polish posterior); e2e amplo (smoke da rota + fluxo de apagar via int, não e2e).
- Não criar loader genérico "busca de pessoa" para fora desta rota (1 call site).

## Riscos e mitigação

- **Surpresas de FK na cascata** (`municipality_rels`/`activity_rels` podem ser `SET NULL` e exigir limpeza explícita; ordens de delete erradas = 500): mapear FKs reais em execução (`migrate:status`/drizzle inspect) antes de escrever a cascata; int test do caminho completo (pessoa com todos os papéis + passkey) valida.
- **Refactor do B18 storage regredir comportamento**: API pública idêntica + suite unit existente + e2e de filtros salvos existente como rede de segurança; manter storage key e eventos idênticos.
- **Semântica de access do staff source divergir do esperado**: overrides documentados + justificados com precedentes citados (D2); int test com assessor verifica que vê só a carteira dele e que contas fora dela não vazam.
- **Volume** (pessoas × municípios nas células): chips truncados "+N"; sem paginação no nível de fonte (merge em memória com volume atual ~centenas).
- **`NEXT_PUBLIC_SITE_URL`** (convite): fluxo existente, sem mudança — checklist de deploy já cobre.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (merge 1 linha/pessoa; 8 colunas; facets; filtros salvos B18 2º call site; WhatsApp/invite/delete com confirmação; sem apoiadores; roteamento intacto)
- [x] Invariantes AGENTS/engineering-standards (transação + `req.transactionID` em toda escrita multi-collection; `overrideAccess` justificado e documentado; pessoa = join com `Contact`; consent fail-closed intocado; identif. em inglês / copy pt-BR; gates `staff`)
- [x] Testes previstos: unit (`peopleListUrl` canonicalização; `mergePeopleSources` dedupe/escopo/partido; factory de storage), int (`loadPeopleListPageData` escopo assessor/unrestricted; cascata completa `deletePerson` incl. passkeys e ficha deletada/anonimizada; manifest; conta protegida bloqueia), e2e smoke (rota + filtro + salvar recorte)
