# Impl: OPS52-media — Recuperar os arquivos de media de produção (capas dos artigos)

Status: aprovado (gate humano 2026-08-18)
Atualizado em: 2026-08-18
Issue: #10 (OPS52-media)
Intenção: docs/plans/ops52-media-recuperar-arquivos.md
Appetite restante: herdado (~0,5–1 dia eng; um outcome verificável)

## Leitura da intenção

- **Outcome:** as ~40 capas de media de produção resolvem no site público:
  `GET https://jorgesolla1313.com.br/api/media/file/<filename>` → **200 com a
  imagem** para toda row; seção S1 da home e artigos exibem as capas; uploads
  novos continuam servindo; fail-closed de storage mantido; **zero mudança de
  schema/migration/Consent**.
- **O que NÃO negociar:** URLs das rows intocadas (contrato relativo via proxy);
  sem reescrita em massa no banco; sem placeholder "em breve"; sem gravar em
  storage errado; DB nunca escrito pela ferramenta de recuperação.
- **O que reavaliar:** a hipótese "só falta o arquivo no bucket" precisa de um
  pre-flight — ver Evidência E3 (rota de media de prod hoje **pendura**, não 404).

## Evidência coletada (2026-08-18, probes read-only)

- **E1 — Fonte das capas no WordPress:** o REST `_embed` de jorgesolla.com.br
  tem **7/43** posts com `wp:featuredmedia`; a maioria das capas do seed vem do
  fallback **primeira imagem inline do corpo** (`processContent` em
  `scripts/seed-posts.mjs` — resolução compartilhada via `resolveCoverSource`).
  A recuperação replica essa resolução exata (featured → senão 1º `img[src]` do
  HTML), senão cobre errado. Todas as 42 capas resolvidas de hoje estão no host
  `jorgesolla.com.br` (probe) — o que permite o allowlist de host no download.
- **E2 — Contrato de URL:** aceite e AGENTS.md dizem `/api/media/file/<filename>`;
  o frontend usa `cover.url` relativo como `src` (src/components/PostCard.tsx:26)
  e o staticHandler do `@payloadcms/storage-s3` serve a rota streamando o objeto
  (getObject com range/etag-304 nativos; `NoSuchKey` → 404 rápido, ver
  `node_modules/@payloadcms/storage-s3/dist/staticHandler.js`).
- **E3 — Rota de media em prod HOJE:** `curl -I https://jorgesolla1313.com.br/api/media/file/<filename>`
  → conexão TLS ok, **sem resposta em 25s+** (não é 404). O handler 404-rápido
  para chave ausente ⇒ o `headObject` do container prod provavelmente **não
  completa** (rota container→Garage tailnet suspeita; Garage está vivo e
  alcançável pelo tailnet desta máquina — 403 no probe sem assinatura). O
  pre-flight do runbook separa "arquivo faltando" (esta Issue) de
  "container prod sem rota ao Garage" (infra — provável sucessor OPS se
  confirmado; o aceite desta Issue exige a rota pública 200).
- **E4 — Postgres prod não exposto ao host** (5432 do homeserver recusou
  conexão): o script de recuperação roda **no homeserver**, dentro da rede do
  compose (padrão do serviço `teqo-1313-migrate`), com `~/stack/teqo-1313.env`
  (DATABASE*URL resolve o serviço `postgres`; S3*\* presentes).
- **E5 — Rows:** 40 rows de `media` (39 capas do seed + 1 órfã provável),
  `filename` único e indexado; o mapeamento row→post é exato via
  `post.coverImage` (FOREIGN KEY confirmada no schema local); fallback
  filename-derivado para órfãs.

## Abordagem recomendada

```mermaid
flowchart LR
  A[rows media + posts.coverImage] -->|Payload find, DB prod| B[recover-media.mjs]
  C[WordPress REST _embed<br/>scripts/lib/wpArticles.mjs] -->|slug -> coverUrl<br/>featured | inline 1o img| B
  B -->|PutObject key = filename<br/>SDK S3 SigV4, bucket teqo-media| G[Garage prod]
  B -.->|--dry-run headObject<br/>--verify HEAD URL pública| R[relatório por row]
  P[browser] -->|GET /api/media/file/&#60;filename&#62;| X[Payload staticHandler] --> G
```

**Opções consideradas:**

- **A — Script CLI commitado `scripts/recover-media.mjs`** (modo `reconcile` /
  `--dry-run` / `--verify`), lendo rows do DB prod e escrevendo SÓ objetos no
  bucket via `@aws-sdk/client-s3`, com guards fail-closed e runbook no
  homeserver. **Recomendada.**
