# Pass 3 — Auditoria de engenharia e consolidação

**Data:** 2026-07-28 · **Método:** skill [`engineering-audit`](../../.cursor/skills/engineering-audit/SKILL.md) (Pass-style; cinco varreduras paralelas read-only) · **Tracker:** [IMPROVE-CODE-QUALITY-PLAN.md](../IMPROVE-CODE-QUALITY-PLAN.md) · **Ledger:** [TECH-DEBT.md](../TECH-DEBT.md)

## Contexto e manchetes

Terceira passagem de engenharia do repositório (antecedentes: Pass 1 em 2026-07-23/24, Pass 2 em 2026-07-25). Gatilho: pedido de uma varredura de "code smells" + consolidação de componentes/hooks/funções similares — mesmo quando não idênticos — inspirada nas skills de altos padrões de engenharia, com a licença explícita de que **o resultado pode mudar um pouco quando a funcionalidade é a mesma** (protocolo de delta de comportamento abaixo).

Baseline mecânico no início da auditoria: `tsc` 0 erros, `lint` 0 warnings, `knip` 0 findings (erro de carga do `payload.config.ts` já ledgerado P3), madge 0 ciclos (650 arquivos).

Manchetes (todas medidas):

- **0 P0.** Invariantes de segurança íntegros nas cinco varreduras: toda collection declara `access`, todo Local API com `user` usa `overrideAccess: false`, escritas multi-collection transacionais, WebAuthn (B40) com as quatro invariantes verificadas, consent fail-closed por chave estável.
- **1 P1:** o gate e2e segue vermelho — todos os locators ledgerados verificados vivos + nova causa medida: regex de nome de município não ancorada em `campaignMunicipalities.e2e.spec.ts:263` (**23/435 colisões de prefixo** no catálogo).
- **2 P2 de correção:** 4 `safeMessages` que nunca casam com a mensagem lançada (1 alcançável por usuário — advisor decidindo demanda escalada); `consentId` confiado do cliente no fluxo público de assinatura de petição.
- **~1.100+ linhas de duplicação medida** em 9 workstreams de consolidação (scripts CLI ~150, usuários e2e ~280, predicados de access ~120, prólogos de páginas ~110, shells de filtro ~100, config Org↔SD ~58, names-by-ids ×7+, máquinas de list-URL em 4 domínios…).
- **Higiene do ledger:** B34+ F2 **stale** (resolvido pelo B37 — fechar); gatilho MunicipalityHeaderFilter **fechado** (sistema compartilhado shipped); linha e2e-thin stale na contagem (15 specs/31 casos); gatilho de subfoldering de `utilities/` **disparado** (6 domínios: municipality +21, supporter +10, territory +5, leadership +5, webauthn +5, visit +4 novos módulos em 30 dias).
- **11 defer+gatilho** registrados sem ID novo (YAGNI / deep modules — padrão B34+/B37).
- Achados saudáveis que NÃO viraram débito: boundary client/server com zero violações; máquinas otimistas com baseline síncrono em todos os controles (a classe de bug do B34 está limpa); política de pointer só em CSS; live regions corretas; spot-check de ~45 exports do `lib/` sem mortos escondidos atrás da cegueira do knip.

## Protocolo de delta de comportamento (a licença do dono, segura)

- **Permitido:** consolidar sobre uma implementação quando as saídas diferem em detalhes pequenos (copy, ordenação, debounce, classes) — cada delta listado por item.
- **Obrigatório:** os pins existentes (unit/int/e2e) são a rede de caracterização. Rodar os suites que pinam os dois lados antes do merge; atualizar pins DELIBERADAMENTE na mesma entrega e listar cada assertion alterada no PR. Pin alterado silenciosamente = defeito.
- **Proibido sem item separado e aprovado:** contratos de URL (congelados, B18), schema de banco (migration = entrega própria), shapes de API pública, comportamento fail-closed de Consent/LGPD.

## Ondas

Correção antes de estrutura; estrutura antes de endurecimento de guardas; docs por último. Cada workstream é uma entrega independente com gate completo (`pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm check:cycles`, `pnpm test`, `pnpm build` — nunca pipeados — + Aikido nos arquivos editados). Commits de estrutura nunca misturam comportamento; teste vermelho no meio de refactor = revert, não debug.

### Onda 1 — Correção (pequena e cirúrgica)

#### P3-A Mensagens de recusa como constantes + guarda de correspondência

