# Impl: Sollinha: links com aparência de link nas respostas

Status: aprovado
Atualizado em: 2026-08-10
Issue: #528
Intenção: docs/plans/sollinha-links-como-links.md
Appetite restante: ~0,5 dia (herdado)

## Leitura da intenção

- **Outcome:** todo link emitido pelo Sollinha numa resposta aparece sublinhado e com a cor primária do tema, distinguível do texto corrido, com hover e foco por teclado visíveis; links externos abrem em aba nova; o resto do markdown permanece como está.
- **O que NÃO negociar:** sem redesenho do bubble/chat; sem trocar o sistema de markdown; **qualquer** link conta (não só internos); sem instalar `@tailwindcss/typography`; navegação interna/clique é do B188 (fora).
- **O que reavaliar:** a hipótese da intenção ("classes `prose` sem efeito") foi **confirmada** — `@tailwindcss/typography` não está no `package.json` e o entry CSS (`styles.css`) só registra `tailwindcss-animate`/`tw-animate-css`/`shadcn/tailwind.css`. O `[button,a]:focus-visible:ring-*` do `BubbleContent` **não cobre** links aninhados no markdown (variantes `[button,a]:` só se aplicam quando o próprio `bubble-content` É um `<a>`/`<button>` via `asChild`; um `<a>` dentro do markdown não recebe nada). A "dica" de estado escuro da intenção é futurologia: o app está `forcedTheme="light"` no `ThemeProvider` e o shell `/campanha` não alterna `.dark` — a proteção é usar tokens (`text-primary`), que já é o que faremos.

## Abordagem recomendada

```mermaid
flowchart LR
  R[ReactMarkdown<br/>assistant message] -->|components.a| X[externalLinkTarget]
  R -->|classes escopadas| A["<a> interno: text-primary + underline<br/>+ hover decoration-2 + focus ring"]
  X -->|http(s):// | N["target=_blank<br/>rel=noopener noreferrer"]
  X -->|relativo/mailto| P["<a> padrão (navega no app)"]
```

**Opções consideradas:** A) classes utilitárias escopadas no contêiner do markdown + renderer mínimo só para links externos | B) classe CSS global (`.sollinha-markdown a {…}`) em `styles.css` | C) renderer `components.a` com as classes inline nele

**Recomendação:** **A** — as variantes arbitrárias `[&_a]:…` seguem o padrão já usado no mesmo elemento (`[&_h1]:text-base`, `[&_table]:text-xs`, …), mantêm o estilo 100% escopado ao chat (sem vazar para outras superfícies) e não trocam o sistema de markdown. O renderer existe **apenas** para o aceite "externo em aba nova" (que o CSS não cobre) e é fino: delega a decisão a uma função pura testável.
**Rejeitadas:** **B** porque espalha o contrato de estilo para o CSS global quando o contêiner já carrega todo o estilo do markdown em JSX (dois lugares para a mesma coisa) e o `prose` morto continuaria lá; **C** porque estilizar via renderer duplica o que o CSS escopado faz (o link renderizado também cai dentro do contêiner) e adiciona manipulação de `node` desnecessária.

### Componentes / mudanças

- **`externalLinkTarget`** (`src/lib/ai/markdownLinks.ts`, novo): função pura `(href: string) => { target: '_blank'; rel: 'noopener noreferrer' } | null` — externo = `^https?://` ou `//` (protocol-relative); tudo mais (relativo `/campanha/…`, `mailto:`, `tel:`, vazio) retorna `null`. Segue o precedente de módulo puro pequeno em `src/lib/` (ex.: `sollinhaChatPanelWidth.ts`).
- **`CampaignAIChat.tsx`** (`src/components/campaign/shell/ai/CampaignAIChat.tsx`):
  - `components={{ a }}` no `ReactMarkdown`: renderer que aplica `externalLinkTarget(href)` ao `<a>` e nada mais; `node` é descartado do spread (prop não-DOM do react-markdown v10).
  - Classes adicionadas ao div do markdown (junto das existentes):
    `[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:decoration-2 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring/50`
  - `[&_a]:text-primary` usa o token do tema (`#c51414` no claro campaign; ~4,6:1 sobre `--secondary` `#f5f5f4` — passa AA para texto normal); em dark hipotético os tokens flipam sozinhos.
- **Migration:** sem migration.
- **Access / Consent:** N/A — render de cliente, nenhuma escrita/leitura nova.
- **UI:** Impeccable B (encaixe no bubble). Sem novos shells; sem mudar bubble/padding/background. shape (classes) → craft (hover/focus) → critique (contraste + escopo) → polish só se a inspeção apontar.

