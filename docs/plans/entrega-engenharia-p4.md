# Pass 4 — Auditoria de engenharia, remediação P0/P1 e guardrails das misses

## Contexto e manchetes

- **Executado em 2026-07-31, no modo autônomo (Cursor Cloud)** da skill `engineering-audit`: precheck solitário verde (`agent:gh-doctor` OK; pool **desligado**), varredura completa, remediações P0/P1 e guardrails das misses colhidas na mesma sessão, cada um em PR próprio com gate completo. **Política atual (2026-08-01):** o PR dos artefatos também é Ready + auto-merge — não há mais exceção de merge humano para audit.
- **Âncora de delta:** Pass 3 (2026-07-28). Em 3 dias o paradigma de agentes tocou **880 arquivos** — homeSearch (8 módulos + ~20 componentes), notificações/push (2 collections + 5 módulos), wizard (~12 componentes), WebAuthn (4 rotas + 4 módulos), 5 migrations. A varredura cobriu o repo inteiro com esforço concentrado no delta.
- **Baseline verde:** `tsc` 0 erros, `lint` 0 warnings, `knip` 0 findings (ruído conhecido do `payload.config.ts`, ledger P3), madge 0 ciclos (**774 arquivos**, +124 desde o Pass 3).
- **Manchetes (todas medidas):**
  - **1 P0:** os 4 globals públicos (`site-settings`, `home`, `metadata`, `privacy-policy`) com `update: Boolean(user)` — JWT de campanha (liderança inclusa) podia **editar o site público** via `/api/globals/*`. Coleções foram travadas na Fase 0; os globals ficaram. Remediado ([PR #91](https://github.com/fsolla/teqo/pull/91)).
  - **1 P1:** `seed-posts.mjs` chamava `dieWithLabel` **sem importar** — ReferenceError no caminho de abort de fetch vazio, invisível a lint/tsc/knip. Meia-adoção do P3-H na mesma passada que criou a guarda da CLI. Remediado ([PR #92](https://github.com/fsolla/teqo/pull/92)).
  - **Harvest de 5 `kind:agent-miss` → 5 guardrails:** #73 (classe **reproduzível** — 7 violações int + 11 deep links e2e; migração para o alocador + guarda de 3 regras, [PR #93](https://github.com/fsolla/teqo/pull/93)); #52 (resíduo de Drawer por célula em 3 listas de chips; provider ×3 + invariante dev + guarda, [PR #94](https://github.com/fsolla/teqo/pull/94)); #53 (probe one-shot correndo com o autenticador CDP; portão de readiness + pin, [PR #95](https://github.com/fsolla/teqo/pull/95)); #54 (0 pares goto→goto não assentados medidos; guarda calibrada + convenção, [PR #95](https://github.com/fsolla/teqo/pull/95)); #83 (guarda `agent:ship` **já viva** via PR #89 — verificada e fechada sem guardrail novo).
  - **Honestidade de flake:** `campaignLeaderships` (chips) falha **deterministicamente em dev** na árvore limpa (instrumentado: nenhum POST dispara; não é a classe de hidratação P3-C). Prod verde 48/48. **Registrado, não "consertado" com retry** — retry mascara o que não é corrida.
  - **2 linhas do ledger stale fechadas:** safeMessages (P3-A) e consentId de petição (P3-B), verificadas no código.
  - **Duplicação medida para o plano:** gêmeos de busca homeSearch (~63 de ~90 linhas compartilhadas ×2), HomeSearch\*Group ×6 (2 pares quase verbatim), Wizard info Drawer ×3, WizardSkipTrailing ×2, names-by-id ×7 em notificationEvents, shell de sucesso vazio ×2.
  - **12 dodges de guarda registrados** (mapa de guardas abaixo) — 3 endurecidos na sessão, o resto vira workstream P2.

## Protocolo de delta de comportamento (inalterado do Pass 3)

Consolidação pode mudar saídas pequenas (copy, ordenação, timing) desde que **cada delta seja listado por item**; pins existentes são a rede de caracterização, atualizados **deliberadamente** na mesma entrega; contratos congelados (URL B18, schema, Consent/LGPD) fora de alcance sem item nomeado.

## Ondas já executadas na sessão (P0/P1 + misses)

| PR                                            | Conteúdo                                                                                                              | Guarda (classe)                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [#91](https://github.com/fsolla/teqo/pull/91) | **P0** globals públicos → `payloadAdminOnly` ×4; bell loaders de notificação tipados pelo ator, sem bypass            | `globalAccessConventions` (3); assinatura por ator (1); pins int de lockdown ×17                               |
| [#92](https://github.com/fsolla/teqo/pull/92) | **P1** import do `dieWithLabel`; inversão tipo lib→utilities; `DAY_MS` fold; comentário de bypass stale               | `scriptCliConventions` (3); ESLint lib `allowTypeImports:false` (2); `localApiOverrideAccessConventions` (3)   |
| [#93](https://github.com/fsolla/teqo/pull/93) | **#73** migração int+e2e para o alocador (classe-agnóstico no teste de classe); 11 deep links → `claimMunicipality()` | `testMunicipalityAllocatorConventions`: fixed-slug+mutação, `municipio=<slug>`, regex de nome não ancorada (3) |
| [#94](https://github.com/fsolla/teqo/pull/94) | **#52** `CampaignListSheetProvider` em lideranças/dobradinhas/assessores                                              | `sharedSheetHostConventions` (3); invariante dev no overlay (5); fallback lazy mantido                         |
| [#95](https://github.com/fsolla/teqo/pull/95) | **#53** `expectCampaignBiometricsReady` ×2; **#54** guarda de goto não assentado + convenção TESTING.md               | `e2eNavigationConventions` (3); convenção doc declarada judgment-only (6)                                      |

Gate de cada PR: `pnpm push` (espelho serial do ci-pr: lint, format, typecheck, knip, cycles, unit, int, build, e2e afetado ou full conforme blast radius). Evidência: full e2e prod **48/48** em 3 das 5 execuções; int full **71/529+** em todas.

## Ondas do plano (P2, ordenadas por risco × churn)

### Onda 1 — Consolidação do delta (homeSearch + notificações)

#### P4-A Runner único de busca textual do homeSearch

- **Meta:** `runHomeSearchTextHits({ collection, where, select, mapDoc, tieBreak, cap })` + mappers finos por domínio.
- **Evidência:** `searchHomeActivities.ts` (88 linhas) ↔ `searchHomeDemands.ts` (100) com similaridade 0,72 (~63 linhas compartilhadas: gate staff → normalize → `contains` + `limit: 0` + `overrideAccess: false` → word-start → `compareHomeSearchNameRelevance` → cap); leaderships 0,53.
- **Conhecimento duplicado (nomeado):** o pipeline staff de hits textuais da busca global.
- **Delta de comportamento:** nenhum se caracterizado pelos pins int existentes ×7 suites; caps/rankings inalterados.
- **Guarda determinística:** convenção — novo `searchHome*` deve usar o runner (classe 3); pin de acesso por papel por grupo (classe 5, já existe em parte).
- **Na mesma entrega:** helper `emptyHomeSearchSuccess(resultKind)` (2 shells idênticos, `searchHomeMunicipalities:23-33` vs `loadHomeSearchSuggestions:77-87`).

#### P4-B HomeSearch\*Group ×6 → grupo configurável

- **Meta:** `HomeSearchHitGroup` como dado (`groupId`, `title`, `selectHits`, `rowProps`); Municipality fica como variação estendida (territórios + trailing de votos).
- **Evidência:** 6 componentes de 40–63 linhas; Advisor↔Leadership e Activity↔Demand quase linha a linha (diferem id/título/href/secundário).
- **Conhecimento:** grupo de hits orçado → seção → `HomeSearchHitRow`.
- **Guarda:** snapshot/unit por groupId (aria-label + href) — classe 5.

#### P4-C notificationEvents → `loadNamesByIds` (P3-E)

- **Meta:** os 7 `findByID` + `select:{name}`/`{name,slug}` de `notificationEvents.ts` (254 linhas) viram os wrappers tipados do P3-E (estender se slug precisar).
- **Conhecimento:** resolver nomes de exibição por ids já autorizados — dono único desde 2026-07-29.
- **Guarda:** convenção banindo `findByID`+`select:{name}` ad hoc fora do allowlist (classe 3, mesma família do ratchet P3-E).

#### P4-D Write-path de notificações/push fail-closed

- **Meta:** (a) `markAllCampaignNotificationsRead` em `withPayloadTransaction` (até 200 updates — hoje falha parcial visível); (b) `subscribeCampaignPush` com schema zod em `lib/schemas` + upsert por `(user, endpoint)` (re-subscribe hoje estoura unique → erro genérico); (c) `unsubscribeCampaignPush` delete com `overrideAccess: false` (a policy `canDeleteOwnPushSubscriptions` já escopa o dono — bypass desnecessário).
- **Evidência:** `actions/notifications.ts:69-91,100-143,172-176`.
- **Guarda:** int — falha injetada no N-ésimo update ⇒ 0 ou todos marcados (5); segundo subscribe com o mesmo endpoint ⇒ sucesso (5).

### Onda 2 — Wizard + camada de apresentação do delta

#### P4-E Wizard info Drawer ×3 → `WizardInfoDrawer`

- **Evidência:** chrome idêntico em `WizardSignalTypeStep.tsx:95-112`, `WizardTrendChoiceStep.tsx:115-132`, `WizardLeadershipStep.tsx:167-179` (botão info → bottom sheet com título + descrição + corpo); grids de tiles ficam locais (dado de domínio). Na mesma entrega: `WizardSignalSkipTrailing`/`WizardTrendSkipTrailing` (13 linhas cada, tipos ambos `{label, href}`) → um `CampaignWizardSkipTrailing`.
- **Guarda:** pin visual/a11y do botão info → nome do dialog (5).

#### P4-F `municipalityColumnLabels` fora do `municipalityListUrl` (fronteira B14)

- **Meta:** mover o mapa de labels para `municipalityLabels` (onde o tipo já vive) ou folha só-de-labels.
- **Evidência:** `MunicipalityListMobileCards.tsx:26` (client) value-importa do módulo de URL (~19 KB, que puxa `isMunicipalitySlug` → `municipalityCatalog`) para ler um mapa de strings — a lição dos 21 kB do B14 na versão mobile.
- **Guarda:** convenção/ESLint — client components não value-importam de `*ListUrl` fora de href builders allowlistados (classe 3).

#### P4-G HomeSearchProvider estreito + regiões vivas em escala

- **Meta:** (a) `HomeSearchProvider` envolve só o slot de busca — hoje envolve `actions`+`summarySlot` não-consumidores e o valor muda a cada tecla (`CampaignHomeStaffChrome.tsx:41-56`); (b) a região `aria-live` incondicional por célula de chips (`RelationChipCell.tsx:821-823` — ~50 regiões polite registradas em lideranças) monta no primeiro anúncio não-vazio, seguindo o overlay.
- **Guarda:** pin de árvore React (ações fora do provider) (5); convenção de teto de regiões polite por lista (3).

### Onda 3 — Endurecimento de guardas (dodges medidos)

#### P4-H Ratchet de bypass: fim da "cobertura de cabeçalho"

- **Meta:** comentário com "bypass" nas primeiras 40 linhas deixa de zerar a contagem do arquivo inteiro; vale por-chamada (janela) ou política de módulo nomeada com contagem declarada. `notification/*` (20 bypasses) e `campaignWebAuthnCeremony` (4) recebem justificativas por bloco na mesma entrega.
- **Evidência:** `codebaseConventions.unit.spec.ts:541-623`; P3-E pretendia "comentário justificando", a forma atual satisfaz a letra sem o espírito.
- **Guarda:** o próprio ratchet endurecido (classe 3).

#### P4-I `canReadCampaignUsers` sem enumeração para liderança

- **Meta:** lista de staff restrita a staff/unrestricted; liderança lê a si mesma. Auditar call sites primeiro (homeSearch advisors já tem gate próprio — verificado na varredura).
- **Evidência:** `access/campaignUsers.ts:33-34` = admin OU qualquer `isCampaignUser` (inclui `leader`); ledger P2 pré-existente, re-verificado 2026-07-31.
- **Guarda:** pins int de acesso — líder nega lista, self permitido (5).

#### P4-J `authenticateCampaignToken` sem segunda leitura (RS+)

- **Meta:** `depth: 0` + `select` mínimo; avatar resolvido sem doc inteiro. Pins: `removePrivateAuthFields` + freshness de rebaixamento de papel (pré-requisito do ledger, mantém).
- **Evidência:** `campaignAuth.ts:87-109` — `payload.auth` (a JWT strategy já lê o doc) + `findByID(depth: 1)` full em toda página.

#### P4-K Fixtures int: restos do P3-C

- **Meta:** (a) 28 blocos `.create({ collection: 'campaignUser' })` em 6 arquivos → `fixtures.createCampaignUser` (salvo mints de sessão legítimos); (b) `fixtures.own()` manual — 49 sites (subiu de 43) — ratchet de contagem; (c) invite-origin: pin unit é o dono (~92 linhas puras), o re-pin int (~158 linhas em `campaignInvite.int.spec.ts:394-552`) vira smoke de integração.
- **Guarda:** convenção banindo create crua de campaignUser fora de helpers (3); ratchet `fixtures.own(` ≤ N (3).

### Onda 4 — Debug com evidência (não é retry, não é palpite)

#### P4-L `campaignLeaderships` chips em dev — causa raiz

- **Evidência registrada (2026-07-31):** na árvore limpa de stage, dev mode, 4/4 execuções falham no passo sugestão/commit. Instrumentação com listeners: **nenhum POST em 60s**; assinaturas variando por run — opção visível + clique sem efeito; contagem de options 1 → 0 após o primeiro fill. **Prod verde** (48/48 full). Não é a classe P3-C (onChange do input funciona, listbox renderiza). `toPass` tentado e **revertido** — retry não conserta o que não é corrida.
- **Método:** debug subagent com hipótese + instrumentação no código da célula (estado `open`/`suggesting`, streaming RSC dev vs prod do `municipalityIndex`, `hitsKey`), não especulação.
- **Guarda:** a pin que nascer do fix; até lá, TESTING.md registra `E2E_PROD=1` como modo honesto para o spec (feito no PR #95).

## Mapa de guardas (prevenção de recorrência)

### Guardas NOVAS na sessão (já mergeadas ou em PR próprio)

| Guarda                                                                                    | Classe | Origem         |
| ----------------------------------------------------------------------------------------- | ------ | -------------- |
| `globalAccessConventions` — ban `Boolean(user)` em update de globals                      | 3      | P0 encontrado  |
| Bell loaders tipados pelo ator (recipientID não representável)                            | 1      | P0 adjacente   |
| `scriptCliConventions` — die-helper importado + `DAY_MS` single-source                    | 3      | P1 encontrado  |
| ESLint `src/lib`: `@/utilities/**` rejeita type-import                                    | 2      | dodge P3-K     |
| `localApiOverrideAccessConventions` — `user` sem `overrideAccess`; import dinâmico server | 3      | guarda ausente |
| `testMunicipalityAllocatorConventions` (3 regras)                                         | 3      | miss #73       |
| `sharedSheetHostConventions` + invariante dev no overlay                                  | 3 + 5  | miss #52       |
| `e2eNavigationConventions` (goto assentado + readiness WebAuthn)                          | 3      | misses #54/#53 |
| Convenção de navegação e2e em TESTING.md (**judgment-only declarado**)                    | 6      | miss #54       |

### Guardas existentes endurecidas na sessão

- `codebaseConventions` — a família de regex ancorada ganhou a irmã de literais (regra 3 do spec #73, keyed no catálogo).
- ESLint `src/lib` — comentário da zona agora codifica a política de módulos de contrato.

### Resíduo judgment-only (declarado, sem fingir que doc é guarda)

- Gatilhos de abstração dos itens defer+trigger (tabela abaixo) — convenção em rules/codebase-map.
- Migração `AdvisorsTable` → `CampaignTable` e fim do modo "Editar nome e contato" — decisão de produto (edit-in-place), não de guarda.
- `relationMembershipDelta` vs `leadershipMunicipalityMembership` (set+floor) — look-alike, não duplicação.

### Dodges medidos pendentes (viram workstream ou ficam registrados)

| Guarda                              | Dodge medido                                                                                        | Destino            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------ |
| Ratchet de bypass (P3-E)            | header de 40 linhas cobre 20+ chamadas (`notification/*`, `webauthnCeremony`)                       | P4-H               |
| `*FormActions.ts` (W4d)             | 7 escadas à mão em `actions/*.ts` (profile ×2, leaderSupporter, password ×4) invisíveis ao filename | defer+trigger      |
| Mensagens de recusa (P3-A)          | const lançada sem presença em safelist de rota (órfã → erro genérico)                               | defer+trigger      |
| `getCampaignUser` em páginas (P3-I) | só cobre `page.tsx`; `assessores/novo` redirect sem `requireCampaignPageActor` (1 de 34)            | defer+trigger      |
| Pin de top-level de `utilities/`    | é allowlist, não disciplina de domínio                                                              | doc (codebase-map) |
| `campaignJsonMutationRoute`         | `export const POST = handler` indireto                                                              | registrado         |
| Vocabulário banido                  | tokens quebrados por concatenação; `.md`/`.sql` fora de migrations                                  | registrado         |

## Registrados como defer + gatilho (sem ID novo)

| Par/candidato                                                                 | Medida                                                                 | Gatilho                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| Split de `RelationChipCell` (826 linhas; máquinas overflow/membership/chrome) | 11 states, blocos de 80/140/190 linhas                                 | próxima relação por chips OU queixa de escala de AT |
| Codec de sort ×3 + multi-toggle ×4 + round-trip ×6 (P3-F)                     | verificado 2026-07-31: **gatilho NÃO disparou**                        | 4º dropdown de sort / 5º multi-filtro               |
| Escadas `actions/*.ts` (7) + convite-login + schema advisors route            | novas actions (notifications/webauthn/suggestion) **usam** os wrappers | próxima escada bespoke → ampliar guarda W4d         |
| `wizardSignalHref`/`wizardTrendHref` (4–5 params posicionais)                 | 2 call sites com `undefined` placeholder                               | próximo href da família → options object            |
| Split de `suggestionCatalog` (646 linhas, 18 exports)                         | patternP1 tem 52 linhas                                                | 9º pattern OU 2º consumidor do avaliador            |
| Extrair `import-projecao.mjs` (1213 linhas)                                   | maior script do repo                                                   | 3ª família de planilha                              |
| `municipalityPageData` (548) / `municipalityListUrl` (500, 23 exports)        | god modules sob contrato congelado B18                                 | próxima faceta/sort                                 |
| `BahiaMap` (608) + `MunicipalityMapPanel` (734)                               | clients god, churn alto                                                | próxima feature de mapa que toque ambos             |
| `ActivityForm` (515)                                                          | formulário único                                                       | próxima feature de atividade                        |
| `agent-pool.mjs` tick (~118) + `derivePoolClaims` (~70)                       | já fatorado em `scripts/lib/agent-pool-*`                              | próxima fase do tick                                |
| `compare ?compare=` sem `unstable_cache` (ledger P3)                          | 3 anos × scan por candidato                                            | profiling mandar (ladder rung 2)                    |
| Posts `limit: 0` + filtro em memória (ledger P3)                              | corpus ~39 artigos                                                     | crescimento do corpus                               |

## Look-alikes rejeitados (não reabrir sem evidência nova)

- `toggleMunicipalityMulti*` × `toggleLeadershipMulti*` (sim 0,24 textual — mesma família de conhecimento do ×4 deferido, não mergear antes do 5º).
- `assertLocalUrl` (stage-snapshot/db-pull, sem override) × `assertLocalDatabase` (com override) — políticas diferentes de propósito.
- `parseEnv` (gate-ci/db-doctor, não muta `process.env`) × `loadCliEnv` (muta) — não forçar.
- `homeSearch*GroupHasHits` ×5 — `array.length > 0` fino demais para abstrair.
- `ui/Sheet` × `ui/Drawer` — consumidor único (Sidebar) não é duplicação.
- `createdBy` em `Notification`/`PushSubscription` — notificações são emitidas pelo sistema; push já carrega hash+timestamp de consentimento.

## Regras de execução (valem para cada workstream)

- Uma consolidação por entrega; gate completo bare (`tsc`, `lint`, `format:check`, `knip`, `check:cycles`, `test`, `build`) + Aikido quando o MCP estiver disponível (nesta sessão o ambiente Cloud não tinha o servidor — o row do ledger segue).
- Commits de estrutura nunca misturam comportamento; teste vermelho no meio do refactor = revert, não debug.
- Contratos congelados: URL (B18), schema (migration = entrega própria), Consent/LGPD fail-closed.
- Lista rejected-with-reason do Pass 3 continua valendo.
- Sobras → ledger via `capture-review-debts`; nada vive só no chat.
- Nenhum item fecha sem a classe de prevenção registrada no PR; guarda chega com o fix.