- **Evidência (verificada string a string):** 4 mismatches — `actions/demand.ts:63,98` e `actions/votePledge.ts:143` lançam a forma "…a assessoria **e o candidato**…" enquanto `demandas/[slug]/formActions.ts:26,77` e `municipios/[slug]/pledgeFormActions.ts:63` safelistam a forma sem candidato; `collections/CampaignDemand.ts:113` lança `'Demandas escaladas são decididas pelo Coordenador Geral ou Candidato.'` vs safelisted `'…Coordenador Geral.'` em `demandas/[slug]/formActions.ts:27` — **o caso alcançável por usuário** (advisor decidindo demanda escalada recebe a mensagem genérica). `mapCampaignFormActionError` casa por string exata (`campaignFormActionError.ts:53`), então os 4 colapsam. +1 entrada morta (`podem abrir demandas`, `demandas/nova/formActions.ts:34` — lançada em lugar nenhum). Clusters da mesma classe: `podem gerenciar lideranças.` ×3, `podem gerenciar apoiadores.` ×3, `gerenciam organizações.` ×3, `anexam comprovantes.` ×2, `'Celular brasileiro inválido.'` ×3 (`lib/phone.ts:45`, `lib/schemas/primitives.ts:27`, `collections/Contact.ts:80,87`).
- **Alvo:** constantes por domínio junto às regras (o padrão `MUNICIPALITY_*_MESSAGE` / `STATE_DEPUTY_*_MESSAGE` / `ADVISOR_*` já existe); teste de convenção novo: **todo literal em `safeMessages` aparece como string lançada no grafo de módulos da ação** — teria pego os 4 + o morto.
- **Delta de comportamento:** o motivo real da recusa chega à UI em 4 fluxos; nenhum acesso muda.
- **Pins:** o teste de convenção novo; int existentes de demand/pledge verdes.
- **Esforço:** S.
- **Guarda determinística (3, duas vias):** (a) spec — todo literal de `safeMessages` aparece como string lançada no grafo da ação; (b) spec — `throw new Error(` com literal de string em `campanha/actions/*.ts` e `formActions.ts` só via constante importada (allowlist: invariantes internos em inglês). A reword deixa de ser possível nas duas pontas.

#### P3-B Consent server-side na assinatura de petição

- **Evidência:** `submitPetitionSignature.ts:9,40,49` escreve o `consentId` postado pelo cliente em `signature` e `subscription` sem resolução server-side; a página renderiza o texto de `petition.form.consent` (`abaixo-assinado/[id]/page.tsx:153-155`) — um request adulterado registra consentimento a um documento diferente do exibido (proveniência LGPD enfraquecida, sem vazamento). O irmão WhatsApp resolve por chave estável, fail-closed (`submitWhatsapp.ts:16-22`, Pass 2 D3).
- **Alvo:** remover `consentId` do input; a action carrega a petição (leitura pública; `petitionId` já chega) e usa sua relação `form.consent`.
- **Delta:** a assinatura passa a registrar o consent real da petição; um id adulterado torna-se inerte.
- **Pins:** int novo — consentId divergente postado é ignorado.
- **Esforço:** S.
- **Guarda determinística (5 + 6):** o pin int é a guarda comportamental; convenção nova no codebase-map ("referência de consent resolve no servidor por chave/relação, nunca do cliente"). O shape do input não admite guarda mecânica — registrar explicitamente como judgment-only residual.

#### P3-C E2E gate verde + fixtures alinhados (P1)

- **Evidência (tudo verificado na árvore):** regex não ancorada em `campaignMunicipalities.e2e.spec.ts:263` (23/435 colisões de prefixo medidas: Conde/Condeúba, Catu/Caturama, Laje ×3, Barra ×4…); `getByLabel('Média')` ×2 com strict-mode violation (trigger do popover + input); checkbox de consent clicado antes da hidratação; cleanup e2e sem os campos E14 (`engagementLevel`/`levelNote`/nome de catálogo) que o cleanup int ganhou em 2026-07-27; o proxy e2e **possui e deleta** a linha compartilhada `apoiador-cadastro` (a isenção `leasedConsentKeys` existe só no int) e reimplementa a máquina de lease que existe três arquivos ao lado; 28 blocos `campaignUser` manuscritos (~280 linhas) onde um builder serve; `campaignListUrl` pinado 3× (spec compartilhado + 5 re-pins de domínio); invite-origin pinado em 2 suites (~160 linhas puras pagando custo int); 43 `fixtures.own()` manuais redundantes com o proxy de auto-ownership (contrato não documentado).
- **Alvo:** locators ancorados (nome exato/slug); espera por sinal de interatividade em vez de existência do elemento; cleanup e2e alinhado ao int (campos E14 + isenção de leased keys) **reutilizando** a máquina de lease; fixture `buildCampaignUser(...)`; colapsar os re-pins de URL na spec compartilhada parametrizada por domínio; invite-origin em uma só camada; documentar o auto-ownership do proxy e remover os `own()` redundantes.
- **Delta:** nenhum em produção; o gate volta a ser confiável — a leitura passa a ser "0 vermelhos", não "comparar a contagem com uma árvore stashed".
- **Pins:** os specs corrigidos; rodada a 1 e 2 workers.
- **Esforço:** M. **Fecha a linha P1 do ledger.**
- **Guarda determinística (3 + 1 + 5):** spec de convenção — `tests/e2e` não interpola nomes de catálogo em `new RegExp` sem âncoras `^…$`; o conjunto de campos resetáveis do município vira módulo único consumido pelos dois cleanups (drift de campos vira vermelho, não divergência silenciosa); spec unitária no proxy e2e pinando a isenção de leased keys.

