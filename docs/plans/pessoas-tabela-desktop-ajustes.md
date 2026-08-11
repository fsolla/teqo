# Pessoas: ajustes da tabela desktop (larguras, base sob o nome, caret, tooltips, "Dobra em")

Status: rascunho
Atualizado em: 2026-08-11
Issue: #697
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe na tabela desktop de `/campanha/pessoas`; sem rota nova
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-pessoas-ajustes-ui-draft.canvas.tsx (seção "Depois — tabela desktop ajustada")
Appetite: ~0,5–1 dia eng; cinco ajustes de leitura/edição na mesma superfície
Responsável: —

## Intenção

A mesa trabalha a tabela de pessoas no desktop e está perdendo tempo (e errando) por problemas de leitura e edição: o telefone aparece cortado, a coluna Base espremida não serve, o caret some ao digitar o nome, e os botões de ação não explicam o que fazem. São ajustes de superfície — nada de fluxo novo.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor no desktop, varrendo a tabela de pessoas.
- **Job principal:** ler telefone e base completos, reconhecer a pessoa pela linha do nome, e entender (por tooltip) o que cada botão de ação faz — inclusive quando está desabilitado.
- **Fluxo desejado:** abro `/campanha/pessoas` → leio o telefone inteiro na coluna Contato → identifico a pessoa pela linha do Nome (2ª linha discreta: nome de legenda ou base) → passo o mouse nas ações e vejo o tooltip → edito o nome digitando e vejo o caret piscar.
- **Anti-goals de produto:** não é redesign da tabela; não muda o mobile (cards) além do mínimo de consistência de nome; não muda o modelo de dados.

## Objetivo e aceite

- **Contato completo:** a coluna Contato mostra o telefone inteiro (sem cortar) — a tabela não pode espremer essa coluna; quando houver muito conteúdo, quem sofre é o restante, não o telefone.
- **Coluna Base removida; base vira 2ª linha do Nome:** a cidade do `Contact` aparece discreta sob o nome, **sem label** (só o nome da cidade) — **exceto** quando há nome de legenda (C129), que ocupa a 2ª linha no lugar dela (legenda tem precedência sobre base).
- **Nome com largura máxima:** nomes outliers truncam com reticências em vez de esticarem a coluna Nome (a edição continua funcionando; o truncamento é só de exibição).
- **Caret visível:** ao editar o nome na célula, o cursor de texto (caret) aparece — hoje ele some quando se começa a digitar.
- **"Aliada em" → "Dobra em":** o cabeçalho da coluna passa a dizer "Dobra em" em todos os lugares que nomeiam a coluna (tabela, cards mobile, menu de ordenação, seletor de colunas) — sem mudar a chave de URL/ordenação.
- **Colunas de município estreitas quando vazias:** Assessora/Lidera/Dobra em vazias ocupam pouco espaço (não podem ser as colunas mais largas da tabela); a largura acompanha o conteúdo (chips).
- **Tooltip em todas as ações:** toda ação da coluna Ações (Convidar, WhatsApp, Apagar) mostra tooltip no hover — inclusive quando o botão está desabilitado (ex.: "WhatsApp indisponível — sem celular"), que hoje não tem tooltip nenhum.
- **Filtro e ordenação por Base permanecem** (decisão do gate 2026-08-11): com a coluna removida, o facet de ausência "Sem base" e a ordenação por base continuam disponíveis (facet = filtro rápido de ausência na omnibox, ex. "Sem base" = fichas sem cidade).
- **Filtro e ordenação por Partido (novos):** a omnibox ganha filtro por partido (lista dos partidos presentes no recorte, padrão do facet de status) e o menu de ordenação ganha a chave "Partido" (o partido segue exibido como sufixo do nome, sem coluna própria).

## Dados (intenção)

- **Vou apresentar dados?** Não — vínculos e texto, sem métrica.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` (definições de coluna, célula de Nome e Ações, cards mobile), `src/components/campaign/shared/CampaignInlineEditableCell.tsx` (caret do nome — input invisível com caret transparente hoje), `src/components/campaign/shared/CampaignHoverTooltip.tsx` (tooltip em ações desabilitadas), `src/utilities/people/peopleListUrl.ts` (chaves de ordenação — sem renomear `aliada`).
- **Precedente a olhar:** C116 (células sempre-input, tooltips nas ações), B17 (seletor de colunas — "Base" sai da definição), C117 (sort/absence — o facet "Sem base" permanece).
- **Risco de acoplamento:** a remoção da coluna Base afeta o seletor de colunas, a ordenação e os filtros de ausência — decidir o que fica (facet "Sem base" continua; ordenação por base vira questão aberta); a 2ª linha do Nome é compartilhada com C129.

## Dependências

- Suave com **C129** (regra da 2ª linha do Nome: legenda sobrepõe base — se C130 sair antes, a base ocupa a posição e C129 a substitui quando houver legenda).

## Fora de escopo

- Redesign dos cards mobile (só o rótulo "Aliada em" muda lá, por consistência de nome).
- Mudanças de modelo de dados (não há — colunas de exibição e larguras).
- O dropdown de municípios (C131) e o ciclo de vida de capacidades (C128).

## Rabbit holes de produto

- **Tabela-fixa vs larguras por coluna**: mexer no layout da tabela pode afetar todas as outras listas que usam o mesmo sistema de tabela. **Corte:** ajuste localizado nas colunas de pessoas; se precisar de mecanismo novo (ex. largura por coluna), generalizar só com 2º consumidor.
- **Ordenação por Base**: com a coluna removida, ordenar por um dado invisível confunde. **Corte:** remover a chave de ordenação "Base" do menu (a chave de URL pode morrer junto — dados antigos de URL são rejeitados com redirect).

## Questões em aberto (produto)

_Decididas no gate 2026-08-11 (não reabrir sem evidência nova):_

- **Facet de ausência "Sem base" e ordenação por Base?** **Decidido:** os dois permanecem — o facet responde "quem está sem dado" e a ordenação continua útil mesmo sem coluna.
- **Filtro e ordenação por Partido?** **Decidido:** adicionar — filtro na omnibox (facets de partidos presentes) + chave "Partido" na ordenação; partido continua exibido como sufixo do nome.
- **Tooltip em ações desabilitadas?** **Decidido:** sim, com copy de indisponibilidade ("WhatsApp indisponível — sem celular").

## Referências

- Canvas UI (gate): plan-pessoas-ajustes-ui-draft.canvas.tsx
- Planos: [pessoas-edicao-inplace-lista.md](pessoas-edicao-inplace-lista.md) (C116), [pessoas-lista-unificada.md](pessoas-lista-unificada.md) (C100 — definição das colunas), [pessoas-nome-de-legenda-dobradinha.md](pessoas-nome-de-legenda-dobradinha.md) (C129)
- `AGENTS.md` — sistema de listas, padrão B18/B17
