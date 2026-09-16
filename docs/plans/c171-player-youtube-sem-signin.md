# Acervo: o player do YouTube nunca termina num beco de signin — toca ou oferece a saída em um clique

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1047
Priority: P1
Impeccable: B — encaixe no player do detalhe do acervo
Rascunho UI: docs/plans/c171-player-youtube-sem-signin-ui-draft.html
Appetite: ~0,5–1 dia eng; um outcome verificável — abrir uma fala com YouTube toca na página ou dá saída em um clique, nunca um beco de login
Responsável: —

## Intenção

A assessoria abre uma fala do acervo com vídeo no YouTube e o player pede "faça signin para exibir o vídeo"; clicar em signin abre outra janela (onde a pessoa já está logada) e nada muda na página — o pedido de login continua. Quem monta peça com prazo curto fica sem assistir a fala na página. Este item garante a saída: o vídeo toca embutido quando o YouTube deixa e, quando ele não deixa, a página nunca termina no beco de signin — oferece em um clique uma superfície que toca (o trecho da Câmara sob demanda, quando elegível) e/ou "Abrir no YouTube" no ponto exato. O erro interno do embed é invisível ao app, então a saída não pode depender de detectar o bloqueio: ela fica sempre ao alcance de um clique.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (communicator, coordenação e candidatura) em `/campanha/comunicacao`, na mesa ou em campo, produzindo peça.
- **Job principal:** assistir a fala na própria página, sem depender de login no YouTube e sem ficar presa num aviso de signin.
- **Fluxo desejado:** abre a fala com YouTube → o vídeo toca embutido → se o YouTube não liberar (login/idade/embed desabilitado), a pessoa vê que tem saída e clica "Assistir na Câmara" (toca o trecho exato nesta página) ou "Abrir no YouTube" (abre no ponto, na conta dela) → transcrição e clique para posicionar seguem funcionando.
- **Anti-goals de produto:** segundo player/editor; espelhar/baixar/transcodificar vídeo; autenticar no YouTube; detectar/inferir a causa do bloqueio; novo `Consent`/collection/migration; expor o acervo fora de `/campanha`; mexer nas URLs públicas.

### Esboço de fluxo (B)

```text
[abre fala com YouTube] → embed tenta tocar
→ YouTube libera → toca; saídas em 1 clique seguem visíveis ("Assistir na Câmara" | "Abrir no YouTube")
→ YouTube bloqueia (signin/idade/embed) → mesmas saídas logo abaixo do aviso
→ nunca um beco: sempre há um caminho que toca
```

### Rascunho UI (B)

- Rascunho UI (gate): `docs/plans/c171-player-youtube-sem-signin-ui-draft.html` — cenas desktop (~1280px) e mobile (~390px) com o embed bloqueado + superfície alternativa; desktop com o YouTube tocando e as saídas visíveis.

## Objetivo e aceite

- Abrir uma fala com YouTube: se o YouTube permitir, o vídeo toca na página sem exigir login nosso e sem CTA de signin nossa.
- Se o YouTube não liberar o embed, a página NUNCA termina num beco: há sempre, em um clique, uma superfície que toca — "Assistir na Câmara" (trecho exato, quando a fala tem VOD) e/ou "Abrir no YouTube" (link `watch?v=<id>&t=<segundos>`, abre no ponto, na conta de quem já está logado).
- A saída fica ao alcance também no caminho feliz (o app não vê o erro interno do iframe): não é preciso saber que o YouTube bloqueou para se salvar.
- Hoje, com YouTube presente, o caminho da Câmara é inalcançável (o iframe ocupa o lugar e a CTA "Assistir o trecho" nunca aparece); a alternativa passa a conviver com o embed.
- Transcrição (clique para posicionar) e seleção de trecho (C166/C167) intactos; quando a superfície ativa for a da Câmara, o clique na transcrição posiciona nela.
- **Guardrails:** gate do acervo (communicator/coordinator/candidate; advisor/leader negados); crédito "Fonte: Câmara dos Deputados · CC BY 4.0"; `excerptTMs` verbatim (nunca aproxima); sem segundo player/editor; sem `Consent`/collection/migration; URLs públicas intocadas; a postura LGPD do embed na área interna é decisão de produto (questão em aberto).

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é player + ações; nenhum KPI/gráfico novo.
- **Decisões desbloqueadas:** a assessoria decide assistir a fala na página sem depender do login do YouTube; a coordenação decide, pelo uso, se a postura `youtube-nocookie` na área interna vale manter.
- **Forma:** _adiada ao plano de implementação_ — restrição: o estado de bloqueio é feedback de ação (o que fazer agora), não dado de acervo.

