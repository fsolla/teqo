# Impl: Sollinha: contexto da conversa persiste durante a sessão da janela/tab

Status: aprovado
Atualizado em: 2026-08-10
Issue: #529
Intenção: docs/plans/sollinha-contexto-sessao-janela.md
Appetite restante: ~1 dia eng (herdado; sem corte necessário)

## Leitura da intenção

- **Outcome:** clicar num link do Sollinha navega sem recarregar a página e a conversa continua; recarregar a aba restaura mensagens + estado aberto (painel/drawer conforme viewport); fechar a aba apaga tudo; nada cruza abas ou vai ao servidor.
- **O que NÃO negociar:** nada em servidor/banco; nada entre abas/dispositivos; sem migration/schema/Consent; guardrail de tamanho sem UI; não restaurar rascunho do input; chat nunca "salta" sozinho em visita nova.
- **O que reavaliar:** a hipótese de direção (Link no render do markdown + sessionStorage) está correta; o detalhe a resolver é **quando** persistir (escrita só em estado settle, nunca durante streaming) e a interação com o efeito `settle` de B167 que força `open=true` no desktop ao carregar.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph pure [sollinhaChatSession.ts — sem React]
    K[chave sessionStorage]
    P[prune: 50 msgs / 256KB, drop-oldest]
    R[read: parse + validação fail-closed]
    W[write: try/catch, fail-open]
  end
  subgraph provider [CampaignAISidebarContext]
    E1[restore no mount]
    E2[persist quando status ready]
  end
  subgraph render [CampaignAIChat]
    L[ReactMarkdown a → next/link se /campanha]
  end
  sessionStorage --> R --> E1 --> useChat.setMessages + setOpen
  useChat.messages --> E2 --> P --> W --> sessionStorage
  L -.->|router.push sem reload| destino
```

**Opções consideradas:** A) persistência própria em `sessionStorage` + Link nos links internos | B) `persistence` nativo do AI SDK | C) persistir no servidor (Payload/collection) | D) interceptar clique por `router.push` em vez de `next/link`
**Recomendação:** **A** — AI SDK v7 (`@ai-sdk/react@4`) **não tem** `persistence` (verificado nas types: `UseChatOptions` só aceita `chat`/`throttle`/`resume`); `sessionStorage` é o único storage com a semântica exata do aceite (por-aba, sobrevive a reload, morre ao fechar a aba); `next/link` é o caminho idiomático para navegação por cliente e preserva open-in-new-tab/modifier keys.
**Rejeitadas:** **B** porque a opção não existe nesta versão (e o `Chat` da lib expõe `setMessages`, que usamos com zero acoplamento à lib de storage); **C** porque viola o anti-goal da intenção (nada no servidor) e exigiria migration; **D** porque `onClick`+`router.push` não respeita middle-click/ctrl+click e reimplementa o que `next/link` já faz.

### Componentes / mudanças

- **`sollinhaChatSession.ts`** (`src/lib/sollinhaChatSession.ts`, novo, puro): chave `teqo:campaign:sollinha-chat-session`; shape `{ version: 1, messages, open }`; `readSollinhaChatSession()` (guards `typeof window` + try/catch + validação fail-closed → `null`); `writeSollinhaChatSession(messages, open)` (fail-open: quota/private-mode ignorados); `pruneSollinhaChatMessages(messages)` — tetos `SOLLINHA_CHAT_MAX_MESSAGES = 50` e `SOLLINHA_CHAT_MAX_BYTES = 256 * 1024` (JSON), drop-oldest sem UI de aviso. Espelha o padrão de `sollinhaChatPanelWidth.ts` (B166).
- **`CampaignAISidebarContext.tsx`**: dois efeitos no provider:
  - **restore** (montagem, 1×): lê a sessão → `chat.setMessages(restored.messages)` + `setOpen(restored.open)`; idempotente sob StrictMode. Sem `useState` initializer para não divergir da hidratação (mensagens renderizam no primeiro paint do painel desktop).
  - **persist** (`[status, messages, open]`): grava **somente quando `status === 'ready'`** — nunca durante streaming, então o que está no storage é sempre settle-completo (nenhum part parcial/tool em voo); grava `prune(messages)` + `open`.
- **`CampaignAIChat.tsx`**: componente `MarkdownLink` passado ao `ReactMarkdown` via `components={{ a }}` — `href` interno (`/^\/campanha(\/|$)/`, o catálogo fechado de B162 só produz paths `/campanha…`) → `next/link` `Link`; qualquer outro (absoluto, `#`, `mailto`, `/api/…`) → `<a>` igual a hoje (sem `target` novo — disciplina de escopo).
- **Migration:** sem migration. **Access / Consent:** N/A. **UI:** Impeccable A — sem superfície nova; B187 (aparência de link) é irmão no mesmo render, ortogonal (muda classe CSS; aqui só o elemento).
- **`useChat`**: mantém `id: 'campaign-sollinha'`; restauração via `setMessages` (exposto pelas helpers).

### Dados → forma

- Forma: `JSON.stringify` direto de `UIMessage[]` (parts `text` + `tool-invocation` completas, **com** `output` — `convertToModelMessages` na route transforma tool parts completas em `tool-call` + `tool-result`, então o modelo recebe o histórico íntegro ao continuar a conversa restaurada).
- Rejeitadas: strip de `output` de tool parts (quebraria o round-trip do histórico para o modelo); compressão (sem ganho no appetite).

