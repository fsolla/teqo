# OPS119 — worktree plan: abrir sem auto-enviar o `/plan-issue` (mensagem opcional na linha)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1066
Priority: P2
Impeccable: A — N/A (CLI/shell, sem superfície de produto)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; mudança de comportamento do launch + testes + textos
Responsável: —

## Intenção

Desde a OPS110 o launch do terminal delega ao `scripts/agent-session.mjs` e o driver destacado **auto-submete** `/plan-issue` na sessão compartilhada. Isso veio do OPS31 (Issue #593), que escolheu auto-envio por simetria com o `next`. Na prática o planejamento quase sempre quer contexto na primeira mensagem — e hoje ele não cabe: abrir já enviado engole a chance de escrever o pedido. Queremos que `worktree plan` (sem argumento) abra a sessão **sem mensagem** (o humano digita `/plan-issue`), e que `worktree plan "<mensagem>"` continue abrindo já enviado com `/plan-issue <mensagem>` — o texto vira também o rótulo do bag/branch, espelhando o `fix`. Isto reverte parte do OPS31 de propósito, com evidência de uso.

## Persona e fluxo

- **Persona / contexto:** o humano (dono do repo) no terminal, abrindo um worktree para planejar em `/plan-issue`, com o contexto da ideia na cabeça.
- **Job principal:** abrir o worktree de planejamento e conseguir descrever o que quer antes de a skill rodar.
- **Fluxo desejado:**
  1. `worktree plan` → cria o worktree, provisiona o ambiente, `cd` e abre a sessão **sem nenhuma mensagem enviada**; o humano digita `/plan-issue` com o contexto que quiser.
  2. `worktree plan "revisa o gate do designer"` → mesma abertura, mas o driver auto-submete `/plan-issue revisa o gate do designer`; o texto também batiza o branch (`plans/plan-issue-revisa-o-gate-do-designer`).
- **Anti-goals de produto:** não virar mecanismo de prefill-draft do opencode; não mudar `next`/`new`/`fix`, `--stay` nem o comando `/worktree`.

## Objetivo e aceite

- `worktree plan` sem argumento abre a sessão persistente **sem driver** (nenhuma mensagem auto-submetida) — mesmo contrato observável do `new`.
- `worktree plan "<mensagem>"` auto-submete `/plan-issue <mensagem>` (uma única mensagem) e usa a mesma mensagem como bag do branch — simétrico ao `fix <bag>`.
- `next` continua com `/work-issue --issue <N>`; `new` continua driverless; `fix <bag>` continua com `/bug-fix <bag>`; `--stay` e o comando `/worktree` do opencode ficam intactos.
- A mensagem passa pela mesma sanitização do `fix` e um bag vazio não gera driver.

## Dados (intenção)

- **Vou apresentar dados?** Não — mudança de comportamento de CLI/shell, sem superfície de dados.
- **Decisões desbloqueadas:** o humano decide o texto de abertura do planejamento; o executor confere bag, branch e prompt num só lugar (como no `fix`).
- **Forma:** _adiada ao plano de implementação_.

## Dados da decisão (literais)

- **`SESSION_COMMAND_BY_PURPOSE`** (`scripts/lib/agent-session.mjs:169-174`): `plan: 'plan-issue'` permanece como nome da skill; o que muda é **quando** a invocação existe (abaixo).
- **`purposeInvocation`** (`scripts/lib/agent-session.mjs:184-199`): ganha o ramo do `plan` — sem argumento → `null` (sessão sem driver, como `new`); com argumento → `{ command: 'plan-issue', arguments: <sanitized> }`, com a **mesma** sanitização do `fix` (`:195`, `replace(/["\\]/g, '')` + `trim`).
- **`opencodeLaunchDirective`** (`scripts/lib/worktree.mjs:202-232`): a emissão de `--argument="<bag>"` deixa de ser só do `fix` (`:227-230`) e passa a valer para `fix` **e** `plan` (condição `purpose === 'fix' || purpose === 'plan'`).
- **`cmdPlan`** (`scripts/worktree.mjs:755-764`): passa `argument: bag` ao `cmdNamespaceBranch`, como o `cmdFix` já faz (`:810`). O runner (`:675-743`, print em `:740`) e o `driverArgs` (`:287-313`, apêndice só se `arguments` for truthy, `:311`) **não mudam**.
- **Posicional intacto:** `plan` segue lendo só `positional[1]` (`scripts/worktree.mjs:1038`) e o bag continua virando slug via `planBranchName` (`scripts/lib/worktree.mjs:277-278`) — agora acumulando a função de mensagem, como o `fix`.
- **Testes a repin:** `tests/unit/agentSession.unit.spec.ts:218-224` (plan sem msg → `null`; plan com msg → `{ command:'plan-issue', arguments:'<msg>' }`); `tests/unit/worktree.unit.spec.ts:190-209` (diretiva do plan sem arg inalterada) e `:255-266` (hoje "argument é só do fix" → passa a: `plan` carrega `--argument`, `new` segue ignorando).
- **Textos a atualizar:** uso do `plan` em `scripts/worktree.mjs:980-992`, `.agents/shell/worktree.sh:9-31,43-49,102-118`, `.agents/skills/worktree-next-issue/SKILL.md:23,30,34`, parágrafo de worktrees do `AGENTS.md` e uma entrada em `docs/changelog/`.
- **Supersede:** `docs/plans/worktree-plan-abre-opencode-com-plan-issue.md` (OPS31/#593) — auto-envio deixa de ser o default sem argumento; re-flagar `~/Code/propositions/opencode/prefill-prompt-sem-submit.md`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/agent-session.mjs` (mapa + `purposeInvocation`), `scripts/lib/worktree.mjs` (diretiva + `cmdPlan`) e os textos em `scripts/worktree.mjs`/`.agents/shell/worktree.sh`/`.agents/skills/worktree-next-issue/SKILL.md`.
- **Precedente a olhar:** o `fix` — o caminho bag→`--argument`→driver já existe e é o espelho exato do que o `plan` passa a fazer; OPS110 (delegação das sessões).
- **Risco de acoplamento:** abrir sem mensagem é a mesma sessão endereçável da OPS110, apenas sem `driverPid`; não tocar em `kill`/`attach` (encerram a sessão driverless normalmente).

## Dependências

- **Nenhuma dura.** O opencode instalado (1.18.31) **não tem** prefill-sem-submit (`--prompt` auto-envia; não há flag de draft), por isso o fallback "abrir sem mensagem"; a proposição upstream é dependência futura, não bloqueio.

## Fora de escopo

- Implementar prefill-sem-submit no opencode (upstream; anotar na proposição).
- Mudar `next`/`new`/`fix`, `--stay` e o comando `/worktree` do opencode.
- Qualquer mudança em claim, banco ou provisionamento.

## Rabbit holes de produto

- **"Já que estamos mexendo, deixa o plan com subcomandos/prompt rico."** Explosão de sintaxe de CLI. **Corte neste item:** só o par sem-arg/arg, espelhando o `fix`.
- **"Abre com prefill e espera o upstream."** Bloqueia a entrega por uma feature que o opencode não tem. **Corte:** fallback driverless agora; prefill re-flagado.

## Questões em aberto (produto)

- **O fallback "abrir sem mensagem" basta, ou vale perseguir prefill-sem-submit no upstream?** **Opções:** A) entregar o fallback agora e re-flagar a proposição; B) bloquear este item até o opencode ganhar prefill. **Recomendação:** A — a fricção real (digitar) é baixa e o auto-envio continua via `worktree plan "<msg>"`; prefill fica como dependência upstream futura. _(assumido — validar no gate)_
- **O bag continua sendo rótulo de branch e, agora, também mensagem?** **Opções:** A) sim, idêntico ao `fix` (um texto faz as duas coisas); B) separar bag de mensagem (nova flag). **Recomendação:** A — preserva a sintaxe `[bag]` e o precedente do `fix`; separar criaria um segundo vocabulário. _(assumido — validar no gate)_

