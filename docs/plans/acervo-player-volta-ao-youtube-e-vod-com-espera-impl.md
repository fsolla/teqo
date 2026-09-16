# Impl: Acervo: o player sempre deixa voltar ao YouTube e espera a Câmara gerar o trecho

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1103
Intenção: docs/plans/acervo-player-volta-ao-youtube-e-vod-com-espera.md
Appetite restante: ~0,5–1 dia eng (herdado da intenção); nada mais entra.

## Leitura da intenção (outcome, não negociar, reavaliar)

- **Outcome:** trocar de superfície nos dois sentidos (Câmara ↔ YouTube) na mesma página, com ponto da fala preservado; esperar geração da Câmara dentro do clique do player (bounded) em vez de devolver "gerando" na primeira resposta.
- **O que NÃO negociar:** nada de autenticar no YouTube nem embed novo; não inventar estado; superfície que o app controla segue preferida (C178); transcrição/posicionamento e seleção/corte intactos; sem Consent/collection/migration; URLs públicas do acervo intocadas; crédito "Fonte: Câmara dos Deputados · CC BY 4.0" mantido.
- **O que reavaliar:** hipóteses de "Direção no codebase" que podem estar erradas.

## Abordagem recomendada

```mermaid
flowchart LR
  U[clica em "Assistir na Câmara"] --> R[resolveSpeechVod com política do player<br/>pollAttempts: 2, pollDelayMs: 3000]
  R --> G{resposta da Câmara?}
  G -- PRONTO --> P[<video> toca o trecho]
  G -- GERANDO --> W[espera bounded<br/>polls curtos]
  W --> G
  G -- INDISPONIVEL/estourou --> F[estado honesto + "Tentar novamente"]
  P --> E[bloco de saída "Assistir no YouTube" sempre visível]
  F --> E
```

**Opções consideradas:**

- **A — Trocar `pollAttempts: 0` por `pollAttempts: 2` com `pollDelayMs: 3000`** no `SPEECH_VOD_PLAYER_POLICY` (reusar a lógica de polling já existente no `resolveFromVodApi`).
- **B — Criar uma política nova `SPEECH_VOD_PLAYER_POLLING_POLICY`** com valores próprios.
- **C — Manter `pollAttempts: 0` e só melhorar a copy.**

**Recomendação: A** — a lógica de polling já existe e é testada; basta ajustar os parâmetros da política do player. **Rejeitadas:** B (complexidade desnecessária; uma política por caller é suficiente), C (não resolve o defeito).

### Componentes / mudanças

- **`src/utilities/speech/speechVodResolver.ts`** (editar o dono):
  - Trocar `SPEECH_VOD_PLAYER_POLICY.pollAttempts` de `0` para `2`.
  - Trocar `SPEECH_VOD_PLAYER_POLICY.pollDelayMs` de `1_000` para `3_000`.
  - Justificativa: 2 polls de 3s = até 6s de espera adicional (total ~9s com o primeiro fetch); é um orçamento curto e próprio do clique, entre o imediato de hoje e o do corte (45s/2 polls de 5s).

- **`src/components/campaign/speech/SpeechDetailPlayer.tsx`** (editar o dono):
  - O bloco `renderYoutubeExit()` já existe e é sempre visível (C178); não precisa de mudança.
  - O estado `generating` já mostra "A Câmara está gerando o trecho" e "Tentar novamente"; com o polling ativo, o player vai transitar automaticamente de `generating` para `resolved` (ou `failed` se estourar o orçamento).
  - **Nenhuma mudança de UI necessária** — o defeito é na política de polling, não no componente.

- **`src/app/(campaign)/campanha/actions/speech.ts`** (não mexer):
  - `resolveSpeechVodForActor` já usa `resolveSpeechVod(coordinates)` que por padrão usa `SPEECH_VOD_PLAYER_POLICY`; a mudança na política surte efeito automaticamente.

- **`src/lib/speechVod.ts`** (não mexer):
  - A função `resolveFromVodApi` já suporta `pollAttempts > 0`; não precisa de mudança.

- **Migration:** **sem migration** — mudança de constante em código, não de schema.

- **Access / Consent:** sem mudança.

- **UI:** **Impeccable A — N/A** (sem UI nova; o bloco de saída já existe e é sempre visível).

- **Testes:** 
  - `tests/unit/speechVodResolver.unit.spec.ts`: atualizar o pin de `SPEECH_VOD_PLAYER_POLICY` (linha 164-171) para refletir os novos valores.
  - `tests/unit/speechDetailPlayer.unit.spec.tsx`: adicionar teste para o estado `generating` com polling ativo (mockar fetch para retornar `GERANDO` na primeira chamada e `PRONTO` na segunda; verificar que o player transita para `resolved`).
  - `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`: o teste existente "search keeps the download off the card; the both-sources detail defaults to the Câmara excerpt" já cobre o estado idle; não precisa de mudança.

- **Changelog:** `docs/changelog/2026-09-16-c181.md`.

### Dados → forma (a resposta é a superfície)

- **Forma escolhida:** a mudança é transparente para o usuário; o player agora espera a geração da Câmara antes de anunciar "gerando/falhou".
- **Rejeitadas:** UI nova (anti-goal), embed do YouTube (anti-goal), autenticação (anti-goal).

## Decisões de engenharia

### D1 — Política de polling do player: reusar a lógica existente com parâmetros próprios

- **Opções:** A) ajustar `SPEECH_VOD_PLAYER_POLICY` (pollAttempts: 2, pollDelayMs: 3000) | B) criar política nova | C) manter pollAttempts: 0.
- **Recomendação: A** — reusa código testado, cumpre o orçamento curto do clique, não inventa estado.
- **Rejeitadas:** B (complexidade desnecessária), C (não resolve o defeito).

