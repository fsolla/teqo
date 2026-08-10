# Worktree plan abre o opencode com /plan-issue já enviado

Status: rascunho
Atualizado em: 2026-08-10
Issue: #593
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (CLI/shell, sem superfície de produto)
Canvas UI: N/A — sem UI
Appetite: ~0,5 dia; um outcome verificável (o TUI abre já no fluxo de planejamento)
Responsável: —

## Intenção

Na entrega OPS26 assumimos que o `--prompt` do opencode seria auto-submetido — e é. Só que o `worktree plan` ficou **sem prompt** por uma premissa equivocada: a proposição em `~/Code/propositions/opencode/prefill-prompt-sem-submit.md` queria "abrir com o prompt preenchido sem enviar", e como a CLI não tem isso, deixamos o `plan` abrir o TUI vazio (autocomplete `/plan-`). A revisão da proposição mostra o óbvio que faltou: **a necessidade real era a oposta** — iniciar com o prompt _commitado_ (enviado) — e isso o `--prompt` já faz, como o `next` prova com `/work-issue`. Queremos o mesmo para o `plan`: um comando e já estar dentro do fluxo de planejamento, sem digitar nada.

## Persona e fluxo

- **Persona / contexto:** o humano (dono do repo) no terminal interativo, rodando `worktree plan [bag]` para abrir uma sessão de `/plan-issue` num worktree de planejamento.
- **Job principal:** cair direto no planejamento — abrir o TUI do opencode já executando a skill de planejamento.
- **Fluxo desejado:**
  1. `worktree plan [bag]` cria o worktree de planejamento (branch `plans/plan-issue-…`), provisiona o ambiente e troca o shell para lá;
  2. o opencode abre no worktree com `/plan-issue` **já enviado** como primeira mensagem;
  3. a sessão começa o fluxo da skill (parse → gate → registro) sem nenhuma interação extra.
- **Anti-goals:** não virar um mecanismo de prefill-draft do opencode (isso é feature do opencode, não do Teqo); não mudar o comportamento de `--stay` nem do comando `/worktree` do opencode.

## Objetivo e aceite

- `worktree plan [bag]` no terminal (sem `--stay`) imprime a diretiva `launch opencode <dir> --model <preset> --auto --prompt /plan-issue` antes do `cd <dir>`.
- O TUI abre com a skill `plan-issue` já carregada e em execução (primeira mensagem enviada), sem digitação.
- `--stay` continua suprimindo `cd` + launch; o comando `/worktree` do opencode continua sem a diretiva (nunca TUI aninhado).
- A proposição `~/Code/propositions/opencode/prefill-prompt-sem-submit.md` é revisada e anotada com o desfecho: a necessidade real do fluxo era **auto-envio** (coberto por `--prompt`); prefill-sem-envio segue como gap do opencode, não bloqueio do Teqo.
- Textos correlatos atualizados (todo lugar que diga "plan sem prompt — autocomplete `/plan-`" passa a dizer "`/plan-issue` enviado").

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs` (constante `OPENCODE_SKILL_COMMAND_BY_PURPOSE` — `plan` sai de `null` para `/plan-issue`; o comentário de "gap registered for the opencode repo" sai ou muda de tom), `scripts/worktree.mjs` (docblock), `.agents/shell/worktree.sh` (comentário), `.opencode/commands/worktree.md` (doc), `AGENTS.md` / `docs/CHANGELOG-AGENTS.md`.
- **Precedente a olhar:** plano OPS26 (`docs/plans/worktree-go-abre-opencode-com-presets.md` + `-impl.md`) — o mecanismo de launch já existe; aqui é só o valor do prompt do `plan`.
- **Risco de acoplamento:** o mesmo mapa de constantes é usado por `next` — não mudar o comportamento do `next`; o valor do `plan` é a única mudança. Proposição opencode fica fora do repo (pasta pessoal `~/Code/propositions/`) — edição local, não commit.

## Dependências

- Nenhuma. (OPS33 mexe no mesmo arquivo de constantes; `serializes: [worktree-cli]` para o pool não rodar os dois em paralelo.)

## Fora de escopo

- Implementar `--prefill` / prefill-sem-submit no opencode (feature upstream; registrar na proposição, não codar aqui).
- Mudar o launch do `next` (continua `/work-issue` como está).
- Qualquer mudança no claim ou no fluxo de execução (OPS32/OPS33).

## Rabbit holes de produto

- **"Já que vamos mexer, deixar o plan mais esperto"** (ex.: esperar confirmação antes de enviar). O pedido é simétrico ao `next`: abrir já executando. **Corte:** mudança de valor no mapa + docs + anotação da proposição; nada mais.

## Questões em aberto (produto)

- **E se o opencode ganhar prefill-sem-submit no futuro?** **Decisão (gate 2026-08-10):** manter auto-envio — simetria com `next` e menos fricção; a opção fica registrada na proposição para quando o upstream existir.

## Referências

- GitHub Issue #593
- Canvas UI (gate): N/A
- `~/Code/propositions/opencode/prefill-prompt-sem-submit.md` (revisar/anotar)
- `docs/plans/worktree-go-abre-opencode-com-presets.md` (OPS26 — mecanismo do launch)
