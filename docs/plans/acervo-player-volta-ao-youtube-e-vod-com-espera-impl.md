# Impl: Acervo: o player sempre deixa voltar ao YouTube e espera a Câmara gerar o trecho

Status: em execução (GATE aprovado em 2026-09-16)
Atualizado em: 2026-09-16
Issue: #1103
Intenção: docs/plans/acervo-player-volta-ao-youtube-e-vod-com-espera.md
Appetite restante: ~0,5–1 dia eng (herdado da intenção); nada mais entra.

## Leitura da intenção (outcome, não negociar, reavaliar)

- **Outcome:** trocar de superfície nos dois sentidos na própria página (Câmara ↔ YouTube), com o ponto da fala preservado ao voltar; esperar a geração da Câmara dentro do clique do player (bounded) em vez de devolver "gerando" na primeira resposta.
- **O que NÃO negociar:** não inventar estado; **a superfície que o app controla segue preferida/entrada padrão** (guardrail C178); transcrição/posicionamento e seleção/corte intactos; sem `Consent`/collection/migration; URLs públicas do acervo intocadas; crédito "Fonte: Câmara dos Deputados · CC BY 4.0" mantido.
- **Decisão de produto (GATE, 2026-09-16):** o humano decidiu **restaurar o embed do YouTube**. A remoção do embed pelo C178 não era a intenção do dono. Esta entrega passa a ser **dona** da reversão da parte "embed removido" do C178 — reabre explicitamente a decisão anterior (precedente do AGENTS: a entrega que muda o contrato o possui).
- **O que preservar do C178:** a **entrada padrão continua sendo a Câmara** quando há trecho (`vodResolvable`); o embed volta como **superfície navegável** (a "volta"), nunca como porta de entrada automática — é isso que evita recriar a parede de signin que originou o C178 (P1/#1081). Falas só-YouTube seguem na capa do C178.

## Abordagem recomendada

```mermaid
flowchart LR
  U[clica em "Assistir o trecho"] --> R[resolveSpeechVod com política do player<br/>pollAttempts: 2, pollDelayMs: 3000]
  R --> G{resposta da Câmara?}
  G -- PRONTO --> P[<video> toca o trecho<br/>superfície Câmara]
  G -- GERANDO --> W[espera bounded<br/>2 polls de 3s]
  W --> G
  G -- INDISPONIVEL/estourou --> F[estado honesto + "Tentar novamente"]
  P --> E[bloco de saída]
  E -- "Assistir no YouTube" --> Y[superfície YouTube: iframe embed no ponto]
  Y -- "Assistir na Câmara" --> P
  Y -.-> X["Abrir no YouTube" externo, no ponto]
```

**Opções consideradas (cabeça 2 — espera da Câmara):**

- **A —** ajustar `SPEECH_VOD_PLAYER_POLICY` (`pollAttempts: 0 → 2`, `pollDelayMs: 1_000 → 3_000`), reusando o loop já existente em `resolveFromVodApi`.
- **B —** política nova só para o clique.
- **C —** manter `pollAttempts: 0` e só melhorar a copy.

**Recomendação: A** — o loop de polling já existe, é testado e é o dono da espera bounded; só os parâmetros mudam. **Rejeitadas:** B (uma política por caller já basta), C (não resolve — é o defeito).

**Opções consideradas (cabeça 1 — volta ao YouTube):** A) bloco externo já entregue | B) capa do C178 in-page | C) **restaurar o embed do YouTube in-page**.
**Recomendação: C (decidida pelo humano)** — o dono quer o embed de volta; a superfície YouTube é o iframe `https://www.youtube.com/embed/<id>?playsinline=1&rel=0&start=<s>` (o contrato literal que a intenção manda preservar), restaurado do pré-C178 (`git show b378e1a9^:src/components/campaign/speech/SpeechDetailPlayer.tsx`) com a entrada padrão invertida para a Câmara. **Rejeitadas:** A/B (não devolvem o embed).

### Componentes / mudanças

- **`src/utilities/speech/speechVodResolver.ts`** (dono da política):
  - `SPEECH_VOD_PLAYER_POLICY.pollAttempts: 0 → 2`, `pollDelayMs: 1_000 → 3_000`. Orçamento ~6s adicionais (1 fetch + 2 polls), bounded; `statusTimeoutMs: 15s` por leitura.