### Onda 2 — Consolidação estrutural

#### P3-D Access layer: políticas nomeadas

- **Evidência:** fragmento advisor-scope `{ municipality: { in: ids ?? [] } }` ×7 em 6 módulos (`access/votePledges.ts:46`, `demands.ts:42`, `municipalityUpdates.ts:40`, `supporters.ts:48`, `activities.ts:43`, `contacts.ts:44`, `leaderships.ts:41,73,114`); prologue de leitura escopada quase verbatim em `canReadVotePledge` vs `canReadCampaignDemand`; motor memoizado triplicado (`getAccessibleMunicipalityIds` / `getAccessibleLeadershipIds` / `getAccessibleContactIds` + one-liner de fresh-user compartilhado); micro-cluster: branches advisor/leader byte-idênticos em `canCreateSupporter` (`supporters.ts:25-35`); alias cross-domain `allocationDecisions.ts` → predicados de `municipalityUpdates` (a política certa escondida sob o nome de outro domínio); wrapper de consent deprecated (`LeadershipConsentDescriptor`) ainda com 4 call sites; `getAccessibleContactIds` sem o early return `isCampaignUnrestricted → null` dos irmãos (`contacts.ts:29` — seguro hoje só por ordem de chamada).
- **Alvo:** `advisorMunicipalityScopeWhere(field, ids)` + `resolveActorScopedRead(req, …)` em `access/shared.ts`; motor privado `resolveAccessibleIds(req, user, memoKey, compute)`; colapsar os branches; finalizar o rename do wrapper de consent; a linha do early return; e o comentário de intenção LGPD no `removeSupporterData` (fecha a linha P3 "documentar ou alinhar" do ledger).
- **Delta:** nenhum (mesmos `Where` gerados).
- **Pins:** matriz int de access existente + `campaignAccessRequestMemo` (1 leitura de `campaign_user` por request) verdes; um pin por forma de predicado consolidada.
- **Esforço:** M.
- **Guarda determinística (3):** spec banindo `{ municipality: { in:` / `{ municipalities: { in:` fora de `access/shared.ts` (allowlist das formas genuinamente distintas) — collection nova que reescrever o fragmento quebra o build.

#### P3-E Loaders: montagem de leitura

- **Evidência:** "resolve nomes por ids" ×7+ (`campaignDashboardData.ts:57-74` — união de slugs que perde tipo para `Record<string,unknown>` —, `leadershipData.ts:56-72`, `organizationData.ts:64-79`, `campaignDemandData.ts:67-133,250-259`, `stateDeputyData.ts:251-266`, `votePledgeData.ts:130-146`, `activityDetailPageData.ts:25-51`, `municipalityUpdatePageData.ts:86-99`), com **~8 bypasses sem o comentário justificador** que o invariante exige (incl. `campaignWebAuthnCeremony.ts` ×4, `supporterImportToken.ts` ×4, `contactPhoneInvariant.ts:40`, `campaignConsent.ts:81`, `campaignInvitePageData.ts:61,80`, `municipalityMapData.ts:193`, `municipalityPageData.ts:517`); `MUNICIPALITY_CATALOG_CACHE_TAG` ao lado de `import { revalidatePath } from 'next/cache'` (`municipalityRevalidation.ts:1,11`) e importada por módulo puro — o precedente correto é `electionCache.ts` (tag sozinha, importável de qualquer lugar); fold de agregado de pledges ×2 (`votePledgeData.ts:53-107` vs `votePledgeViews.ts:80-108` — duas superfícies que não podem divergir; o E9 teve de adicionar `lastPledgeAt` nas duas); leitura de escopo ×3 (`campaignMunicipalityScope.ts:39-59`, `municipalityTriggers.ts:202-243`, `visitPlannerData.ts:162-188`) com select-base de 5 campos compartilhado.
- **Alvo:** wrappers tipados de uma linha (`loadCampaignUserNamesByIds`, `loadMunicipalityNamesByIds`…) sobre o núcleo `DynamicFind` já sancionado — o comentário de bypass vive uma vez dentro, e a slug-union que perde tipo morre; tag de cache em módulo neutro + `server-only` na revalidation; `aggregatePledgesWhere` delega o fold por bucket a `aggregateMunicipalityPledgesFromRows`; `loadMunicipalityScope(payload, user, where, { extraSelect })` com os extras na chave do React `cache()`.
- **Delta:** nenhum (mesmos selects; a honestidade de tipo melhora onde a união morria).
- **Pins:** int de listas/detalhes existentes; pin novo — agregado do dossiê === agregado da lista; pin de separação de cache-key por `extraSelect`.
- **Esforço:** M.
- **Guarda determinística (3 + 5):** spec exigindo comentário justificador (`// bypass: …`) em todo `overrideAccess: true` — o invariante social vira erro de build; os pins int (dossiê === lista; cache-key por `extraSelect`) são as guardas comportamentais das duas superfícies.

