# Impl: CI main — e2e da agenda mobile vermelho desde o merge do B188 (deploy bloqueado)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #562
Intenção: docs/plans/ci-e2e-agenda-mobile-regressao-b188.md
Appetite: ~1 dia (diagnóstico já fechado; fix pequeno)

## Leitura da intenção

- **Outcome:** CI de `main` verde estável (e2e agenda mobile 4/4 em runs consecutivos) → deploy automático desbloqueado; se o mecanismo raiz for defeito real de produto, o comportamento do app é corrigido (não o teste).
- **O que NÃO negociar:** não enfraquecer as asserções do spec (C101 é o contrato de UX mobile da agenda); sem mudança de schema/Consent/access; não refatorar o spec nem a infra de e2e; não tocar leader lockdown.
- **O que reavaliar:** a hipótese da intenção apontava o chat como suspeito natural (B167 precedent) — confirmada, mas o mecanismo exato é diferente do "roubo de largura do primeiro frame": é o **vazamento do estado `open` persistido pelo B188 entre viewports da mesma aba**.

## Root cause (verificado localmente, prod build)

**Cadeia completa, confirmada por reprodução local (`E2E_PROD=1`, build `.next/e2e`) + error-contexts:**

1. O fixture `campaign.login` loga em **viewport desktop (1280×720)** e aterrissa em `/campanha`. O efeito `settle` de B167 (`CampaignAISidebarContext`) reconhece `measured && !isMobile` e faz `setOpen(true)` — o chat desktop "abre" sozinho no load (comportamento pré-existente).
2. **B188** adicionou o efeito **persist** (`sessionRestored && status === 'ready'`) — e `status` do `useChat` já nasce `'ready'` (nada foi enviado). Resultado: a página de login/dashboard grava `{version:1, messages:[], open:true}` no `sessionStorage` da aba.
3. O spec então faz `setViewportSize(390×844)` e `goto('/campanha/agenda')` — **mesma aba, mesmo `sessionStorage`**. No mount da agenda, o efeito **restore** do B188 lê a sessão e faz `setOpen(true)` → **o drawer mobile do Sollinha abre sozinho**.
4. O drawer (Radix Dialog modal) **aria-hide + inert** todo o resto da página (`ariaHideOutside`) e cobre o viewport. Consequências por teste:
   - `:96` — o swipe CDP cai no drawer (hit-testing) → título nunca avança para o dia seguinte.
   - `:242` — o combobox sai da a11y tree (aria-hidden) → `getByRole('combobox', { name: 'Filtrar agenda' })` → "element(s) not found" (o label via CSS selector ainda responde height ≤ 1 — por isso linha 265 passa).
   - `:295` — clique no seletor de visualização bloqueado pelo drawer/inert → timeout de 90s; **teclado funciona** porque keydown vai ao elemento focado, não por hit-testing.
   - `:173` — passa: nada de hit-testing/a11y (scroll programático + geometria).
5. **Por que determinístico desde 07464b88:** antes do B188 nada persistia `open` — o mount da agenda nascia com `open=false`. Depois, todo login desktop → visita mobile da mesma aba reabre o drawer. Único merge na janela verde(05:47)→vermelho(05:54) é o B188 (confirmado no histórico de runs do GH Actions).

**É defeito real de produto, não só teste:** um usuário com uma aba desktop (chat aberto pelo settle) que muda para largura mobile na MESMA aba → recarregar (ou o próprio reload ao cruzar) reabre o drawer sozinho — o "chat saltando" que o próprio B188 pinou como anti-comportamento no teste "visita mobile nova permanece fechada" (o caso "mobile desde o início" foi coberto; o caso "desktop→mobile na mesma aba" não). O drawer aberto também aria-esconde o conteúdo — quebra de acessibilidade.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph session [sollinhaChatSession.ts]
    S[shape: version 1 + openBy: 'user'|'settle'?]
  end
  subgraph provider [CampaignAISidebarContext]
    U[userToggledOpenRef — setOpen/toggle públicos marcam intenção]
    E1[restore: espera measured; abre só se openBy=user OU !isMobile]
    E2[persist: grava openBy conforme intenção do usuário]
  end
  U --> E2 --> S
  S --> E1
