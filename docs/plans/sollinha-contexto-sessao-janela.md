# Sollinha: contexto da conversa persiste durante a sessão da janela/tab

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #529
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (comportamento de estado; nenhuma superfície nova)
Canvas UI: N/A — sem UI
Appetite: ~1 dia eng; navegação dos links do chat + persistência de sessão da aba; sem migration/schema/Consent

## Intenção

O Sollinha foi pensado para trabalhar **em colaboração** com o usuário, mas hoje o contexto da conversa se perde: se o usuário clica num link que o próprio Sollinha sugeriu (ex.: detalhe de um município), a página recarrega por completo e a conversa zera. A expectativa: o contexto permanece durante **toda a sessão daquela janela/tab** — inclusive ao navegar pelos links do próprio Sollinha e ao recarregar a página — e some quando a aba é fechada. É uma mudança de decisão de produto: o plano original do chat (entregue) travou "sessão nova a cada abertura"; este item é o **sucessor** dessa decisão, no escopo restrito de uma aba.

## Persona e fluxo

- **Persona / contexto:** assessor/coordenador em `/campanha`, conversa com o Sollinha, segue um link sugerido para ver o detalhe, e **espera voltar à mesma conversa** para continuar pedindo.
- **Job principal:** navegar dentro do app (inclusive via links do chat) sem perder o fio da conversa, durante toda a sessão da aba.
- **Fluxo desejado:**
  1. O usuário pergunta, recebe resposta com link e clica.
  2. A vista destino abre, **sem recarregar a página** (navegação interna do app).
  3. O chat continua com a conversa; o usuário reabre o painel/drawer e retoma de onde parou.
  4. Recarregar a página na mesma aba também mantém a conversa (sessão da aba).
  5. Fechar a aba → tudo some; outra aba começa limpa.
- **Anti-goals de produto:** persistência entre abas/dispositivos ou no servidor (fora de escopo); histórico/threads gerenciáveis (complexidade de v2 continua fora).

## Objetivo e aceite

- Clicar num link do Sollinha navega **sem recarregar a página** (navegação por cliente do app), e a conversa continua presente ao reabrir o chat.
- Recarregar a página na mesma aba restaura a conversa (mensagens e estado em andamento). _Nota de impl (B188): a recarga no meio de uma resposta perde apenas aquele turno em voo — o storage só guarda o último estado settle; o chat recomeça `ready` e o usuário repete a pergunta._
- Fechar a aba apaga tudo; outra aba inicia sem histórico.
- Nada é gravado no servidor/banco; nada cruza abas ou dispositivos.
- Se o chat estava aberto ao recarregar, ele volta aberto na mesma superfície (painel/drawer conforme o viewport).

## Dados (intenção)

- Dados: N/A — estado de sessão local; nenhum dado de campanha novo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/ai/CampaignAIChat.tsx` + `CampaignAISidebarContext.tsx` (o `useChat` vive no provider, montado no layout `(app)/layout.tsx`, que **sobrevive** à navegação por cliente — a perda acontece porque os links do markdown são âncoras comuns (`<a href>`) que disparam navegação completa). Direções prováveis, a critério do executor: (1) links do chat navegando por rota do app (Next `Link`/interceptação de clique), preservando o layout; (2) persistência da conversa no storage de sessão da aba (ex.: `sessionStorage`), restaurada ao montar — cobre também recarga manual. `src/lib/sollinhaChatPanelWidth.ts` é precedente de persistência local do chat (guards `typeof window`, try/catch).
- **Precedente a olhar:** `docs/plans/ai-chat-sollinha.md` (decisão original "sem persistência" — `in-prod`, não editar; este item a sucede por decisão de produto); `docs/plans/migrar-chat-painel-drawer-resize.md` (B167 — estados do painel/drawer); `docs/plans/largura-padrao-chat-sollinha.md` (B166 — storage local do chat).
- **Risco de acoplamento:** mesma área de render tocada por B187 (links com aparência de link) — os dois mudam o render de mensagens; devem ser feitos sem conflito (ou em sequência). O `useChat` tem lifecycle próprio (limpar estado ao fechar aba é nativo do storage de sessão).

## Dependências

- Nenhuma dura. Nota: links **parecerem** links é B187 (separado; aparece junto na prática).

## Fora de escopo

- Histórico entre abas, dispositivos ou logins; threads nomeadas; persistência no servidor/banco.
- Exportar/limpar conversa manualmente (a aba limpa sozinha).
- Sobreviver ao fechamento e reabertura da aba (persistência "até apagar os dados" é outra decisão de produto).

## Rabbit holes de produto

- **Virar histórico infinito.** Se alguém "só completar", a conversa cresce sem limite e o custo/ruído sobe. **Corte:** guardrail simples de tamanho no storage de sessão (mensagens mais antigas descartadas sem pedir), e nada além da sessão da aba.
- **Chat abrindo sozinho.** Restaurar o estado aberto não pode fazer o chat saltar na tela sem o usuário ter deixado aberto. **Corte:** restaura junto apenas se estava aberto no momento da recarga.
- **Conflito com B166/B167.** Largura e superfície (painel/drawer) têm regras próprias. **Corte:** este item só restaura conversa + estado aberto; largura e migração de superfície continuam como estão.

## Questões em aberto (produto)

- **Restaurar também o estado "aberto"?** **Opções:** (A) só as mensagens — o chat reabre fechado; (B) mensagens + estado aberto (se estava aberto, volta aberto). **Recomendação:** (B) — é o que faz "continuar trabalhando" funcionar após recarga; a superfície segue o viewport (regra B167). _(assumido — validar)_
- **Rascunho digitado no input:** persistir junto? **Opções:** (A) sim; (B) só mensagens trocadas. **Recomendação:** (B) — mensagens são o contrato de contexto; rascunho é bônus que adiciona estados estranhos (pergunta parcial no meio de digitação). _(assumido — validar)_
- **Limite de contexto:** quantas mensagens/máximo de bytes na sessão? **Recomendação:** guardrail de tamanho (ex.: últimas ~50 mensagens ou teto de bytes), sem UI de aviso. _(assumido — validar)_

## Referências

- `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx` — provider do `useChat` (estado atual)
- `src/components/campaign/shell/ai/CampaignAIChat.tsx` — render dos links do markdown
- `src/app/(campaign)/campanha/(app)/layout.tsx` — onde o provider vive (sobrevive à navegação por cliente)
- `src/lib/sollinhaChatPanelWidth.ts` — precedente de storage local do chat (B166)
- `docs/plans/ai-chat-sollinha.md` — decisão original "sem persistência" (imutável, `in-prod`; este item a sucede)
- `docs/plans/sollinha-links-como-links.md` (B187) — irmão no mesmo render