#### P3-F List-URL + shells de filtro/busca

- **Evidência:** `buildXSortHref` ×4 (`municipalityListUrl.ts:451`, `leadershipListUrl.ts:216`, `stateDeputyListUrl.ts:178`, `territoryListUrl.ts:150`), codec de sort ×3, multi-toggle ×4, canonicalize-round-trip ×6, cauda de serialização ×4 — 6–15 linhas cada, mesmo algoritmo, dados de domínio; `firstValue` ×3 (a 3ª grafia privada em `detailTabUi.ts:8-10`; a 4ª inline em `municipalityUpdatePageData.ts:39-42`), `XNotFoundError` ×3, `parseRegionsParam` + `canonicalTerritoryBySearchValue` ×2 (bundle-constrained — não pode entrar no `campaignListUrl`, lição dos ~21 kB); `ActivityFilters.tsx` ↔ `SupporterFilters.tsx` ~50 linhas quase verbatim cada — e **sem a guarda de no-op** do `useCampaignListFilterNavigation` (disparam round-trip RSC até quando o valor já está ativo); `CampaignSearchForm.tsx:30-31,41-43` serializa `?q=` na mão (latente: o primeiro param de filtro que a lista ganhar é silenciosamente dropado no submit); idioma de busca dividido (4 listas com debounce de 1 s, 3 com submit explícito, atividades sem busca — sem decisão registrada).
- **Alvo:** factories parametrizadas por dados em `campaignListUrl.ts` (`createSortToggleHref`, `createSortValueCodec`, `toggleMultiParam`, builder canonicalizante) — o contrato B18 sai preservado **por construção** (round-trip pelo parser do próprio domínio); `useCampaignFilterValues` + `CampaignCollapsibleFilterPanel` adotados pelos dois shells legados; `hrefForQuery` via serializador canônico; idioma de busca unificado no hook (debounce 1 s); módulo `territoryRegionParam.ts` minúsculo para os 2 importadores; `createEntityNotFoundError` para o 3º site da máquina (o gate 3+ bateu).
- **Delta:** a guarda de no-op passa a valer nos 2 shells (menos round-trips); 3 listas passam a buscar com debounce em vez de submit explícito (decisão registrada no PR); resto zero.
- **Pins:** specs de contrato de URL existentes por domínio + spec table-driven novo (padrão `relationMembershipDelta`).
- **Esforço:** M.
- **Guarda determinística (1 + 5):** `hrefForQuery` obrigatório na `CampaignSearchForm` — o consumidor não compila sem o serializador canônico (a serialização manual de `?q=` deixa de ser escrevível); specs de contrato de URL por domínio + spec table-driven das factories pinam a semântica. Adoção das factories em domínios futuros: judgment-only (doc).

#### P3-G Feedback de forms + primitives

- **Evidência:** JSX de feedback de form-action ×15 com `aria-live` em só 5 (`ActivityUpdateForm.tsx:39`, `ActivityResultForm.tsx:59`, `LeaderContactForm.tsx:84`, `SupporterForm.tsx:131`, `CampaignInviteForm.tsx:48`) — **10 alertas de erro mudos para AT**; efeito success→toast ×7; classe de input borderless ×4 verbatim (`AdvisorsTable.tsx:223,236,250` + `AdvisorDebouncedTextCell.tsx:121`); prop `showLabels` deprecated sem nenhum call site (`VoteEstimateScenarioStrip.tsx:18,27,32` — knip não vê props).
- **Alvo:** `CampaignFormActionMessage` (erro+sucesso, títulos parametrizados, `aria-live` sempre) + `useCampaignFormSuccessToast(state, onSuccess?)`; constante `campaignInlineInputClassName`; deletar a prop.
- **Delta:** os 10 alertas passam a anunciar (correção de a11y); convergência dos 5 spellings.
- **Pins:** int de forms existentes + uma asserção a11y.
- **Esforço:** S–M.
- **Guarda determinística (3):** spec banindo o JSX cru de feedback de form-action (`state.message && state.status …`) fora do `CampaignFormActionMessage` — mesmo estilo da guarda W4d; o primitive é dono do `aria-live`, então adoção = prevenção.