### D2 — Visibilidade do bloco de saída "Assistir no YouTube"

- **Opções:** A) manter como está (sempre visível quando youtubeWatchUrl existe) | B) mostrar só quando a superfície for `vod` e a mídia estiver resolvida.
- **Recomendação: A** — a saída é justamente o que falta hoje; nunca deixar o usuário sem caminho.
- **Rejeitadas:** B (restringe a saída no momento em que mais se precisa dela).

### D3 — Localização do botão "Assistir no YouTube"

- **Opções:** A) no bloco de saída já existente (`renderYoutubeExit`) | B) junto das ações do player.
- **Recomendação: A** — simétrico a "Assistir na Câmara", mesmo bloco, mesmo desenho.
- **Rejeitadas:** B (desconecta a saída do contexto de "outro caminho").

## Fases verificáveis

1. **Ajuste da política (~0,1 dia):** editar `SPEECH_VOD_PLAYER_POLICY` em `src/utilities/speech/speechVodResolver.ts` (pollAttempts: 2, pollDelayMs: 3000). Prova: `pnpm test:unit` verde (pin atualizado no spec).
2. **Teste do polling no player (~0,25 dia):** adicionar teste em `tests/unit/speechDetailPlayer.unit.spec.tsx` que mockia fetch para retornar GERANDO → PRONTO e verifica a transição. Prova: spec novo verde.
3. **Verificação e2e (~0,1 dia):** rodar `pnpm test:e2e --grep "acervo"` para garantir que nenhum quadrante quebrou. Prova: e2e verde.
4. **Changelog e lint (~0,05 dia):** criar `docs/changelog/2026-09-16-c181.md`, rodar `pnpm lint` e `pnpm format:check`.

**Quota total:** ~0,5 dia (dentro do appetite herdado).

## Rabbit holes / Não escopo (engenharia)

- **Trocar a superfície do YouTube para embed.** Corte: a volta é um botão na nossa própria página; o YouTube continua embed anônimo.
- **Espera infinita / fila de render.** Corte: orçamento curto dentro do clique; estourou → estado honesto + retry.
- **"Retry resolve, então é só mandar tentar".** Corte: isso é o defeito, não a solução — o app espera antes de acusar falha.
- **Redesenhar o player inteiro.** Corte: encaixe cirúrgico; transcrição, seleção e corte intactos.
- **Autenticar no YouTube ou usar embed novo.** Corte: anti-goal explícito na intenção.
- **Inventar estado ("sucesso" sem verificação de mídia).** Corte: a política de probing já verifica a mídia antes de devolver `pronto`.
- **Mudar o bloco de saída "Assistir no YouTube".** Corte: já existe e é sempre visível (C178); não precisa de mudança.

## Riscos e mitigação

- **A Câmara demora mais que 9s para gerar o trecho:** o player entra no estado `generating` e mostra "Tentar novamente" (estado honesto); o usuário pode clicar retry manualmente. **Mitigação:** o orçamento de 9s cobre a maioria dos casos; se a Câmara ficar lenta frequentemente, reavaliar o `pollAttempts`.
- **Regressão nos testes existentes:** o pin de `SPEECH_VOD_PLAYER_POLICY` no spec precisa ser atualizado. **Mitigação:** atualizar o pin antes de rodar os testes.
- **Mudança de comportamento para usuários existentes:** o player agora espera 9s em vez de falhar imediatamente; isso é uma melhoria, não um defeito. **Mitigação:** nenhum usuário vai reclamar de "esperou demais" quando antes falhava de primeira.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: o player sempre deixa voltar ao YouTube (bloco de saída sempre visível) e espera a geração da Câmara dentro do clique (pollAttempts: 2, pollDelayMs: 3000).
- [ ] Invariantes AGENTS/engineering-standards: `overrideAccess: false` + `user` em toda leitura; gate `canReadSpeechCatalog`; sem migration/Consent; sem UI nova; identificadores em inglês, chaves/copy em pt-BR.
- [ ] Testes previstos: unit `speechVodResolver` (pin atualizado) + `speechDetailPlayer` (transição generating→resolved) + e2e `campaignSpeechAcervo` (quadrantes intactos); `pnpm lint` e `pnpm format:check` verdes.
- [ ] Changelog: `docs/changelog/2026-09-16-c181.md`.

Self-score decision-quality: 5/5 — (1) fatia = um outcome verificável (volta simétrica ao YouTube + espera bounded na geração); (2) appetite ~0,5 dia comporta o ajuste de política e os testes, sem schema; (3) persona/job/aceite em linguagem de produto; (4) direção no codebase é precisa (arquivos nomeados, política existente, bloco de saída já implementado); (5) zero decisão dura de engenharia (política e UI já existem; só ajuste de parâmetros).

- Decisões caras com rejeitadas: 3/3 — D1 (política), D2 (visibilidade da saída), D3 (localização do botão) no formato Opções|Recomendação|Rejeitadas.
- Cabe no appetite? 5/5 — ~0,5 dia (dentro do herdado); sem migration, sem UI, sem dependência nova.
- Rabbit holes nomeados? 5/5 — embed do YouTube, espera infinita, retry como solução, redesign do player, autenticação, inventar estado, mudança de UI.
- Depth check reusa? 5/5 — `resolveFromVodApi` já suporta polling, `renderYoutubeExit` já existe e é sempre visível, `speechVodResolver` já exporta a política, `speechDetailPlayer` já tem o estado `generating`.
- Intenção permanece satisfeita? 5/5 — o outcome não foi reescrito: a volta ao YouTube é simétrica (bloco de saída sempre visível) e a espera é bounded (pollAttempts: 2, pollDelayMs: 3000).
