# B34+ — Escala e DRY pós-B34

Fill-in de engenharia com os débitos que sobreviveram ao `/simplify` do **B34 ✓** (chips editáveis de municípios na lista de lideranças). Entrega-mãe: [`chips-municipios-lista-liderancas.md`](chips-municipios-lista-liderancas.md).

Três achados dos relatórios foram aplicados **no próprio fechamento do B34** e não voltam aqui: campos mortos no índice RSC (`city`/`zoneNumber`), o parser divergente de `FormData` em `/campanha/assessores`, e a mensagem de seleção vazia declarada duas vezes.

## Já resolvido no fechamento (medido, não estimado)

O passe de perf localizado que fechou o B34 rendeu, com bancada em `tsx` sobre o catálogo real (435 entradas, tabela de 25 linhas):

| Caminho                              | Antes   | Depois       | Como                                                                                                                |
| ------------------------------------ | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `buildMunicipalityPortfolioChips`    | 4,2 ms  | **0,78 ms**  | `WeakMap` por array de índice (`portfolioIndexDerivations`) + curto-circuito `territoryIds.length > remaining.size` |
| idem, em re-render (índice quente)   | 4,2 ms  | **0,043 ms** | o `WeakMap` sobrevive entre renders; um `useMemo` por linha não sobreviveria                                        |
| `searchMunicipalityPortfolio`, tecla | 4,59 ms | **0,077 ms** | query normalizada **uma vez** + rótulos pré-normalizados (`matchesNormalizedAtWordStart`)                           |

Também entraram: `sameIdSet` no lugar do comparador de chaves ordenadas escrito à mão (3º call site do helper), `scrollIntoView` restrito a navegação por teclado (o mouse já está onde aponta — era um layout forçado por opção percorrida), corpo do `Drawer` atrás de `drawerOpen` (era alocado em toda linha, inclusive no ponteiro fino onde nunca abre), e o `revalidatePath` passou a usar o delta real (`changed`) em vez de tudo que foi pedido — remover um município que já não estava vinculado não busta mais a rota dele.

**Um item do relatório foi rejeitado por medição, e vale registrar porque parecia óbvio:** remover o `sort: 'name'` do loader ("nada depende da ordem do banco") **quebrou a lista de sugestões**. `searchMunicipalityPortfolio` percorre o índice na ordem em que ele chega e para no `limit`, então a ordem alfabética das sugestões era a ordem do `ORDER BY` — sem ele o usuário passa a receber os 12 primeiros casamentos em ordem física de linha. O e2e do B34 pegou (o teste digita um prefixo e aperta Enter no primeiro item), e o `sort` voltou com o motivo escrito ao lado.

## F1 — Regressão de First Load JS nas duas listas (prioritário)

**Medido** contra `main` limpo (stash com `-u`, dois `pnpm build` completos, números como o Next reporta — minificados, não gzip):

| Rota                   | main   | B34        | Δ          |
| ---------------------- | ------ | ---------- | ---------- |
| `/campanha/liderancas` | 246 kB | **304 kB** | **+58 kB** |
| `/campanha/assessores` | 253 kB | **295 kB** | **+42 kB** |

A decomposição importa e ninguém deve re-derivá-la: `/campanha/assessores` **já** importava o catálogo estático da Bahia antes do B34 (via `advisorMunicipalityPortfolio.ts`, o módulo que virou `municipalityPortfolio.ts`), então os +42 kB de lá são a **célula em si** — Drawer, links, o contrato de combobox, a máquina de medição. Os +16 kB restantes em lideranças são o catálogo (`municipalityCatalog` + `bahiaTerritories` + `bahiaTseZones`, ~40 kB min / ~12,9 kB gzip) chegando a uma rota que não o tinha. É exatamente o custo que o **B14 ✓** já havia medido e nomeado (importar um serializador de URL no cliente custou 21 kB por um link).

**Duas direções, e elas se opõem — escolher, não fazer as duas:**