### Onda 3 — Estrutura (scripts, collections, camada de rotas)

#### P3-H Scripts + fold único de nome de município

- **Evidência:** esqueleto CLI reescrito 5–7× (`die` ×7, `sha256` ×5 byte-idêntico, download→cache→sha256 ×5 ~20 linhas, `writeJson`/`writeText` ×5 — o script mais novo copiou a forma VELHA: drift vivo —, `cacheDir` ×5, preâmbulo dotenv ×6); **dois resolvedores de nome de município divergiram**: o path de apoiadores (`lib/schemas/supporter.ts:19-28`) rejeita 4 das 5 grafias curadas pelo pipeline TSE ("Camacã", "QUINJINGUE", "Santa Terezinha", "Muquém do São Francisco") — um CSV de apoiadores digitado de documentos TSE falha no preview exatamente nos nomes que a campanha já reconciliou; `LOCAL_HOSTS` ×2 divergidos (`assert-local-database` aceita `postgres`, `db-pull` não); `ALLOW_REMOTE_DB` reescrito em `guard-dev-db`; o one-shot `generate-remodel-municipalities-migration.mjs` (146 linhas) sobreviveu ao próprio deploy e segura 2 entradas de allowlist reféns.
- **Alvo:** `scripts/lib/cli.mjs` (a casa existe desde B5 F2): `dieWithLabel`, `sha256Hex`, `loadCliEnv`, `ensureCachedDownload({label,url,ext,cacheDirEnvVar,defaultDir,expectedSha256})`, `writeRepoFile`; fold único (`normalizeSearchPhrase` é o estritamente mais forte) + tabela de aliases como dados + política de erro como dados; `db-pull` importa `LOCAL_HOSTS`; deletar o one-shot + suas 2 entradas de allowlist.
- **Delta:** import de apoiadores passa a aceitar as 4 grafias curadas (**bug latente corrigido**); `identityKey` muda em re-seed (inerte hoje: `runningAgain2026` é 100% `desconhecido` sem caminho de leitura); `db-pull` aceita host `postgres` (é local); saídas dos artefatos byte-idênticas (provadas pelos specs de artefato).
- **Pins:** specs de artefato existentes + casos de alias no int de import; uma rodada de build com cache-hit + `--dry-run`/`--report`.
- **Esforço:** M.
- **Guarda determinística (3 + 5):** spec banindo `function die(`, `createHash('sha256')` e preâmbulo dotenv fora de `scripts/lib/`; spec unitária iterando a tabela de aliases curada e assertando que o resolvedor de apoiadores aceita TODOS — a tabela é dado, divergência futura vira vermelho.

#### P3-I Collections config + camada de rotas

- **Evidência:** campo de ator (`createdBy`/`decidedBy`/`declaredBy`) ×5–7 quase verbatim + hook de stamping ×3 verbatim — drift orgânico já aconteceu (Supporter/Leadership ganharam `read:`, CampaignInvite é `required`) — e o precedente de factory existe (`voteEstimateScenarioFields`); `trimmedText` ×4 byte-idêntico em collections (helper puro fora do `lib/`); divergência `[...new Set(relationshipIds())]` vs `uniqueRelationshipIds()`; schema de rota reescrito (`municipios/advisors/route.ts:16-20`) em vez do omit/extend dos irmãos; **guarda W4d furada**: casa só nomes `*FormActions.ts`, então 7 ladders em `actions/*.ts` escapam — 3 expressíveis hoje sem delta (profile avatar ×2, leaderSupporter) e **convite-login fora da allowlist e já expressível** (o mismatch de senha é `FormDataBoundaryError`); `password.ts`/`auth.ts` genuinamente bespoke mas não registrados; `NEXT_REDIRECT` hand-rolled ×2; prólogo de página staff ×22 (~110 linhas) com divergência `return null` ×5 vs `redirect` ×17 (ambos inalcançáveis pela barreira do layout — mas páginas novas copiam o que abrirem primeiro); `requireConsentByKey` chamado cru onde o wrapper nomeado existe (`leaderSupporter.ts:99-104`).
- **Alvo:** `campaignAuditFields.ts` (`systemStampedActorField({name,label,withRead?})` + `deriveCampaignCreatedBy`); `trimmedText` → `lib/`; omit/extend na rota de advisors; migrar os 3–4 ladders expressíveis; guarda ampliada para exports `(state, formData)` em `actions/` **ou** allowlist com razão para password/auth; `requireCampaignPageActor({gate})` para as 22 páginas; wrapper nomeado no leaderSupporter.
- **Delta:** os 5 `return null` ganham redirect no caso inalcançável (invisível); estados das ladders migradas idênticos (incl. chaves de `fieldErrors`).
- **Pins:** int/e2e existentes de avatar, leader supporter, convite login; o spec da guarda ampliada.
- **Esforço:** M.
- **Gatilhos irmãos (registrar, não executar):** `validateMunicipalityAdvisors` ↔ `validateActivityAdvisors` (~20 linhas ×2 — 3º campo de staff-assignment); gêmeo de config Org↔SD (~58 linhas — 3ª entidade de referência staff); esqueleto de transação crua no frontend ×2 (3ª escrita pública).
- **Guarda determinística (3 ×3):** guarda W4d ampliada para exports `(state, formData)` em `actions/` (as 7 ladders invisíveis quebram o build); ban de import de `getCampaignUser()` em `(app)/**/page.tsx` fora do `requireCampaignPageActor`; ban do campo de ator hand-spelled (`canSetCampaignSystemField` + relationship `campaignUser` readOnly) fora da factory.

