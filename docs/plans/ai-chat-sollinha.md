# AI Chat — "Sollinha" (assistente virtual da campanha)

Status: entregue (2026-08-04 — v1 read-only)
Atualizado em: 2026-08-04
Item do roadmap: feature nova (não numerada em trilha)
Appetite: ~2 dias eng; API route + tools + chat UI com shadcn; sem migration, sem collection, sem Consent

## Design

Âncoras: `PRODUCT.md` (Field Desk; PWA de campo) / `DESIGN.md` · tema `data-theme='campaign'`.

Na implementação: **chat sidebar no desktop, drawer full-screen no mobile** — o assessor mantém a tela principal visível enquanto conversa com a IA.

Brief compacto:

- **Persona / contexto:** Assessor/coordenador navegando em `/campanha` quer fazer perguntas sobre os dados sem sair da tela atual ("Quantos votos tivemos em Ilhéus em 2022?", "Quem é o deputado mais votado em Feira?", "Quais dobradinhas temos em Salvador?").
- **Job principal:** abrir chat, perguntar em linguagem natural, receber resposta com dados reais do banco.
- **Estratégia de cor:** Restrained — botão 🤖 no header (desktop + mobile), ao lado do sino de notificações. Sheet cinza com bubbles padrão shadcn.
- **Edit where you see:** não — chat.
- **Anti-goals:** substituir navegação pela IA; persistir histórico entre sessões (complexidade desnecessária no v1); write tools no v1.

## Dados → decisão → apresentação

Dados: TSE 2014/2018/2022 (`electionCandidateVote`, `electionTally`), municípios, lideranças, dobradinhas, organizações.

## Arquitetura

### Fluxo de dados

```
┌──────────┐   POST /campanha/api/ai-chat    ┌──────────────┐
│  Client  │ ───────────────────────────────> │  Route (RSC) │
│ useChat  │ <─────────────────────────────── │  streamText  │
│ (shadcn) │   Streaming (Server-Sent Events) │  + tools     │
└──────────┘                                  └──────┬───────┘
                                                     │
                                          ┌──────────▼───────┐
                                          │  Payload Local   │
                                          │  API (user-scoped│
                                          │  access control) │
                                          └──────────────────┘
```

### Camadas

| Camada        | Localização                                                   | Responsabilidade                                                                              |
| ------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| API route     | `src/app/(campaign)/campanha/api/ai-chat/route.ts`            | Streaming endpoint: auth via `campaign-token`, rate limit, `streamText` com DeepSeek V4 Flash |
| Tools         | `src/utilities/ai/tools/*.ts`                                 | 8 funções que o modelo chama: queries Payload com `user` scoped                               |
| System prompt | `src/utilities/ai/systemPrompt.ts`                            | Personalidade "Sollinha" + domínio eleitoral da Bahia                                         |
| Rate limiter  | `src/utilities/ai/rateLimit.ts`                               | In-memory token bucket: 50 mensagens por 15 min por usuário                                   |
| Chat UI       | `src/components/campaign/shell/ai/*.tsx`                      | `useChat` hook + shadcn `message`/`bubble`/`input-group`                                      |
| Sheet         | `src/components/campaign/shell/ai/CampaignAIChatSheet.tsx`    | Sheet (desktop) / Drawer (mobile) — wrapper responsivo                                        |
| Header button | `src/components/campaign/shell/ai/CampaignAIHeaderButton.tsx` | Botão 🤖 no `CampaignDesktopHeader` e `CampaignMobileTopBar`                                  |
| Types         | `src/lib/ai/types.ts`                                         | `AIToolContext = { user, payload }`                                                           |

### Modelo

- **Modelo:** `deepseek-v4-flash` via `@ai-sdk/deepseek`
- **Tool calling:** nativo (suportado pelo modelo)
- **Multi-step:** `stopWhen: stepCountIs(10)` — permite tool → resposta → tool encadeado
- **Streaming:** `result.toUIMessageStreamResponse()` — Server-Sent Events

### Contexto

