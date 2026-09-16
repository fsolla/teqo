# Página pública do corte: revisão de design

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1086
Priority: P2
Impeccable: C — superfície pública existente redesenhada (a página `/corte/<id>`)
Design UI: docs/plans/corte-pagina-publica-design-ui-design.html
Appetite: ~1–1,5 dia eng; um outcome verificável — a página pública do corte passa a ser bonita e compartilhável, e o conteúdo não fica sobre um fundo colorido incômodo.
Responsável: —

## Intenção

"A página pública do corte não está bonita; revise o design da página pública de corte. Uma coisa que me incomodou foi o fundo colorido do conteúdo." O link `/corte/<id>` é a ponta do compartilhamento WhatsApp-first do acervo: é o que um cidadão abre no celular depois de receber o link. Hoje a página funciona (player, título, descrição, share) mas não parece uma peça cuidada — e o conteúdo parece assentar sobre uma superfície colorida que incomoda. Esta fatia redesenha SÓ essa página para que o vídeo seja o herói, a leitura seja confortável e o resultado dê orgulho de repassar, sem tocar no contrato (rota, unlisted/`noindex`, metadata). A origem do "fundo colorido" será investigada e eliminada como requisito explícito de design.

## Persona e fluxo

- **Persona / contexto:** quem recebe o link no WhatsApp — cidadão/eleitor no celular, com pressa e distração; secundariamente a assessoria que envia e quer um link apresentável.
- **Job principal:** assistir ao trecho e, se gostar, repassar ou baixar, percebendo na hora que é peça oficial do mandato.
- **Fluxo desejado:** abre o link → capa do player (vídeo como herói) → dá play e assiste → lê título, meta e descrição com conforto → "Compartilhar no WhatsApp" (primário) ou "Baixar arquivo (MP4)" → vê o crédito CC BY e a nota de não listagem.
- **Anti-goals de produto:** não vira galeria/índice público; não vira embed de YouTube; não expõe transcrição/internals; não promete o que a campanha não pode verificar; não muda rota nem indexação.

### Esboço de fluxo (C)

```text
[link no WhatsApp] → /corte/<id> (unlisted, noindex)
→ capa do player (herói) → play e assiste
→ título + meta (tipo · data · duração) + descrição
→ Compartilhar no WhatsApp (primário) · Copiar link · Baixar arquivo (MP4)
→ crédito CC BY + nota "página não listada"
[despublicado/id inexistente] → mesma tela "Este corte não está disponível"
```

### Design UI (C)

- Design UI (gate): `docs/plans/corte-pagina-publica-design-ui-design.html` — cenas desktop (~1280), mobile (~390) e indisponível/despublicado; no fundo do conteúdo, **nenhuma superfície tintada**.

## Objetivo e aceite

- A página lê como peça cuidada e compartilhável: o vídeo é o herói, com hierarquia clara título → meta → descrição → ações.
- O conteúdo textual assenta em superfície neutra do site público; **nenhum fundo colorido/tintado atrás do texto** (sem faixa, card colorido ou gradiente sob título/descrição).
- Compartilhar é WhatsApp-first e mobile-first: ação primária evidente acima da dobra no celular; download do MP4 ao lado.
- Leitura confortável: medida de prosa controlada, contraste AA, tamanho/entrelinha adequados no celular.
- Publicado (com e sem link de sessão no YouTube) e indisponível/despublicado — ambos coerentes e bonitos.
- **Guardrails:** unlisted/`noindex` preservado; rota `/corte/<id>` e contrato inalterados; sem transcrição/internals; crédito `Fonte: Câmara dos Deputados · CC BY 4.0` visível; sem galeria indexável.

## Dados (intenção)

- **Vou apresentar dados?** Não — superfície de assistir/ler/compartilhar; nenhum KPI/gráfico novo.
- **Decisões desbloqueadas:** quem recebe decide assistir/repassar; a assessoria decide se o link está apresentável para enviar. Sem decisão nomeável → nada a medir.
- **Forma:** N/A — sem dado agregado nem visualização a definir.

## Dados da decisão (literais)

