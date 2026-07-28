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

Também entraram: `sameIdSet` no lugar do comparador de chaves ordenadas escrito à mão (3º call site do helper), `scrollIntoView` restrito a navegação por teclado (o mouse já está onde aponta — era um layout forçado por opção percorrida), e o `revalidatePath` passou a usar o delta real (`changed`) em vez de tudo que foi pedido — remover um município que já não estava vinculado não busta mais a rota dele.

**Um item do relatório foi rejeitado por medição, e vale registrar porque parecia óbvio:** remover o `sort: 'name'` do loader ("nada depende da ordem do banco") **quebrou a lista de sugestões**. `searchMunicipalityPortfolio` percorre o índice na ordem em que ele chega e para no `limit`, então a ordem alfabética das sugestões era a ordem do `ORDER BY` — sem ele o usuário passa a receber os 12 primeiros casamentos em ordem física de linha. O e2e do B34 pegou (o teste digita um prefixo e aperta Enter no primeiro item), e o `sort` voltou com o motivo escrito ao lado.

## Fechado no `/simplify` pós-rebase (a premissa que morreu)

O rebase em `main` trouxe o **B42 ✓** e, com ele, `CampaignCellEditOverlay`. A leitura inicial foi que a casca não servia porque "ela decide por largura de viewport e o B34 decide por tipo de ponteiro". **Isso é falso no código:** a casca não decide nada — `variant` é prop, não há `matchMedia` nela, e o docstring diz isso com todas as letras. Quem decide por largura é o `MunicipalityList`, que renderiza duas árvores irmãs; `LeadershipListSupportStatusControl`, na mesma tabela do B34, fixa `variant="popover"` porque sabe a sua própria política. O B34 passou a ser a terceira política sobre um container que não tem nenhuma: **`variant="sheet"` fixo, com o `pointer-fine:hidden` no `triggerClassName`**, e a política de ponteiro continua onde estava, no CSS.

Ganhos que não eram sobre linhas (embora sejam ~25 a menos, ~14 delas cópias verbatim do `DrawerHeader`/`DrawerFooter`): o `initialFocus={titleRef}` da casca — o Drawer do B34 focava o **primeiro chip**, um link que navega para fora da linha que se está editando, ou o campo de busca numa linha em rascunho, que é exatamente o teclado-virtual-sobre-a-folha que o B42 documentou; o trigger passou a ter `aria-haspopup="dialog"`/`aria-expanded`/`aria-busy`, que todo outro trigger de célula das duas listas já tinha; e a célula entrou no spec table-driven da casca como **5º caso** — a metade Drawer do B34 não tinha nenhuma cobertura, porque o e2e roda em ponteiro fino.

**A adoção custou um bug real, achado pelo e2e e vale saber antes de adotar a casca em outro lugar:** um `Drawer` sempre montado reporta `onOpenChange(false)` quando uma dispensa em outro ponto da página varre a pilha de camadas — não só quando ele mesmo fecha. O handler novo (limpar a busca ao fechar a folha, para que o listbox portalizado não apareça num toque depois que a gaveta sai) apagava, sem guarda, o que o ponteiro **fino** tinha acabado de digitar no input inline. O guard é `if (!next && drawerOpen)`.

Também fechado aqui, e é correção de comportamento, não de estilo: `setAdvisorMunicipalitiesBatch` revalidava só o **último** município do lote (`lastSlug`). Era pré-existente do B19, mas o B34 promoveu o lote ao **único** caminho de escrita do assessor e pôs um chip de território ao alcance do dedo, então soltar um TI de 30 municípios deixava 29 páginas de detalhe velhas. Agora devolve `slugs: string[]` e revalida a lista uma vez e cada detalhe que mudou, espelhando `revalidateLeadershipMunicipalityPaths`.

