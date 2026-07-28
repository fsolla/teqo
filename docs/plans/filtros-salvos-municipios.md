# B18 — Filtros salvos na lista de Municípios (+ acesso rápido no sidebar)

Status: ✓ entregue (2026-07-28) — sem migration, sem collection, sem server action, sem `Consent`
Atualizado em: 2026-07-28
Item do roadmap: [docs/roadmap.md](../roadmap.md) (B18; superfície de coordenação)
Impeccable: B — craft + critique + polish em `MunicipalityFilters` e `CampaignSidebar`; sem rota nova
Appetite: ~1–1,5 dia eng (gasto: dentro)
Responsável: —

## O que ficou de pé

Em `/campanha/municipios`, um botão **Salvar filtro** ao lado de **Limpar** nomeia o recorte atual da URL, e o atalho passa a viver como **submenu de 2º nível sob Municípios** no sidebar — com chevron, estado persistido, item ativo, apagar com desfazer.

Três camadas:

- **`src/utilities/municipalitySavedFilters.ts`** — `localStorage` com cache de snapshot para `useSyncExternalStore`, `MAX_ENTRIES = 12`, `MAX_NAME_LENGTH = 60`, ordem alfabética, limpeza no logout.
- **`src/lib/listQueryMatch.ts`** — `isSameListHref(a, b, ignoredParams)`, puro e sem imports pesados.
- **`MunicipalityNavSavedFilters`** + **`SaveMunicipalityFilterControl`**, sincronizados pelo hook compartilhado `useMunicipalitySavedFilters`.

## Premissas do plano de 2026-07-24 que morreram na auditoria

Registradas porque cada uma custou trabalho que o appetite original não previa, e porque voltar a acreditar nelas custaria de novo:

1. **`SidebarMenuSub` / `SidebarMenuSubItem` / `SidebarMenuSubButton` / `SidebarMenuAction` NÃO existiam.** O plano dizia "existem no shadcn local e não são usados" — o Pass 2 W4b pôs knip `exports` em ERROR e o kit foi podado. Foi preciso **re-adicioná-los** do upstream. Ao fazê-lo apareceu um bug latente do kit: React renderiza `data-active={false}` como `data-active="false"`, e o seletor Tailwind `data-active:` casa com `[data-active]` — ou seja, **todo item não-ativo estava recebendo o estilo de ativo**. Agora o atributo só é emitido quando verdadeiro (`data-active={isActive || undefined}`), em `SidebarMenuButton` e `SidebarMenuSubButton`.
2. **`src/utilities/municipalityUi.ts` não existe** — o Pass 2 W1 o dividiu em `municipalityListUrl.ts`, `municipalityListFilters.ts`, `municipalityLabels.ts` e `municipalitySignal.ts`. `buildMunicipalitySavedFilterHref` nasceu em `municipalityListFilters.ts`.
3. **O estado da URL cresceu** muito além do que o plano listava (`q`, `regions[]`, `slugs[]`, `advisors[]`, `kind`, `coverage`, `priority`, `trends[]`, `classes[]`, `levels[]`, `compare`, `sort`, `dir`, `page`). Serializar o estado inteiro menos `page`/`compare` absorveu isso sozinho — nenhuma lista de params foi escrita à mão.
4. **B17 persiste em cookie, não `localStorage`.** A linha de contexto do plano estava errada. Não muda a decisão (o bookmark não precisa chegar ao render do servidor).
5. **"Ao lado de Limpar / Colunas" como uma fileira só é impossível:** `Limpar` está em `MunicipalityFilters` e `Colunas` está dentro de `CampaignTable`, numa fileira compartilhada pelas sete listas. Decidido na sessão: **barra de filtros, ao lado de Limpar**.
6. **`municipalityListHasSavableFilters` não precisou existir.** `formatMunicipalityActiveFiltersSummary` já é o gate "tem filtro?" (é o que o `Limpar` usa) **e** já produz o rótulo legível de todos os filtros — então ele é ao mesmo tempo a condição de montagem do botão e o **nome padrão** sugerido no Popover.
7. **Disclosure por hover morreu com B38 ✓.** Com `collapsible="offcanvas"`, recolhido no desktop a sidebar sai inteira da tela e não sobra rail para hover. Virou **collapsible com chevron e estado persistido**, decidido com o usuário.
8. **Renomear entrou no v1**, ao contrário do "adiado" do plano: como a identidade é o href e re-salvar é upsert, o botão simplesmente lê **"Renomear"** quando o recorte atual já está salvo, e o Popover abre pré-preenchido. Custou uma string, não uma fase.

## Decisões de engenharia que valem guardar

