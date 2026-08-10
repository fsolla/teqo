# Worktree CLI: `--go` vira o padrão (escape `--stay`) e `kill` volta ao main

Status: rascunho
Atualizado em: 2026-08-10
Issue: #569
Priority: P2
Model: composer-2.5
model-local: deepseek-v4-flash-high
Impeccable: A — N/A (CLI de dev; sem superfície de usuário de produto)
Canvas UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável (o terminal sempre termina no lugar certo)

## Intenção

Hoje `pnpm worktree next` / `plan` só aplicam o `cd` com `--go` explícito — mas **quase toda** invocação quer ir para o worktree; o raro é ficar. O usuário lança `worktree next --go` e `worktree plan --go` todo dia, e o caso incomum (automação, olhar sem entrar, rodar de dentro do opencode) é o que deveria pedir o flag. Além disso, `worktree kill` destrói o worktree em que o shell está e deixa o terminal órfão num diretório que não existe mais — o output até imprime "Volte ao main: cd …", mas ninguém aplica esse cd, então o prompt do shell fica num cwd morto até o usuário sair manualmente.

## Persona e fluxo

- **Persona / contexto:** Francisco no terminal (bash), fluxo diário de abrir/fechar worktrees; e o agente opencode rodando o comando `/worktree`.
- **Job principal:** um comando `worktree` que termina me deixando no lugar certo — dentro do worktree quando crio, no repo principal quando destruo.
- **Fluxo desejado:** `pnpm worktree next` (sem flags) cria/reusa e provisiona o worktree **e** aplica `cd <dir>` no shell; `pnpm worktree plan` idem; `pnpm worktree kill` destrói, remove os bancos **e** aplica `cd <main>` (`~/Code/teqo`); quem não quer entrar usa `--stay`.
- **Anti-goals de produto:** não criar um sistema de flags complexo (um escape só); não mudar a lógica determinística de branch/slot/provisionamento; não alterar o que `kill` destrói.

## Objetivo e aceite

- `pnpm worktree next` e `pnpm worktree plan` sem flags aplicam o `cd` no shell do terminal (hoje exigem `--go`).
- `--stay` suprime o `cd` (e a futura abertura de opencode — ver OPS26): o script imprime o caminho sem aplicar.
- `--go` explícito continua aceito como no-op — não quebra hábito, script de automação ou a doc existente.
- `pnpm worktree kill` termina com o shell no main repo; o cwd nunca fica num diretório destruído.
- O comportamento vale nas duas superfícies que aplicam o cd: função `worktree()` do `.agents/shell/worktree.sh` (terminal) e comando `/worktree` do opencode (`.opencode/commands/worktree.md`).
- **O comando `/worktree` no TUI do opencode continua criando/reutilizando o worktree (roda o script completo, com provisionamento) — o cd é consequência, não a função dele.** Com default-go, `/worktree next` cria + provisiona + aplica o cd na sessão; `/worktree plan` idem; `/worktree kill` destrói + aplica `cd <main>`.
- `AGENTS.md` (seção "Per-worktree environments") reflete a nova semântica default-go/`--stay`.

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície de dados; é ergonomia de CLI de dev.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/worktree.mjs` (cmdNext/cmdPlan imprimem `cd <dir>` por default; flag `--stay` no parseArgs; cmdKill imprime `cd <mainRoot>` no mesmo formato máquina que `next`/`plan` já usam); `.agents/shell/worktree.sh` (aplica o cd por default, suprime com `--stay`, aplica também no `kill`); `.opencode/commands/worktree.md` (texto de uso das três formas).
- **Precedente a olhar:** o formato `cd <dir>` já é o contrato entre o script e a função shell (sed parse na última linha); o kill já resolve `mainRoot` como `entries[0]?.path`.
- **Risco de acoplamento:** o opencode command (`/worktree`) e a função shell dividem a mesma saída do script — qualquer mudança de formato quebra os dois; manter UMA linha `cd …` no fim, sempre.

## Dependências

- Nenhuma. (Base de semântica para OPS26 e OPS27.)

## Fora de escopo

- Abertura do opencode ao "go" — item próprio (OPS26).
- O subcomando `worktree new` — item próprio (OPS27).
- Mudanças no provisionamento (porta/bancos/env) — pré-existente, não é o alvo.

## Rabbit holes de produto

- **"Vários escapes":** `--no-go`, `--here`, `--cd`… um só, com nome claro.
- **"O script deve detectar terminal vs opencode":** não — o script imprime o `cd`; quem aplica (shell function vs opencode command) decide o que fazer com ele. Manter o contrato de saída simples.

## Questões em aberto (produto)

- **Nome do escape?** **Opções:** A) `--stay` | B) `--no-go` | C) `--here`. **Recomendação:** A — curto, lê como o oposto de "go" e não parece flag de modo. _(confirmado no gate — `--stay`)_
- **`kill` deve suportar `--stay` (não voltar ao main)?** **Opções:** A) não — kill sempre volta ao main | B) sim, por simetria. **Recomendação:** A — ficar num cwd destruído é exatamente o bug que estamos corrigindo; quem roda kill por automação não depende do cwd do terminal pai.

## Referências

- GitHub Issue #569
- `scripts/worktree.mjs:444-481` — `cmdKill` já imprime "Volte ao main: cd ${mainRoot}"; nada aplica
- `scripts/worktree.mjs:329` e `400` — `if (go) console.log(\`cd ${dir}\`)`em`next`/`plan`
- `.agents/shell/worktree.sh:36-39` — cd só quando `--go` presente
- `.opencode/commands/worktree.md` — instrui o agente a aplicar o `cd` quando `--go`
- `AGENTS.md` seção "Per-worktree environments" — documenta `worktree next [--go]` etc.