- B — One-off manual no homeserver (curl/SDK em scratch) sem código commitado —
  sem evidência de aceite reproduzível, sem guard de alvo, contrário à própria
  intenção ("ferramenta de reconciliação deve ser explícita sobre o alvo").
- C — Estender `scripts/seed-posts.mjs` com `--restore` — acopla seed de
  conteúdo (guard local-only, idempotência por slug) com recuperação de prod
  (bucket + DB remoto): semântica confusa, risco de rodar contra DB errado.

**Recomendação: A** — porque o problema é um débito operacional de prod com
aceite verificável (200 por filename): um CLI commitado com o mesmo padrão de
guard dos seeds (all-or-nothing S3, `ALLOW_REMOTE_DB=true` explícito, echo do
alvo) é a forma reproduzível e segura; os modos `--dry-run`/`--verify` dão o
pre-flight e o aceite sem depender de credencial.

**Rejeitadas:** B (não reproduzível, sem guard de alvo); C (acopla dois
contratos de guard diferentes no mesmo script; o seed é local-first por design).

### Componentes / mudanças

- **`scripts/lib/wpArticles.mjs`** (novo — extração do dono, sem twin):
  move de `scripts/seed-posts.mjs` o que é fetch puro do WordPress
  (`BASE_URL`, `USER_AGENT`, `stripHtml`, `fetchViaRestApi`, o typedef
  `Article`) e adiciona `inlineCoverUrl(html)` (1ª `img[src]` — a peça que o
  `processContent` do seed usa como fallback; idêntica semântica). O seed
  importa daqui (comportamento inalterado; `fetchViaHtmlArchive` e
  `processContent` permanecem no seed). Helpers puros adicionais:
  `slugFromFilename(filename)` (remove a última extensão) e a resolução
  `resolveCoverSource(article)` (`article.coverUrl || inlineCoverUrl(...)`).
  Unit-testados (padrão dos módulos de `scripts/lib`).
- **`scripts/recover-media.mjs`** (novo): fluxo — _(desde OPS52-media-guard,
  #37, o reconcile também exige `MEDIA_RECOVER_CONFIRM=1` antes de qualquer
  passo abaixo — ver `docs/plans/ops52-media-guard-impl.md`)_
  1. `loadCliEnv` + `assertLocalDatabase('media:recover', hint do runbook)` +
     `resolveS3StorageEnv(process.env)` (reuso de `src/utilities/mediaStorage.ts`;
     aborta se `enabled: false` — recuperação é operação de prod, nunca storage
     local) → **echo do alvo** (host do DB, endpoint, bucket) antes de qualquer
     escrita.
  2. Leitura read-only: `payload.find` em `media` (todas as rows) e em `post`
     com `coverImage` (depth 0) → mapa `mediaId → post.slug`; fallback
     `slugFromFilename(row.filename)`.
  3. `fetchArticlesFromWordPress()` → mapa `slug → coverUrl` (featured →
     inline 1º img, exatamente como o seed).
  4. Por row: resolve cover; `fetch` do cover (User-Agent do seed);
     `PutObjectCommand` key **= `row.filename` verbatim**, `ContentType` =
     content-type do download (os bytes reais mandam no decode — o nome do
     arquivo é cosmético no contrato), sobrescreve (idempotente).
  5. Relatório por row (uploaded / sem-cover / erro) + resumo; **nunca**
     `payload.create/update` — o script só lê o DB.
- **Modos:** default = reconcile (plano + upload); `--dry-run` = plano +
  `headObject` por key (presente/ausente), zero escrita; `--verify` = `HEAD`
  de cada filename contra a URL pública (`NEXT_PUBLIC_SITE_URL` ou
  `https://jorgesolla1313.com.br`), o aceite da Issue, sem credencial de bucket.
- **Timeouts fail-fast:** `@aws-sdk/client-s3` + `@smithy/node-http-handler`
  (devDependencies, versões já no lockfile) com `connectionTimeout: 5s` /
  `requestTimeout: 15s` — endpoint inalcançável falha em segundos, não pendura
  (mitiga o sintoma da E3 no runbook).
- **`package.json`:** `media:recover` (mesma fiação `--import=tsx/esm
--import=./scripts/seed-loader.mjs` dos seeds — os hooks de `post` chamam
  `revalidateTag`).
- **Migration:** nenhuma. **Access/Consent:** intocados (`media.read` público;
  a tool não autentica nada).