- **O casamento "URL atual == filtro salvo" não pode usar o serializador de URL do domínio.** A sidebar está no layout de `(app)`, então tudo que ela importa entra no First Load JS de **toda** rota `/campanha`, e o AGENTS.md já registra que importar `buildMunicipalityListHref` num island custou **21 kB** (arrasta `bahiaTerritories` + `municipalityCatalog`). Daí `src/lib/listQueryMatch.ts`: comparação de `URLSearchParams` insensível à ordem, que de quebra resolve um caso que o plano não previu — **estar na página 3 de um filtro salvo ainda é estar nele** (`page` é posição dentro do recorte, não parte dele).
- **Medido contra árvore limpa (`git stash`), que é a única forma de afirmar isso:** `/campanha` ficou **inalterado em 277 kB**; `/campanha/municipios` foi de **328 → 330 kB**. A fase `optimize` não disparou.
- **A identidade é o href, não um UUID.** O plano previa `id` + `name` + `href` + `savedAt`; sobrou `{ href, name }`. Um UUID só existiria para permitir dois atalhos que navegam para o mesmo lugar, que é exatamente o que o upsert existe para impedir — e `savedAt` não é lido por nada, porque a ordem é **alfabética** de propósito: um atalho nomeado que se reordena sozinho sob o cursor cada vez que é re-salvo é um bug de navegação. Recência é o trabalho de Visitados.
- **O teto é checado contra as OUTRAS entradas** (`others.length >= MAX_ENTRIES`), não contra o tamanho armazenado — senão renomear no limite passaria a ser recusado.
- **O `useSyncExternalStore` tem o server snapshot como constante congelada.** Devolver `[]` fresco ali é o loop de render clássico; o snapshot do cliente é cacheado e invalidado por escrita e por `storage` de outra aba (o evento nativo não dispara na aba que escreveu — daí o evento custom que cobre a outra metade).

## Dois bugs reais que só o e2e pegou

1. **O auto-open reabria o grupo em toda montagem, tornando a preferência persistida inobservável exatamente para quem mais usa filtros salvos:** o usuário recolhe o grupo, recarrega, e ele volta. A causa não é óbvia — o gatilho era `activeHref` aparecer, mas **o store responde vazio até o cliente ler o `localStorage`**, então um match surgindo da hidratação se parecia com uma navegação. O gatilho passou a ser a **URL mudar**; a preferência guardada vence na montagem e o "revelar onde você está" fica reservado à navegação que de fato muda o atalho corrente.
2. **Apagar uma linha derrubava o foco para `<body>`.** O sucessor é resolvido **antes** da remoção, porque esvaziar o grupo desmonta o componente inteiro — chevron incluído — e nesse caso o alvo tem de ser o link de nav.

## Achados de acessibilidade corrigidos no critique

- **SC 2.5.3 (Label in Name):** o botão mostrava "Salvar filtro" e tinha `aria-label="Salvar este filtro"`. O nome acessível precisa **conter** o rótulo visível, ou "clique em Salvar filtro" por voz não casa com nada. O `aria-label` saiu do caso de salvar; o de renomear fica, porque mantém a palavra visível na frente.
- A mensagem de recusa ganhou `aria-describedby` do input além do `role="alert"` que o `Alert` já traz: o alerta anuncia uma vez, o `describedby` é o que conta a quem volta ao campo **por que** ele ainda está inválido.
- O `<ul>` do submenu ganhou nome (`aria-label="Filtros salvos de Municípios"`), e os links ativos ganharam `aria-current="page"` — inclusive os de 1º nível, que não tinham.
- Apagar é revelado no hover/foco no desktop com `opacity-0` (que continua focável e no a11y tree, ao contrário de `hidden`) e é **permanentemente visível no toque**.

## Não escopo (mantido)

Sync multi-device / preferências em `campaignUser`; saved views em outras listas (FD2 já vetou o genérico); rota `/vistas/[id]`; incluir Cenário A10 ou `compare` do mapa no bookmark; salvar junto o viewport de colunas do B17.

## Adiado com gatilho

- **Árvore de navegação genérica em `nav.ts`.** Este item especializa **só** Municípios, via a constante exportada `MUNICIPALITY_NAV_HREF`. **Gatilho:** o 3º call site de submenu no sidebar.
- **Sync servidor / compartilhar recorte entre assessores.** **Gatilho:** evidência de multi-device **e** pedido explícito de "mandar este recorte" — aí sim collection + access, fora deste appetite.

## Testes

- `tests/unit/listQueryMatch.unit.spec.ts` — ordem trocada casa, `page` diferente casa, filtro a mais não casa, percent-encoding normaliza.
- `tests/unit/municipalitySavedFilters.unit.spec.ts` — upsert por href, cap, shape inválido, dedup, cache de snapshot.
- `tests/e2e/campaignSavedFilters.e2e.spec.ts` — filtrar → salvar → submenu → ativo na página 2 → restaurar → renomear → apagar → desfazer, e o disclosure persistido através de reload.

**Nota operacional:** `pnpm build` limpa `.next`, e o servidor de dev do e2e usa `NEXT_DIST_DIR=.next/e2e` — rodar o build entre duas rodadas de e2e derruba o cache de compilação e faz o projeto `setup` estourar os 90 s. Não é flake do teste.

## Referências

- `docs/plans/visitados-recentemente.md` — precedente de localStorage + logout
- `docs/plans/seletor-colunas-lista-municipios.md` (B17) — vizinho que persiste em **cookie**, porque o servidor precisa ler
- `src/utilities/municipalityListUrl.ts` / `municipalityListFilters.ts` — contrato de URL congelado
- `src/utilities/recentVisits.ts` — espelho de storage
- `src/components/ui/Sidebar.tsx` — `SidebarMenuSub*` / `SidebarMenuAction` re-adicionados