## Fases verificáveis

1. **Tracer / lib pura** — `sollinhaChatSession.ts` + unit tests (`tests/unit/sollinhaChatSession.unit.spec.ts`: parse inválido → null, prune por contagem e por bytes mantendo o mais novo, round-trip, versão desconhecida → null). `pnpm test` unit.
2. **Provider + render** — efeitos restore/persist + `MarkdownLink`. E2E novo `tests/e2e/campaignSollinhaContext.e2e.spec.ts`: (a) reload na mesma aba restaura mensagens (mock SSE com link markdown) e some o hello-state; (b) clique no link da resposta navega por cliente (contador de `page.on('load')` não incrementa + URL muda + mensagens continuam); (c) mobile: drawer aberto antes do reload volta aberto; fechado volta fechado; (d) reload com zero mensagens mantém hello-state e drawer fechado (sem chat saltando). Os testes existentes de `campaignAiChatResize` (aba nova vazia, fechado cruza borda) viram regressão do isolamento.
3. **Gates** — `pnpm gate:fast`; entrega via `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Restaurar `status` ('submitted'…): proibido — input ficaria bloqueado para sempre; o chat sempre recomeça `ready`. Reload no meio de um stream perde **aquele** turno (o stream não é resumível; storage só tem o último settle) — corte documentado do "estado em andamento".
- Rascunho do input: não persiste (decisão B da intenção).
- Fechar sheet/drawer ao clicar link (non-goal explícito de B162).
- `target="_blank"` para links externos / aparência de link (B187).
- Sincronizar entre abas (`storage` events): proibido por intenção.
- Migrar largura (B166, localStorage) ou superfície (B167) para a sessão — regras próprias, intactas.

## Riscos e mitigação

| Risco                                                                       | Mitigação                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conflito com o efeito `settle` de B167 (`open=true` no desktop ao carregar) | Analisado: no desktop o painel RRP abre visível no load e `settle` manda `open=true` de qualquer forma — comportamento atual preservado (aceite exige só aberto→aberto); no mobile o `settle` não roda e o flag restaurado manda no drawer. Última escrita vence; sem regressão. |
| Escrita durante streaming grava mensagem parcial                            | Persist só em `status === 'ready'` (uma janela única de escrita); `open` mudado no meio do stream é gravado no settle seguinte.                                                                                                                                                  |
| sessionStorage indisponível (private mode/quota)                            | try/catch fail-open: chat funciona, só não persiste (precedente B166).                                                                                                                                                                                                           |
| Hidratação diverge se restaurar no initializer                              | Restore em `useEffect` pós-montagem; primeiro paint idêntico ao SSR; sem warning de hidratação (flash de 1 frame do hello-state no reload — aceito).                                                                                                                             |
| Tool parts sem `output` quebrariam o histórico no round-trip                | Persistir `UIMessage[]` íntegras; `convertToModelMessages` (verificado no fonte da lib) emite `tool-result` para parts completas.                                                                                                                                                |
| Drift com B187 (mesmo render do markdown)                                   | Mudanças ortogonais (elemento vs estilo); sequenciáveis sem conflito.                                                                                                                                                                                                            |

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (links por cliente; reload restaura msgs + aberto; aba fecha apaga; nada cruza abas/servidor; guardrail sem UI)
- [x] Invariantes AGENTS/engineering-standards (nada de migration/Consent/access; pt-BR só em strings visíveis; identificadores em inglês)
- [x] Testes de domínio previstos: unit da lib pura (prune/parse) + e2e de contexto (reload, link por cliente, mobile aberto/fechado)

## Decisões de engenharia (self-score)

| Decisão                   | Recomendação                                          | Rejeitadas                                                                                           |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Mecanismo de persistência | `sessionStorage` próprio via lib pura                 | `persistence` do AI SDK (não existe no v7); collection/servidor (anti-goal)                          |
| Quando persistir          | Só em `status === 'ready'` (settle-completo)          | A cada chunk (grava parcial); a cada mudança de `open` (pode capturar stream em voo)                 |
| Restauração               | `useEffect` pós-montagem + `setMessages`/`setOpen`    | initializer de `useState` (hidratação); `useSyncExternalStore` (complexidade sem ganho para 1 frame) |
| Guardrail                 | 50 mensagens + 256 KB, drop-oldest                    | UI de aviso; strip de tool outputs (quebra round-trip)                                               |
| Links internos            | `next/link` via `components={{ a }}` no ReactMarkdown | `onClick`+`router.push` (perde modifier keys); interceptar no container (raro/rasteiro)              |
| Escopo do link            | Só `/campanha…` vira `Link`                           | Todos os relativos (catálogo fechado de B162 não produz outros)                                      |

**Self-score decision-quality: 5/5** — decisões caras com rejeitadas documentadas; appetite respeitado; rabbit holes nomeados (incl. o corte do stream em voo); reusa padrões existentes (`sollinhaChatPanelWidth`, `setMessages`, `convertToModelMessages`); o aceite de produto permanece íntegro — a engenharia não reescreveu o outcome.