- **Sem persistência:** cada abertura do chat = sessão nova. `useChat` sem `id`/`initialMessages`.
- **Sem histórico entre abas/dispositivos:** a complexidade de threads fica para v2.
- **Limpeza implícita:** fechar o Sheet/Drawer descarta o estado React.

### Rate limiting

- **Algoritmo:** in-memory token bucket, keyed by `userId`.
- **Limite:** 50 mensagens por janela de 15 minutos.
- **Resposta no estouro:** HTTP 429 com mensagem em pt-BR.
- **Resiliência:** sobrevive a um servidor; reseta no deploy. Suficiente para v1.

## Ferramentas (v1 read-only)

| #   | Tool                      | Descrição                                                       | Fonte de dados                               |
| --- | ------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| 1   | `calculate`               | Aritmética segura (sem `eval`) — percentuais, somas, taxas      | Puro, sem DB                                 |
| 2   | `getMunicipalityVotes`    | Votos do Solla por ano + voto válido no município               | `electionCandidateVote` + `electionTally`    |
| 3   | `getTopDeputies`          | Ranking de deputados federais mais votados no município/ano     | `electionCandidateVote`                      |
| 4   | `getDobradinhas`          | Parcerias com deputados estaduais, filtráveis por município     | `stateDeputy` + `municipality.stateDeputies` |
| 5   | `getMunicipalityOverview` | Nível de engajamento, prioridade, lideranças, compromissos      | `municipality` + contagens                   |
| 6   | `getLeaderships`          | Lideranças por município ou nome                                | `leadership`                                 |
| 7   | `getOrganizations`        | Organizações por município, tipo ou nome                        | `organization`                               |
| 8   | `searchEntities`          | Busca fuzzy cross-collection (fallback quando pergunta ambígua) | 4 coleções em paralelo                       |

Cada tool recebe `{ user, payload }` e chama a Local API com `overrideAccess: false` + `user` (respeita RBAC) ou `overrideAccess: true` com justificativa (dados eleitorais públicos).

## Decisões travadas

- **Vercel AI SDK (`ai` + `@ai-sdk/deepseek`), não LangChain/Mastra.** O AI SDK é first-party Next.js, tem `streamText` com tools nativo, `useChat` hook no cliente, e o projeto já está em Next.js. **Rejeitado:** LangChain (overhead de abstração sem ganho para tools simples); Mastra (framework de agentes completo, desnecessário para v1 de chat com tools).
- **Modelo `deepseek-v4-flash`, não `deepseek-chat` legado.** O nome legado `deepseek-chat` será descontinuado em 2026-07-24. O V4 Flash suporta tool calling e tem 128K tokens de input. **Rejeitado:** `deepseek-v4-pro` (mais caro, desnecessário para queries de dados); `deepseek-reasoner` (latência maior, sem ganho para tools).
- **8 tools específicas + 1 calculadora, não 1 tool genérica "query".** Tools com propósitos não-sobrepostos melhoram o routing do modelo. **Rejeitado:** uma tool "query anything" faz o modelo alucinar a sintaxe de query; uma tool "sql" é insegura e desnecessária (Payload já é a camada de query).
- **shadcn chat components (`message`, `bubble`, `marker`, `input-group`), não hand-rolled.** shadcn lançou chat components em junho/2026; o projeto já usa shadcn; a qualidade visual e de acessibilidade é superior a hand-rolling. **Rejeitado:** `@chatscope/chat-ui-kit-react` (lib externa, bundle maior, menos integração com Tailwind/shadcn).
- **Sheet (desktop) / Drawer (mobile), não modal Dialog.** O assessor precisa manter a tela principal visível enquanto interage com a IA. **Rejeitado:** Dialog modal (bloqueia a tela principal); página separada (perde o contexto de onde o usuário estava).
- **Header button, não FAB.** Produto pediu FAB inicialmente, mas o header é mais discoverable e consistente com o sino de notificações. **Rejeitado:** FAB flutuante (competiria com o FAB de ações rápidas); ícone no sidebar (menos visível, navegação já tem densidade alta).
- **Contexto limpo a cada abertura.** Complexidade de threads/histórico é desnecessária para o target user (assessor de campanha em campo). **Rejeitado:** persistir conversas no DB (migration, UI de histórico, cleanup — v2); auto-clean por inatividade (surpreende o usuário que volta).