## Dados da decisão (literais)

- **Embed atual:** `https://www.youtube-nocookie.com/embed/<id>?playsinline=1&rel=0&start=<segundos>` (params `playsinline=1`, `rel=0`; `start` só quando >0) — `src/components/campaign/speech/SpeechDetailPlayer.tsx:29-35`; iframe com `title="Vídeo da sessão no YouTube"`, `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure"`, `allowFullScreen`, `loading="lazy"` (`:250-257`); sem `onError`, sem `enablejsapi`, sem fallback.
- **Se a recomendação A/C valer (trocar domínio):** `https://www.youtube.com/embed/<id>?playsinline=1&rel=0&start=<segundos>` — mesmos params, host sem `-nocookie`.
- **Link de "Abrir no YouTube" (já existe):** `https://www.youtube.com/watch?v=<id>&t=<segundos>` (`t=` omitido quando o offset é desconhecido) — `src/lib/speechShare.ts:29-35`.
- **Postura LGPD atual (site público, referência):** `https://www.youtube-nocookie.com/embed/i_fbclWWC5o?playsinline=1&rel=0` com comentário "youtube-nocookie keeps the embed LGPD-friendly" — `src/components/CampaignStorySection.tsx:9,54-61`.
- **Evidência das hipóteses:** o app não vê o erro do player (sem `onError`/API) e nenhum spec carrega o embed real — e2e aborta `https://www.youtube-nocookie.com/**` globalmente (`tests/e2e/fixtures/e2eTest.ts:108`); pins do domínio: `tests/unit/speechDetailPlayer.unit.spec.tsx:183,201,293`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts:163`, `tests/e2e/frontend.e2e.spec.ts:513`. Hipóteses do defeito (nenhuma confirmada): (a) bot-check do YouTube a embeds anônimos do nocookie ("Sign in to confirm you're not a bot"); (b) cookies de terceiros bloqueados — a sessão logada não chega ao iframe (explica a outra janela que "não muda nada"); (c) vídeo restrito por idade ou embed desabilitado; (d) restrição de embed de live archive da Câmara.
- **Copy pt-BR das saídas:** "Assistir na Câmara" (resolve e toca o trecho exato nesta página); "Abrir no YouTube" (abre no ponto); aviso: "Se o vídeo não abrir aqui, assista por outro caminho:" e apoio "O trecho da Câmara toca nesta página; o YouTube abre no ponto da fala." Sem fala não elegível ao VOD, fica só "Abrir no YouTube".
- **Hoje (inalcançável com YouTube):** `renderMedia` devolve o iframe primeiro e a CTA "Assistir o trecho" nunca aparece; sobra "Baixar vídeo (MP4)", que baixa mas não toca na página (`:248-258`, `:319-331`, `:405-429`).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/speech/SpeechDetailPlayer.tsx` (embed + bloco de ações); `src/lib/speechShare.ts` (link de share); `src/utilities/speech/speechVodResolver.ts` + rota `acervo/resolver-vod` (reuso do resolver C162 — nenhum segundo player).
- **Precedente a olhar:** `src/components/CampaignStorySection.tsx` (embed nocookie do site público); estados honestos do próprio player (`StatusPanel`, "Não foi possível carregar o vídeo deste trecho.").
- **Risco de acoplamento:** C162/C166/C167/C169 tocam o mesmo arquivo — encaixe cirúrgico, sem reescrever quadrantes; gate do acervo e crédito CC BY valem; não há CSP/middleware/`headers()` no repo (a postura LGPD é convenção, não configuração).

## Dependências

- Suave: C169 (defeito do resolver no corte) — a superfície "Assistir na Câmara" fica mais confiável com o resolver corrigido; sem dependência dura.
- Entregues: C162 (player VOD sob demanda + YouTube default), C154/C166/C167 (detalhe, seleção, corte).