- **(a) Catálogo fora do browser.** O índice RSC passa a carregar `tseZones` e a célula deixa de importar `municipalityCatalog`/`bahiaTseZones`. Ganha ~12,9 kB gzip de bundle em duas rotas; **paga** mais payload em todo render _e em todo toggle de chip_ (a action revalida, o RSC re-serializa o índice inteiro).
- **(b) Payload mínimo.** O loader devolve só `{ id, slug }` (~13 kB crus contra ~45 kB) e nome/região/cidade saem do catálogo, que já está no bundle. Ganha em toda interação; mantém o bundle como está.

O staff edita muito e navega pouco, o que favorece **(b)** — o bundle é pago uma vez e fica em cache imutável, o payload é pago a cada toggle. A ressalva registrada é honesta: `buildMunicipalityPortfolioChips` hoje prefere de propósito o `region` **do banco** à resolução por slug do catálogo, "para os chips colaparem mesmo com divergência de alias entre ambientes". Essa justificativa é fraca — `municipalityCatalog` é snapshot-testado contra o catálogo semeado (`tests/fixtures/municipality-catalog.snapshot.json`), que é precisamente o guard que transforma divergência em teste vermelho — mas foi uma decisão deliberada, então a troca precisa de uma chamada explícita, não de um corte silencioso.

Um terceiro lance, **ortogonal e cumulativo**: carregar o `Drawer` por `next/dynamic` atrás do primeiro toque. Ele só abre em `pointer-coarse`, e uma gaveta que já anima pode absorver o import. Recupera parte dos +42 kB que atingem as duas rotas.

## F2 — `useChipRowOverflow`: o gatilho disparou e a máquina foi copiada

`MunicipalityPortfolioCell` e `LeadershipStateDeputyRelationCell` (B31 ✓) carregam ~105 linhas idênticas de medição de overflow — as constantes, o guard de "não trate o primeiro callback do observer como resize", a invalidação por conteúdo, o filtro `lastVisibleTop + 1`, o laço de largura da cauda, o `expandToggle` com `tabIndex={measuring ? -1 : undefined}` — incluindo um comentário verbatim. As duas células são renderizadas **pela mesma tabela**.

A duplicação é **anterior** ao B34 (nasceu entre `AdvisorMunicipalityCell` e a célula do B31; esta entrega moveu uma das cópias para `shared/`), mas o `AGENTS.md` do B34 escreveu que "**ele**, não o B37, é o gatilho de extração" — e o gatilho disparou. Extrair `useChipRowOverflow({ chipsKey, chipAttribute, toggleAttribute, trailingWidth, gapPx, enabled })` para `shared/`; a única diferença real entre os dois chamadores é o que ocupa o slot final (um botão de lápis com `ref` contra o `min-width` calculado do input), que vira o parâmetro.

## F3 — Um só delta de membership

`nextMunicipalityIdsAfterLeadershipMembership` é o **terceiro** módulo da família, e a generalização foi **verificada exata**, não aproximada: chamá-lo com um array de um elemento reproduz a semântica dos dois irmãos (`nextStateDeputyIdsAfterMembership`, `nextAdvisorIdsAfterMembership`) — `assigned === alreadyAssigned → null` equivale a `added.length === 0 → null`, e o teto checado antes do append equivale ao checado depois para um id. A única capacidade que os irmãos não têm é o piso, que já é opcional na forma. Colapsar em `nextRelationMembershipIds(current, changed, assigned, { max, capMessage, min, floorMessage })`, com os três nomes como wrappers de uma linha se o vocabulário importar; os três specs unitários viram um.

No mesmo arquivo, `setLeadershipMunicipalitiesMembershipRecord` e `setLeadershipStateDeputyMembershipRecord` são ~55 de ~90 linhas iguais e **adjacentes**, com três comentários copiados palavra por palavra. Um `withLeadershipRelationDelta({ leadershipId, relation, lockKey, computeNext })` — local ao arquivo, não genérico entre collections — dono da transação, do lock, da leitura escopada e do early return de no-op, deixando ao chamador a asserção de escopo e a busca de slug. Precedente declarado: `runStaffEntityMutation` (política no helper, mutação tipada no chamador). São 2 call sites, abaixo do limiar de 3 — mas "escrita por delta sob lock consultivo numa linha de liderança" é uma política que merece nome, que é a outra metade da mesma regra.