#### P3-J Subfoldering de `utilities/` — gatilho D1 disparado

- **Evidência:** 122 módulos top-level (eram 92 no Pass 2); novos em 30 dias (`git --diff-filter=A`): municipality +21, supporter +10, territory +5, leadership +5, webauthn +5, visit +4 — **6 domínios passaram do gatilho "3º módulo novo de um domínio num mês"** registrado na decisão D1 do Pass 2; `campaignTime.ts` (140 linhas, zero imports) e `relationship.ts` (33 linhas, zero imports) são puros e estão na camada errada.
- **Alvo:** executar o subfoldering D1 para os domínios que dispararam (`municipality/`, `supporter/`, `territory/`, `leadership/`, `visit/`, `webauthn/`) — imports diretos, **sem barrels** (a lição do barrel `campaignAccess` + sidebar já foi paga); mover `campaignTime`/`relationship` → `lib/`; atualizar `codebase-map.mdc` + `ARCHITECTURE.md` no mesmo PR (a convenção exige os dois juntos).
- **Delta:** nenhum (churn de paths apenas).
- **Pins:** `check:cycles` + guarda de convenções; sem pins de comportamento.
- **Esforço:** M (mecânico; último da onda para não invalidar paths das consolidações anteriores).
- **Guarda determinística (3):** allowlist pinada dos módulos top-level de `src/utilities/` — módulo novo top-level falha o build até ser registrado (codifica o gatilho D1 em vez de depender de memória).

### Onda 4 — Guardas, constantes e docs

#### P3-K Guardas + single-sourcing

- **Guardas:** regex de vocabulário tolerante a acento (`/pra[çc]|n[úu]cleo/i` + allowlist dos 2 hits legítimos — hoje `praca`/`nucleo` sem acento passam, e a linha irmã "Plano de Ação" já foi endurecida por isso); guarda `server-only` ampliada para value-imports de `next/cache` / `next/server` / `next/headers` (`municipalityRevalidation.ts` e `campaignJsonMutationRoute.ts` são server-bound e invisíveis hoje); ESLint `no-restricted-imports` barrando value-imports vindos de `components/` dos 3 módulos client-safe que carregam o artefato TSE de 623 KB (`municipalityTerritorialClass`, `municipalityPotential`, `territoryIntraCaptureBenchmark` — o B13 evitou por disciplina, não por mecanismo).
- **Single-sourcing (cada um S, um PR por cluster afim):** tipo territorial-class → `lib/territorialClassAnchors.ts` (adicionar uma classe vira erro de tipo no lib — hoje compila verde e mis-sorta); `DAY_MS` ×3 → casa neutra (e sai da interface pública do `suggestionCatalog`); `MAX_VOTE_COUNT` ×6 (duas camadas validando o mesmo campo com o mesmo bound escrito duas vezes); exportar `passwordSchema`/`tokenSchema` de `campaignPassword.ts` (o `invite.ts` copiou); `lib/electionYears.ts` leaf (o espelho do `suggestionCatalog` morre junto com a desculpa documentada); `formatBrazilianPhoneDisplay = formatBrazilianPhoneInput` (delega, mantém nome/doc); transform de dedup no `advisorMunicipalitiesBatchSchema`; `formatElectionNumber` nos 3 formatters de `voteEstimate.ts` (o E18 pinou zero frações; eles reescritos sem o pin); deletar `hasAnyEstimate` (gêmeo mais fraco de `hasAnyVoteEstimate`).
- **Esforço:** S cada.
- **Guarda determinística: esta É a workstream de guardas** — 2 ESLint + 3 specs de convenção endurecidas/novas + 1 single-sourcing de tipo (ver Mapa de guardas).