## Fases (ordem de entrega)

1. **F1 — Sessão (owner):** `SESSION_COMMAND_BY_PURPOSE`/`purposeInvocation` para o par do `plan` (sem msg → `null`; com msg → `/plan-issue <msg>`).
2. **F2 — Launch:** `opencodeLaunchDirective` emite `--argument` para `plan`; `cmdPlan` passa o bag.
3. **F3 — Testes + textos:** repin dos dois specs, atualização da doc de uso e entrada de changelog.

## Verificação

- Unit verde nos dois specs repinados; walkthrough manual: `worktree plan` abre sem mensagem e `worktree plan "mensagem"` abre com `/plan-issue mensagem` e branch `plans/plan-issue-mensagem`.
- Não-regressão: comparar as linhas de diretiva de `next`/`new`/`fix` com as de hoje.

## Riscos

- **Divergência entre bag (slug) e mensagem (texto sanitizado).** Mitigação: reusar a sanitização do `fix` na diretiva e o `slugify` existente no branch.
- **Regressão no `new`/`fix` ao mexer na condição da diretiva.** Mitigação: teste travando `new` ignorar argumento e `fix` manter o comportamento.
- **Texto/doc dizendo "plan auto-submete `/plan-issue`".** Mitigação: varredura por `/plan-issue` nos textos listados antes do commit.

## Referências

- GitHub Issue #1066
- Rascunho UI (gate): N/A
- `scripts/lib/agent-session.mjs` · `scripts/lib/worktree.mjs` · `scripts/worktree.mjs` — código a editar primeiro
- `docs/plans/worktree-plan-abre-opencode-com-plan-issue.md` (OPS31/#593 — decisão superada)
- `~/Code/propositions/opencode/prefill-prompt-sem-submit.md` (re-flagar)
- `AGENTS.md` — parágrafo de worktrees / sessões persistentes
