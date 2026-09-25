# Post-mortem: CDN do Instagram inalcançável do container — IPv4 instável e caminho único sem retry

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-25                                                                                                                   |
| Severidade          | alta (fluxo editorial da Central e capas públicas do Instagram na home)                                                      |
| Ambiente            | prod                                                                                                                         |
| Issue(s)            | sem Issue — continuação do relato do worktree `fix/10` (post-mortem anterior: `2026-09-24-instagram-link-sem-early-stop.md`) |
| PR do fix           | a preencher (o retry no resolver); a rede foi corrigida direto no stack do homeserver (fora do repo)                         |
| Detectado por       | humano (testes em prod: reels com `Instagram indisponível no momento`)                                                       |

## Timeline

| Momento                 | Data/hora                   | Evento                                                                                                                                                     |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável         | não apurado                 | A rota IPv4 da rede até o CDN do Instagram degradar; o container (IPv4-only) depende dela desde sempre                                                     |
| C220-FOLLOWUP em prod   | 2026-09-25 ~03:34 UTC       | Deploy do SHA `3cdd1cd8` (inclui o early-stop do PR #1332); o sintoma persistiu                                                                            |
| Detecção                | 2026-09-24 ~22:09 BRT       | Relato do humano; a causa residual só foi isolada com o diagnóstico read-only de 2026-09-25                                                                |
| Diagnóstico (read-only) | 2026-09-25 ~08:30–09:30 BRT | API devolve `media_url` presente; otimizador de imagem de prod → 500; host e container com ~3/8 de sucesso no IPv4 e 100% no IPv6; container sem rota IPv6 |
| Correção de infra       | 2026-09-25 ~09:35 BRT       | Rede `teqo-ipv6` (enable_ipv6, ULA) anexada a `teqo-1313`/`teqo-staging` no compose do homeserver + recreate; verificação 10/10 e otimizador 200           |
| Correção de código (PR) | pendente                    | Retry com teto de conexão no download do resolver (`contentPieceLink.ts`) — a preencher número                                                             |
| Deploy (código)         | pendente                    | Merge em `main` dispara deploy; produção só com approve humano no environment `production`                                                                 |
| Verificado em prod      | pendente                    | Aguardando o reteste do humano na Central (a rede já está corrigida em prod)                                                                               |

## O bug

Colocar um link de publicação do próprio Instagram na Central de Conteúdos não baixava a mídia nem catalogava a peça: a ficha terminava com "Instagram indisponível no momento" (peça-link). O mesmo caminho de rede também quebrava as capas do Instagram na home pública (otimizador de imagem respondendo `500`) e podia derrubar chamadas do feed.

## Causa-raiz

O container de produção é **IPv4-only** (Docker sem `ipv6`; `/proc/net/if_inet6` só loopback). A rota IPv4 da rede do homeserver até o CDN do Instagram (`instagram.fssa2-1.fna.fbcdn.net`, edge Vivo `191.251.196.160`) está **muito instável**: medições repetidas deram ~3/8 de sucesso no host e ~3/8 no container, com `ETIMEDOUT` de conexão; o **IPv6 funciona 100%** (`curl -6` 206; fetch no container com a rede IPv6: 10/10). O resolver baixava com **uma única tentativa** (`contentPieceLink.ts`), então quase sempre devolvia `indisponivel` — sem qualquer sinal de que o problema era a rede, não a API.

5-whys:

1. **Por que a peça não baixava?** O `fetch` do `media_url` estourava por timeout de conexão no CDN.
2. **Por que estourava?** O container só tem IPv4 e o caminho IPv4 até o edge do CDN é instável nesta rede (o IPv6, estável, não está disponível no container).
3. **Por que o container não usa IPv6?** O Docker do homeserver não tem IPv6 habilitado e o serviço não estava anexado a nenhuma rede IPv6.
4. **Por que isso não aparecia?** O board da home **degrada em silêncio** para o snapshot (fail-closed) e o painel de sync dizia "Sincronizado" (a chamada da API funciona); a ficha mostrava um motivo genérico ("Instagram indisponível no momento") que aponta para a plataforma, não para a rede.
5. **Por que os testes não pegavam?** Todo o caminho de download é mockado nos testes (unit/int) — nenhum teste toca o CDN real; e a verificação viva do C220 nunca foi feita em produção.

**Evidência:**

- API com token de produção (read-only): `media_url` **presente** para os reels recentes; `media_audio_type` nulo; nenhum `copyright_check_information`.
- `DdsAC82NXsC` é um reel **colaborativo** de `@joaobahiaprefeito` e **não** aparece no edge `/media` da própria conta — um link de terceiro/colab corretamente não casa (seria `nao-encontrado` com o feed saudável).
- Host `curl -4` no `media_url`: 3/8; `curl -6`: 100% (rápido). Container: 3/8 no IPv4, `ENETUNREACH` no IPv6.
- `https://jorgesolla1313.com.br/_next/image?url=<capa IG>` → `500` antes da correção; `200 image/jpeg` depois.
- Dentro do container de produção, após a rede IPv6: 10/10 downloads do `media_url`.

## Correção

- **Infra (fora do repo):** rede `teqo-ipv6` (`enable_ipv6: true`, subnet ULA `fd00:1313:1313::/64`) no `~/stack/docker-compose.yml` do homeserver, anexada a `teqo-1313` e `teqo-staging` (mantendo a `default`). Backup do compose em `docker-compose.yml.pre-ipv6-<stamp>`; containers recriados (`docker compose up -d teqo-1313 teqo-staging`). Rollback: restaurar o backup e `docker compose up -d teqo-1313 teqo-staging`.
- **Código (este PR):** `downloadContentPieceMedia` em `src/utilities/content/contentPieceLink.ts` — até 6 tentativas com teto de 15 s para a fase de conexão/cabeçalhos (o corpo de uma resposta conectada mantém o orçamento de 3 min). Um `fetch` perdido deixa de perder a peça; tentativas esgotadas continuam virando `indisponivel`, e resposta não-2xx não é repetida.

## Verificação

- Teste de regressão: `tests/int/contentPiece.int.spec.ts` — "retries a stranded media download and still extracts the piece" — falha sem o fix (1 tentativa → `indisponivel`) e passa com (4 tentativas → mídia criada)
- Suíte: int contentPiece 39/39; `pnpm gate:fast` verde (lint/typecheck/unit full 4669)
- Infra em prod: 10/10 downloads do CDN dentro do container `teqo-1313`; `/_next/image` de capa IG → `200` (3/3)
- CI: pendente no PR; Prod: pendente do reteste do humano na Central

## Prevenção

| Estratégia                                                                                               | Custo  | Estado                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Retry com teto de conexão no dono do download (resolver da peça)                                         | barata | implementada agora (este PR)                                                   |
| Registrar a rede `teqo-ipv6` e o sintoma no runbook de deploy                                            | barata | implementada agora                                                             |
| Observabilidade do caminho do CDN (alerta quando o otimizador/sync falha por rede, não só status da API) | cara   | documentada — o painel de sync diz "Sincronizado" mesmo com o CDN inalcançável |
| Re-host das capas do Instagram no sync (S3/Garage) para não depender do CDN em tempo de request          | cara   | já documentada no post-mortem de 2026-09-11 — segue candidata                  |
| Healthcheck ativo do stack para egress IPv6/IPv4 aos CDNs externos                                       | cara   | documentada                                                                    |

**Estratégia implementada:** retry no resolver + nota no runbook (com a rede IPv6 documentada).

**Estratégia documentada (cara):** observabilidade do caminho, re-host das capas e healthcheck de egress.

## Lições

- **Fetch remoto de tentativa única + rede de caminho único = falha silenciosa.** O motivo "Instagram indisponível" escondia uma falha de rota local; um retry curto teria mascarado por tempo, mas a rede era a causa.
- **Fail-closed do board mascara a indisponibilidade:** o snapshot manteve a home de pé e o painel de sync dizia "Sincronizado" (a API chama IPv4 que funcionava para `graph.instagram.com`) enquanto o CDN de mídia estava inalcançável. Status de API não é status de mídia.
- **Diagnóstico de rede precisa dos dois lados:** medir host × container e IPv4 × IPv6 com repetição revelou o padrão que uma única tentativa não mostra.
- **"A API entrega o arquivo" não significa "o arquivo chega":** `media_url` presente, `copyright` ausente e o download falhando por rota.
- **O CDN muda de host/edge sem aviso:** o post-mortem de 2026-09-11 já tinha visto `cdninstagram` → `fbcdn`; desta vez o edge IPv4 novo é que não é alcançável de forma confiável.
