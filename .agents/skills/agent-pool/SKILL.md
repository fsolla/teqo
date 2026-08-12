---
name: agent-pool
description: >-
  Opera e monitora o pool de agentes Cursor Cloud do Teqo (supervisor remoto
  determinístico em GitHub Actions). Ao invocar: SEMPRE status + fila elegível
  primeiro; NUNCA liga o pool sem confirmação explícita do usuário. Usar quando
  o usuário pedir /agent-pool, ligar/desligar/pausar o pool, ver status dos
  workers, "pool de agentes", orquestrador, triage de Issue que o pool mandou
  a blocked, ou configurar CURSOR_API_KEY.
---

# Agent pool — operação do supervisor remoto

O pool mantém até **5 Cursor Cloud Agents** (configurável, máx 12) rodando `agent-work-issue` sobre Issues `ready` elegíveis para autonomia. O supervisor é **determinístico** (não é um agente): workflow **`.github/workflows/agent-pool.yml`** (tick stateless a cada 10 min + a cada merge em `main` + sob dispatch) rodando `scripts/agent-pool.mjs`. Arquitetura e elegibilidade: `docs/plans/agent-pool-orchestrator.md`.

**O pool NUNCA deploya** — deploy gated fica em `ci.yml` após merge em `main`.

**Esta skill não é “só start”.** O caminho feliz ao invocar é **inspecionar → (opcional) ligar com confirmação → monitorar sob demanda**. O pool não precisa ficar ligado o tempo todo: ligue quando for drenar a fila; `stop` ou auto-stop ao esvaziar.

## Fluxo obrigatório ao invocar (não pule)

**Nunca** rode `pnpm agent:pool -- start` (nem `gh workflow run … action=start`) no primeiro passo. O default é só leitura.

```
- [ ] 1. Pré-check leve: `pnpm agent:pool -- doctor` se for a 1ª vez na sessão / suspeita de secret; senão pode ir direto ao status
- [ ] 2. `pnpm agent:pool -- status` — config (ligado/pausado/maxSlots), slots ocupados, fila elegível, exclusões
- [ ] 3. Emitir o briefing abaixo no chat (pt-BR)
- [ ] 4. Ramificar:
        - pool DESLIGADO → perguntar se deve ligar (confirmação explícita); só então `start`
        - pool LIGADO (ou pausado) → NÃO perguntar start; ficar em modo monitoramento
- [ ] 5. Se o usuário confirmou start → `pnpm agent:pool -- start` (respeitar `--max-slots` se pediu) e re-emitir status após o dispatch
- [ ] 6. Monitoramento (só enquanto o usuário quiser acompanhar nesta conversa): a cada ~2–3 min, ou quando pedir “update”, re-rodar `status` e reportar o delta
```

### Briefing obrigatório (passo 3)

Apresente, nesta ordem:

1. **Estado do pool** — `desligado` | `ligado` | `pausado`; `maxSlots`; `startedAt`/`startedBy` se houver; slots `ocupados/max`.
2. **Workers ativos** (se houver) — Issue #N, URL do agente, classificação do tick (ocupado / auto-merge / …).
3. **Fila elegível** (`isAutonomousClaimable`, mesma ordem do claim) — lista completa ou as primeiras ~15 se longa.
4. **Próximas N em paralelo** — destaque as primeiras **`maxSlots`** (default **5**) entradas da fila elegível: são as que o próximo tick claimaria/spawnaria ao ligar (ou no tick seguinte se já ligado com gap). Inclua `#`, id, `model:`, título.
5. **Exclusões relevantes** — `needs:consent` / `blocked` / deps / `migration-busy` (não precisam da lista inteira se for barulho; cite as que o humano costuma achar “por que não entrou”).

### Confirmação de start (pool desligado)

Pergunte de forma explícita, por exemplo:

> Pool desligado. Fila elegível: K issues; ao ligar com maxSlots=M as próximas M seriam: #… . Ligar agora?

- **Só** dispare `start` após resposta afirmativa clara (“sim”, “liga”, “start”, “pode ligar”, …).
- Se o usuário só queria ver a fila → pare no briefing; não ligue.
- Se pedir `maxSlots` diferente do default, use `pnpm agent:pool -- start -- --max-slots N`.

### Monitoramento (pool já ligado)

- Não reinicie o pool; não faça `stop` sem pedido.
- Reporte periódico **nesta sessão** (poll de `status`), não um agente supervisor 24/7 e não um daemon novo — o tick GHA já reconcilia sozinho.
- Em cada update: slots, o que mudou (novos claims, merges/`done`, falhas→`blocked`), fila restante, próximas N se ainda houver gap.
- Pare de polir quando o usuário disser para parar, a fila drenar (`POOL_ENABLED=false` auto-stop), ou a conversa encerrar. Lembre que **desligar o monitoramento ≠ `stop` no pool**; pergunte se quer `stop` se a intenção for “não quero mais workers”.

### Pedidos explícitos fora do fluxo default

| Pedido do usuário | Ação |
| ----------------- | ---- |
| “só status” / “fila” | Passos 2–3; sem pergunta de start |
| “liga” / “start” (já com intenção clara na mesma mensagem) | Briefing (2–3) + start sem segunda pergunta se a mensagem já for ordem inequívoca **e** o briefing não revelar bloqueio grave (ex.: doctor falhou, zero elegíveis) — se zero elegíveis, avise e confirme mesmo assim |
| “para” / “stop” | `pnpm agent:pool -- stop` |
| “pausa” / audit | `pause`; lembrar `resume` depois |
| triage de Issue `blocked` pelo pool | Ler comentários `pool-worker` + run em cursor.com/agents; sugerir re-`ready` ou corrigir spec |