- **Runbook + docs:** seção no impl plan (ordem do homeserver) + nota curta no
  AGENTS.md (seeds/media §) apontando o runbook; entrada
  `docs/changelog/2026-08-18-ops52-media.md` + `pnpm changelog:build`.
- **UI:** N/A (Impeccable A — a seção S1 renderiza certo; problema é a media).

## Revisão pós-simplify (2026-08-18 — 3 revisores, fixes absorvidos)

- Download de capa com `AbortSignal.timeout(30s)`; fetch do REST com signal
  opcional (60s no recover; o seed passa nenhum — semântica do fallback
  intacta).
- Covers constrangidas a http(s) no host do WP (`resolveCoverDownloadUrl`;
  relativas resolvem contra a origem) e só `image/*` é armazenado — sem SSRF
  do homeserver, sem objeto não-imagem servido same-origin pelo proxy.
- `--verify` não resolve S3\_\* (config parcial não mata o aceite); origin do
  verify ecoado no resumo de alvo.
- `--dry-run` sai com exit 1 quando QUALQUER checagem do bucket falha
  (pre-flight honesto — all-erro ≠ 0).
- `resolveMediaCoverSources` extraído puro para a lib e unit-testado
  (mapeamento row→post→cover, fallback e classificação de fonte); `fmt` e o
  twin do `processContent` corrigidos.
- DevDeps com range `^` (convenção do repo); script `media:recover` fora do
  bloco `db:seed:`; typedef `Article` via `@import` no seed.

## Fases verificáveis

1. **Lib + refactor do seed** — `scripts/lib/wpArticles.mjs` + seed importando
   (fetch idêntico); unit tests de `slugFromFilename` / `inlineCoverUrl` /
   `resolveCoverSource`; `pnpm gate:fast` + `pnpm format:check` + `knip` +
   `check:cycles`; conferir `git diff` do seed = só import.
2. **Script de recuperação** — `recover-media.mjs` + npm script + devDeps;
   `--dry-run` contra DB local (rows vazias — valida guards e caminho read-only);
   unit dos helpers puros; gates da fase 1 repetidos.
3. **Docs + changelog** — runbook no impl plan, nota no AGENTS.md,
   `docs/changelog/2026-08-18-ops52-media.md`, `pnpm changelog:build` +
   `pnpm changelog:check`.
4. **Gates finais** — `pnpm gate:fast`, `pnpm format:check`, `pnpm exec knip`,
   `pnpm check:cycles`, `pnpm test` (unit+int), `pnpm build` local.
5. **Execução em prod (pós-merge, runbook — humano):**

## Runbook de execução em produção (pós-merge, humano)

> **Estado 2026-08-18 (executado):** 38/40 objetos restaurados e servindo 200 em
> `/api/media/file/...`; exceções sem fonte: `fim-escala-6x1.jpg` e
> `jorgesolla.jpg` (404 honesto — rows manuais, não referenciadas por posts).
> **E3 resolvido na raiz:** o container prod não alcançava o Garage — o
> firewall do host derrubava TODA a sub-rede do docker (gateway, LAN e tailnet:
> tudo bloqueado — o `headObject` pendurava e a rota de media dava timeout).
> Fix aplicado no homeserver (reversível):
>
> 1. `sudo ufw allow from 10.0.11.0/24 to any port 3900 proto tcp` (INPUT)
> 2. `sudo ufw route allow from 10.0.11.0/24 to any port 3900 proto tcp` (FWD)
> 3. `extra_hosts: ["host.docker.internal:host-gateway"]` nos serviços
>    `teqo-1313` e `teqo-1313-migrate` do `~/stack/docker-compose.yml`
>    (sobrevive aos deploys — o OPS53 edita o compose in-place; backup
>    `docker-compose.yml.pre-ops52-media-hostgateway`)
> 4. `S3_ENDPOINT=http://host.docker.internal:3900` no `~/stack/teqo-1313.env`
>    (o tailnet IP continua sendo o endpoint da workstation)

Ordem das próximas execuções (pós-merge, humano):

1. **Deploy do merge em `main`** (CI OPS53) — o script e a lib chegam ao
   homeserver com a imagem do SHA.
2. **Pre-flight no homeserver** (rede do compose, env do stack
   `~/stack/teqo-1313.env` — `DATABASE_URL` resolve o serviço `postgres` e as
   `S3_*` já estão lá):
   ```bash
   cd ~/stack
   set -a; source teqo-1313.env; set +a
   ALLOW_REMOTE_DB=true pnpm media:recover --dry-run
   ```
   Esperado: `headObject` de cada filename responde `presente`/`ausente` em
   segundos. Se TODAS as rows derem `erro` (timeout/ECONNREFUSED), o container
   não alcança o Garage — repetir o diagnóstico do estado acima (firewall +
   extra_hosts + endpoint) antes de recuperar.