## Dependências

Nenhuma — feature independente. Não depende de migrações, collections novas, Consent, ou outras features.

## Não escopo (v1)

- Write tools (criar/editar lideranças, pledges, atividades via chat)
- Histórico persistente entre sessões
- Web search (grounding externo)
- Speech-to-text (Assembly AI)
- Upload de arquivos/áudio no chat
- Suporte a múltiplos modelos

## Roadmap futuro (arquitetura preparada)

| Feature               | Como a arquitetura atual suporta                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write tools           | Adicionar tool em `src/utilities/ai/tools/`, registrar no `index.ts`. Usar `payload.update`/`payload.create` com `user` scoped — mesmo padrão das tools de leitura.     |
| Web research          | Adicionar tool `webSearch` que chama uma API externa. O `streamText` com tools suporta nativamente.                                                                     |
| Speech-to-text        | `InputGroup` aceita slot de addon. Adicionar botão de microfone que grava → envia para Assembly AI via server action → injeta transcrição como `sendMessage({ text })`. |
| Meeting recording     | Pipeline: gravar → Assembly AI transcript → `sendMessage({ text: "Resuma esta reunião e sugira atualizações nos dados: ..." })`.                                        |
| Mudar de modelo       | Trocar `deepSeek('deepseek-v4-flash')` por outro provider no `route.ts` — tools e UI não mudam.                                                                         |
| Histórico persistente | Passar `id` para `useChat` + salvar mensagens em collection Payload. Migração simples (uma collection `aiChatMessage`).                                                 |

## Testes

| Camada | Cobertura                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit   | `campaignMobileTopBar.unit.spec.tsx` cobre o botão AI no header mobile (existente, estendido); `codebaseConventions.unit.spec.ts` cobre a allowlist do route                          |
| Int    | Queries Payload das tools são cobertas indiretamente pelos int tests dos data loaders existentes (`municipalityElectoralBaseline`, `votePledgeViews`, etc.)                           |
| E2e    | `tests/e2e/ai-chat.e2e.spec.ts` — abre o Sheet, digita mensagem, verifica resposta mockada. Mocka `/campanha/api/ai-chat` com `page.route()` para não depender de API key real no CI. |

### E2e mocking strategy

O endpoint de chat é mockado no Playwright com `page.route()`:

```ts
await page.route('**/campanha/api/ai-chat', async (route) => {
  // Retorna um stream SSE mínimo que o useChat entende
  await route.fulfill({
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    body: 'data: {"type":"text","text":"Olá! Como posso ajudar?"}\n\n',
  })
})
```

Isso permite testar o fluxo completo de UI (botão → Sheet → digitar → resposta) sem chave de API no CI. **Não é necessário `DEEPSEEK_API_KEY` como repo secret.**

## Configuração de ambiente

| Variável           | Onde                  | Obrigatória                    |
| ------------------ | --------------------- | ------------------------------ |
| `DEEPSEEK_API_KEY` | Vercel production env | Sim (produção)                 |
| `DEEPSEEK_API_KEY` | `.env.local`          | Sim (desenvolvimento local)    |
| `DEEPSEEK_API_KEY` | GitHub repo secrets   | **Não** (e2e mocka o endpoint) |

## Referências

- `src/app/(campaign)/campanha/api/ai-chat/route.ts` — endpoint
- `src/utilities/ai/tools/index.ts` — registro de tools
- `src/utilities/ai/systemPrompt.ts` — prompt do sistema
- `src/components/campaign/shell/ai/CampaignAIChat.tsx` — UI do chat
- `src/components/campaign/shell/ai/CampaignAIChatSheet.tsx` — Sheet/Drawer
- `src/components/campaign/shell/ai/CampaignAIHeaderButton.tsx` — botão no header
- `src/components/campaign/shell/CampaignDesktopHeader.tsx` — header desktop
- `src/components/campaign/shell/CampaignMobileTopBar.tsx` — header mobile
- AGENTS.md — Campaign auth, Municípios model
- `PRODUCT.md` / `DESIGN.md`
