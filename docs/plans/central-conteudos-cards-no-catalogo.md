# S35 — Central de Conteúdos — cards personalizáveis como itens do catálogo

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1304
Priority: P1
Impeccable: B — encaixe no catálogo existente (novos itens + busca/filtros), sem rota nova
Design UI: docs/plans/central-conteudos-cards-no-catalogo-ui-design.html
Appetite: ~1–1,5 dia eng; um outcome verificável (cada card encontrável por nome, busca e filtro no catálogo)
Responsável: —

## Intenção

Hoje os cards personalizáveis aparecem em `/conteudos` como **um único convite genérico** ("Faça seu card com Solla 1313"), que só é exibido quando nenhum filtro está ativo e não revela quais modelos existem. Quem procura um card pelo nome popular não acha nada, e quem não conhece a galeria nem sabe que há seis opções. O dono pediu literalmente: buscar **"santinho"** deve trazer os cards **"Time de você"** e **"colinha"**; buscar **"foto de perfil"** deve trazer os cards de foto de perfil. Cada modelo deve ser um item próprio do catálogo — **junto dos demais itens, sem seção separada** —, encontrável pelo próprio nome, por apelido e pelo filtro Tipo "Card", levando ao estúdio já com o modelo escolhido.

Isso revoga explicitamente a decisão D6 do S27 (`docs/plans/central-conteudos-publica-impl.md:81-85`), que rejeitou a entrada catalogada e fixou o tile único — o tile morre, substituído pelos itens individuais. Card continua **não sendo peça**: sem linha no banco, sem arquivo, sem publicação/kill switch próprio; o estúdio `/cards` segue o único lugar que gera o card, no aparelho do visitante.

## Persona e fluxo

- **Persona / contexto:** eleitor/simpatizante no celular, chegando por busca ou link do WhatsApp; conhece os cards pelos apelidos ("santinho", "foto de perfil", "colinha"), não pelos nomes oficiais dos modelos.
- **Job principal:** achar o card que ele quer pelo nome que ele usa e cair no estúdio com o modelo já escolhido, sem varrer a galeria inteira.
- **Fluxo desejado:** abre `/conteudos` → busca "santinho" (ou "foto de perfil") ou filtra Tipo "Card" → vê cada modelo como item próprio, com nome, explicação curta e arte → toca no item → chega em `/cards?model=<id>` com o modelo selecionado → faz e baixa o card no aparelho → o catálogo segue igual (nada do card fica lá).
- **Anti-goals de produto:** não transforma card em peça (arquivo, publicação, kill switch); não cria rota, galeria ou segundo estúdio; não move a geração para o servidor/catálogo; não captura dado novo (a foto continua 100% no aparelho); não vira SEO de palavras-chave nem página própria por card.

### Esboço de fluxo (B)

```text
[eleitor no celular] → /conteudos
→ busca "santinho" · "foto de perfil" · "colinha" · "estadual" ou Tipo "Card"
→ cada modelo de card aparece como item próprio, misturado às peças (sem seção separada)
→ toca no item → /cards?model=<id> (modelo já escolhido no estúdio)
→ faz/baixa o card no aparelho (nada do card fica no catálogo)
→ volta ao catálogo: peças e cards juntos, sem convite duplicado
[filtro geográfico ativo (Cidade/Região/Instituição)] → cards somem (não são territoriais)
[sem JS] → a busca por querystring continua achando os itens do mesmo jeito
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-cards-no-catalogo-ui-design.html` (+ assets em `central-conteudos-cards-no-catalogo-ui-design-assets/`) — itens de card **misturados ao board existente, sem seção/agrupamento próprio** (arte, nome, mini-descrição/apelido, caminho para o estúdio), o estado do filtro Tipo "Card" e o resultado das buscas por apelido. (Revisão do gate: a primeira versão agrupava os cards numa seção própria; o gate cortou a seção.)

## Objetivo e aceite

