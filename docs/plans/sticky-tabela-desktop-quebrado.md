# D7 — Sticky dos headers da tabela desktop quebrado (headers não grudam ao rolar)

Status: registrado
Atualizado em: 2026-08-10
Issue: (criada via agent:register)
Priority: P3
Model: composer-2.5
Impeccable: A (só backend/UI interna)

## Diagnóstico (medido durante B184, 2026-08-09)

Na lista de municípios em desktop (viewport 1440px, prod build local), os headers da tabela
(`[&_th]:sticky [&_th]:top-0` em `MunicipalityList.tsx` → `CampaignTable`) **não grudam**: o `th`
computa `position: sticky`, mas rola junto com o conteúdo (medido: `top` 174 → −326 ao scrollar
500px no scrollport). A feature do B41 está silenciosamente morta.

**Causa-raiz (mesma classe de bug do sticky do omnibox B184):** o wrapper da tabela
(`CampaignTable` `containerClassName="overflow-x-auto …"`) é um **scroll container** (overflow-x
não-`visible` torna o elemento scroll container nos dois eixos). Ele nunca rola verticalmente —
o scroll vertical acontece no `#campaign-content-scroll` (pai). O `position: sticky` do `th` gruda
relativo ao **scroll container mais próximo** (o wrapper), que não rola → o sticky nunca engaja.
`[&_th]:sticky` é hoje CSS morto em todas as listas que usam `CampaignTable`.

## Abordagem sugerida (investigar na execução)

- **A)** Fazer o wrapper **não** ser scroll container para o eixo vertical mantendo o horizontal:
  `overflow-x: clip` não rola — precisa de outro mecanismo para tabelas mais largas que o container.
- **B)** Estrutural: mover o scroll horizontal para dentro do fluxo vertical (ex. o scroll acontece
  na região da tabela com o header fixo por JS/`position: sticky` num elemento irmão do scroller).
- **C)** Aceitar e remover as classes `[&_th]:sticky` mortas (documentar o não-suporte).
- **Recomendação preliminar:** reproduzir nas N listas `CampaignTable`; avaliar B com um sticky
  real só no header (JS-free se houver arranjo de DOM possível, senão pin por scroll listener no
  scrollport); C como fallback honesto. Fora de escopo: mudar o padrão de scroll da página.

## Escopo

- Reprodução: `/campanha/municipios` (e demais listas com `CampaignTable`).
- Sem migration, access, dados.

## Rabbit holes

- Reescrever o layout das listas para "inner scroll" sem pedido — se a solução exigir mudança de
  UX de scroll, parar e propor antes.
- Mover o scroll para o `tbody`/tabela via `display: block` — quebra a semântica/larguras de coluna.
