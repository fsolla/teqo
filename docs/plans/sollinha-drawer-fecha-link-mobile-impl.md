# Impl: Sollinha mobile: fechar o drawer ao navegar por link

Status: aprovado
Atualizado em: 2026-08-11
Issue: #660
Intenção: docs/plans/sollinha-drawer-fecha-link-mobile.md
Appetite restante: herdado (~0,5 dia eng; um encaixe no renderer de links do chat)

## Leitura da intenção

- **Outcome:** em mobile, tocar num link interno (`/campanha…`) na resposta do Sollinha fecha o drawer no toque (antes de a página carregar) e a navegação segue no mesmo tab; reabrir restaura a conversa intacta; desktop inalterado; link externo (nova aba) não fecha o drawer da aba de origem; reload não reabre o drawer.
- **O que NÃO negociar:** a conversa não pode ser descartada (sessão intacta); o painel desktop não pode fechar; só links das respostas do chat fecham (chips/sugestões/busca ficam fora — são `sendMessage`, não navegação, então nem chegam perto do renderer de links).
- **O que reavaliar:** a hipótese "fechar é chamar `setOpen(false)` no toque, provavelmente só quando `isMobile`" — validar o efeito no `userToggledOpenRef`/`openBy` persistido (ver Riscos).

## Decisões de engenharia

### D1 — Onde fechar o drawer

```
Opções: A | B | C
Recomendação: A — no onClick do renderer de link interno (mobile) — porque é o
único ponto que conhece a tripla href + viewport + gesto do clique: o renderer
já decide interno vs externo (B187/B188), o `ctx.isMobile` vem do provider e o
click event diz se é clique simples (mesmo tab). Fecha no toque, exatamente o
aceite ("antes de a página carregar"). Sessão intocada.
Alternativas rejeitadas: B (efeito em pathname no provider) porque fecha em
QUALQUER navegação — incluindo back/forward e cliques na faixa de 10% da página
visível acima do drawer —, mais amplo que o aceite (o corte da intenção é "só
os links das respostas") e dispara após o commit da navegação, não no toque; C
(expor `closeForNavigation` no contexto que não marca intenção de usuário)
porque `requestOpen(false)` já é seguro (ver Riscos) — crescer o API do
contexto sem mudança de comportamento é over-engineering.
```

### D2 — Onde mora a decisão pura (testável)

```
Opções: A | B
Recomendação: A — em `src/lib/ai/markdownLinks.ts` (dono da decisão de link
interno/externo, B187) — porque o regex `APP_INTERNAL_LINK` já é conhecimento
de link que vive no renderer; consolidar lá como `isCampaignInternalLink` e
adicionar `shouldCloseDrawerOnLinkClick` pura (href + isMobile + metadados do
click), unit-testável sem DOM. O renderer vira fiação fina.
Alternativas rejeitadas: B (deixar a condição inline no componente) porque a
regra de fechamento (mobile + interno + clique simples, ignorando
ctrl/meta/shift/alt/middle-click e defaultPrevented) merece pin de teste de
unidade, e o owner já existe.
```

### D3 — Como o renderer alcança o contexto

`markdownComponents` hoje é constante de módulo (sem acesso ao `useAISidebar`).
Mover para dentro de `CampaignAIChat` num `useMemo` (deps `[ctx?.isMobile,
ctx?.setOpen]`) — o `a` interno ganha `onClick` que fecha quando a função pura
responde true. `setOpen` (requestOpen) é estável via `useCallback`; o memo não
re-renderiza o markdown à toa. Alternativa rejeitada: componente novo
`AssistantMarkdown` — o chat já é o dono do markdown; fatiar em outro
componente é cerimônia sem volatilidade.

## Componentes / mudanças

- **`isCampaignInternalLink`** (`src/lib/ai/markdownLinks.ts`): regex `^\/campanha(?:\/|$)` promovido de `CampaignAIChat.tsx` para o owner; usado pelo renderer e pela função de fechamento. Sem mudança de semântica.
- **`shouldCloseDrawerOnLinkClick(href, isMobile, event)`** (`src/lib/ai/markdownLinks.ts`): `true` ⇔ link interno && `isMobile` && clique simples (`button === 0`, sem ctrl/meta/shift/alt, `!defaultPrevented`). Modifier/middle-click abre em nova aba — a aba de origem mantém o drawer (mesma regra do link externo).
- **`CampaignAIChat.tsx`**: `markdownComponents` vira `useMemo` no corpo do componente lendo `ctx`; o branch interno do `a` adiciona `onClick` que chama `setOpen(false)` quando `shouldCloseDrawerOnLinkClick`. Branch externo e desktop intactos (desktop: `isMobile` false → no-op).
- **`tests/unit/aiMarkdownLinks.unit.spec.ts`**: pin das duas funções puras (interno/externo, viewport, modifiers, botão, defaultPrevented).
- **`tests/e2e/campaignSollinhaContext.e2e.spec.ts`**: dois testes mobile com o mock de SSE já usado no arquivo (resposta com link interno → drawer fecha + URL muda sem `load`; resposta com link externo → drawer permanece e abre nova aba).
- **Migration:** sem migration.
- **Access / Consent:** N/A.
- **UI:** Impeccable B — comportamento do drawer existente, sem superfície nova; shape→critique leve (não há shape novo).

## Fases verificáveis

1. **Núcleo puro** — `markdownLinks.ts` + unit tests; `pnpm test:unit` (spec de markdownLinks).
2. **Fiação UI** — `CampaignAIChat.tsx` (useMemo + onClick); `pnpm typecheck` + `pnpm lint`.
3. **E2E** — dois testes no `campaignSollinhaContext.e2e.spec.ts`; rodar só o arquivo.
4. **Gates** — `pnpm gate:fast`, `pnpm format:check`, `pnpm exec knip`, `pnpm check:cycles`; push via `pnpm push` no PR.

## Rabbit holes / Não escopo (engenharia)

- Animar/transicionar o fechamento; mudar drawer/vaul; chips/sugestões/busca (não navegam); sessão/restauração; painel desktop; prefetch de link.
- Decisão de "qual drawer state se anima durante navegação": não existe — `setOpen(false)` usa o mecanismo existente.

## Riscos e mitigação

- **`openBy` persistido como `'user'` após fechamento por navegação** (porque `requestOpen` marca `userToggledOpenRef`): inerte — o restore só reabre quando `session.open === true` (CampaignAISidebarContext.tsx:89), e aqui `open` vira `false` antes do persist effect rodar (`status` ready + mudança de `open`). Reload não reabre (aceite). Validação no teste e2e existente "drawer aberto volta aberto após reload" não é afetada (aquele fluxo não navega).
- **Clique modificado (cmd/ctrl+click) em link interno**: abre nova aba; sem fechar — a aba de origem mantém o chat montado. Coberto por unit test da função pura.
- **Clique em link durante frame de hidratação (isMobile não medido)**: impossível — o drawer só renderiza com `isMobile` true, que só vira true após a medição (`useIsMobileMeasured`).
- **`markdownComponents` recriado por render**: o `useMemo` mantém identidade estável; `ReactMarkdown` recebe `components` novo apenas quando viewport/`setOpen` mudam.
- **Fechar + navegar no mesmo handler**: state update (drawer) e router push (next/link) coexistem sem conflito; o `e.defaultPrevented` não é tocado.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (5 itens do aceite → testes unit + e2e)
- [x] Invariantes AGENTS/engineering-standards (sem migration, sem access, identificadores em inglês, pt-BR só em strings de UI)
- [x] Testes de domínio previstos: unit (decisão pura) + e2e (comportamento drawer mobile)
