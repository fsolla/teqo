---
name: agent-pool
description: Opera o pool de agentes Cursor Cloud do Teqo (supervisor remoto stateless em GitHub Actions) — start/stop/pause/resume/status remotos, triage de workers falhos, pré-requisitos (secrets) e smoke test. Usar quando o usuário pedir para ligar/desligar/pausar o pool, ver status dos workers, "pool de agentes", "orquestrador", triagem de Issue que o pool mandou a blocked, ou configurar CURSOR_API_KEY.
---

# Agent pool — operação do supervisor remoto

O pool mantém até **5 Cursor Cloud Agents** (configurável, máx 8) rodando `work-issue` sobre Issues `ready` elegíveis para autonomia. O supervisor é o workflow **`.github/workflows/agent-pool.yml`** (tick stateless a cada 10 min + a cada merge em `stage` + sob dispatch) rodando `scripts/agent-pool.mjs` — nenhum processo local, laptop fechado não importa. Arquitetura, elegibilidade (`isAutonomousClaimable`), anti-race (claim coordenado pelo supervisor) e ciclo de vida: `docs/plans/agent-pool-orchestrator.md`.

**O pool NUNCA faz `pnpm agent:promote`** — promote `stage→main` continua humano.

## Pré-requisitos (uma vez)

1. **Repo secret `CURSOR_API_KEY`** (Settings → Secrets and variables → Actions) — chave de cursor.com/dashboard/api. Sem ela o tick live morre antes de spawnar (fail-closed).
2. Workflow mergeado em `main` — `schedule` e o trigger de merge em `stage` **só rodam da default branch**. Antes do promote, use dispatch na branch (`--ref`).
3. Fila com Issues `ready` (`pnpm agent:status`) e nenhum audit solitário em curso.
4. Validar o ambiente: `pnpm agent:pool -- doctor` (gh auth, repo variables, chave Cursor, tabela de modelos `/v1/models`).

## Operação remota (canal canônico = workflow_dispatch)

```bash
pnpm agent:pool -- start                # liga (default 5 slots)
pnpm agent:pool -- start -- --max-slots 3
pnpm agent:pool -- stop                 # para de spawnar; ativos drenam até o merge
pnpm agent:pool -- pause                # audit solitário / manutenção
pnpm agent:pool -- resume
pnpm agent:pool -- status               # leitura local (config, slots, fila, exclusões)
```

Os wrappers disparam `gh workflow run agent-pool.yml -f action=…`; acompanhe com `gh run list --workflow agent-pool.yml --limit 3` (o job summary de cada run é a superfície remota de status: slots, spawns, falhas, decisão do tick). Estado escalar vive em repo variables `POOL_*` (Settings → Variables); workers/Issues em voo são derivados — Issues `in-progress` com marcador `pool-worker` nos comentários.

## Ciclo de vida de uma Issue no pool

`ready` → (tick: claim coordenado, flip + marcador) → `in-progress` → worker spawnado com o `model:` da Issue (fallback `composer-2.5`) → PR `--base stage` com `Closes #N` → CI green → auto-merge → `done` (flip determinístico do CI) → tick arquiva o agente e repõe o slot.

- **Falha terminal** (run ERROR/CANCELLED/EXPIRED ou fim sem PR): tick comenta, move a Issue para `blocked` e arquiva o agente. **Triage humana**: ler o run em cursor.com/agents, decidir — re-`ready` manual se transitório (o circuit breaker recusa a 3ª tentativa automática), corrigir a spec se sistêmico.
- **Worker travado**: archive em cursor.com/agents → o próximo tick reconcilia como falha documentada.
- **Duplicata**: impossível em condições normais (alocador único + lock otimista + `agentId` idempotente); o tick cancela runs extras se alguém spawnar manualmente.
- **`needs:migration`/`serializes:[migrations]`**: o tick não spawna enquanto houver PR aberto tocando schema (`migration-lock`) — re-avalia a cada tick.
- **Audit solitário**: `pause` antes, `resume` depois (a skill `engineering-audit` lembra).

## Smoke remoto (aceite — rodar na primeira ativação)

1. 2 Issues `kind:chore` triviais, `ready`, sem `model:` → `start --max-slots 2` → 2 agents `pool-i<N>-…` em cursor.com/agents e as 2 Issues `in-progress` com comentário de claim. Zero duplicata. Modelo efetivo = `composer-2.5`.
2. 1 Issue `blocked` e 1 `needs:consent` plantadas na fila → permanecem intactas.
3. 1 Issue com `model: cursor-grok-4.5-high` → run criado com esse modelo (doctor lista os ids válidos).
4. (Opcional) par bipartido: Issue plan (`cursor-grok-4.5-high`) + Issue exec (`kimi-k3-low`, `depends` no plan) — o tick só spawna a exec quando o plan estiver `done`.
5. Workers abrem PRs na base canônica do pool; merge → slot reposto automaticamente no tick seguinte (≤10 min).
6. Fila drenada → `POOL_ENABLED=false` sozinho. `stop` → próximo tick sem spawns.
7. Tudo com o laptop desligado (start pelo browser/celular).

## Se algo quebrar

- `tick` vermelho no Actions: ler o log do job — gh sem `actions:write` (permissões do workflow), `CURSOR_API_KEY` ausente/errada, ou API da Cursor fora. O tick seguinte re-tenta; nada fica em estado intermediário perigoso (claim revertido em falha de spawn).
- "You’ve reached the limit" no spawn: arquivar agents antigos em cursor.com/agents (cap do plano: 8 simultâneos no Pro; o pool usa ≤5 para deixar margem a humanos).
