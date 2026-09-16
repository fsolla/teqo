# C171-F1 — Player: a troca para a Câmara perde o ponto da transcrição

Status: rascunho
Atualizado em: 2026-09-15
Issue: (registrada na triage do simplify do C171)
Pai: #1047 (C171) — `depends: [1047]`
Priority: P2
Kind: defect
Appetite: ~0,25 dia eng (client-only; sem schema, sem `Consent`, sem escrita, sem rota)
Responsável: —

> Débito registrado na triage do simplify/impeccable do C171
> ([c171-player-youtube-sem-signin-impl.md](c171-player-youtube-sem-signin-impl.md)).

## Contexto

O C171 introduziu a superfície ativa (`surface: 'youtube' | 'vod'`) e o "Assistir na Câmara" no
`SpeechDetailPlayer`. O efeito de `initialSeconds` existe desde o C162 e posiciona o `<video>`
quando o `playbackUrl` passa a existir — dependência `[initialSeconds, playbackUrl]`.

Dois furos no mesmo dono (efeito keyed em `playbackUrl`, não na montagem do `<video>`):

1. **Ponto clicado sobrescrito.** Clique na frase com o embed ativo grava o ponto em `activeStart`
   (e recarrega `start=` do iframe). Ao trocar para a Câmara, o `<video>` nasce e o efeito
   posiciona em `initialSeconds` (deep link `?t=`) — ou, sem deep link, deixa em 0 — ignorando o
   último clique; highlight e `t=` da saída ficam dessincronizados até o primeiro `timeupdate`.
2. **Deep link perdido quando o arquivo já estava verificado.** Se a pessoa baixa o MP4 primeiro
   (o `playbackUrl` resolve com a superfície YouTube ativa), o efeito roda sem `<video>` montado
   e retorna cedo; ao trocar para a Câmara as deps não mudam e o efeito **não** re-roda — o
   `<video>` fica em 0 mesmo com `initialSeconds > 0` (regressão do contrato C162).

## Evidência

- `src/components/campaign/speech/SpeechDetailPlayer.tsx:164-177` — efeito de `initialSeconds`
  com deps `[initialSeconds, playbackUrl]` e sem considerar `activeStart`/a montagem do `<video>`.
- `:222-233` — `seekTo` grava `activeStart` no ramo YouTube; `:216-220` — `watchVod` só troca a
  superfície quando o arquivo já está verificado (sem novo POST).
- `tests/unit/speechDetailPlayer.unit.spec.tsx` — "plays the Câmara excerpt in place of the embed"
  clica a transcrição **depois** de a Câmara resolver (`initialSeconds: 100`); "switches to the
  already verified file" usa `initialSeconds: null` — nenhum dos dois cobre os casos acima.

## Objetivo e aceite

- Clique explícito na transcrição feito com a superfície YouTube ativa vence o `initialSeconds`
  quando o `<video>` da Câmara monta: `video.currentTime` = último ponto clicado (excerpt-relative).
- Sem clique explícito, o contrato C162/C171 permanece: `initialSeconds` no arquivo recém-resolvido
  **e** no já verificado (download primeiro); sem deep link, 0.
- Nenhum seek em loop: `timeupdate` não re-dispara o efeito; sem mudança de copy/layout/quadrantes
  sem YouTube, do POST/rota da Câmara e do `t=` da saída (que segue o ponto efetivo).

## Decisão de engenharia

Opções: A) precedência de alvo (`pendingSeekRef` gravado por `seekTo` no ramo YouTube, consumido
quando o `<video>` monta) + deps do efeito incluindo a transição de superfície | B) incluir
`activeStart` direto nas deps do efeito | C) remontar o player na troca de superfície.

**Recomendação: A** — cobre os dois furos (clique vence o deep link; deep link vale mesmo no
caminho já verificado) sem re-disparo a cada `timeupdate`; o ref é do dono (clique), não do estado
de reprodução.

**Rejeitadas:** B porque `activeStart` muda a cada `timeupdate` e o efeito re-seekaria em loop;
C porque descarta a resolução já verificada e força novo fetch (regressão do "sem novo POST").

## Fases verificáveis

1. **Fix (~0,15 dia).** `seekTo` (ramo YouTube) grava o alvo no ref; efeito do `<video>` usa
   `ref.current ?? initialSeconds` e passa a rodar na transição para a superfície da Câmara; ref
   limpo após o seek.
   - Testes (RTL, `tests/unit/speechDetailPlayer.unit.spec.tsx`): clique na frase 43 com embed
     ativo → "Assistir na Câmara" → `video.currentTime === 43` (com `initialSeconds: 100` e sem
     deep link); arquivo já verificado (download primeiro) + `initialSeconds > 0` sem clique →
     `video.currentTime === initialSeconds`; pins C162 existentes sem clique inalterados.
   - Verificação: `pnpm test:unit`, `pnpm typecheck`.
2. **Gates (~0,1 dia).** `pnpm gate:fast`; e2e browserless do acervo inalterado (a interação é
   dona do jsdom); changelog no fechamento.

## Fora de escopo

- IFrame API/`postMessage` para retomar posição do embed do YouTube — segue cortado (C162/C171).
- Persistir o ponto entre reloads; tocar `speechVodResolver.ts`/rota `resolver-vod`/`actions/speech.ts`
  (dono: C169/#1045).
- Mudanças de layout/copy do bloco de saída (o débito cosmético S3 do triage tem gatilho próprio
  no plano-pai).

## Riscos

- **Ref obsoleto de um clique antigo:** o alvo só é gravado no ramo YouTube e só é lido quando o
  `<video>` monta; teste cobre POST novo e arquivo já verificado.
- **Compat C162:** nenhum pin sem clique muda — rodar a suíte do player inteira.