**Duas recomendações do relatório foram fechadas como "não fazer", com motivo:** o ramo **Popover** da casca não serve ao B34 e não deve ser adotado — ele entrega `role="dialog"` atrás de um `PopoverTrigger`, e um dialog não pode ser o popup de um combobox ARIA 1.2 (o inline precisa de `PopoverAnchor` + `role="listbox"` que nunca toma foco). E o **F3** abaixo (colapsar os três `next*IdsAfterMembership`) continua registrado, mas com a recomendação invertida por uma segunda leitura: um genérico cobrindo "um id" e "um conjunto com piso e teto" precisaria de quatro callbacks para poupar ~20 linhas.

## Fechado na revisão de qualidade + performance (o bug que voltou)

**O achado que importa: o bug do baseline otimista tinha voltado, escrito de outro jeito.** O fechamento anterior corrigiu "aplicar o delta funcionalmente" e registrou isso como resolvido — mas o `??` _dentro_ do updater ainda lia o `municipalityIds` da render que criou a closure, e o "Desfazer" do toast é justamente o único chamador que sobrevive à sua render. Sequência real, reproduzida em teste: remover um território (toast aparece) → servidor reconcilia, `optimistic` volta a `null` → **adicionar outro município** → apertar Desfazer. O updater cai no ramo do fallback, reconstrói a linha a partir do conjunto de antes do add, e o município adicionado some da tela enquanto continua salvo no servidor. A divergência é **permanente**, porque o efeito de reconciliação só limpa em igualdade exata. Corrigido com um ref (`latestIds`) que segue `effectiveIds`, e o ramo `draft` o avança **de forma síncrona** — dois toggles no mesmo tick liam ambos a prop da render em que foram enfileirados, e o segundo descartava o primeiro.

Isso agora tem pino: `tests/unit/municipalityPortfolioCell.unit.spec.ts` monta a sequência inteira e falha (vermelho verificado) contra a versão com o bug. As duas revisões **discordaram** aqui — a de performance leu o `withDelta` funcional e concluiu "sem divergência de closure"; a de qualidade traçou a sequência. Vale registrar qual estava certa, porque a leitura otimista é a intuitiva.

**Uma otimização anterior foi desfeita por medição, e ela era minha:** o corpo do `Drawer` estava atrás de `drawerOpen` como "ganho de alocação". O ganho foi medido e é **zero** — o portal fechado não emite DOM e a string de 85 classes é acerto de cache do tailwind-merge (2,71 ms frios uma vez por sessão, 0,0001 ms depois) — enquanto o custo é real: base-ui mantém o popup montado durante a transição de saída, então fechar a gaveta animava uma caixa **vazia** encolhendo. As outras duas células em célula da casa não fazem esse gate. Removido.

Também entraram: `matchesNormalizedAtWordStart` deixou de fatiar/juntar palavra por palavra — como `normalizeSearchPhrase` emite exatamente `words.join(' ')`, "começo de palavra" é a posição 0 ou depois de um espaço, então `startsWith(q) || includes(' ' + q)` diz o mesmo em **0,0011 ms contra 0,0585 ms** por 435 rótulos (53×, equivalência verificada em 4.608 pares com apóstrofo, travessão, dígito e vazio); `matchesAtWordStart` normaliza a query **primeiro** e sai cedo na vazia, que é como os pickers filtram a lista inteira ao abrir; e `buildMunicipalityPortfolioChips` passou a **copiar** o `municipalityIds` do território ao montar o chip — aquele array é memoizado por índice e compartilhado por toda a tabela, então entregá-lo a um chamador transformava qualquer `sort`/`splice` posterior em corrupção da página inteira.

## F7 — Cada toggle de chip re-renderiza a página inteira (374 SQL, 229 ms)

`setLeadershipMunicipalitiesMembership` chama `revalidatePath('/campanha/liderancas', 'page')` a cada toggle, e a célula grava **uma action por toggle**. O Next re-executa a página dentro da resposta da action: medido localmente, com 288 lideranças, **374 statements e 228,6 ms** (`loadLeadershipListPageData` 371/183,3 ms + `loadStateDeputyOptions` 2/4,4 ms + `loadMunicipalityPortfolioIndex` 1/11,9 ms), mais ~44 kB de payload por toggle. Limpar um chip de território e adicionar três dispara isso quatro vezes — e localhost é **piso**: `gru1`↔`sa-east-1` soma ~1–3 ms por round trip.

