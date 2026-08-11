# Pessoas — ordenação (omnibox + header) e filtros de ausência

Status: rascunho
Atualizado em: 2026-08-11
Issue: #656
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe em tela existente (`/campanha/pessoas`); sem rota nova
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c117-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; um outcome verificável — recortar e ordenar a lista pelo critério do dia
Responsável: —

## Intenção

A lista de pessoas hoje só ordena por nome (fixo) e só filtra por capacidade/município/status. A mesa precisa de dois movimentos: **ordenar por qualquer coluna** (quem tem mais rede? quem está sem base?) e **filtrar ausência** ("Sem assessor", "Sem base", "Sem contato" — para atacar exatamente quem não tem o dado). Ordenação entra em dois lugares com o mesmo estado: o header das colunas (desktop) e o omnibox (onde já existe o padrão de ordenação nas outras listas).

## Persona e fluxo

- **Persona / contexto:** coordenador e assessores (staff) na lista de pessoas; leader não acessa.
- **Job principal:** recortar a lista pelo critério do dia e ordená-la pela coluna que importa, sem sair da tela nem decorar quem é quem.
- **Fluxo desejado:**
  - Clicar no header de uma coluna ordena por ela e mostra a **seta de direção** ao lado do header; clicar de novo inverte; clicar em outra coluna move o indicador. Ordenação padrão: alfabética pelo nome.
  - Na omnibox, opção **Ordenação** com cada coluna × crescente/decrescente (padrão já usado na lista de Territórios) — **em todos os breakpoints**, inclusive no mobile (a omnibox é edge-to-edge e o mobile tem as mesmas capacidades de ordenação).
  - Na omnibox, filtros de ausência: **Sem assessor** (quem não tem assessorado), **Sem base** (sem cidade no cadastro), **Sem contato** (sem telefone registrado).
- **Anti-goals de produto:** não vira spreadsheet mode; nada de ordenar por colunas ocultas (toda chave de ordenação pousa numa coluna visível); filtro de ausência não expõe o valor do dado (só a presença/ausência — telefone nunca é listado em facet).

## Objetivo e aceite

- Header de cada coluna sortável ordena a lista global (conjunto filtrado, não só a página), com `aria-sort` e seta de direção; 2º clique inverte; a coluna ativa é única (mudou de coluna, o indicador move).
- Omnibox ganha o recorte "Ordenação" (padrão de Territórios) com as mesmas chaves/direções do header.
- Omnibox ganha os filtros de ausência "Sem assessor", "Sem base", "Sem contato" — combináveis entre si e com os filtros atuais, estado na URL como os demais.
- Ordenação default inalterada (nome A–Z) — a lista abre como hoje.
- Guardrails: sem migration, sem collection nova; escopo do assessor preservado (ordena/filtra sobre o que ele enxerga); leader segue fora da rota.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhuma métrica nova: a entrega é recorte e ordenação sobre a tabela existente (mesma natureza do B29 em lideranças).
- **Decisões desbloqueadas:** staff: "quem da minha carteira está sem telefone para disparar a ação?"; "quais pessoas lideram mais municípios?"; "quem está sem assessor na região X?". Ausência é recorte operacional, não dado exibido.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/people/peopleListUrl.ts` (estado `sort`/`dir` + filtros de ausência no contrato de URL, espelhando `territoryListUrl.ts`); `src/utilities/people/peopleListFilters.ts` e `peopleOmnibox.ts` (chips/sugestões de ordenação e ausência, molde `territoryOmnibox.ts`); `src/utilities/people/peopleData.ts` (aplica sort sobre o conjunto filtrado — a lista já é merge em memória); `src/components/campaign/people/PeopleFilters.tsx` (omnibox); página `pessoas/page.tsx` (headers sortáveis via `CampaignSortableHead`/`CampaignTransitionAnchor`, padrão B15).
- **Precedente a olhar:** [ordenacao-colunas-lista-municipios.md](ordenacao-colunas-lista-municipios.md) (B15 — header sort com `?sort=`/`?dir=` na URL), [ordenacao-filtros-lista-liderancas.md](ordenacao-filtros-lista-liderancas.md) (B29 — wrappers de domínio sobre chrome compartilhado), `src/utilities/territory/territoryOmnibox.ts` (chip "Ordenação" no omnibox com chaves asc/desc).
- **Risco de acoplamento:** a lista é merge de três fontes (leadership/dobradinha/staff) com filtros in-memory — o sort deve operar sobre o conjunto filtrado **antes** da paginação (precedente B15 branch in-memory), respeitando o escopo do assessor no merge; chaves de ordenação só sobre colunas visíveis; nulls ("Sem…") sempre no fim (precedente B15).

## Dependências

- **C99/C100** (prontas). **Suaves:** C116 (mesma tabela; sem dependência de ordem), B155+ (padrão de escrita de célula — só afeta se o sort interagir com edição).

## Fora de escopo

- Edição in-place / chips de território → **C116** ([pessoas-edicao-inplace-lista.md](pessoas-edicao-inplace-lista.md)).
- Ordenar por colunas ocultas; filtros salvos novos (o padrão B18 já cobre a lista se a mesa pedir).
- "Sem e-mail" como filtro (o pedido cobre assessor/base/contato; e-mail oculto por padrão desde B197).
- Export CSV / view alternativas.

## Rabbit holes de produto

- **"Ordenar por coluna oculta ou por campo sem coluna."** Chave de ordenação que não é coluna visível é estado que mente. **Corte:** toda chave do omnibox = uma coluna da tabela; nada extra.
- **"Filtro de ausência vira campo de busca."** Digitar "sem telefone" na busca e esperar que interprete. **Corte:** facet explícito "Sem…" na omnibox, combinável, mesmo contrato dos demais.
- **Sort client-side da página de 25.** Ordena a página, não a lista — ranking falso. **Corte:** sort sobre o conjunto filtrado completo (a lista já carrega o filtrado para merge; o custo é o mesmo do B15 in-memory).
- **Nova métrica de "cobertura" para justificar o sort.** Contagem de vazios agregada no topo da página vira dashboard de vaidade. **Corte:** ausência é filtro e ordenação, não KPI.

## Questões em aberto (produto)

Resolvidas no gate 2026-08-11:

- Colunas de municípios ordenam **por contagem** (mais municípios primeiro em `desc`); vazios ("Sem…") sempre no fim.
- "Sem contato" = **sem telefone** registrado (coluna Contato = telefone desde B197).
- Coluna Ações não é sortável (inerte, padrão B15).
- Mobile: o recorte "Ordenação" na omnibox vale em todos os breakpoints — o mobile tem as mesmas capacidades de ordenação e filtro.

## Referências

- `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` — tabela + `PeopleFilters` (omnibox)
- `src/utilities/people/peopleListUrl.ts` / `peopleListFilters.ts` / `peopleOmnibox.ts` — contrato de URL e omnibox atuais ("no sort in v1")
- `src/utilities/territory/territoryOmnibox.ts` + `territoryListUrl.ts` — molde do recorte "Ordenação" no omnibox
- `src/components/campaign/shared/CampaignTable.tsx`, `CampaignSortableHead` (B15/B29) — headers sortáveis com `aria-sort` + seta
- `src/utilities/people/peopleData.ts` — merge in-memory; ponto onde o sort global se aplica
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c117-ui-draft.canvas.tsx`
