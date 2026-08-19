# Impl: OPS67 — Forgejo: retry com backoff nos fetchs do forgejo-api (fetch failed transitório mata o run do safety net)

Status: aprovado
Atualizado em: 2026-08-19
Issue: #73
Intenção: body sem plano linkado — o título + frontmatter são a spec. Sem plano de intenção separado.
Appetite restante: herdado do tamanho da Issue (P3, mudança pontual de infra/scripts).

## Leitura da intenção

- **Outcome:** os fetchs do cliente Forgejo API (`scripts/lib/forgejo-api.mjs`) retentam com backoff as falhas transitórias — um `fetch failed` de rede não mata mais o run do safety net (`agent-pr-ready-automerge.yml`) nem nenhum outro consumidor do cliente.
- **O que NÃO negociar:** nenhum contrato de produto aqui; os invariantes são os testes existentes do cliente (403 → throw com corpo da API, shape normalizado gh-flavored, fail-closed sem token). O retry **não pode mudar o contrato de erro visível dos callers**: falha permanente continua `exit 1` com a mesma mensagem (ex.: flip da `forgejo-issue-transition.mjs` continua vermelhando — OPS61).
- **O que reavaliar:** o escopo do "transitório". O título cobre o fetch reject de rede (`fetch failed`); a decisão de engenharia é o que mais retentar (5xx? 429?) e com que política.

## Decisões de engenharia

### D1 — Onde vive o retry

**Opções:** A) no `request()` de `scripts/lib/forgejo-api.mjs` (choke point único — 19 call sites: safety net, claim/ready/status, issue-transition, branch-protection, pool, worktree); B) wrapper só no `forgejo-pr-automerge.mjs`; C) helper genérico `withRetry` novo + aplicar nos call sites.

**Recomendação: A** — o cliente é o deep module certo do transporte Forgejo (zero-dep, plain Node, roda no Actions sem pnpm); um único ponto dá resiliência a todos os runs de uma vez. **Rejeitadas:** C porque criaria pass-through raso e tocaria 19 call sites (DRY de conhecimento violado — "edit the owner, don't twin"); B porque deixa claim/status/pool vulneráveis ao mesmo flake e o safety net voltaria a morrer por outro call site.

### D2 — O que retentar (classe de falha)

**Opções:** A) só falha de rede (fetch reject: `fetch failed`, ECONNRESET/ETIMEDOUT/DNS) em todos os métodos; B) A + 5xx (502/503/504) **apenas em GET**; C) A + 5xx em qualquer método (padrão Octokit).

**Recomendação: B** — o sintoma do título é exatamente o fetch reject; o 5xx-em-GET custa 3 linhas e protege o caminho dominante do safety net: o poll do `waitForChecks` (GET PR + GET statuses a cada 15 s por até 45 min) — um 502 do Cloudflare no meio da espera é a mesma classe de morte de run. **Rejeitadas:** C porque retentar POST 5xx pode duplicar efeitos colaterais (createIssue duplicado no `agent-register`, comentário duplicado, merge re-enviado em corrida — o `autoMerge` já tem guard de re-read, mas o resto não) sem necessidade observada. 429 não entra (não observado; gatilho de revisitação). AbortError não existe no cliente hoje (sem AbortSignal) — se um dia entrar, não retentar.

### D3 — Política de backoff

**Opções:** A) exponential: base 300 ms, fator 2, jitter ±20%, `retries: 3` (4 tentativas, pior caso ~2,1 s); B) delay fixo 1 s × 3; C) retry imediato.

**Recomendação: A** — padrão de livro; o delay total é irrelevante frente ao budget de 55 min do workflow. **Rejeitadas:** B e C (sem espalhamento; rajada curta de blips derrubaria tentativas consecutivas).

Configuração: opções flat no `createApi` (`retries`, `backoffMs`, `jitter`, `sleepImpl`) espelhando o `fetchImpl` injetável que já existe — defaults prod preservam o comportamento sem nenhum caller mudar; `sleepImpl` + `jitter: false` + `backoffMs` pequeno dão determinismo aos testes (zero espera real).

### D4 — Visibilidade

`console.warn` pt-BR no retry, estilo das mensagens do lib (`Sem token…`): `[forgejo-api] GET <path> falhou (tentativa 1/4): <motivo> — retry em <ms>ms`. O log do run do safety net fica diagnóstico; sem plumbing novo de logger.

## Componentes / mudanças

- **`request()`** (`scripts/lib/forgejo-api.mjs`): loop de tentativas em volta do `fetch`; checagem de `response.status` **antes** de `response.text()` (necessário para decidir 5xx-GET sem consumir o body); `sleepImpl` default `setTimeout`. Sem migration, access, UI, DB.
- **`tests/unit/forgejoApi.unit.spec.ts`**: 12 specs novas (após /simplify) — rede GET/POST→sucesso, body-drop em GET retenta + em escrita fail-closed, rede persistente→throw após `retries+1` calls, `retries: 0`, 4xx não retenta, 5xx GET retenta/exaure, 5xx POST não retenta, backoff cresce (`sleepImpl` spy: [base, base×2] com jitter off), jitter ±20% com `Math.random` pinado. Spec 403 existente ganha pin de 1 fetch por invocação.
- **`docs/changelog/2026-08-19-ops67.md`** + `pnpm changelog:build`.
- **Docs:** conferir `docs/AGENT-OPS.md` / `.agents/rules/agent-pr-workflow.mdc` por menção ao cliente sem retry (toque só se houver drift real).

## Fases verificáveis

1. **Cliente + specs** — `forgejo-api.mjs` + specs unit novas; `pnpm test:unit` (arquivo), lint, format, typecheck, knip, cycles.
2. **Changelog + docs** — entrada `ops67`, build do agregado, retoque de doc se houver drift.
3. **PR → CI** — `scripts/` conta como produção no `.dockerignore`, então o CI do PR roda a suíte completa; merge → deploy na janela.

## Rabbit holes / Não escopo

- Retry em outros fetchs (`wpArticles`, `seed-posts`, `recover-media`, `check-push-chain`): domínios diferentes, políticas próprias — não tocar.
- Retry 429 / retry de POST 5xx: não observados — revisitar só se aparecerem.
- AbortSignal no cliente: não existe hoje; não introduzir.
- Timeout 30 min do `waitForChecks` vs 55 min do job (débito anotado no OPS62): não escopo.

## Riscos e mitigação

- Retry adiciona ~2 s no pior caso antes do erro real: irrelevante; o erro final é o mesmo (exit 1).
- Duplicação de POST quando a conexão cai no meio (server aplicou, resposta não voltou): residual padrão de toda SDK HTTP (Octokit idem); os endpoints de escrita do cliente são idempotentes na prática (labels/comentário) ou têm guard de re-read (`autoMerge`); `createIssue` é o único sensitivo e o risco é residual — aceito.
- Testes lentos: impossível — `sleepImpl` injetado e backoff configurável.

## Aceite de engenharia

- [x] Aceite do título mantido: fetch transitório não mata mais run de nenhum consumidor do cliente
- [x] Invariantes: zero-dep mantido (stdlib), contrato de erro dos callers preservado, mensagens pt-BR
- [x] Testes unit cobrindo as 4 classes (rede / 4xx / 5xx-GET / 5xx-POST) + crescimento do backoff
