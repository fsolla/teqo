# C221 — "Limpar" do omnibox não pode quebrar linha no mobile

Status: rascunho
Atualizado em: 2026-09-24
Issue: (a registrar)
Priority: P3
Impeccable: B — ajuste de encaixe do shell de filtros existente (não é fluxo novo)
Appetite: ~2h eng (fill-in)

## Intenção

Débito capturado na crítica de design da C219 (`docs/plans/acervo-paridade-busca-filtros.md`): no mobile, quando o chip de busca do omnibox compartilhado é longo, o botão global "Limpar" (o "X" circular dentro do campo, `md:hidden`) quebra para uma linha própria e aparece órfão abaixo do chip, criando uma faixa vazia entre o campo e o seletor de modo. Reproduzido igualmente na fonte Câmara e na fonte "Gravações enviadas" — é comportamento pré-existente do `CampaignListOmnibox`, não regressão da C219.

Evidência: `/tmp/opencode/c219-shots/06-mobile-empty.png` (gravações) e `/tmp/opencode/c219-shots/11-mobile-camara-long-chip.png` (Câmara) na sessão da C219; o código é o cluster `flex-wrap` do campo em `src/components/campaign/shared/CampaignListOmnibox.tsx` (chips + input + botão de limpar na mesma linha flexível).

## Objetivo e aceite

- Com um chip de busca longo no mobile, o "X" de limpar permanece visualmente vinculado ao campo/chips (não quebra para uma linha órfã), em todas as listas que usam o shell.
- Comportamento, acessibilidade (`aria-label="Limpar"`, anel de foco, região `sr-only`) e desktop intocados.
- Sem mudança de contrato de URL/filtros.

## Direção no codebase (hipótese)

- `src/components/campaign/shared/CampaignListOmnibox.tsx` — cluster do campo (`flex min-h-10 w-full flex-wrap items-center gap-1.5 ...`) com chips, input e o botão de limpar `md:hidden`.
- Consumidores para regressão visual: `SpeechAcervoFilters`, `RecordingAcervoFilters`, listas de municípios/apoiadores (qualquer `<form>` com `campaignListOmniboxFormClassName`).
- Estratégias possíveis (decidir no impl): manter o botão fora do fluxo dos chips (posição absoluta no campo), agrupar chips+input num contêiner que quebra e ancorar o X na linha do input, ou limitar a largura do chip no mobile. A mais simples que preserve o layout desktop.

## Fora de escopo

- Redesenho da barra da Câmara ou dos shells de lista.
- Mudanças nos adaptadores de omnibox por domínio.

## Aceite de engenharia

- [ ] Regressão visual mobile (390) em pelo menos uma lista de cada vertical que usa o shell.
- [ ] Nenhuma mudança de markup/ARIA que quebre os e2e existentes das listas.