- **`src/components/campaign/speech/SpeechDetailPlayer.tsx`** (dono da superfície) — restaurar do pré-C178 com a entrada padrão da Câmara:
  - Voltar `buildYoutubeSrc(videoId, startSeconds)` (iframe `playsinline=1&rel=0[&start=N]`).
  - Voltar o estado `surface: 'camara' | 'youtube'` com **default `'camara'` quando `vodResolvable`** (e `'youtube'` só quando não há trecho), invertendo o default pré-C178.
  - `renderMedia`: quando `surface === 'youtube'` e há id, renderizar o `<iframe>` (título "Vídeo da sessão no YouTube", `loading="lazy"`, allow list do pré-C178); caso contrário o comportamento Câmara atual.
  - `youtubeStart` (offset da sessão + ponto) e `pendingSeekRef` (C171-F1) restaurados: o ponto clicado na transcrição sobrevive à troca de superfície até o `<video>` montar e seekar; `seekTo` volta a tratar a superfície YouTube.
  - Bloco de saída (`renderYoutubeExit`): manter o layout C178 e o link externo "Abrir no YouTube" (no ponto); adicionar o controle simétrico **"Assistir no YouTube"** (troca para a superfície embed) quando a superfície ativa é a Câmara e há id; **"Assistir na Câmara"** quando a superfície é o embed e `vodResolvable` (restaura o `<video>`/painel no ponto). Copiar o padrão de botão já usado no bloco.
  - `inlineNotice` do pré-C178 restaurado: estado `generating`/`failed`/download-não-verificado visível enquanto o embed está ativo.
  - Falas só-YouTube (`!vodResolvable`) seguem a `YoutubeFacade` do C178 (capa externa) — **não** entram em embed automático (evita a P1 de signin).
  - `seekable` volta a considerar a superfície YouTube (offset conhecido).

- **`src/app/(campaign)/campanha/actions/speech.ts`** (não mexer): herda a política do player.
- **`src/lib/speechVod.ts`** (não mexer): `resolveFromVodApi` já suporta `pollAttempts > 0`.
- **`src/lib/speechShare.ts`** (não mexer): `buildSpeechExcerptYoutubeUrl` já entrega o ponto.
- **Migration:** **sem migration** — constantes e UI, não schema.
- **Access / Consent:** sem mudança (`canReadSpeechCatalog` + `overrideAccess: false` nas leituras).
- **UI:** Impeccable A — o embed e o bloco de saída já foram desenhados (pré-C178/C178); a composição nova é o switch simétrico dentro do bloco já existente. Sem novo arquivo de design; reusa o markup removido. Se a crítica final (trigger c) reprovar a composição, escalar ao `designer`.

### Dados → forma

- **Forma:** feedback de ação no player; a superfície ativa é `useState`, nunca persistido. Nenhum KPI/gráfico.
- **Rejeitadas:** UI nova fora do bloco de saída; persistir a superfície; autenticar no YouTube.

## Decisões de engenharia

### D1 — Política de polling do player (cabeça 2)

- **Opções:** A) ajustar `SPEECH_VOD_PLAYER_POLICY` (2 polls de 3s) | B) política nova | C) manter `pollAttempts: 0`.
- **Recomendação: A** — reusa `resolveFromVodApi` testado, orçamento curto e bounded, sem inventar estado.
- **Rejeitadas:** B (twin para <3 call sites), C (não resolve).

### D2 — Restauração do embed e default da superfície (cabeça 1)

- **Opções:** A) bloco externo já entregue | B) capa C178 in-page | C) restaurar o embed (default Câmara).
- **Recomendação: C** — decisão do humano no GATE; restaura o contrato de embed que a intenção manda preservar e mantém a Câmara como entrada padrão (guardrail C178).
- **Rejeitadas:** A/B (não devolvem o embed). O embed **não** vira default em fala só-YouTube (recriaria a parede de signin do P1).

### D3 — Localização do controle simétrico

- **Opções:** A) no bloco de saída já existente (`renderYoutubeExit`) | B) junto das ações do player.
- **Recomendação: A** — simétrico ao bloco "assista por outro caminho", mesmo desenho; foi onde o pré-C178 colocou "Assistir na Câmara".
- **Rejeitadas:** B (desconecta a saída do contexto).

## Renegociação de pins (obrigatória — mesma entrega)

- **`tests/e2e/campaignSpeechAcervo.e2e.spec.ts`** (SSR, sem interação):
  - `not.toContain('youtube.com/embed')` e `not.toContain('<iframe')` **seguem válidos** no default Câmara (o embed só monta após o clique) — manter como regressão de que a entrada não é o embed.
  - Ajustar a asserção "old surface-switch button is gone": o bloco de saída passa a oferecer "Assistir no YouTube" (superfície Câmara). Adicionar interação (ou teste client/unit) cobrindo a ida Câmara→embed→Câmara com o ponto preservado.
  - Falas só-YouTube: `not.toContain('youtube.com/embed')`/`<iframe`/`Assistir na Câmara` seguem válidos (facade).
- **`tests/unit/speechDetailPlayer.unit.spec.tsx`**: restaurar os testes de troca de superfície do pré-C178 (`git show b378e1a9^:tests/unit/speechDetailPlayer.unit.spec.tsx`) adaptados ao novo default Câmara; manter os testes de quadrantes do C178.
- **`tests/unit/speechVodResolver.unit.spec.ts`**: atualizar o pin de `SPEECH_VOD_PLAYER_POLICY` (linhas 163–171) para os novos valores; adicionar caso `GERANDO → PRONTO` sob a política do player.