A célula já reconcilia contra o array do servidor e já faz rollback por delta em falha, então o refresh da lista não entrega nada que o usuário veja. Direção recomendada: dispensar o `revalidatePath` da própria lista no caminho de sucesso (mantendo o dos detalhes de município, que mudam de verdade) e deixar o estado otimista de pé até navegação. Não foi feito agora porque é mudança de comportamento em caminho de escrita e merece a sua própria medição pós-fix.

## F8 — O índice de municípios é dado de referência lido sem cache

`loadMunicipalityPortfolioIndex` custa **12,4 ms medianos (1 SQL)** e roda uma vez por request em duas rotas — e de novo em cada re-render disparado pelo F7. **~10 dos 12 ms são o transform por documento do Payload**, não a query: pedir só `slug` no `select` não muda nada (10,7 ms).

Contra a escada de cache do repo: o degrau 1 (`cache()`) rende **zero** — é um único call site por request, dentro de um `Promise.all`. O degrau 2 (`unstable_cache` + tag) é o encaixe certo e não está em uso: nome/slug/região de município é geografia read-only semeada por migration, a definição de dado lento entre requests. Uma tag `municipality-catalog` no allowlist de `revalidateRequest.ts` tira 12 ms das duas rotas e de todo toggle.

**Correção ao F1:** a opção (b) "payload mínimo" encolhe o payload RSC de **35.510 B / 7.286 B gzip** para **13.610 B / 3.534 B gzip**, mas **não poupa tempo de servidor nenhum** (10,7 ms de qualquer jeito). A decisão registrada é payload-contra-bundle, não um ganho de servidor.

## F9 — O ramo do assessor entrega uma chave nova ao WeakMap por linha

`searchIndex` filtra `municipalityIndex` quando há `addableIds`, produzindo **um array novo por linha** — e é esse array que vira a chave do WeakMap de derivações. O assessor fica com 25 conjuntos de derivação (4 Maps cada) em vez de um, e paga o build O(435) de novo na primeira busca de cada linha: **1,89 ms** para as 25 contra 0,076 ms para uma. É exatamente o modo de falha que a memoização foi escrita para evitar, embora o número absoluto seja pequeno.

Duas saídas, nenhuma feita agora: passar `addableIds` como opção de `searchMunicipalityPortfolio` (preserva a contagem escopada de hits de TI/ZE e elimina as 25 alocações, mas mexe na assinatura de uma função compartilhada), ou memoizar o filtro num WeakMap aninhado dentro da célula (contido, mas é uma segunda camada de cache).

## F1 — Regressão de First Load JS nas duas listas (prioritário)

**Medido** contra `main` limpo (stash com `-u`, dois `pnpm build` completos, números como o Next reporta — minificados, não gzip):

| Rota                   | main   | B34        | Δ          |
| ---------------------- | ------ | ---------- | ---------- |
| `/campanha/liderancas` | 246 kB | **304 kB** | **+58 kB** |
| `/campanha/assessores` | 253 kB | **295 kB** | **+42 kB** |

**Ajuste pós-rebase (medido nas duas pontas, não inferido):** adotar `CampaignCellEditOverlay` mexeu nisto, e para os dois lados. O chunk **próprio** de cada rota encolheu (assessores 6,58 → **4,05 kB**; lideranças 6,89 → **6,46 kB**), mas o First Load de assessores subiu 295 → **297 kB**, enquanto lideranças ficou em **305 kB**. A assimetria tem uma causa só: a casca arrasta `CampaignHoverTooltip` (o ramo Popover a usa para a tooltip do B23) para uma rota que ainda não tinha nenhum chamador de overlay — lideranças já tinha, pela coluna Status. Não muda a recomendação abaixo; muda a linha de base contra a qual ela será medida.

