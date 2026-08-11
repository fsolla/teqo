# Impl: Container Postgres compartilhado é recriado por outro worktree — mata dev+e2e de todos em voo

Status: aprovado
Atualizado em: 2026-08-10
Issue: #605
Intenção: docs/plans/container-postgres-compartilhado-compose-replace.md
Appetite restante: herdado (~0,5 dia eng; um outcome verificável)

## Leitura da intenção

- **Outcome:** `pnpm db:start` com `teqo-postgres-1` saudável é no-op (não recria, não derruba conexões de outros worktrees); recriação legítima segue possível por comando explícito; nada de CI/produção muda.
- **O que NÃO negociar:** sem serialização/locks de agentes; sem tocar em containers de outros projetos; fix no **owner** do container (`db:start`), não na educação dos agentes.
- **O que reavaliar:** a pergunta em aberto da intenção — "por que o config_hash divergiu?" — foi **respondida com evidência** (ver abaixo): é o bind mount relativo `./docker/postgres/init`, único campo que difere entre worktrees. Isto descarta o fix alternativo "pinar o compose para não depender do workdir" como frágil; o fix no `db:start` cobre o mecanismo inteiro.

## Diagnóstico (verificado em 2026-08-10)

`docker-compose.yml` linha 27: `- ./docker/postgres/init:/docker-entrypoint-initdb.d:ro` — bind mount **relativo**, resolvido por compose contra o diretório do projeto (o root do worktree). Medido:

- `docker compose -p teqo config --hash postgres` → OPS37: `39e89956…`; B195: `cf3cb522…`; C101: `917e11bb…` — três worktrees, três hashes.
- `docker compose -p teqo config` diff OPS37×B195: **única** diferença é `source:` do bind mount (path absoluto do worktree).
- Container atual roda com o hash do OPS37 (`com.docker.compose.config-hash` label) — qualquer `db:start` de outro worktree → hash difere → compose faz `replace` → `terminating connection due to administrator command` para todos.

O bind mount só importa na **primeira** inicialização do volume (`01-create-test-db.sql` cria `teqo_test`); depois é letra morta — mas compose não sabe disso e o inclui no hash.

## Abordagem recomendada

```mermaid
flowchart LR
  A[pnpm db:start / worktree provisioning] --> B{container Up + healthy?}
  B -- sim --> C[no-op: nada a recriar]
  B -- não / --force-recreate --> D[compose -p teqo up -d --wait postgres]
  D --> E[container de pé, nenhuma conexão viva foi derrubada]
```

**Opções consideradas:** A | B | C
**Recomendação:** **A** — preflight "container saudável → skip do compose" no owner `db:start` (novo `scripts/db-start.mjs` + lib compartilhada usada também pelo provisioning do worktree). Porque: ataca exatamente o caso perigoso (recriar container **de pé** com conexões vivas); quando o container não está de pé (missing/exited), compose up é seguro e continua o único caminho; dá mensagem clara ao operador; cobre os dois call sites do compose (`db:start` e `dockerComposeUp` do `worktree.mjs`, que tem o MESMO risco de replace durante `pnpm worktree next`).
**Rejeitadas:**

- **B — "pinar o bind mount"** (ex.: path absoluto para o main repo): resolveria o hash, mas injeta path do host no compose commitado — quebra portabilidade (main repo pode morar em outro caminho/máquina) e o bind é read-only só usado no primeiro init; se o path sumir, o container sobe com init vazio em silêncio. Frágil demais para um problema de 1 linha no script.
- **C — só `--no-recreate` no compose up**: comportamento correto no skip, mas silencioso — quando o config muda de verdade (bump de imagem), o operador não descobre que o container está stale, e o caminho explícito fica menos óbvio; além disso não dá diagnóstico quando algo mais está errado (container unhealthy). O preflight de A é o `--no-recreate` com luzes.
- ~~Remover o bind mount e criar `teqo_test` via `docker exec createdb` pós-start~~: espalha o bootstrap, quebra a garantia "só no primeiro init do volume", e a mudança de compose toca todos os worktrees de uma vez.

### Componentes / mudanças

- **`scripts/lib/db-start.mjs`** (novo): núcleo compartilhado —
  - `shouldSkipStart({ running, health })` → puro: `true` quando `running && health ∈ {healthy, starting}` (skip; `starting` evita o race de substituir um container que um worktree vizinho acabou de criar).
  - `parsePostgresContainerHealth(jsonText)` → puro: `docker inspect --format '{{json .State}}'` → `{ running, health }` (`health` vazio = container antigo sem healthcheck → **não** skip: compose up migra de volta para a config atual).
  - `waitForHealthyPostgres({ timeoutMs, intervalMs })` → espera um container `starting` ficar `healthy` (bounded 60s/2s; timeouts injetáveis para os testes); `false` se sumir/virar `unhealthy`/estourar o tempo → cai no compose up.
  - `startSharedPostgres({ cwd, forceRecreate })` → async: inspeciona `teqo-postgres-1`; skip com mensagem quando `healthy` (ou espera o boot de um `starting`) e `!forceRecreate`; senão `docker compose -p teqo up -d [--force-recreate] --wait --wait-timeout 120 postgres` com `cwd` (a lib não assume o root — o provisioning passa o dir do worktree). Docker inacessível → lança (o CLI imprime remédio; o `worktree.mjs` já try/catch → fallback env).
