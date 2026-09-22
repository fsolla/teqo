# Jingles — Carousel mobile e cards menores

**Issue:** #1249
**Status:** rascunho
**Appetite:** 45 min
**Prioridade:** P3
**Depends:** S21 (cards de jingle)

## Contexto

Na seção de jingles da home (`src/components/jingles/JingleHomeSection.tsx`) e na página `/jingles`, os cards de jingle são grandes e empilhados no mobile, ocupando muito espaço vertical. O usuário deseja cards menores e em carrossel no mobile, removendo textos explicativos e indicadores de UI.

## Escopo

- Modificar `src/components/jingles/JingleCards.tsx` para usar layout de carrossel no mobile.
- Reduzir o tamanho dos cards no mobile (menor padding, imagem menor).
- Manter o layout de grid (3 colunas) no desktop (`md+`).
- Adicionar scroll horizontal com snap no mobile.
- **Remover** o bloco inteiro "Um jingle toca por vez" (icone + texto) de `JingleIntro.tsx` e `JingleHomeSection.tsx`.
- **Remover** o parágrafo mobile "Dê o play para ouvir aqui..." de `JingleIntro.tsx` (manter a versão desktop).
- **Esconder** o parágrafo "Escolha um jingle, dê o play e escute aqui mesmo." no mobile (usar `hidden sm:block` em `JingleIntro.tsx`).
- **Ajustar** o espaçamento no mobile para posicionar o carrossel mais próximo do título (reduzir `pb` do container do título e `py` da seção do carrossel).
- **Remover** indicadores de carrossel: barra de rolagem visual, texto "Arraste para ouvir mais" e paginação "1 de 3".
- **Ajustar** o espaçamento no mobile para posicionar o carrossel mais próximo do título.

## Fora de escopo

- Alterar o player de áudio ou controles de play/pause.
- Modificar o layout desktop (Cena 01).
- Alterar a quantidade de jingles exibidos.

## Decisões

- **A:** Usar `overflow-x-auto snap-x snap-mandatory` para o carrossel mobile.
- **B:** Cards mobile terão `w-[280px] flex-none` (largura fixa) em vez de `w-full`.
- **C:** Gap entre cards: `gap-4` mobile, `gap-5 sm:gap-6` desktop.
- **D:** Imagem de capa: `h-40` mobile (vs `h-48` desktop).
- **E:** Remover o bloco "Um jingle toca por vez" (icone + texto) de `JingleIntro.tsx` e `JingleHomeSection.tsx`.
- **F:** Remover o parágrafo mobile "Dê o play para ouvir aqui..." de `JingleIntro.tsx` (manter a versão desktop).
- **G:** Não exibir barra de rolagem visual, texto "Arraste para ouvir mais" ou paginação "1 de 3" no carrossel.

## Critérios de aceite

- [ ] No mobile (390px), os cards de jingle aparecem em carrossel horizontal.
- [ ] Os cards são menores que os atuais no mobile.
- [ ] O scroll é suave com snap.
- [ ] No desktop (1280px), o layout continua sendo grid de 3 colunas.
- [ ] A acessibilidade (navegação por teclado, leitores de tela) funciona.

## Notas de implementação

```tsx
// Mobile: carrossel
<div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:snap-none md:gap-5 lg:gap-6">

// Card mobile
<article className="w-[280px] flex-none snap-start ... md:w-auto md:flex-none">
```
