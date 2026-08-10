# Worktree `go` abre o opencode com pré-seleções (DeepSeek V4 Flash, auto-approve, skill inicial)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #571
Priority: P2
Model: composer-2.5
model-local: deepseek-v4-flash-high
Impeccable: A — N/A (CLI de dev; sem UI de produto)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável (do terminal ao TUI do opencode sem tocar em nada)

## Intenção

Depois de criar um worktree, o fluxo natural é trabalhar nele com o opencode — e hoje isso são três gestos manuais: `cd` (com `--go`), `opencode` no diretório e `/skills` → buscar `work-issue` → enviar. O opencode já oferece as pré-seleções via CLI: `opencode <dir> --model <provider/model> --auto --prompt "<msg>"` abre o TUI no diretório com modelo escolhido, permissões em auto-approve e a mensagem já enviada — e **verificamos na fonte** que uma mensagem inicial que começa com `/` expande para o comando (`submit()` → `session.command`). Então `opencode <worktree> --model deepseek/deepseek-v4-flash --auto --prompt "/work-issue"` abre exatamente a sessão desejada. Queremos que `worktree next` (go, default desde OPS24) termine nessa sessão.

## Persona e fluxo

- **Persona / contexto:** Francisco no terminal (função `worktree()` do `.agents/shell/worktree.sh`), fluxo diário de abrir worktree para executar ou planejar.
- **Job principal:** ir da linha de comando para uma sessão de opencode pronta (modelo certo + permissões + skill certa) com um único comando.
- **Fluxo desejado:** `worktree next` → cria/provisiona → `cd` → abre o TUI do opencode no worktree com `deepseek/deepseek-v4-flash`, auto-approve ativo e primeira mensagem `/work-issue` **enviada** (que expande o comando da OPS25). `worktree plan` → mesma abertura, com `/plan-issue` **pré-preenchido no input, sem enviar** (hoje: sem prompt, autocomplete completa — ver aceite). `--stay` (OPS24) suprime o launch.
- **Anti-goals de produto:** não abrir TUI aninhado quando o comando roda de dentro do opencode (`/worktree`); não alterar o provisionamento; não hardcodar presets por worktree (arquivos de config commitados).

## Objetivo e aceite

- No terminal, `worktree next` termina com o TUI do opencode aberto no worktree: modelo `deepseek/deepseek-v4-flash` selecionado, permissões em auto-approve (`--auto`) e a mensagem `/work-issue` **já enviada** — não apenas pré-preenchida (o comando da OPS25 executa o ciclo).
- `worktree plan` abre o opencode com os mesmos presets e o input **pré-preenchido com `/plan-issue` mas sem enviar** — o humano decide quando disparar. **Restrição descoberta na verificação:** a CLI atual do opencode só sabe preencher o input com `--prompt`, e esse caminho **sempre auto-envia** (o TUI chama `submit()`; não há flag de pre-fill sem submit — `route.prompt` existe no tipo da rota mas não é populável via CLI). Fallback acordado: `plan` abre **sem** prompt — o usuário digita `/plan-` e o autocomplete do TUI completa. Se a CLI ganhar pre-fill sem submit, `plan` passa a usá-lo.
- Quando o script roda **sem** o marcador de terminal (comando `/worktree` do opencode, automação), o launch **não** acontece — só o `cd` (comportamento atual preservado; sem TUI dentro de TUI).
- `--stay` (OPS24) suprime cd e launch.
- Ao sair do opencode, o shell retorna ao terminal no worktree (launch sem `exec`) — e **não** há execução automática de `worktree kill` ao sair (o worktree continua vivo para a próxima sessão).
- Presets (modelo/auto) são constantes declaradas no script — trocar de modelo é editar uma constante, não caçar flags espalhadas.

## Dados (intenção)

- **Vou apresentar dados?** Não.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/worktree.mjs` (novo bloco de "launch directive": quando chamado com env/flag que só a função shell passa — ex. `WORKTREE_TERMINAL=1` — imprime a linha `opencode <dir> --model deepseek/deepseek-v4-flash --auto --prompt /work-issue` após o `cd`); `.agents/shell/worktree.sh` (chama o script com o marcador e executa as duas linhas); `.opencode/commands/worktree.md` (roda sem marcador — nada muda além do texto).
- **Precedente a olhar:** o contrato `cd <dir>` na última linha já existe; o opencode command não precisa saber do launch.
- **Risco de acoplamento:** o marcador de terminal é o que separa o comportamento em duas superfícies — sem ele, o `/worktree` do opencode abriria um TUI aninhado. A skill/AGENTS.md devem documentar que `next`/`plan` **no terminal** abrem o opencode.

## Dependências

- OPS24 (semântica `--go` default / `--stay` — o launch vive no mesmo caminho de "go").
- OPS25 (comandos `/work-issue` e `/plan-issue` — a primeira mensagem do launch os invoca).

## Fora de escopo

- O subcomando `worktree new` — item próprio (OPS27; herda o launch sem skill inicial).
- Config global de opencode (`~/.config/opencode/opencode.json`) — presets são por-invocação via flags, não config persistente.
- Escolher o modelo de forma dinâmica (ex.: perguntar ao usuário) — constante fixa no script, configurável por edição.

## Rabbit holes de produto

- **"Configurar o worktree com um `opencode.json` próprio":** arquivos commitados no repo virariam config de todo mundo. **Corte:** flags na linha de comando, efêmeras.
- **"`--auto` é perigoso":** sim — é exatamente o que o usuário pediu ("Enable auto-approve permissions"); o `--auto` só vale para a sessão lançada, não muda a config global. Deixar a escolha documentada no plano de implementação.

## Questões em aberto (produto)

- **`plan` sem pre-fill (fallback) é aceitável?** **Opções:** A) sim — `plan` abre sem prompt; `/plan-` + autocomplete completa (recomendado; única forma hoje) | B) `plan` envia `/plan-issue` igual ao `next` (contradiz a preferência de não enviar) | C) `plan` não abre opencode (só cd). **Recomendação:** A — o autocomplete do TUI completa `/plan-issue` com pouquíssimos toques, e não dispara nada sem o Enter do humano. _(confirmado no gate — restrição de plataforma descoberta na verificação; registro do gap para o repo do opencode: `~/Code/propositions/opencode/prefill-prompt-sem-submit.md` — se o repo ganhar a flag, `plan` passa a usar pre-fill)_
- **Ao sair do opencode, o terminal volta ou morre?** **Opções:** A) retorna ao shell no worktree (sem `exec`) | B) `exec opencode` (substitui o shell). **Recomendação:** A — volta para um terminal utilizável no worktree; `exec` é o escape para quem quiser. _(confirmado no gate — e sem auto-kill ao sair)_

## Referências

- GitHub Issue #571
- `scripts/worktree.mjs:329/400` — `if (go) console.log(\`cd ${dir}\`)`
- `.agents/shell/worktree.sh:42-53` — aplicação do cd pelo shell
- `.opencode/commands/worktree.md` — superfície que NÃO deve lançar o TUI
- Verificação: `opencode --help` (flags `--model`/`--auto`/`--prompt`); fonte do TUI (`packages/tui/src/home.tsx` auto-submete `--prompt`; `packages/tui/src/component/prompt/index.tsx` expande mensagem com `/` via `session.command`)