- Copy pt-BR fixada: primário `Compartilhar no WhatsApp`; secundárias `Copiar link` e `Baixar arquivo (MP4)`; crédito `Fonte: Câmara dos Deputados · CC BY 4.0`; nota `Página não listada — o link circula, mas não é indexada nem aparece em buscas.`; link opcional `Ver sessão no YouTube ↗`.
- Título de indisponível: `Este corte não está disponível` (id inexistente e despublicado usam a MESMA tela — não revela existência).
- Meta linha: `<tipo> · <data da fala> · <duração>` (ex.: `Discurso · 12/08/2026 · 2:14`).
- Rota `/corte/<id>` inalterada; `robots: { index: false, follow: false }` inalterado.
- Requisito explícito: **zero fundo tintado atrás do conteúdo** — fundo = superfície neutra do site público (`background`/`card`, conforme `DESIGN.md`), jamais `scope`/`support-*`/`editorial-bg`/gradiente sob o texto.
- Fonte do vídeo: o MP4 armazenado (`media.url`) — nunca YouTube/VOD como player.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(frontend)/corte/[id]/page.tsx`; `src/components/SpeechCutShareActions.tsx`; `src/components/SiteHeader.tsx`; superfícies/tokens públicos em `src/app/(frontend)/**`.
- **Precedente a olhar:** páginas públicas de artigo `[type]/[category]/[slug]/page.tsx` (superfície de prosa); `DESIGN.md` (themes `editorial`/`petition`, "Public header: Header Crimson").
- **Risco de acoplamento:** não tocar metadata/OG nem a resolução do id (C167); o card do acervo reusa `SpeechCutShareActions` (prop `primary`) — acabamento visual não pode quebrar esse uso.

## Dependências

- **C167 entregue** — a página pública e a rota já existem. Nenhuma dependência nova.

## Fora de escopo

- Qualquer mudança de rota, metadata/Open Graph, indexação ou contrato de compartilhamento (C167 congelado).
- Galeria/listagem pública de cortes, busca, perfil (unlisted por desenho).
- Transcrição, legendas, player custom, fundo alternativo de download.
- Redesign do header do site ou da paleta global — apenas a superfície desta página.

## Rabbit holes de produto

- **Redesign do site inteiro ("já que estou aqui").** Se alguém "só completar": mexer no `SiteHeader`, na home, na paleta. **Corte neste item:** só a página `/corte/<id>` (no máximo, o acabamento da share kit dentro dela).
- **Player custom/branded.** Se alguém "só completar": controles próprios, autoplay, capa animada. **Corte:** `<video controls>` com poster, só acabamento visual.
- **Inventar contexto/claims sobre a fala.** Se alguém "só completar": biografia, números, "assista e compartilhe" com promessa. **Corte:** título/descrição reais de C167 + meta mínima; nada não verificável.

## Questões em aberto (produto)

- **Quanto contexto da fala mostrar?** **Opções:** A) só o corte + crédito | B) meta mínima (tipo · data · duração) + link do YouTube quando houver | C) bloco de contexto maior. **Recomendação:** B — dá credibilidade e data sem virar verbete. _(assumido — validar com produto)_
- **Onde fica a share kit?** **Opções:** A) logo abaixo do player (acima da descrição) | B) abaixo da descrição | C) CTA fixo no rodapé mobile. **Recomendação:** A — WhatsApp primário visível acima da dobra mobile; sem CTA fixo nesta fatia.
- **Tratar a origem do "fundo colorido"?** **Opções:** A) só garantir superfície neutra no redesign | B) investigar e remover o token tintado que a produção aparenta usar. **Recomendação:** B fail-safe — investigar a origem (theme/`editorial-bg`/gradiente do body) e forçar superfície neutra local. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1086
- Design UI (gate): `docs/plans/corte-pagina-publica-design-ui-design.html` (+ assets em `corte-pagina-publica-design-ui-design-assets/` se houver)
- `DESIGN.md` — "The Field Desk", themes `editorial`/`petition`, Signal Red Rule, header público.
- `AGENTS-public.md` — convenções do site público (corta quando toca `(frontend)`).
- Planos C167: `docs/plans/c167-cortar-trecho-publicar.md` e `...-impl.md` (rota, anti-goals, unlisted/noindex).
- Arquivo pivô: `src/app/(frontend)/corte/[id]/page.tsx`.
- Doutrina do design hi-fi: `.agents/skills/plan-issue/ui-design-html.md`.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (página bonita, compartilhável, sem fundo tintado); (2) appetite ~1–1,5 dia cabe com design hi-fi + port da página; (3) persona/job/aceite em linguagem de produto; (4) direção no codebase é hipótese; (5) zero decisão dura de engenharia.
