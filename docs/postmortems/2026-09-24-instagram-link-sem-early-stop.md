# Post-mortem: Link do Instagram na Central não baixava a peça — janela de 500 sem early-stop

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-24                                                                                                                    |
| Severidade          | alta (fluxo editorial de produção prometido não funcionava; sem perda de dados)                                               |
| Ambiente            | prod (sintoma) + dev/worktree (diagnóstico e fix)                                                                             |
| Issue(s)            | sem Issue — o item anterior, C220 (#1302), já estava fechado/in-prod; o residual não gerou Issue (o post-mortem é o registro) |
| PR do fix           | #1332                                                                                                                         |
| Detectado por       | humano (relato do usuário na sessão `/bug-fix` do worktree `fix/10`, 2026-09-24 ~22:09 BRT)                                   |

## Timeline

| Momento            | Data/hora                  | Evento                                                                                                                                                |
| ------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-09-24 ~03:19 BRT      | Commit `8f311831` "fix(C220): link do proprio Instagram baixa e cataloga a peca" (PR #1314) introduz a janela de 500 sem early-stop                   |
| C220 em produção   | 2026-09-24 12:56–13:07 UTC | Deploy run 35966535233 (SHA `8f311831`), job "deploy production"                                                                                      |
| Detecção           | 2026-09-24 ~22:09 BRT      | Relato do humano na sessão `/bug-fix`                                                                                                                 |
| Correção mergeada  | 2026-09-25 ~02:00 UTC      | PR #1332 (merge `9f43cbb2`); em produção no deploy do SHA `3cdd1cd8` (~03:34 UTC)                                                                     |
| Deploy             | 2026-09-25 ~03:34 UTC      | Deploy run 36087193017 (SHA `3cdd1cd8`), job "deploy production"                                                                                      |
| Verificado em prod | 2026-09-25                 | O sintoma **persistiu** após o merge: a causa residual era o caminho de rede até o CDN do Instagram — ver `2026-09-25-instagram-cdn-ipv4-instavel.md` |

## O bug

Na Central de Conteúdos (`/campanha/comunicacao/conteudos`), colar o link de uma publicação do próprio Instagram do deputado (@depjorgesolla) não baixava a mídia nem transcrevia/catalogava automaticamente: a peça ficava como peça-link. Afetava a assessoria de comunicação no fluxo editorial que o C220 prometia entregar.

## Causa-raiz

O design aprovado do C220 (`docs/plans/central-conteudos-link-instagram-impl.md`, D2 e §Riscos) prometia "janela de 500 mídias … early-stop no match; a chamada típica é 1" e que uma paginação time-based degradaria para a 1ª página sem quebra. A implementação não honrou o early-stop:

1. O resolver chamava `loadInstagramFeed` com `maxResults=500` (`src/utilities/content/contentPieceLink.ts:178` pré-fix).
2. O match do shortcode só acontecia DEPOIS de andar a janela inteira — até 10 páginas via `paging.cursors.after` (`src/utilities/socialFeed/instagramFeed.ts:263-281`).
3. O contrato era tudo-ou-nada: erro em página ≥2 lançava (`instagramFeed.ts:273-275`) e o resolver capturava QUALQUER erro do feed como `indisponivel` (`contentPieceLink.ts:182-186`), descartando a página 1 já recebida.

Resultado: o caso típico (post recém-publicado, na página 1) ficava refém de páginas profundas. A doc oficial da edge `/{ig-user-id}/media` no host Instagram Login documenta paginação TIME-BASED (`since`/`until`), e o próprio C212 registrou a paginação por cursor como "a confirmar na implementação".

**Evidência de reprodução:** script com o `loadInstagramFeed` real e `fetchImpl` fake (página 1 com o alvo + `paging.cursors.after`; `after=` → HTTP 400); pré-fix lança `InstagramApiError` e o resolver devolve `linkFailureReason='indisponivel'` mesmo com o post na página 1. Coberto pelo teste int novo (`tests/int/contentPiece.int.spec.ts`, "stops at page 1 when the pasted post is there, even if deeper cursors fail") — vermelho sem o fix (`expected 'indisponivel' to be null`), verde com.

**Por que os testes não pegaram:** o unit do feed usava cursor fabricado; os testes int do resolver injetavam `loadFeed` fake (nunca o dono real); o e2e do motivo gravava `linkFailureReason` direto no banco e não esperava o job. Nenhum teste exercia o `loadInstagramFeed` real através do resolver.

**Observação honesta:** na ocasião, a API real com a credencial de produção não foi acessada; no diagnóstico seguinte (autorizado pelo dono, read-only) ela foi consultada e a hipótese H2 foi **descartada** para os reels testados (`media_url` presente, sem copyright). A causa residual era de rede — ver `2026-09-25-instagram-cdn-ipv4-instavel.md`. A forma da paginação da edge além da 1ª página segue **não apurada**.

## Correção

`src/utilities/socialFeed/instagramFeed.ts` ganhou o opcional `shouldStopAt?: (post) => boolean` em `LoadInstagramFeedArgs`, checado após cada página; board/sync não passam a opção, então o contrato de 1 página e o tudo-ou-nada ficam intocados. `src/utilities/content/contentPieceLink.ts` passa `shouldStopAt: matchesInstagramShortcode(link.shortcode)` (novo helper, reusado no match final).

Efeito: a colagem típica volta a custar UMA chamada de mídia, e uma falha em página profunda nunca mais transforma um match de página 1 em `indisponivel`. Sem migration, sem mudança de access/UI.

## Verificação

- Teste de regressão: `tests/int/contentPiece.int.spec.ts` — "stops at page 1 when the pasted post is there, even if deeper cursors fail" — falha sem o fix com `indisponivel`, passa com
- Unit novo: `tests/unit/instagramFeed.unit.spec.ts` — "stops at the page that holds the searched post…" e "keeps walking when the searched post is deeper" — 23/23
- Suíte: int contentPiece 38/38; `pnpm gate:fast` verde (lint/typecheck/unit full 4669; houve 1 flake de `contentPiecePeopleField.unit.spec.tsx` sob carga, que passou 2x em isolamento)
- CI: pendente no PR
- Prod: pendente da confirmação do humano

## Prevenção

| Estratégia                                                                                                                               | Custo  | Estado                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Teste de regressão no nível certo (int do resolver com o `loadInstagramFeed` REAL + `fetchImpl` fake, pinando 1 chamada e zero `after=`) | barata | implementada agora (mesmo PR)                                                                                       |
| Unit do dono: para no match e continua quando o alvo está mais fundo                                                                     | barata | implementada agora (mesmo PR)                                                                                       |
| Best-effort no modo lookup (página ≥2 falha → devolver o já coletado em vez de `indisponivel`)                                           | cara   | documentada — distorce o vocabulário (`nao-encontrado` falso para post fundo); só com evidência de colagens antigas |
| Verificação viva/canário com credencial real (staging/prod) + runbook do token                                                           | cara   | documentada — única verificação não-cega da forma da paginação na edge                                              |
| Pesquisar/decidir o contrato time-based da edge (`since`/`until` × cursor `after` × `paging.next` sem vazar token)                       | cara   | documentada — candidata a Issue                                                                                     |

**Estratégia implementada:** os três testes acima (unit do dono + int do resolver com o feed real).

**Estratégia documentada (cara):** as três acima.

## Lições

- Promessa de plano sem teste executável vira comentário: "early-stop em 1 chamada" era contrato do design e não tinha prova.
- O seam de injeção de dependência pode virar blindagem: testar o dublê e nunca o dono real esconde regressões no caminho de produção.
- "A confirmar na implementação" precisa de verificação viva antes de vender o comportamento como entregue.
- Degradação honesta prometida no plano precisa de teste no modo real de falha (página ≥2), não só no caminho feliz.
