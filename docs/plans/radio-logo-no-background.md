# Rádio — Remover fundo cinza do logo no player

**Issue:** #1247
**Status:** rascunho
**Appetite:** 30 min
**Prioridade:** P3
**Depends:** S25 (player próprio)

## Contexto

O player da Rádio Jorge Solla 1313 (`src/components/jingles/RadioPlayer.tsx`) exibe o logo sobre um quadrado cinza (`bg-(--campaign-band)`). O usuário deseja remover esse fundo, mantendo apenas o logo circular sobre o fundo da seção (branco/cream).

## Escopo

- Remover a classe `bg-(--campaign-band)` do container do logo em `RadioPlayer.tsx` (linhas 302-306).
- Ajustar o padding/margin do container se necessário para manter o alinhamento.
- Verificar se o brilho/sombra do círculo interno (`absolute inset-[13%] rounded-full border ...`) continua legível sem o fundo cinza.

## Fora de escopo

- Alterar o logo em si ( imagem PNG em `public/campaign-kit/radio/`).
- Mudar o layout do player em desktop (Cena 01).
- Alterar a versão compacta do player.

## Decisões

- **A:** Manter o círculo branco interno (`absolute inset-[13%] ...`) — ele dá profundidade ao logo.
- **B:** Não adicionar nenhum fundo alternativo — o logo circular ficará "flutuando" sobre o fundo branco da seção.

## Critérios de aceite

- [ ] O logo da rádio aparece circular, sem quadrado cinza atrás.
- [ ] O layout do player não quebra em mobile (390px) e desktop (1280px).
- [ ] A acessibilidade (contraste, labels) não é afetada.

## Notas de implementação

```tsx
// Antes
<div className="relative grid size-[76px] flex-none place-items-center overflow-hidden rounded-[10px] bg-(--campaign-band) md:size-28">

// Depois
<div className="relative grid size-[76px] flex-none place-items-center overflow-hidden rounded-[10px] md:size-28">
```