```

**Core:** distinguir `open:true` **de origem do usuário** (FAB/header/drawer → `setOpen`/`toggle`) de `open:true` **de origem do settle** (reconciliação do painel desktop, B167). O settle é verdade de layout, não intenção — persistir como `open:true` é o que vaza para o drawer mobile. O restore passa a honrar `open:true` em mobile **somente** quando a origem foi o usuário.

### Mudanças

1. **`src/lib/sollinhaChatSession.ts`** — `SollinhaChatSession` ganha `openBy?: 'user' | 'settle'` (opcional: sessões legadas sem o campo são tratadas como `'settle'` — fail-closed, o leak fecha também para sessões já gravadas pela versão atual). Validador aceita `undefined | 'user' | 'settle'` (rejeita qualquer outro). `writeSollinhaChatSession(messages, open, openBy = 'settle')`. **Sem bump de versão**: shape cresce compatível; sessão legada `{open:true}` continua válida e é interpretada como settle.
2. **`src/components/campaign/shell/ai/CampaignAISidebarContext.tsx`**:
   - `userToggledOpenRef` — o `setOpen` exposto no context value e o `toggle` passam a marcar a ref antes de setar (todas as superfícies de usuário — FAB, header, drawer — já passam por esses dois). Efeitos internos (restore, settle) usam o setter cru.
   - **restore**: passa a rodar **após `measured`** (a decisão precisa do viewport real; hoje roda no mount com `isMobile` não medido) e honra `session.open` só quando `session.openBy === 'user' || !isMobile`. Guard `sessionReadRef` mantém 1× sob re-renders/StrictMode.
   - **persist**: grava `openBy: userToggledOpenRef.current ? 'user' : 'settle'`.
   - `settle` (B167) e demais efeitos: intactos.
3. **Testes:**
   - Unit (`tests/unit/sollinhaChatSession.unit.spec.ts`): round-trip de `openBy`; sessão com `openBy` inválido → `null` (fail-closed); sessão legada sem `openBy` continua lendo.
   - E2E pin de regressão (`tests/e2e/campaignSollinhaContext.e2e.spec.ts`): novo teste "settle do desktop não vaza drawer para a visita mobile da mesma aba (OPS22)" — login desktop (poll `storedSession().open === true` garante o persist do settle) → viewport 390 → `goto('/campanha/agenda')` → `dialog` com count 0 + combobox "Filtrar agenda" visível + botão do Sollinha ainda visível (chat acessível). Não toca o spec da agenda.
   - Atualizar o comentário do teste "visita mobile nova..." em `campaignAiChatResize.e2e.spec.ts` (linhas ~147-150) que documenta o vazamento como "legítimo".
4. **Docs:** registrar entrega em `docs/CHANGELOG-AGENTS.md`; plano `*-impl.md` commitado.

**Por que os testes do B188 continuam verdes:** (1) desktop + conversa → reload desktop: settle-originated é honrado em desktop (equivale ao que o settle faria) ✓; (2) link navega sem reload ✓; (3) drawer mobile aberto pelo botão → openBy 'user' → restore abre ✓; (4) visita mobile nova (sem sessão) ✓. Os 4 da resize spec: crossings ao vivo (B167) não passam por restore ✓; "fechado cruza borda" usa `open:false` persistido ✓.

## Opções consideradas / rejeitadas

- **A) Track de intenção + `openBy` (escolhida)** — fecha o leak na origem (o persist), mantém o contrato B188 (aberto por usuário persiste), não descarta sessões, sem bump de versão.
- **B) Reverter o B188** — desbloqueia, mas devolve a funcionalidade entregue (persistência da conversa); rabbit hole que a intenção cortou.
- **C) Não persistir `open` quando `openBy=settle`** (gravar `open:false` no lugar) — quebra o teste B188 #1: reload desktop com conversa restaurada dependeria do settle reabrir, mas `restoredSessionRef` bloqueia o settle quando há sessão → painel fechado com conversa invisível. Rejeitada.
- **D) Bump de versão da sessão (v2 exigindo `openBy`)** — descarta sessões ativas de usuários na virada; sem necessidade (o campo opcional já fecha o leak nas legadas).
- **E) Enfraquecer/remover as 3 asserções do spec da agenda** — viola o anti-goal da intenção; o app regrediu de verdade.

## Fases verificáveis

1. **Lib pura** — `openBy` opcional + validador + default; unit tests novos; `pnpm test:unit` (só o arquivo).
2. **Provider** — ref de intenção + restore pós-measurement com gate de origem; persist com `openBy`.
3. **E2E (prod build)** — spec da agenda mobile 4/4; `campaignSollinhaContext` 4/4 (com o novo pin = 5); `campaignAiChatResize` 4/4.
4. **Gates + entrega** — `pnpm gate:fast` (lint/typecheck/unit) → `pnpm push` → PR `--base main` com `Closes #562` → auto-merge → `gh pr checks --watch --required` (deploy desbloqueado quando `checks` + `migration-lock` verdes).