3. **Recuperar** (o reconcile escreve no bucket — guard de intenção explícita
   OPS52-media-guard exige `MEDIA_RECOVER_CONFIRM=1`; sem ela o script recusa
   com a mensagem e o comando correto):
   ```bash
   MEDIA_RECOVER_CONFIRM=1 ALLOW_REMOTE_DB=true pnpm media:recover
   ```
   Esperado: 40 uploads (`PutObject` key = filename; idempotente por overwrite),
   exceções reais (sem cover / download 404) listadas no relatório — conferir
   e registrar na Issue; exit 1 se houver falhas.
4. **Aceite:**
   ```bash
   ALLOW_REMOTE_DB=true pnpm media:recover --verify
   ```
   Esperado: `38/40 filenames respondendo 200 em https://jorgesolla1313.com.br`
   (as 2 exceções seguem 404 — aceite da Issue contempla o registro honesto).
   Se persistir pendurando (erro/timeout) com objetos no bucket → confirmar
   container→Garage (passo 2) — agora a causa raiz conhecida é firewall.
5. **Check visual:** home de campanha (seção "Acompanhe de perto") e 1–2
   páginas de artigo com capa; console do navegador sem erro de imagem.
6. **Exceções:** `fim-escala-6x1.jpg` e `jorgesolla.jpg` (rows manuais sem
   fonte no WP) → reportar na Issue #10; o card degrada para a banda cinza
   existente (sem placeholder, sem placeholder "em breve").

## Rabbit holes / Não escopo (engenharia)

- **Testar o script ponta a ponta desta máquina** — impossível por contrato:
  sem S3\_\* (fail-closed) e sem DB prod; a prova E2E é o runbook do homeserver
  (padrão OPS52 fase 3: prova de contrato manual, humana).
- **`--verify` exigir credencial** — não: URL pública é o aceite; sem bucket.
- **Consertar a rota/connectivity container→Garage** — se o pre-flight/verify
  confirmar E3 como infra, é sucessor OPS (documentar diagnóstico no runbook),
  não muda nada desta entrega.
- **Deletar a store do Vercel Blob / bucket público / CDN** — já fora de escopo
  do OPS52/intenção.
- **Reescrever URLs das rows / recriar rows** — proibido pelo aceite; a tool
  grava só objetos.

## Riscos e mitigação

- **R1 — Rota pública segue pendurando após recuperar objetos (E3 real).**
  Mitigação: pre-flight no runbook (dry-run com timeout fail-fast já sinaliza
  endpoint inalcançável; `--verify` pós-upload é o aceite). Se confirmar
  infra container→Garage: reportar na Issue e abrir sucessor OPS — o aceite
  desta Issue depende da rota 200, e o objeto restaurado é condição necessária
  mas o caminho de rede é do ambiente.
- **R2 — Capa do WP mudou desde o seed (featured nova / imagem removida).**
  Q1 da intenção aceita a capa atual do WP como fonte; exceções reais
  (fetch 404/erro) são registradas e o card degrada para a banda cinza já
  existente — sem placeholder.
- **R3 — Órfã (40ª row) não resolve por post nem por slug.**
  Exceção no relatório; humano decide (registrar na Issue). Não inventar fonte.
- **R4 — Guard de alvo insuficiente (rodar contra bucket errado).**
  `resolveS3StorageEnv` fail-closed (todas ou nenhuma) + echo do alvo +
  `ALLOW_REMOTE_DB=true` obrigatório para DB remoto (mesmo padrão dos seeds).
- **R5 — Extensão ≠ conteúdo (row `.jpg` com webp no WP).**
  `ContentType` = o do download (bytes reais decodificam); extensão é cosmética
  no contrato de URL. Mencionado no runbook.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto: 200 público por filename das
      ~40 rows, DB intocado, uploads novos intocados, fail-closed mantido
- [ ] Invariantes AGENTS/engineering-standards: identificadores em inglês;
      guard local de DB reusado; zero access/Consent/transação tocados
- [ ] Testes de domínio: unit dos helpers puros de `wpArticles.mjs` e da
      resolução row→cover; gates da checklist do AGENTS rodados
- [ ] Docs: runbook de execução em prod + nota AGENTS.md + changelog
