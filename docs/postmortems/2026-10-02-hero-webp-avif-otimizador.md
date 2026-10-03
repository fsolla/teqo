# Post-mortem: hero da home sem imagens — chaves AVIF presas no otimizador do Next

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-10-02                                                                                                           |
| Severidade          | alta (imagens principais da home ausentes para parte dos visitantes; sem indisponibilidade geral nem perda de dados) |
| Ambiente            | prod                                                                                                                 |
| Issue(s)            | sem Issue                                                                                                            |
| PR do fix           | [#1433](https://github.com/fsolla/teqo/pull/1433)                                                                    |
| Detectado por       | humano (relato na sessão de bug-fix de 2026-10-02 ~17:15 -03: "as imagens pararam de aparecer")                      |

## Timeline

| Momento               | Data/hora                        | Evento                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável       | 2026-10-02 ~16:35 -03 (~19:35Z)  | Deploy de produção do SHA `ac39c817` recria o container (job de produção do `deploy.yml` rodou 19:26:40Z–19:35:53Z; container recriado ~19:35Z ≈ 16:35 -03). Antes disso o sintoma não existia; staging (mesmo SHA, deploy 15:17Z) nunca reproduziu.                                                                                                                                                                                                                                            |
| Detecção              | 2026-10-02 ~17:15 -03 (≈20:15Z)  | Relato humano na sessão de bug-fix ("as imagens pararam de aparecer"). No browser, requests a `/_next/image` ficavam pendentes para sempre (`complete=false`, `naturalWidth=0`); o Cloudflare devolvia 524 após ~100–125s no mesmo URL exato. Sem Issue.                                                                                                                                                                                                                                        |
| Correção implementada | 2026-10-02                       | Worktree `fix/16`: 5 masters do hero regerados em WebP display-size, 3 refs de cards da home apontadas para `.webp` existentes, 9 `.avif` de `public/` removidos, `scripts/build-radio-artes.mjs` lendo `JOA00162.webp` e 3 guards de formato. `pnpm gate:fast` verde (468 arquivos, 5178 testes); e2e `frontend.e2e.spec.ts` 42 passed.                                                                                                                                                        |
| Correção mergeada     | 2026-10-02 18:55 -03 (21:55:55Z) | PR [#1433](https://github.com/fsolla/teqo/pull/1433) mergeado via rebase (`afc22e5b`) após o required check `CI (PR) / checks` verde.                                                                                                                                                                                                                                                                                                                                                           |
| Deploy                | 2026-10-02 20:54 -03 (23:54:33Z) | O run automático do merge (`37069700073`) foi pulado pelo `preflight` (havia run aguardando approval de produção — gap previsto no runbook, linha "Merge durante aprovação pendente"); o `workflow_dispatch` manual `37069890690` verificou e publicou staging, mas o job de produção falhou sem runner associado (`runner_id` 0 — causa não apurada). Produção foi publicada pelo run seguinte `37075531360` (push do C246-hotfix `8e32c7ce`, que contém `afc22e5b`) em 23:54:33Z ≈ 20:54 -03. |
| Verificado em prod    | 2026-10-02 ~20:55 -03            | Read-only em `jorgesolla1313.com.br`: home com 0 ocorrências de avif; as 5 imagens do hero carregam no browser (`complete=true`, `naturalWidth` 176–591); chaves novas `*.webp` do otimizador 200 `image/webp` em 0,13–0,39s; masters novos no ar (`Jeronimo.webp` 61.752B, antes 626.200B) e AVIF antigos 404. Confirmação do humano na sessão.                                                                                                                                                |

## O bug

Em produção, no browser, as imagens `RUI`/`WAGNER`/`Jeronimo` (e `Lula` em certos viewports) do hero da home pública não carregavam: os requests para `/_next/image` ficavam pendentes para sempre (`complete=false`, `naturalWidth=0`) e o mesmo URL exato nunca respondia — o Cloudflare devolvia 524 após ~100–125s. A matriz de evidências em produção (Accept de browser, q=75) mostrou que estavam envenenadas exatamente `RUI - 2-2.avif w=256`, `WAGNER - 2-9 final.avif w=256`, `Jeronimo.avif w=256` e `Lula.avif w=384`; **todas** as outras larguras dos mesmos arquivos (16–3840) e todas as outras imagens (`JOA00162` em todas as larguras, `fundo.avif`, as 2 fotos `.avif` da home, o HEIC do Instagram) respondiam 200 em ~0,3–6s. As 4 chaves correspondem exatamente ao conjunto que um load da home a 1920×1080 DPR1 pede em paralelo (aliados 211px→256; Lula 284px→384). A chave com mimeType avif (Accept: `image/avif`) do mesmo `RUI w=256` respondia 200 em 0,26s, e `q=76` respondia 200 em 0,28s — a geração estava saudável; só as 4 chaves exatas estavam presas na memória do processo. O sintoma afetava a página principal para parte dos visitantes, sem indisponibilidade geral nem perda de dados. **Sintoma — não a causa.**

## Causa-raiz

### 5 whys

1. **Por que a imagem não aparecia?** Porque o request para a chave exata do otimizador nunca respondia (524).
2. **Por que nunca respondia?** Porque o `Batcher` do `ResponseCache` do Next (`node_modules/next/dist/lib/batcher.js`) deduplica por cache key e guarda a promise em `this.pending`; uma geração que pendura deixa a promise sem timeout para sempre — toda request futura daquela chave entra na mesma promise morta até o processo reiniciar. Evidência de código: `node_modules/next/dist/server/response-cache/index.js` (Batcher com `schedulerFn`), sem timeout.
3. **Por que a geração pendurou?** Os 5 masters do hero eram AVIF e o Next 15.4.11 os decodifica via libheif (sharp 0.34.2). O advisory crítico GHSA-2xp9-vwfh-vxw4 ("Unauthenticated RCE in Image Optimization API when AVIF files are used"; afeta `next >=10 <15.5.24`) tem como mitigação oficial, no patch vercel/next.js commit `409772ec` (release 15.5.24), adicionar AVIF a `BYPASS_TYPES` (não otimizar AVIF) e bloquear os loaders libvips não-seguros. O hang transiente **não foi reproduzido** localmente (testado sharp glibc e musl/Alpine, sequencial e 4 concorrentes, 15 rodadas; staging idêntico também não reproduz) — é race de ambiente/carga no startup; ficou registrado como não reproduzido.
4. **Por que AVIF chegou ao otimizador?** Porque o fix anterior (`16f95975`, 2026-10-01) regerou os masters como AVIF no tamanho de exibição para resolver a lentidão; o caminho AVIF→libheif permaneceu, e nenhum guard olhava formato/mídia.
5. **Por que passou?** Porque não havia observabilidade de `/_next/image` nem guard de formato; o advisory era conhecido e o upgrade do Next é débito registrado como caro (`docs/plans/b195-f1-wizard-form-duplicado-streaming-impl.md`).

## Correção

- **Masters convertidos para WebP:** os 8 AVIF locais referenciados via `next/image` viraram WebP — os 5 masters do hero foram regerados display-size a partir dos próprios AVIF aprovados (mesmo enquadramento; `pnpm images:resize --format webp --quality 85`: `RUI`/`WAGNER`/`Jeronimo` 768px, `Lula` 1024px, `JOA00162` 1536px; 538KB vs 351KB de AVIF — o master não vai ao cliente) e os 3 cards da home (`fundo`, `53569851134…`, `52396285023…`) passaram a referenciar os `.webp` existentes.
- **AVIF removido de `public/`:** os 9 `.avif` foram deletados (8 referenciados + `Marca-Lula.avif` órfão).
- **`scripts/build-radio-artes.mjs`** passou a ler `JOA00162.webp`.
- **Arquivos:** `src/components/CampaignHero.tsx`, `src/app/(frontend)/(home)/page.tsx`, `scripts/build-radio-artes.mjs`, `public/*.webp` (5 regerados), `public/*.avif` (9 removidos).

Resolve a causa: o caminho de decodificação vira libwebp (o patch oficial trata webp como loader seguro) e as URLs do otimizador mudam de chave, matando as 4 chaves envenenadas no próximo deploy — sem purge nem restart manual.

## Verificação

- Teste de regressão: `tests/unit/imageDelivery.unit.spec.ts` (2 casos novos: ban de literal `.avif` em `src/` incluindo `image:` e zero `.avif` em `public/`) e `tests/unit/campaignHero.unit.spec.tsx` (caso "serve masters WebP"). Prova vermelho/verde independente: sem o fix, 2–3 falhas (recebe `/RUI - 2-2.avif`; `.avif` presente; dimensão com arquivo ausente); com o fix, 8 passed.
- Suíte: `pnpm gate:fast` verde (468 arquivos, 5178 testes); e2e `tests/e2e/frontend.e2e.spec.ts` 42 passed (modo dev local; o comando com dependências estourou 900s e o recipe do config `--no-deps --project=frontend` passou em 1,1 min).
- Otimizador local: home com 0 ocorrências de avif; os 8 masters WebP servidos via `/_next/image` a 256w em 200 `image/webp` (0,7–1,6ms) e derivados ligeiramente menores que os do AVIF (ex.: `RUI` 256: 9,8KB vs 12,2KB).
- Prod (read-only, antes do deploy): as 4 chaves AVIF seguem presas (timeout/524) e a home ainda serve AVIF (260 ocorrências).
- CI: verde no PR [#1433](https://github.com/fsolla/teqo/pull/1433) (required check `CI (PR) / checks`; e2e do blast radius `frontend`, `frontendConteudos`, `frontendShareLink`) e no `verify` full do deploy.
- Prod (pós-deploy, read-only): home com 0 avif; as 5 imagens do hero carregam (`complete=true`, `naturalWidth` 176–591); chaves `*.webp` 200 `image/webp` em 0,13–0,39s; masters novos no ar (`Jeronimo.webp` 61.752B) e AVIF antigos 404. Confirmação do humano na sessão.

## Prevenção

| Estratégia                                                                                                                                                                              | Custo  | Estado                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------- |
| Ban de literal `.avif` em `src/` (as duas grafias, incluindo `image:`), zero `.avif` em `public/` e hero exigindo `.webp` (`imageDelivery.unit.spec.ts` / `campaignHero.unit.spec.tsx`) | barata | implementada agora (este PR)                      |
| Upgrade Next ≥15.5.24 (AVIF em `BYPASS_TYPES` + loaders libvips seguros)                                                                                                                | cara   | documentada — Issue, não implementada neste fluxo |
| Cache Rule/observabilidade Cloudflare para `/_next/image` + runbook de purge                                                                                                            | cara   | documentada — Issue, não implementada neste fluxo |
| Healthcheck/probe sintético de chaves presas com alerta                                                                                                                                 | cara   | documentada — Issue, não implementada neste fluxo |

**Estratégia implementada:** os 3 guards de formato acima (ban de AVIF em `src/` com as duas grafias, zero AVIF em `public/`, hero exigindo `.webp`), somados aos guards de dimensão/TTL do fix anterior.

**Estratégia documentada (cara):** (c) upgrade Next ≥15.5.24 (AVIF em `BYPASS_TYPES` + loaders seguros) — Issue; (d) Cache Rule/observabilidade Cloudflare para `/_next/image` + runbook de purge — Issue; (e) healthcheck/probe sintético de chaves presas com alerta — Issue. **Não fazer:** patch local no Batcher, `unoptimized` global, upgrade do Next neste PR.

## Lições

- **Default de dependência vulnerável:** os masters AVIF num Next <15.5.24 significavam decodificar via libheif exatamente o caminho do advisory crítico GHSA-2xp9-vwfh-vxw4 (RCE não autenticada na Image Optimization API); a mitigação oficial é bypass (`BYPASS_TYPES`), não um remendo local.
- **Mitigação upstream é bypass, não patch local:** o patch `409772ec` (15.5.24) trata AVIF como tipo a não otimizar; patch no Batcher e `unoptimized` global foram descartados — o caminho certo é o upgrade registrado como débito/Issue.
- **O Batcher transforma hang transiente em outage permanente por chave:** a promise sem timeout em `this.pending` (`node_modules/next/dist/lib/batcher.js`) faz toda request futura da mesma cache key herdar a promise morta até restart do processo — o URL exato nunca respondia enquanto as outras larguras fluíam.
- **Guard de formato teria pegado:** um ban simples de `.avif` no `src/` e um check de `public/` teriam barrado a regressão no PR anterior — é exatamente a prevenção barata implementada agora, junto dos guards de dimensão/TTL.
- **Staging idêntico não reproduz race — observabilidade é a rede:** o mesmo SHA não reproduziu em staging, o hang não reproduziu local (glibc/musl, sequencial/4 concorrentes, 15 rodadas) e a detecção foi humana ~40 min depois do deploy; sem probe/alerta de `/_next/image`, o 524 do Cloudflare (~100–125s) é o único sinal e chega tarde.