A decomposição importa e ninguém deve re-derivá-la: `/campanha/assessores` **já** importava o catálogo estático da Bahia antes do B34 (via `advisorMunicipalityPortfolio.ts`, o módulo que virou `municipalityPortfolio.ts`), então os +42 kB de lá são a **célula em si** — Drawer, links, o contrato de combobox, a máquina de medição. Os +16 kB restantes em lideranças são o catálogo (`municipalityCatalog` + `bahiaTerritories` + `bahiaTseZones`, ~40 kB min / ~12,9 kB gzip) chegando a uma rota que não o tinha. É exatamente o custo que o **B14 ✓** já havia medido e nomeado (importar um serializador de URL no cliente custou 21 kB por um link).

**Duas direções, e elas se opõem — escolher, não fazer as duas:**

- **(a) Catálogo fora do browser.** O índice RSC passa a carregar `tseZones` e a célula deixa de importar `municipalityCatalog`/`bahiaTseZones`. Ganha ~12,9 kB gzip de bundle em duas rotas; **paga** mais payload em todo render _e em todo toggle de chip_ (a action revalida, o RSC re-serializa o índice inteiro).
- **(b) Payload mínimo.** O loader devolve só `{ id, slug }` (~13 kB crus contra ~45 kB) e nome/região/cidade saem do catálogo, que já está no bundle. Ganha em toda interação; mantém o bundle como está.

O staff edita muito e navega pouco, o que favorece **(b)** — o bundle é pago uma vez e fica em cache imutável, o payload é pago a cada toggle. A ressalva registrada é honesta: `buildMunicipalityPortfolioChips` hoje prefere de propósito o `region` **do banco** à resolução por slug do catálogo, "para os chips colaparem mesmo com divergência de alias entre ambientes". Essa justificativa é fraca — `municipalityCatalog` é snapshot-testado contra o catálogo semeado (`tests/fixtures/municipality-catalog.snapshot.json`), que é precisamente o guard que transforma divergência em teste vermelho — mas foi uma decisão deliberada, então a troca precisa de uma chamada explícita, não de um corte silencioso.

**Parente, não duplicata — o rebase em `main` trouxe isto à vista:** o **B33+** já registra que `/campanha/municipios` embarca ~10 kB gzip do mesmo catálogo, e o gatilho de lá já disparou duas vezes (B41 ✓, B42 ✓) sem ninguém pagar. Os dois são a mesma classe de problema com **causas opostas**, e a correção não é a mesma: lá o catálogo entra por **acidente** (um `isMunicipalitySlug` em `municipalityListUrl.ts` arrasta o módulo inteiro para três componentes de filtro que só queriam um predicado), e o conserto é mover o predicado para um módulo client-safe; aqui ele entra **de propósito**, porque a célula precisa mesmo de nome/região/ZE, e o conserto é escolher quem carrega o dado — bundle ou payload. Quem atacar um não fecha o outro; quem atacar os dois deve fazê-lo na mesma passada, porque a medição de First Load JS das três rotas é a mesma bancada.

Um terceiro lance, **ortogonal e cumulativo**: carregar o `Drawer` por `next/dynamic` atrás do primeiro toque. Ele só abre em `pointer-coarse`, e uma gaveta que já anima pode absorver o import. Recupera parte dos +42 kB que atingem as duas rotas.

## F2 — `useChipRowOverflow`: o gatilho disparou e a máquina foi copiada

`MunicipalityPortfolioCell` e `LeadershipStateDeputyRelationCell` (B31 ✓) carregam ~105 linhas idênticas de medição de overflow — as constantes, o guard de "não trate o primeiro callback do observer como resize", a invalidação por conteúdo, o filtro `lastVisibleTop + 1`, o laço de largura da cauda, o `expandToggle` com `tabIndex={measuring ? -1 : undefined}` — incluindo um comentário verbatim. As duas células são renderizadas **pela mesma tabela**.