#### P3-L Ledger + docs reconcile

- Fechar B34+ F2 (resolvido por B37) e o gatilho MunicipalityHeaderFilter; atualizar e2e-thin (15 specs/31 casos) e a linha Praça-copy (W4f executado; resto = textos de consent provisórios Onda 0, lote jurídico — D6); `codebase-map.mdc`: exceção `TerritoryOverviewTable` morta (a rota usa `CampaignTable` com sort de URL desde B21) + nota de que `lib/formData.ts` é o único `server-only` do lib; `TESTING.md` truth-up (backlog de caracterização: `posts.ts` e `activityViewModels.ts` seguem sem pin — confirmado nesta auditoria).
- **Esforço:** S.
- **Guarda determinística (6):** doc — a convenção "codebase-map + ARCHITECTURE no mesmo PR" já existe; reafirmar. Sem mecanismo.

## Mapa de guardas (prevenção de recorrência)

Regra desta passada (decisão D6 do tracker): nenhum item fecha sem a classe de prevenção registrada, e guarda nova shipa na MESMA entrega do fix — nunca "depois". Escala de determinismo: **(1) tipo** (o estado ruim não compila) → **(2) ESLint** (`no-restricted-*`) → **(3) spec de convenção** (`codebaseConventions.unit.spec.ts`, table-driven) → **(4) análise estática CI** (knip/madge) → **(5) pin comportamental** → **(6) doc/convenção** (último recurso, declarado como tal).

**Guardas novas que esta passada shipa (12):**

| Guarda                                                                                         | Classe | WS   |
| ---------------------------------------------------------------------------------------------- | ------ | ---- |
| safeMessages ↔ throw, duas vias (literal safelisted existe como throw; throw só via constante) | 3      | P3-A |
| Comentário justificador obrigatório em `overrideAccess: true`                                  | 3      | P3-E |
| Âncoras `^…$` em regex de e2e com nomes de catálogo                                            | 3      | P3-C |
| Fragmento advisor-scope banido fora de `access/shared.ts`                                      | 3      | P3-D |
| JSX cru de feedback de form-action banido fora do primitive                                    | 3      | P3-G |
| Esqueleto CLI (`die`/sha256/dotenv) banido fora de `scripts/lib/`                              | 3      | P3-H |
| Allowlist pinada dos top-level de `src/utilities/`                                             | 3      | P3-J |
| `getCampaignUser()` banido em `(app)/**/page.tsx` fora do helper                               | 3      | P3-I |
| Campo de ator hand-spelled banido fora da factory                                              | 3      | P3-I |
| `server-only` ampliada a `next/cache` / `next/server` / `next/headers`                         | 3      | P3-K |
| Vocabulário banido tolerante a acento                                                          | 3      | P3-K |
| ESLint `no-restricted-imports` do artefato TSE (value-import vindo de `components/`)           | 2      | P3-K |

**Guardas existentes endurecidas (3):** W4d filename guard → exports `(state, formData)` em `actions/` (P3-I); sweep `server-only` (P3-K); regex de vocabulário (P3-K).

**Fonte única / tipo (classe 1):** conjunto de campos resetáveis compartilhado int↔e2e (P3-C); `hrefForQuery` obrigatório (P3-F); união territorial-class em `lib/territorialClassAnchors.ts` (P3-K).

**Pins comportamentais (classe 5):** aliases curados resolvem em todo path (P3-H); dossiê === lista (P3-E); cache-key por `extraSelect` (P3-E); consentId adulterado ignorado (P3-B); isenção de leased keys no proxy e2e (P3-C).

**Judgment-only residual (declarado):** adoção das factories de list-URL em domínios futuros; chamadas do gate de abstração (3+ call sites); trade-offs de bundle; gramática de busca unificada — prevenção = docs + listas rejected-with-reason + esta trilha de decisões. Não fingir que doc é guarda.

## Registrados como defer + gatilho (sem ID novo)