**Não** estender ao lado do assessor: `setAdvisorMunicipalitiesBatchRecord` percorre a relação **inversa** (`municipality.advisors`), com N locks / N leituras / N updates sob bypass admin. Um helper cobrindo os dois teria de ser parametrizado por "de que lado da aresta eu escrevo", que é a fontanaria genérica que o repo já rejeitou uma vez.

## F4 — Duas formas de view model para uma célula

`leadershipData.ts` estreitou certo (`municipalityIDs: number[]`), mas `AdvisorsTable` faz `row.municipalities.map((m) => m.id)` e joga `name`/`slug` fora — enquanto `municipalitiesByAdvisorIds` ainda roda um `payload.find` inteiro sobre `municipality` para produzi-los. A mesma decisão tomada de dois jeitos opostos na mesma entrega. Dar ao loader **de lista** um caminho só-ids (a forma `{id,name,slug}` continua para `assessores/[id]`, que de fato renderiza os nomes). Se o F1 (b) entrar, cai junto: o cliente resolve tudo pelo catálogo.

## F5 — Combobox à mão onde o kit já embrulha um

São ~90 linhas de teclado/ARIA mais ~20 de atributos duplicados entre as duas superfícies. **A restrição que descartaria a alternativa não se aplica:** o cmdk `Command` está corretamente fora (ele resolve itens consultando `[cmdk-item]` dentro da própria raiz, e o listbox aqui **precisa** ser portalizado porque o container de scroll da tabela recorta uma lista em fluxo) — mas `ui/combobox.tsx`, que embrulha o `Combobox` do base-ui, já aceita **`anchor`** e tem um hook `data-chips={!!anchor}`, ou seja, foi escrito para exatamente esta forma: input dentro de uma linha de chips, listbox portalizado ancorado na célula. Fit parcial (hits heterogêneos — município/TI/ZE — e a recusa por teto pedem render de item próprio de qualquer jeito), então remove a metade de teclado/ARIA, não o todo.

## F6 — Baixos

- **`PortfolioChipLabel`**: o ramo `chip.kind === 'municipality' ? <Badge asChild><Link/></Badge> : <Badge/>` está escrito duas vezes (~14 linhas) nas duas superfícies. O resto da divergência entre elas é a tese da entrega (16 px revelado no hover contra 44 px sempre visível) e deve continuar divergindo.
- **e2e**: `createStaffLeadership({ role, municipalities })` e `expectPostResponse(page, fragment)` em `campaignE2EFixtures.ts` — 3 call sites hoje.
- **`relationIds()`** exportado de `tests/helpers/campaignFixtures.ts`: `typeof entry === 'number' ? entry : entry.id` está reescrito em 9 lugares nos int specs, com `src/utilities/relationship.ts` já exportando o equivalente de produção. Débito anterior; o spec novo é a 9ª instância.
- **`loadMunicipalityPortfolioIndex` fora da escada de cache**: leitura do catálogo inteiro, de campos só-geografia, idêntica para todo ator e toda request, sem `cache()` nem `unstable_cache`. Uma chamada por request hoje, então o degrau 1 não compra nada — mas o degrau 2 é a resposta da escada. Decidir, não deixar por omissão.
- **Duas respostas para "quais ids formam o TI T?"**: resolvido no fechamento (busca e colapso agora leem o mesmo `idsByTerritory` do índice vivo), mas `municipalityIdsForTseZone` continua sendo o gêmeo de um laço que resolve slugs pelo `bySlug`. Colapsa em `municipalityIdsForEntries(entries, bySlug)` quando alguém tocar o arquivo.

## Fora de escopo (verificado, não é duplicação)

`runCampaignFormAction` está corretamente usado; `matchesAtWordStart`/`normalizeSearchPhrase` reusados sem normalizador paralelo; **nenhum 4º call site** da máquina de auto-save por debounce foi criado (o único `setTimeout` da célula é um deferral de 120 ms em `onBlur`, não um save — o débito **B32+** segue com seus 3+1 call sites); `CampaignListPendingBoundary` não se aplica (a célula dispara uma action, não uma navegação); a detecção de ponteiro não ignorou nenhum hook (`use-mobile.ts` é por largura, e escolher `pointer:` é a tese do B34); e a extração de `campaignHoverTooltip` é a correção certa de um bug de RSC real, não duplicação.
