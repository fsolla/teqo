# Impl: Jingles — Carousel mobile e cards menores

Status: aprovado
Atualizado em: 2026-09-22
Issue: #1249
Intenção: docs/plans/jingles-mobile-carousel.md
Appetite restante: herdado (45 min)

## Leitura da intenção

- **Outcome:** No mobile (390px), os cards de jingle aparecem em carrossel horizontal com scroll suave e snap; cards menores que os atuais; desktop (1280px) mantém grid de 3 colunas. Remover textos explicativos e indicadores de UI no mobile.
- **O que NÃO negociar:** Layout desktop (grid 3 colunas) intocado; player de áudio/controles de play/pause inalterados; mesma quantidade de jingles exibidos; acessibilidade (navegação por teclado, leitores de tela) preservada.
- **O que reavaliar:** Hipóteses de "Direção no codebase" que podem estar erradas: (1) O `JingleCards` já é client component — verificar se o carrossel pode ser implementado sem novo wrapper; (2) Breakpoint `md` (768px) pode ser adequado para mobile vs desktop; (3) Remoção de textos pode afetar a compreensão do fluxo de uso.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph page[JingleCards.tsx — client]
    A[mobile: flex overflow-x-auto snap-x] --> B[Card w-[280px] flex-none snap-start]
    C[desktop: md:grid md:grid-cols-3] --> D[Card md:w-auto md:flex-none]
  end
  E[JingleIntro.tsx] --> F[Remover bloco "Um jingle toca por vez"]
  G[JingleHomeSection.tsx] --> H[Remover "Um jingle toca por vez"]
  I[Estilos] --> J[Reduced padding mobile]
```

**Opções consideradas:** A | B | C
**Recomendação:** **A — CSS-only responsive layout** — porque o `JingleCards` já é client component e o carrossel pode ser implementado com `overflow-x-auto snap-x snap-mandatory` no mobile, mantendo o grid existente no desktop via breakpoint `md`. Não exige novo wrapper ou mudança de semântica a11y.
**Rejeitadas:**

- **B) Wrapper client com matchMedia** — Custo: componente wrapper novo + dupla renderização pós-hidratação para detectar viewport. O S6 (home-campanha-sem-carrossel-desktop) já rejeitou esse padrão por não vale o movimento quando o CSS resolve.
- **C) Biblioteca de carrossel (ex: Embla)** — Custo: nova dependência + setup + customização. O scroll nativo com snap atende ao requisito (snap suave, sem auto-avanço) e mantém zero deps.

### Componentes / mudanças

- **`JingleCards`** (`src/components/jingles/JingleCards.tsx`): Adicionar classes responsive para mobile (carrossel) e desktop (grid). Cards mobile com `w-[280px] flex-none snap-start`; desktop `md:w-auto md:flex-none`.
- **`JingleIntro`** (`src/components/jingles/JingleIntro.tsx`): Remover bloco inteiro "Um jingle toca por vez" (icone + texto) via `hidden sm:block` ou remoção direta. Remover parágrafo mobile "Dê o play para ouvir aqui..." mantendo versão desktop.
- **`JingleHomeSection`** (`src/components/jingles/JingleHomeSection.tsx`): Remover texto "Um jingle toca por vez." da seção de jingles.
- **Migration:** sem migration. **Access/Consent:** n/a. **UI:** Impeccable B — shape → craft (browser, viewports 390/1280) → critique → polish.

### Dados → forma

- Sem dados novos — itens já existem. Forma: carrossel horizontal no mobile com cards menores; grid estático no desktop.

## Fases verificáveis

1. **Layout mobile carrossel** — Modificar `JingleCards.tsx`: adicionar `overflow-x-auto snap-x snap-mandatory` no container, cards com `w-[280px] flex-none snap-start`. Verificar scroll suave e snap no mobile (390px).
2. **Cards menores mobile** — Ajustar padding e imagem: `p-4` mobile vs `p-5` desktop, `h-40` mobile vs `h-48` desktop. Gap `gap-4` mobile vs `gap-5 sm:gap-6` desktop.
3. **Desktop grid preservado** — Manter `md:grid md:grid-cols-3` no container; cards `md:w-auto md:flex-none`. Verificar grid 3 colunas no desktop (1280px).
4. **Remoção de textos** — `JingleIntro.tsx`: remover bloco "Um jingle toca por vez" (icone + texto) e parágrafo mobile. `JingleHomeSection.tsx`: remover "Um jingle toca por vez."
5. **Gates** — `pnpm gate:fast` na iteração; `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Não redesenhar o card no mobile (mantém estrutura existente, só ajusta tamanho).
- Não mexer no player de áudio ou controles de play/pause.
- Não alterar a quantidade de jingles exibidos.
- Não adicionar indicadores de carrossel (barra de rolagem, paginação, texto "Arraste para ouvir mais").

## Riscos e mitigação

- **Regressão mobile:** Container mobile com `overflow-x-auto` pode causar layout quebrado se cards não tiverem largura fixa. Mitigação: `w-[280px] flex-none` garante largura consistente; snap alinha cards.
- **Desktop grid afetado:** Breakpoint `md` pode não ser adequado. Mitigação: testar em 768px+ para garantir transição suave.
- **Acessibilidade:** Carrossel horizontal pode não ser acessível por teclado. Mitigação: `snap-x` com `scroll-snap-type` e `scroll-snap-align` suportam navegação por teclado; verificar `aria-label` nos cards.
- **Performance:** Múltiplos `<audio>` elements podem consumir memória. Mitigação: manter `preload="none"` existente; áudio só carrega ao play.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (carrossel mobile, cards menores, desktop grid)
- [ ] Invariantes AGENTS/engineering-standards (sem migration/Consent; identificadores em inglês; copy pt-BR)
- [ ] Testes de domínio previstos (unit/int) onde access/write paths mudam — verificar se `JingleCards` tem testes existentes; adicionar testes de layout se necessário.

**Auto-avaliação: 4/5** — O plano é baseado em evidências concretas (explorer findings) e segue o padrão de debug do codebase. As hipóteses são testáveis e o apetite é realista. Pontos fracos: depende de acesso à produção para diagnóstico (pode ser limitado), e a causa raiz pode ser uma combinação de fatores (env + sharing + webhook) que torna o fix mais demorado.