| Par                                                                                                                                     | Gatilho                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Token assinado HMAC ×2 (`supporterImportToken` ↔ `campaignWebAuthnChallenge`, ~30 linhas + cookie options ×2)                           | 3º token assinado → `signedToken.ts`                                                  |
| Prólogo de redemption ×2 (`campaignInviteRedemption.ts:91-168` ↔ `170-297`)                                                             | 3º tipo de convite → policy wrapper                                                   |
| Montagem de avaliador ×2 (`municipalityTriggers` ↔ `visitPlannerData`)                                                                  | 3º avaliador (o wiring "não vá" do E13 pode ser) → `loadMunicipalityEvaluationInputs` |
| Esqueleto do `AdvisorDebouncedTextCell` (3 deltas medidos e justificados vs `useCampaignCellAutosave`)                                  | 2ª célula free-text debounced → transport seam + `revertOnFailure`                    |
| Editor de set estilo roster (`MunicipalityListAdvisorsControl`, reconciliador por seq — provado correto pelo advisory lock do servidor) | 3º editor roster → extrair a máquina ou modo "roster" do `RelationChipCell`           |
| `validateXAdvisors` ×2                                                                                                                  | 3º campo de staff-assignment → `assertEligibleCampaignStaffIds`                       |
| Gêmeo de config Org↔SD (~58 linhas)                                                                                                     | 3ª entidade de referência staff → factories de name/slug                              |
| Esqueleto de transação crua no frontend ×2                                                                                              | 3ª escrita pública multi-collection                                                   |
| Gêmeos `advisorData` (`:90-116` ↔ `:118-147`)                                                                                           | 3ª leitura por assessor                                                               |
| `memoizeProcess` ×4 (`let x = null; if (x) return x; …`)                                                                                | dobrar em qualquer entrega que toque esses módulos                                    |
| Fórmula LQ ×2 (classifier 2022-only vs per-year nos triggers)                                                                           | 3º escritor de LQ → `locationQuotient` no `lib/`                                      |
| Sentinela + `exists:false` OR-branch ×2                                                                                                 | já registrado in-code ("a third should extract") — mantido                            |

**B34+ F10** (batch twins município-side, 2 sites) verificado: raciocínio e gatilho continuam corretos onde estão.

## Explicitamente fora (e por quê)

- `municipalityListUrl.ts` (537 linhas/23 exports) e `municipalityListFilters.ts` (417/24): cruzam o limiar de god module mas são contratos coesos e congelados (B18) — split por estética churna a superfície congelada. Watch, não split.
- `import-projecao.mjs` (1.214 linhas): pipeline one-shot faseado que ganha o tamanho; extração quando virar rotina mensal.
- `searchMunicipalityPortfolio` (74 linhas): linear com early-returns; borderline, fica.
- `resolveOgImage` ×2 por request de artigo (re-parse do Lexical): micro; revisitar só se profiling mandar.
- `cities.ts` (5.651 linhas) e os 4 catálogos nome-chaveados: dados estáticos com fixtures de evidência — julgados como dados, não como código.
- Qualquer mudança de URL, schema de banco, API pública ou texto de Consent: fora do escopo desta passada (protocolo acima).

## Look-alikes rejeitados (não reabrir sem evidência nova)

`formatLqMultiple` 1 vs 2 casas (política de precisão proposital — a borda 0,95× imprimiria "1,0×" em duas faixas adjacentes); 4 catálogos nome-chaveados (proveniências independentes, cada uma com sua fixture de evidência); 3 lazy loaders de `bahiaGeometries` (~15 linhas poupadas por uma interface a mais — não paga); `campaignRelationOptions` ×5 (rejeitado por medição: o prologue é uniforme e o conteúdo é o label); `formatXActiveFiltersSummary` / sort-options / clear ×3–4 (2–3 linhas de esqueleto, o conteúdo é copy de domínio); `RelationMultiSelect` ↔ `RelationChipCell` (state ownership diferente: draft FormData vs writes otimistas); 3 updates simples de `municipality.ts` (honestidade de tipo > ~15 linhas); curries `getFreshStaffActor` ×5 (a mensagem já é o parâmetro); `buildMunicipalityFilterOptionHref` re-derivando regras do parser (fast path medido, documentado); `supporterListFilters` vs `supporterListSqlFilters` (espelho SQL deliberado do C6, núcleo já extraído).

## Regras de execução (valem para cada workstream)

1. Uma consolidação por entrega; gate completo por entrega, comandos nunca pipeados; Aikido nos arquivos editados.
2. Commits de estrutura nunca misturam comportamento; teste vermelho no meio de refactor = revert, não debug.
3. Migrations congeladas nunca editadas; mudança de schema = `pnpm migrate:create` (nenhuma prevista nesta passada).
4. A lista rejected-with-reason da skill `engineering-audit` vincula a implementação.
5. Sobras e débitos novos → ledger via `capture-review-debts`; nada vive só no chat.
6. Itens que inflarem além do appetite viram roadmap via `roadmap-item`.
7. Nenhum item fecha sem a classe de prevenção (1–6) registrada no PR; guarda nova shipa junto com o fix, nunca "depois".