### Dados → forma

- N/A — aparência apenas; nenhum dado.

## Fases verificáveis

1. **Core** — `src/lib/ai/markdownLinks.ts` + testes unitários (`tests/unit/aiMarkdownLinks.unit.spec.ts`): http/https/`//` → target/rel; `/campanha/…`, `mailto:`, `tel:`, `#anchor`, vazio → `null`.
2. **UI** — renderer `a` + classes no `CampaignAIChat.tsx`; e2e `tests/e2e/campaignAiLinks.e2e.spec.ts` (padrão `campaignAiChatResize`/`campaignAiTranscribe`: `mockAiChat` com SSE contendo `[Ilhéus](/campanha/municipios/ilheus)` e um link externo):
   - link interno visível, `color: rgb(197, 20, 20)` e `text-decoration-line` contém `underline`;
   - hover → `text-decoration-thickness: 2px`;
   - foco por teclado (Tab) → `toBeFocused()` + `box-shadow` ≠ `none` (ring visível);
   - link externo → `target="_blank"` e `rel` com `noopener`.
3. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push`; PR com `Closes #528`.

## Rabbit holes / Não escopo (engenharia)

- Estilizar o bubble inteiro (padding/cor de fundo) — proibido pela intenção.
- Remover as classes `prose` mortas — débito barato, registrar no capture-review-debts (não nesta entrega).
- Navegação interna sem reload / `router.push` — é o B188 (o renderer não intercepta cliques; só decide `target`/`rel`).
- Sanitizar URLs (`javascript:` etc.) — react-markdown v10 já filtra via `defaultUrlTransform`; fora.
- Instalar `@tailwindcss/typography` — explícito fora de escopo.
- Testar dark theme no e2e — o app está `forcedTheme="light"`; a garantia é via token (revisão visual opcional).

## Riscos e mitigação

| Risco                                           | Mitigação                                                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer `a` quebra props do react-markdown v10 | Descartar `node` do spread; renderer devolve `<a {...props}>` — os testes e2e provam render real                                       |
| Conflito com B188 (mesmo render de mensagens) | B188 já está em main (renderer `next/link` para `/campanha…`); o renderer deste item **compõe** em vez de substituir: interno → `next/link` preservado, externo → `target/_blank`, resto → âncora pura |
| Contraste da cor primária no bubble `secondary` | `#c51414` sobre `#f5f5f4` ≈ 4,6:1 (AA texto normal); hover não muda a cor, engrossa o sublinhado                                       |
| Classes `[&_a]` vazam para mensagens do usuário | Escopo é só o div do markdown das respostas do assistente (usuário renderiza `span` puro)                                              |

## Débitos deferidos (capture-review-debts, gate humano 2026-08-10)

- **D1 → Issue #556 (B194):** mock SSE v7 duplicado em 4 specs + mock legado em `campaignAiTranscribe` — extrair helper compartilhado em `tests/e2e/fixtures/`.
- **D2 (deferido):** classes `prose`/`dark:prose-invert` mortas no `CampaignAIChat` (plugin `@tailwindcss/typography` ausente). **Gatilho:** qualquer toque futuro no div do markdown do chat (B188+, B194) — remover junto.
- **D3 (deferido, absorvido por #556):** migrar o mock legado do `campaignAiTranscribe` para o formato v7 — executar junto do helper do D1.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (underline + primária + hover/foco + externo em aba nova + markdown intacto)
- [x] Invariantes AGENTS/engineering-standards (sem schema/access/Consent; identificadores em inglês; copy pt-BR)
- [x] Testes previstos: unit de `externalLinkTarget` + e2e de aparência/interação do link no chat

## Decisões de engenharia (self-score)

| Decisão             | Recomendação                                                          | Rejeitadas                                   |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Mecanismo de estilo | Variantes `[&_a]` no contêiner do markdown (padrão do arquivo)        | Classe global no CSS; classes no renderer    |
| Externo em nova aba | Função pura `externalLinkTarget` + renderer `a` fino                  | Renderer com toda a lógica; ignorar o aceite |
| Hover               | Engrossa o sublinhado (`decoration-2`), cor mantém                    | Mudar cor (piora contraste)                  |
| Foco                | `ring-2 ring-ring/50` escopado (BubbleContent não cobre `a` aninhado) | Confiar no ring existente (não se aplica)    |

**Self-score decision-quality: 4/5** — decisões baratas e reversíveis documentadas; appetite ~0,5 dia respeitado; rabbit holes nomeados; sem schema; seam limpo para o B188.