- **`scripts/db-start.mjs`** (novo, CLI): `--force-recreate` (recriação explícita) e `--help`; args desconhecidos → usage + exit 2; cwd = `process.cwd()` (compose file do worktree atual); erro de docker → mensagem estilo `db-doctor` ("Docker looks unreachable — is Docker running?") + exit 1. Sem `--force-recreate`, container saudável → `[db] teqo-postgres-1 already up (healthy) — nothing to recreate.` exit 0.
- **`package.json`**: `"db:start": "node scripts/db-start.mjs"` (substitui o raw compose up). `db:stop`/`db:doctor` intactos.
- **`scripts/worktree.mjs`**: `dockerComposeUp` inlined — o `provision()` chama `await startSharedPostgres({ cwd: dir })` direto — mesmo preflight no provisioning (idempotência de `worktree next`); `SHARED_COMPOSE_PROJECT` órfão removido (agora const privada da lib).
- **`tests/unit/dbStart.unit.spec.ts`** (novo): `shouldSkipStart` (matrix running×health), `parsePostgresContainerHealth` (healthy/starting/unhealthy/sem healthcheck/Health null/malformado), e o wrapper `startSharedPostgres`/`waitForHealthyPostgres` com `vi.mock('node:child_process')` (skip não chama compose; container ausente → compose up com argv correto; `--force-recreate` bypassa; `starting` → espera → healthy; `starting` travado/unhealthy/sumiu → false) — seguindo o padrão de `worktree.unit.spec.ts` (importa direto de `scripts/lib/*.mjs`, `// @vitest-environment node`).
- **Docs:** `AGENTS.md` → bullet "Database & local development": `db:start` é idempotente (no-op com container saudável; `pnpm db:start --force-recreate` para recriação explícita). `docs/CHANGELOG-AGENTS.md` → uma entrada curta.
- **Migration:** nenhuma. **Access/Consent:** n/a. **UI:** n/a.

### Dados → forma (se aplicável)

n/a — sem dados novos; o contrato `StartedAt` inalterado é a métrica de aceite (verificação com `docker inspect`).

## Fases verificáveis

1. **Núcleo + wiring** — `scripts/lib/db-start.mjs` + `scripts/db-start.mjs` + `package.json` + delegação em `worktree.mjs`. Verificação: `pnpm db:start` com container saudável imprime o no-op e `docker inspect teqo-postgres-1 --format '{{.State.StartedAt}}'` fica **igual** antes/depois; `docker compose -p teqo config --hash postgres` do worktree == hash do container (estado atual já é esse).
2. **Unit tests** — `tests/unit/dbStart.unit.spec.ts` (17 casos: matrix pura + wrapper mockado); rodar via `pnpm test:unit` (ou o alvo unit).
3. **Gates** — `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm check:cycles`, unit/int. `--force-recreate` é verificado pela flag passando ao compose (execução live opcional, avisando o humano — recriar derruba sessões de outros worktrees por ~2s).

## Rabbit holes / Não escopo (engenharia)

- Não mexer em `docker-compose.yml` (mantém compat: qualquer worktree continua podendo rodar compose up cru — agora inofensivo para os outros? **não**: compose up cru de outro worktree ainda recria. O escopo é o owner (`db:start`/provisioning); compose up manual é caminho do operador, e o `--force-recreate`/docs o tornam explícito).
- Não tocar em `db:stop` (parada explícita é intenção do operador).
- Não serializar/lockar agentes (anti-goal da intenção).
- Race raro: container ausente e dois worktrees rodam `db:start` simultâneo → ambos sobem compose; o segundo pode recriar o primeiro (sem conexões vivas ainda — inofensivo). Documentado, não corrigido.

## Riscos e mitigação

- **Container `starting` de um peer**: o `startSharedPostgres` espera o boot ficar `healthy` (60s, polling 2s) em vez de recriar; se travou (nunca healthy), cai no compose up com `--wait-timeout 120` — falha alta, sem hang infinito. `--force-recreate`/`db:doctor` seguem como escape.
- **Container antigo sem healthcheck**: `health` vazio → não skip → compose up migra para a config atual (uma recria única, sem conexões? pode ter — caso raro e legítimo; o plano da intenção aceita recriação quando a config mudou de verdade).
- **`worktree next` com docker inacessível**: comportamento preservado (throw → try/catch → fallback env).
- **Knip/águeiro**: `scripts/db-start.mjs` é entry point (não exporta nada); `scripts/lib/db-start.mjs` tem consumidores reais (`db-start.mjs` + `worktree.mjs` + o spec) — nada órfão.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (no-op com saudável; recreate explícito; sem CI/prod; sem locks)
- [x] Invariantes AGENTS/engineering-standards (idempotência; sem path absoluto no compose; owner do container)
- [x] Testes de domínio previstos: unit das decisões puras + wrapper mockado (17 casos)
- [x] Verificação live: `StartedAt` inalterado após `pnpm db:start` repetido (inclusive de outro worktree com hash diferente)