## Pré-requisitos (uma vez)

1. **Repo secret `CURSOR_API_KEY`** (Settings → Secrets and variables → Actions) — chave de cursor.com/dashboard/api. Sem ela o tick live morre antes de spawnar (fail-closed).
2. Workflow mergeado em `main` — `schedule` e o trigger de merge em `main` **só rodam da default branch**. Antes do promote, use dispatch na branch (`--ref`).
3. Fila com Issues `ready` elegíveis (`pnpm agent:pool -- status` / `pnpm agent:status`) e nenhum audit solitário em curso (se audit: `pause`).
4. Validar o ambiente: `pnpm agent:pool -- doctor` (gh auth, repo variables, chave Cursor, tabela de modelos `/v1/models`).

## Operação remota (canal canônico = workflow_dispatch)

```bash
pnpm agent:pool -- start                # liga (default 5 slots) — só após confirmação no fluxo acima
pnpm agent:pool -- start -- --max-slots 3
pnpm agent:pool -- stop                 # para de spawnar; ativos drenam até o merge
pnpm agent:pool -- pause                # audit solitário / manutenção
pnpm agent:pool -- resume
pnpm agent:pool -- status               # leitura local (config, slots, fila, exclusões)
```

Os wrappers disparam `gh workflow run agent-pool.yml -f action=…`; acompanhe com `gh run list --workflow agent-pool.yml --limit 3` (o job summary de cada run é a superfície remota de status: slots, spawns, falhas, decisão do tick). Estado escalar vive em repo variables `POOL_*` (Settings → Variables); workers/Issues em voo são derivados — Issues `in-progress` com marcador `pool-worker` nos comentários.

## Ciclo de vida de uma Issue no pool

`ready` → (tick: claim coordenado, flip + marcador) → `in-progress` → worker spawnado com o `model:` da Issue (fallback `composer-2.5` + **`fast=false`** — omitir `fast` na API vira `composer-2.5-fast` no usage) → PR `--base main` com `Closes #N` → CI green → auto-merge → `done`+`in-prod` (flip determinístico do CI) → tick arquiva o agente e repõe o slot.

Issues nascidas de `plan-issue` com `--plan` **não** entram como `ready`: ficam `blocked` até o plano de intenção estar em `main` e promote dual (OPS17 `pnpm agent:ready` + OPS18 Action no merge com `Related #N`). O tick não promove — só consome `ready`.

- **Falha terminal** (run ERROR/CANCELLED/EXPIRED ou fim sem PR): tick comenta, move a Issue para `blocked` e arquiva o agente. **Triage humana**: ler o run em cursor.com/agents, decidir — re-`ready` manual se transitório (o circuit breaker recusa a 3ª tentativa automática), corrigir a spec se sistêmico.
- **Worker travado**: archive em cursor.com/agents → o próximo tick reconcilia como falha documentada.
- **Duplicata**: impossível em condições normais (alocador único + lock otimista + `agentId` idempotente); o tick cancela runs extras se alguém spawnar manualmente.
- **`needs:migration`/`serializes:[migrations]`**: o tick não spawna enquanto houver PR aberto tocando schema (predicado `countOpenSchemaPrs` em `agent-pool-github.mjs`) — re-avalia a cada tick.
- **Audit solitário**: `pause` antes, `resume` depois (a skill `engineering-audit` lembra).

## Smoke remoto (aceite — rodar na primeira ativação)

1. 2 Issues `kind:chore` triviais, `ready`, sem `model:` → `start --max-slots 2` → 2 agents `pool-i<N>-…` em cursor.com/agents e as 2 Issues `in-progress` com comentário de claim. Zero duplicata. Modelo efetivo = `composer-2.5` **sem** `-fast` (`originalModelName` / usage dashboard = `composer-2.5`, não `composer-2.5-fast`).
2. 1 Issue `blocked` e 1 `needs:consent` plantadas na fila → permanecem intactas.
3. 1 Issue com `model: cursor-grok-4.5-high` → run criado com esse modelo (doctor lista os ids válidos).
4. (Opcional) par bipartido: Issue plan (`cursor-grok-4.5-high`) + Issue exec (`kimi-k3-low`, `depends` no plan) — o tick só spawna a exec quando o plan estiver `done`.
5. Workers abrem PRs na base canônica do pool (`main`); merge → slot reposto no tick seguinte (≤10 min).
6. Fila drenada → `POOL_ENABLED=false` sozinho. `stop` → próximo tick sem spawns.
7. Tudo com o laptop desligado (start pelo browser/celular).

## Se algo quebrar

- `tick` vermelho no Actions: ler o log do job — gh sem `actions:write` (permissões do workflow), `CURSOR_API_KEY` ausente/errada, ou API da Cursor fora. O tick seguinte re-tenta; nada fica em estado intermediário perigoso (claim revertido em falha de spawn).
- "You’ve reached the limit" no spawn: arquivar agents antigos em cursor.com/agents (cap do plano Cursor; o pool hard-clamp é 12 e o default é 5 — margem a humanos e a outros agents).