## Fora de escopo

- Fazer o YouTube tocar quando ele mesmo bloqueia o embed (login/idade/região) e autenticar/SSO no YouTube.
- Detectar ou classificar o motivo do bloqueio (o app não vê o erro interno do iframe).
- Baixar/espelhar/transcodificar vídeo; re-hospedar no S3 (C162/C167); redesenhar o detalhe/lista além do encaixe do player.
- Exposição pública do acervo; segundo player/editor; novo `Consent`/collection/migration.

## Rabbit holes de produto

- **"Fazer o YouTube sempre tocar".** Se alguém "só completar": OAuth, player próprio, proxy de mídia. **Corte neste item:** se o YouTube bloquear, a página oferece a alternativa em um clique.
- **Detectar o bloqueio no iframe.** Se alguém "só completar": IFrame API + eventos + polling + estados condicionais. **Corte neste item:** a saída é independente de detecção — sempre visível; sem prometer aviso automático.
- **"Login resolve".** Se alguém "só completar": round-trip de sessão para dentro do iframe (impossível com cookies de terceiros). **Corte neste item:** o embed é anônimo; o login é problema do YouTube, a saída é nossa.
- **Reescrever o player inteiro.** Se alguém "só completar": novos quadrantes, novo layout, tocar C162. **Corte neste item:** encaixe cirúrgico conforme rascunho; comportamento existente (transcrição, seleção, download) intacto.

## Questões em aberto (produto)

- **Trocar o domínio do embed de `youtube-nocookie.com` para `youtube.com`?** **Opções:** A) sim (mesmos params, só o host) — ataca as hipóteses (a)/(b) de bot-check/sessão e é o caminho direto para "toca sem login" | B) manter `nocookie` e apostar só nas saídas | C) ambos (trocar o host E manter as saídas). **Recomendação:** C — a troca é o remédio barato para embeds anônimos recusados e as saídas cobrem o que o YouTube bloquear de fato (idade, embed desabilitado); a área é interna e autenticada, então o custo LGPD é menor que no site público, mas como mexe na postura do repo, validar no gate. _(assumido — validar com produto)_
- **As saídas ficam sempre visíveis ou só quando o YouTube falha?** **Opções:** A) sempre (secundárias, junto das ações do detalhe) | B) só no estado de bloqueio (exige detecção). **Recomendação:** A — o app não vê o erro interno do iframe; esperar a detecção é o que produz o beco de hoje. _(assumido)_
- **"Abrir no YouTube" abre na aba nova ou embutido?** **Opções:** A) aba nova com o link de share no ponto | B) trocar o embed para `youtube.com` na mesma página. **Recomendação:** A como secundária (link já validado do C166); B é efeito da troca de host, não um botão. _(assumido)_
- **O que o aviso diz?** **Opções:** A) explica e oferece as saídas ("Se o vídeo não abrir aqui, assista por outro caminho:") | B) só oferece as saídas, sem explicar. **Recomendação:** A, sem culpar quem usa. _(assumido)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c171-player-youtube-sem-signin-ui-draft.html`
- Planos irmãos: `acervo-vod-sob-demanda.md` (C162/#999), `c166-compartilhar-trecho-link.md`, `c167-cortar-trecho-publicar.md`, `c168-biblioteca-cortes.md`
- Arquivos-chave (pista, não contrato): `src/components/campaign/speech/SpeechDetailPlayer.tsx`, `src/lib/speechShare.ts`, `src/utilities/speech/speechVodResolver.ts`, `tests/unit/speechDetailPlayer.unit.spec.tsx`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`, `tests/e2e/fixtures/e2eTest.ts`; `AGENTS.md` / `AGENTS-campaign.md` — vertical Comunicação, gate do acervo e crédito CC BY.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (tocar na página ou sair em um clique, nunca beco de signin); (2) appetite de ~0,5–1 dia comporta embed + saídas + pins de teste, sem schema; (3) persona, job e aceite legíveis sem jargão de stack; (4) direção no codebase é hipótese (áreas, precedente e pins como pista); (5) zero decisão dura de engenharia — host do embed, props e layout ficam como questão de produto/implementação.