A duplicação é **anterior** ao B34 (nasceu entre `AdvisorMunicipalityCell` e a célula do B31; esta entrega moveu uma das cópias para `shared/`), mas o `AGENTS.md` do B34 escreveu que "**ele**, não o B37, é o gatilho de extração" — e o gatilho disparou. Extrair `useChipRowOverflow({ chipsKey, chipAttribute, toggleAttribute, trailingWidth, gapPx, enabled })` para `shared/`; a única diferença real entre os dois chamadores é o que ocupa o slot final (um botão de lápis com `ref` contra o `min-width` calculado do input), que vira o parâmetro.

**A releitura pós-rebase alargou o alvo: são ~165 linhas, não ~105, e o nome está errado.** Além da medição, os dois arquivos repetem a adoção de props por `sameIdSet` (~7/~12), o derivado `showAll`/`measuring`/`clamping` (~11/~15), o `expandToggle` (~32/~20) **e** o delta otimista com rollback por delta e toast (~39/~48). O que sai é `useRelationChipCell` — medição **mais** o redutor otimista —, e as duas metades da medição são idênticas até o `+ 1` de epsilon no `lastVisibleTop`. Consequência de planejamento: **o B37 não retira este débito**. B37 pluga uma terceira relação na célula compartilhada sem máquina nova; quem fecha o F2 é quem deletar `LeadershipStateDeputyRelationCell`, que é o módulo do qual a cópia sobreviveu.

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
- **`searchInputProps(surface)`**: o input de busca está escrito nas duas superfícies com **oito** props idênticas (`role`, `aria-expanded`, `aria-controls`, `aria-autocomplete`, `aria-activedescendant`, `onKeyDown`, `aria-label` e o corpo `setQuery` + `setFeedback(null)`), divergindo só no `setOpen(true)`/`onFocus`/`onBlur` do inline. A divergência é **correta**, e é justamente por isso que deveria ser explícita: uma factory espalhada nos dois, com os overrides do inline escritos depois do spread, poupa ~16 linhas e troca uma assimetria inferida por uma declarada.
- **e2e**: `createStaffLeadership({ role, municipalities })` e `expectPostResponse(page, fragment)` em `campaignE2EFixtures.ts` — 3 call sites hoje.
- **`relationIds()`** exportado de `tests/helpers/campaignFixtures.ts`: `typeof entry === 'number' ? entry : entry.id` está reescrito em 9 lugares nos int specs, com `src/utilities/relationship.ts` já exportando o equivalente de produção. Débito anterior; o spec novo é a 9ª instância.
- **`loadMunicipalityPortfolioIndex` fora da escada de cache**: leitura do catálogo inteiro, de campos só-geografia, idêntica para todo ator e toda request, sem `cache()` nem `unstable_cache`. Uma chamada por request hoje, então o degrau 1 não compra nada — mas o degrau 2 é a resposta da escada. Decidir, não deixar por omissão.
- **Duas respostas para "quais ids formam o TI T?"**: resolvido no fechamento (busca e colapso agora leem o mesmo `idsByTerritory` do índice vivo), mas `municipalityIdsForTseZone` continua sendo o gêmeo de um laço que resolve slugs pelo `bySlug`. Colapsa em `municipalityIdsForEntries(entries, bySlug)` quando alguém tocar o arquivo.

## Fora de escopo (verificado, não é duplicação)

`runCampaignFormAction` está corretamente usado; `matchesAtWordStart`/`normalizeSearchPhrase` reusados sem normalizador paralelo; **nenhum 4º call site** da máquina de auto-save por debounce foi criado (o único `setTimeout` da célula é um deferral de 120 ms em `onBlur`, não um save — o débito **B32+** segue com seus 3+1 call sites); `CampaignListPendingBoundary` não se aplica (a célula dispara uma action, não uma navegação); a detecção de ponteiro não ignorou nenhum hook (`use-mobile.ts` é por largura, e escolher `pointer:` é a tese do B34); e a extração de `campaignHoverTooltip` é a correção certa de um bug de RSC real, não duplicação.