- Cada um dos 6 modelos é um item próprio do catálogo, **na mesma lista dos outros conteúdos, sem seção separada**, encontrável pelo nome do modelo e pelos apelidos: "santinho" traz "Time de você" e "Minha colinha"; "foto de perfil" traz "Moldura quadrada" e "Moldura vertical"; "colinha" traz "Minha colinha"; "estadual" traz "Time do estadual".
- O filtro Tipo "Card" traz os itens de card; a busca por termo e os filtros funcionam sem JS (querystring), como no catálogo atual.
- Cada item leva ao estúdio com o modelo já escolhido (`/cards?model=<id>`); o estúdio segue alcançável pelo estado vazio.
- Guardrail — card não é peça: sem linha no banco, sem mídia, sem publicação/kill switch próprio; o item é um convite ao estúdio, nunca um arquivo para baixar/compartilhar.
- Guardrail — o tile único ("Card personalizado") deixa de existir; nada de convite duplicado.
- Guardrail — **sem seção/agrupamento separado de cards**: eles aparecem misturados aos demais itens do catálogo, sob a mesma busca e os mesmos filtros; nenhum cabeçalho/faixa própria de cards.
- Guardrail — cards não respondem a faceta geográfica (Cidade/Região/Instituição): com faceta ativa, somem do resultado (não são territoriais).
- Guardrail — catálogo sem peça publicada mantém o estado honesto atual (com o caminho para o estúdio), sem inventar um board vazio de cards.
- Guardrail — nada muda no estúdio: foto/recorte 100% no aparelho, sem PII e sem `Consent` novo; o clique no item pode alimentar o mecanismo anônimo do C213/S32 como abertura de card, nunca como peça.

## Dados (intenção)

- **Vou apresentar dados?** Não — o item não exibe número/contador; só roteia o visitante ao estúdio. A contagem de uso continua no mecanismo anônimo do C213/S32 (assunto card), sem métrica nova.
- **Decisões desbloqueadas:** o eleitor escolhe o modelo sem varrer a galeria; a comunicação passa a poder ler quais modelos são procurados no catálogo, se a questão (c) for aceita (leitura pelo mecanismo existente).
- **Forma:** _adiada ao plano de implementação_ — nenhuma tabela/gráfico; quando muito, o evento anônimo já existente.

## Dados da decisão (literais)

