# Container Postgres compartilhado é recriado por outro worktree — mata dev+e2e de todos em voo

Status: rascunho
Atualizado em: 2026-08-10
Issue: #605
Priority: P2
Model: composer-2.5
Appetite: ~0,5 dia eng; um outcome verificável

## Intenção

O container `teqo-postgres-1` é compartilhado por todos os worktrees (compose project pinado `-p teqo`, um único Postgres em 5432 com todos os bancos `teqo_*`). Qualquer `docker compose -p teqo up` executado a partir de **qualquer** worktree recria o container quando o `config_hash` do compose difere do que está rodando — o Docker loga `com.docker.compose.replace=postgres-1` e o Postgres derruba **todas** as conexões vivas: dev servers e runs e2e de todos os worktrees em voo morrem com `terminating connection due to administrator command` (não é failover, é kill).

Medido na sessão OPS29 (2026-08-10): duas runs e2e completas mortas no meio por um worktree vizinho (B195) rodando compose up; 17+ testes falharam com `ERR_CONNECTION_REFUSED` e `Failed query ... terminating connection`. `db:doctor`/preflight não pegam: o restart acontece **durante** a run, não no boot.

## Persona e fluxo

- **Persona / contexto:** qualquer agente (pool ou humano) rodando `pnpm test:e2e` ou `pnpm dev` num worktree enquanto outro worktree executa `pnpm db:start`/`docker compose up`.
- **Job principal:** que e2e/dev de um worktree sobrevivam à atividade de compose de outro — o container não deve ser recriado sem necessidade, e recriação nunca deve acontecer com conexões vivas.
- **Fluxo desejado:** `pnpm db:start` com o container já de pé e saudável → no-op (sem recreate); mudança real de config (ex.: bump de imagem) → recria, mas isso é decisão explícita, não efeito colateral de um worktree qualquer.
- **Anti-goals:** não serializar o trabalho dos agentes; não exigir locks manuais; não tocar no `db:start` do container de outro projeto (nextcloud etc.).

## Objetivo e aceite

- Rodar `pnpm db:start` (ou o compose up equivalente) com `teqo-postgres-1` já saudável **não** recria o container nem derruba conexões — verificável: `docker inspect` mostra o mesmo `StartedAt` após o comando.
- Uma run e2e local não morre com `terminating connection due to administrator command` por causa de um worktree vizinho.
- O caminho de recriação legítima (config do compose realmente mudou) continua possível por comando explícito.
- Nenhuma mudança no `db:start`/`db:doctor` que afete produção ou o pipeline CI.

## Direção no codebase (hipótese)

- **Área provável:** `docker-compose.yml` (anotar/derivar por que o config_hash difere entre worktrees — ex.: paths absolutos ou campos de versão no compose), `scripts/db-*.mjs`/`scripts/lib/*` (onde `db:start` vive), e/ou um `--no-recreate`/preflight "já está saudável" no `db:start`.
- **Precedente a olhar:** `db:doctor` (já diagnostica containers crash-looping e PGDATA compartilhado), `guard-dev-db` (preflight do dev), `scripts/lib/worktree.mjs` (slot/porta/bancos — o compose file é o mesmo para todos os worktrees? por que o config_hash divergiu?).
- **Risco de acoplamento:** o compose é usado por todos os worktrees; qualquer mudança de comportamento do `db:start` precisa ser idempotente e não quebrar o provisionamento `pnpm worktree next`.

## Dependências

- Nenhuma. (A família OPS28-30 endereça flaky e2e por seed/compile; este item é o mecanismo de infra paralela — ortogonal.)

## Fora de escopo

- Serializar/sincronizar runs e2e entre worktrees (estratégia de escalonamento, não de correção).
- Mexer no `docker-compose.yml` de outros projetos no mesmo host.
- CI/produção — o problema é exclusivo do ambiente local de worktrees paralelos.

## Rabbit holes

- **"Culpar o worktree vizinho"**: o B195 não fez nada errado — `docker compose up` é o comando canônico de start; o defeito é o `db:start`/compose permitir recreate quando não é necessário. **Corte:** fix no owner do container (db:start), não na educação dos agentes.
- **"Lock distribuído de Postgres"**: sem locks manuais — o container deve ser imutável enquanto saudável; locks só encobririam o recreate.

## Questões em aberto

- **Por que o config_hash divergiu entre worktrees?** (paths? version fields? `com.docker.compose.config_hash` difere por workdir?) — descobrir primeiro, pois pode haver fix mais simples (ex.: pinar o compose para não depender do workdir).
- **Recriação legítima**: como o operador força recreate quando a imagem/config muda de verdade? (ex.: `--force-recreate` explícito ou remover o container antes).

## Referências

- Sessão OPS29 (2026-08-10): `docker events` mostrando `container ... (com.docker.compose.project=teqo, com.docker.compose.project.working_dir=/home/fsolla/.cursor/worktrees/teqo/B195-.../docker-compose.yml, com.docker.compose.replace=postgres-1, ...)` no meio de duas runs e2e; Postgres `StartedAt` recriado às 12:06; 17+ testes falhando com `terminating connection due to administrator command` / `ERR_CONNECTION_REFUSED`.
- `AGENTS.md` → "Database & local development": `db:start`/`db:stop` pinam `-p teqo` "para SEMPRE alvo daquele UM container mesmo de um worktree" — a promessa vale para o alvo, não para o recreate.
