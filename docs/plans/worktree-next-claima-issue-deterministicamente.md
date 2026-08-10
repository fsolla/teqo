# Worktree next claima deterministicamente a Issue e abre o opencode com /work-issue já informado

Status: rascunho
Atualizado em: 2026-08-10
Issue: #595
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (CLI/shell, sem superfície de produto)
Canvas UI: N/A — sem UI
Appetite: ~1 dia; um outcome verificável (de `worktree next` ao TUI já na Issue certa, sem claim do agente)
Responsável: —

## Intenção

Todo agente que executa `/work-issue` gasta o primeiro passo com `pnpm agent:claim` — e o claim **já é um script determinístico**. Em vez de deixar o agente fazê-lo (e poder errar — #582 nasceu de claim/branch divergentes), o fluxo faz o claim **antes**, como primeiro passo do `worktree next`: falhou (fila vazia, race, `--issue` inválido) → avisa o humano e para; sucesso → cria o worktree da Issue **já claimada**, troca o shell para lá e abre o opencode com `/work-issue` sabendo qual Issue é — sem nenhum re-claim nem verificação.

## Persona e fluxo

- **Persona / contexto:** o humano no terminal interativo; uma sessão de trabalho por comando.
- **Job principal:** do comando ao TUI do opencode já em execução na Issue certa, sem passo manual.
- **Fluxo desejado:**
  1. `worktree next [--issue N]` → **claim determinístico** (mesma fila/ordem do `agent:claim`, mesmo lock otimista);
  2. falhou → imprime o motivo (fila vazia / Issue não claimável / race) e **para** — nada de worktree órfão;
  3. sucesso → cria (ou reutiliza) o worktree da Issue claimada, provisiona o ambiente, imprime o brief do claim;
  4. `cd` para o worktree e `launch opencode …` com `/work-issue` **já informando a Issue** (ex.: comando com o número, ou prompt com o brief) — o agente nunca roda `agent:claim`.
- **Anti-goals:** não virar um executor de Issues em lote; não desfazer claims (reverter `in-progress` → `ready` é outra entrega); não mexer no claim coordenado do pool.

## Objetivo e aceite

- `worktree next` claima **antes** de criar o worktree; claim falhou → motivo no stdout e saída sem worktree.
- A Issue do worktree é exatamente a claimada (mesmo pick da fila; `--issue N` repassado ao claim).
- O launch comunica a Issue ao agente de forma determinística, e o texto de saída avisa explicitamente "já claimada — não rodar `agent:claim`".
- Reutilizar worktree já existente da mesma Issue continua idempotente; abrir de novo uma Issue já claimada não re-claima (ver questão em aberto).
- `--stay` continua suprimindo `cd` + launch (o claim ainda acontece). O comando `/worktree` do opencode roda o mesmo script (claim incluso); a única diferença de superfície segue sendo a diretiva `launch` (só no terminal interativo).
- Fluxo ponta a ponta dependente de OPS32 (work-issue aceita Issue claimada sem re-claim).

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/worktree.mjs` (`cmdNext`: claim no primeiro passo — reutilizar/invocar a lógica de `scripts/agent-claim.mjs`, capturar o brief e o número da Issue claimada antes do pick/branch; a linha "Issue NÃO claimada — claim continua sendo `pnpm agent:claim`" sai), `scripts/lib/worktree.mjs` (diretiva `launch` ganha a Issue no prompt), `.agents/shell/worktree.sh` + `.opencode/commands/worktree.md` (textos), `AGENTS.md` / `docs/CHANGELOG-AGENTS.md`.
- **Precedente a olhar:** `scripts/lib/agent-pool-prompt.mjs` — o pool já entrega a Issue claimada ao agente com `buildPoolWorkerPrompt` (número, título, path do plano via `extractPlanPath`): é o molde do conteúdo do launch.
- **Risco de acoplamento:** mesmo arquivo de constantes do OPS31 (`serializes: [worktree-cli]`); claim do pool usa o mesmo lock otimista — um claim humano não pode desestabilizar o do pool (e vice-versa), o lock já cobre.

## Dependências

- **OPS32** (work-issue no paradigma claimado) — direção proposital: a skill é a **receptora** do contrato ("a Issue chega claimada"), este item é o **produtor** do claim automático. Produtor antes do receptor quebra: com a skill antiga, o Passo 1 hardcoded `pnpm agent:claim` rodaria no launch e pegaria o topo da fila (a claimada virou `in-progress` e saiu) → Issue errada. Receptor primeiro é seguro: na transição o produtor é o humano (`pnpm agent:claim` standalone), coberto pelo fallback de OPS32. (Alternativa sem janela: fundir 32+33 — não escolhida.)

## Fora de escopo

- Reverter claim / devolver Issue à fila (ex.: humano decide não trabalhar a Issue) — outra entrega.
- Claim do pool (supervisor, worker UUID) — intacto.
- O conteúdo da skill `/work-issue` em si (OPS32 define; aqui é só entregar o contexto).

## Rabbit holes de produto

- **"Já que claima, validar o worktree, o env, o modelo, o plano…"** — o script deve fazer o claim e o que já faz (worktree + provisionamento); toda validação extra que o contexto já garante é o overhead que OPS32 está removendo do outro lado.
- **"Tratar falha pós-claim"** (ex.: `git worktree add` quebra depois do claim): o claim não deve ser desfeito automaticamente — reportar e deixar o humano decidir (desfazer claim é outra entrega).

## Questões em aberto (produto)

- **Reabrir a sessão de uma Issue já claimada (worktree existe)?** **Decisão (gate 2026-08-10):** detecta e segue ao launch **sem re-claim** (idempotente, "já claimada — reabrindo") — reabrir sessão é o caso comum e não pode exigir cerimônia.
- **Como o launch entrega a Issue ao agente?** **Decisão (gate 2026-08-10):** comando com argumento (`/work-issue --issue <N>`) — a skill lê o resto do GitHub; fonte única de verdade é a Issue, sem duplicar brief.
- **`worktree next --issue <N>` deve existir?** **Decisão (gate 2026-08-10):** sim — claim direcionado, mesmo contrato do `agent:claim`.

## Referências

- GitHub Issue #595 (depends OPS32)
- Canvas UI (gate): N/A
- `scripts/agent-claim.mjs` (lógica do claim a reutilizar), `scripts/lib/agent-pool-prompt.mjs` (molde do contexto ao agente)
- `docs/plans/worktree-go-abre-opencode-com-presets.md` (OPS26 — mecanismo do launch)