## Fases verificáveis

1. **Política de polling (~0,1 dia):** `SPEECH_VOD_PLAYER_POLICY` + pin/spec. Prova: `pnpm test:unit` verde.
2. **Restauração do embed + switch (~0,5 dia):** markup pré-C178, default Câmara, controle simétrico no bloco de saída, `pendingSeekRef`. Prova: unit do player (ida-e-volta com ponto preservado) e e2e renegociado.
3. **Teste do polling no player (~0,2 dia):** unit GERANDO → PRONTO resolve sozinho.
4. **Gates (~0,1 dia):** `pnpm gate:fast`; changelog `docs/changelog/2026-09-16-c181.md`; `pnpm push`.
5. **Fechamento:** crítica visual do `designer` (trigger c) no diff que muda UI antes do push.

**Quota:** ~0,8–1,0 dia (no topo do appetite herdado).

## Rabbit holes / Não escopo (engenharia)

- **Tornar o embed a entrada padrão de novo.** Corte: default segue Câmara (guardrail C178); o embed é opt-in.
- **Fazer o YouTube tocar quando ele bloqueia / OAuth / player próprio.** Corte: fora de escopo (intenção).
- **Embed automático em falas só-YouTube.** Corte: mantém a facade do C178 (P1 de signin).
- **Espera infinita / fila de render.** Corte: orçamento bounded; estourou → estado honesto + retry.
- **Redesenhar o player inteiro.** Corte: restauração cirúrgica; transcrição, seleção e corte intactos.
- **Inventar estado ("sucesso" sem verificação).** Corte: o probing de mídia decide o `pronto`.
- **UI fora do bloco de saída.** Corte: simetria no bloco já desenhado.

## Riscos e mitigação

- **Regressão do P1 (parede de signin):** o embed não volta como entrada padrão; só após clique. Mitigação: manter o default Câmara e os pins SSR `not.toContain('youtube.com/embed')`/`<iframe`.
- **E2E pina o oposto:** renegociar os pins na mesma entrega, sem reintroduzir embed server-rendered. Mitigação: teste de interação para a troca.
- **Ponto perdido na troca de superfície:** restaurar `pendingSeekRef` (C171-F1) e o `youtubeStart`. Mitigação: unit cobrindo o seek após voltar.
- **Estouro do orçamento da Câmara:** estado `generating` honesto + retry. Mitigação: reavaliar `pollAttempts` se crônico.
- **Pin de `SPEECH_VOD_PLAYER_POLICY`:** atualizar antes do push.

## Aceite de engenharia

- [ ] Volta ao YouTube **embutida** na própria página, preservando o ponto, com a Câmara como entrada padrão.
- [ ] Espera bounded da Câmara dentro do clique (2 polls de 3s); estourou → estado honesto + retry.
- [ ] Invariantes AGENTS: `overrideAccess: false` + `user`; gate `canReadSpeechCatalog`; sem migration/`Consent`; identificadores em inglês, copy em pt-BR.
- [ ] Testes: unit resolver (pin + GERANDO→PRONTO), unit player (ida-e-volta + polling), e2e acervo renegociado.
- [ ] Changelog: `docs/changelog/2026-09-16-c181.md`.

Self-score decision-quality: 4/5 — decisões caras com rejeitadas (D1/D2/D3); cabe no appetite; rabbit holes nomeados; depth check reusa `resolveFromVodApi` + `YoutubeFacade` + bloco de saída + markup pré-C178; a renegociação de pins do C178 e o escopo do embed (só com trecho, opt-in) são o que impede o 5/5 sem confirmação explícita no GATE.

## Registro de execução

- **GATE (humano):** aprovado em 2026-09-16; decisão de produto: restaurar o embed (opção 1-C), com a Câmara como entrada padrão.
- **Simplify (2 revisores):** sem blockers. Aplicados: `seekTo` da Câmara grava `activeStart` (ponto preservado na troca), `inlineNotice` corrige a condição para `!playbackUrl` e ganha `mt-3`, `YoutubeIcon` sem props mortas, comentários obsoletos (componente/C178, resolver/C162, e2e) atualizados. **Débitos:** os achados restantes são `cheap_polish` (score ≤2) — `buildYoutubeSrc` no componente vs. `speechShare`, extração de `renderSurfaceSwitch`, duplicação de strings do `inlineNotice`, duplicação de testes entre políticas — nenhum `expensive_lock`; não geram Issue.
- **Design (trigger c):** crítica do `designer` (`openai/gpt-5.6-sol`) retornou **`DEGRADED`** — sem screenshots do app renderizado no worktree, não certifica. Observações não-certificadas: (2) a copy "o YouTube abre no ponto da fala" ficou incompleta com o embed ativo; (3) espaçamento do `inlineNotice` (corrigido com `mt-3`); (4) dois controles longos no bloco de saída podem comprimir a copy entre 640–1280px. Exige sign-off humano (ou nova rodada com evidência renderizada) antes do push.