## Rabbit holes / não escopo

- Comportamento **ao vivo** do crossing desktop→mobile (drawer abre por B167 quando `open=true`): **fora de escopo** — é design de B167 ("drawer open on resize"), pinado pela resize spec; a regressão B188 é o caminho persist/restore (reload).
- Outros flakes de carga (#553): destino #553.
- Artefato de `test-results` no CI (questão aberta da intenção): barato (upload action no passo de falha) — incluir só se não atrasar; senão registrar como débito (expensive_lock) na capture-review-debts.
- Restaurar `status` do chat / rascunho do input: já cortados pelo B188.

## Riscos e mitigação

| Risco                                                                                               | Mitigação                                                                                                                |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Restore atrasado 1 frame (gate `measured`) muda o flash do hello-state no reload                    | Adiciona só o tempo do matchMedia (~1 frame); o B188 já aceitava flash pós-montagem                                      |
| Sessão legada `{open:true}` tratada como settle → usuário desktop→mobile perde o "aberto" que tinha | É exatamente o defeito sendo corrigido (vazamento); no desktop o open continua honrado                                   |
| `setOpen` cru usado fora dos efeitos internos sem marcar intenção                                   | Auditoria: FAB/header/drawer usam `ctx.setOpen`/`ctx.toggle` (os wrappers); grep de `setOpen(` no shell confirma no gate |
| StrictMode duplo mount re-lê a sessão                                                               | `sessionReadRef` gate (idempotente)                                                                                      |
| Build .next/e2e divergente                                                                          | Mesmo comando do CI (`NEXT_DIST_DIR=.next/e2e pnpm build` + `E2E_PROD=1`)                                                |

## Aceite de engenharia

- [x] Aceite da intenção: CI verde estável (spec 4/4), deploy desbloqueado, app corrigido (drawer não salta), spec da agenda intacto
- [x] Invariantes AGENTS: sem migration/Consent/access; sem tocar acesso; identificadores em inglês; pt-BR só em strings visíveis
- [x] Testes: unit da lib (openBy), e2e pin da regressão, e2e existentes (agenda + B188 + resize) verdes

## Decisões de engenharia (self-score)

| Decisão             | Recomendação                                                       | Rejeitadas                                                                             |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Onde fechar o leak  | Persist/restore com origem da intenção (`openBy`)                  | Revert B188; não persistir open de settle (quebra B188 #1); bump v2 (descarta sessões) |
| Campo `openBy`      | Opcional no shape (legado = settle), sem bump de versão            | Obrigatório + version bump                                                             |
| Restore timing      | Depois de `measured` (precisa do viewport real)                    | No mount com isMobile não medido                                                       |
| Surfaces de usuário | Wrappers `setOpen`/`toggle` no provider (todos já passam por eles) | Marcar intenção em cada componente                                                     |
| Teste de regressão  | Pin novo no spec B188 (não mexe no spec da agenda)                 | Enfraquecer asserções da agenda                                                        |

**Self-score decision-quality: 5/5** — mecanismo raiz documentado e reproduzido (CI + local prod build, error-contexts com o drawer aberto), fix mínino na origem, todas as decisões com rejeitadas e testes por camada; nenhum teste enfraquecido.