- Modelos (id → rótulo atual, fonte única `src/lib/cardModels.ts:65-135`): `eu-sou-solla` → "Card com seu nome"; `perfil-quadrado` → "Moldura quadrada"; `perfil-retangular` → "Moldura vertical"; `time-de-voce` → "Time de você"; `time-do-estadual` → "Time do estadual" (S30, escolha entre 53 estaduais); `minha-colinha` → "Minha colinha" (S31, selo `NOVO`, escolha de estadual).
- Apelidos de busca por modelo (proposta verbatim): "santinho" → `time-de-voce` + `minha-colinha`; "foto de perfil" → `perfil-quadrado` + `perfil-retangular`; "colinha" → `minha-colinha`; "estadual" → `time-do-estadual`; o próprio nome de cada modelo sempre vale.
- URL de destino: `/cards?model=<id>` — o estúdio já valida o id e pré-seleciona o modelo (`src/app/(frontend)/(home)/cards/page.tsx:20-27`).
- Filtro de Tipo: valor existente `card`, rótulo `Card` (`src/lib/contentPiece.ts:24-34`); peça publicada de tipo card continua peça comum, com o comportamento atual.
- Supersessão explícita: a decisão D6 do S27 (`docs/plans/central-conteudos-publica-impl.md:81-85`) fica revogada na parte do tile único; valem os itens individuais por modelo, sem peça catalogada e sem linha no banco.
- Regra de apresentação (decisão do gate): os itens de card aparecem **junto dos demais itens da Central, sem seção separada** — não existe cabeçalho/faixa própria de cards.
- Analytics (se a questão (c) for aceita): o clique no item conta pelo mecanismo único do C213/S32 como abertura de card — `subjectType: 'card'`, `subjectId = model.id` (`src/app/(frontend)/api/content-events/route.ts:95-114`) — nunca como peça; sem segundo analytics.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/cardModels.ts` (os 6 modelos/rótulos), `src/components/conteudos/` (`ContentPieceCatalog.tsx`, hoje `ContentPieceCardInvite.tsx`), `src/lib/contentPieceCatalog.ts` (itens/facetas/filtro/busca), `src/components/conteudos/ContentPieceFilters.tsx` e `src/app/(frontend)/conteudos/(catalog)/page.tsx` (o `showCardInvite` atual), o deep-link `src/app/(frontend)/(home)/cards/page.tsx` e, se (c) valer, `src/lib/contentEvents.ts` + `src/app/(frontend)/api/content-events/route.ts`.
- **Precedente a olhar:** D6 no `central-conteudos-publica-impl.md:81-85` (o que este item revoga) e `ContentPieceCardInvite.tsx:16-44` (o tile que morre); S30/S31 (modelos/pickers) e S32 (`docs/changelog/2026-09-23-s32.md` — `subjectType: 'card'`, `subjectId = model.id`); S28 (facetas + busca por `searchText`).
- **Risco de acoplamento:** itens sintéticos — nada de collection/migration/kill switch; a lista de modelos/labels é fonte única (não duplicar copy); a busca sem JS é contrato do catálogo; #1277 (`docs/plans/escala-dry-pos-s30.md`) mexe em `src/components/cards/` — sem conflito esperado com o catálogo público, mas serializar se rodar em paralelo.

## Dependências

- Nenhuma dura — catálogo (S27/S28) e os 6 modelos (S13–S16, S30, S31) já estão no repo.
- **Suave:** C213/S32, se a questão (c) for aceita (reusa o mecanismo existente, sem nada novo).
- Design UI aprovado no gate.

## Fora de escopo

- Card virar peça (linha, arquivo, publicação, kill switch) ou ganhar página/detalhe/OG próprios.
- Rota nova, segunda galeria, alterar o estúdio `/cards` ou o funil de geração (foto/canvas seguem no aparelho).
- Copy editável pelo CMS; busca semântica/tema aplicada a cards além do decidido; facetas próprias de card.
- Analytics novo (o mecanismo é o do C213/S32).
- Redesenho da Central/shell/nav; mudar a regra das peças publicadas (tipo card continua peça comum).

## Rabbit holes de produto

- **"Já que virou item, vira peça".** Se alguém "só completar": collection, migration, mídia, publicação e kill switch para cards — dono duplicado do catálogo. **Corte neste item:** item sintético, sem linha; o estúdio é o dono.
- **"Baixar o card direto do catálogo".** Se alguém "só completar": geração no catálogo/servidor e a foto sai do aparelho. **Corte neste item:** o item só leva a `/cards`; o card nasce no aparelho.
- **"Um SEO por card".** Se alguém "só completar": página, título e palavras-chave por modelo, virando segundo catálogo. **Corte neste item:** itens do board + apelidos decididos; sem rota nova.
- **"Card com tema/cidade para combinar com os filtros".** Se alguém "só completar": metadados territoriais/editoriais por card, um segundo modelo de conteúdo. **Corte neste item:** cards fora das facetas geográficas; tema só se um dia declarado (v1: nenhum).
- **"Contar quem fez o card".** Se alguém "só completar": identificar visitante para medir conversão do item. **Corte neste item:** só o evento anônimo existente, se (c) aceita.

## Questões em aberto (produto)

- **Como os cards se comportam sob faceta geográfica e temas?** **Opções:** A) ignoram facetas e ficam visíveis | B) excluídos quando faceta geográfica ativa | C) ganham temas próprios declarados. **Recomendação:** B — cards não são territoriais; tema só se declarado por modelo (v1 não declara). _(assumido — validar com produto)_
- **O tile único "Card personalizado" fica como "ver todos os cards"?** **Opções:** A) fica como entrada geral | B) morre e é substituído pelos itens individuais, com o estúdio alcançável por cada item e pelo estado vazio. **Recomendação:** B — evita convite duplicado e é o pedido do operador. _(assumido — validar com produto)_
- **O clique no item conta abertura de card ou de peça?** **Opções:** A) abertura de card (`subjectType: 'card'`, `subjectId = model`) pelo mecanismo do C213/S32 | B) abertura de peça | C) não conta. **Recomendação:** A — mede o interesse real no modelo sem duplicar como peça. _(assumido — validar com produto)_

## Referências

- GitHub Issue — a registrar (`pnpm agent:register`).
- Design UI (gate): `docs/plans/central-conteudos-cards-no-catalogo-ui-design.html` (+ assets em `central-conteudos-cards-no-catalogo-ui-design-assets/`)
- `docs/plans/central-conteudos-publica-impl.md:81-85` (D6 revogada) e `docs/plans/central-conteudos-publica.md` (S27 — o catálogo e o tile)
- `src/components/conteudos/ContentPieceCardInvite.tsx:16-44`, `src/components/conteudos/ContentPieceCatalog.tsx:50-55`, `src/app/(frontend)/conteudos/(catalog)/page.tsx:108,153-157`
- `src/lib/cardModels.ts:65-135`, `src/lib/contentPieceCatalog.ts:39-107,155-269,506-548`, `src/components/conteudos/ContentPieceFilters.tsx`
- `src/app/(frontend)/api/content-events/route.ts:95-114`, `src/lib/contentEvents.ts`, `docs/changelog/2026-09-23-s32.md`
- `docs/plans/escala-dry-pos-s30.md` (#1277 — sobreposição só em `components/cards/`)

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (cada modelo encontrável por nome, apelido, busca e Tipo "Card"); (2) appetite ~1–1,5 dia cabe: itens sintéticos no board e nos filtros existentes, sem rota nem migration; (3) persona/job/aceite em linguagem de produto, com os apelidos literais do dono e o guardrail "card não é peça"; (4) direção no codebase é hipótese, com D6 e o tile atual abertos como pista; (5) zero decisão dura de engenharia — sem collection/schema/signature, com as três dúvidas de produto posicionadas.
