# OpenCode: comandos `/work-issue` e `/plan-issue` (atalho direto para as skills)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #570
Priority: P2
Model: composer-2.5
model-local: deepseek-v4-flash-high
Impeccable: A — N/A (arquivos de configuração do opencode; sem UI de produto)
Canvas UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável (duas skills com um `/` de distância)

## Intenção

Toda sessão de trabalho no repo começa invocando `/work-issue` (executar uma Issue) ou `/plan-issue` (planejar um lote de ideias). O caminho atual é `/skills` → buscar a skill → enviar — três passos e uma busca que às vezes erra o nome. O opencode já suporta **commands** (`.opencode/commands/<nome>.md`): o template vira o prompt da sessão quando o usuário digita `/nome`. O repo já usa esse mecanismo (`/issue`, `/worktree`). Queremos `/work-issue` e `/plan-issue` como atalhos diretos que instruem o agente a carregar a skill pelo nome e seguir o fluxo dela de ponta a ponta.

## Persona e fluxo

- **Persona / contexto:** Francisco no TUI do opencode, começando uma sessão de execução ou de planejamento.
- **Job principal:** disparar a skill certa com zero fricção e com o modelo de preferência já selecionado.
- **Fluxo desejado:** digitar `/work-issue <args>` → o agente carrega a skill `work-issue` (via ferramenta de skills) e segue o ciclo completo (claim → plano de implementação → pausa humana → execução → `/simplify` → capture-review-debts → PR); `/plan-issue <args>` idem para o ciclo de intenção (parse → planos → gate → registro). Argumentos repassados via `$ARGUMENTS`.
- **Anti-goals de produto:** não transcrever o corpo das skills dentro do comando (a fonte canônica continua `.agents/skills/`); não criar um terceiro fluxo paralelo de planejamento.

## Objetivo e aceite

- `/work-issue` e `/plan-issue` aparecem no autocomplete do TUI e funcionam em qualquer diretório do repo (projeto opencode).
- O template instrui o agente a carregar a skill pelo nome exato e seguir o fluxo dela ponta a ponta, sem reescrever o conteúdo.
- `$ARGUMENTS` é repassado (ex.: `/plan-issue <lote>`).
- Cada comando leva `model: deepseek/deepseek-v4-flash` no frontmatter — sessão manual já abre no modelo de preferência (ver questão em aberto).
- Abertura automática a partir de `worktree next/plan` (OPS26) usa estes comandos como primeira mensagem.

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.opencode/commands/work-issue.md` e `.opencode/commands/plan-issue.md` (novos; precedente: `issue.md` e `worktree.md` já existem); frontmatter `description` + `model`; corpo com instrução curta de "carregue a skill X e siga-a", com `$ARGUMENTS` no fim.
- **Precedente a olhar:** `.opencode/commands/worktree.md` (formato frontmatter + corpo + `!` bash); `.agents/skills/work-issue/SKILL.md` e `plan-issue/SKILL.md` (nomes exatos a referenciar).
- **Risco de acoplamento:** o nome do comando casa com o nome da skill (`/work-issue` ↔ skill `work-issue`) — se uma skill for renomeada, o comando quebra silenciosamente; manter nomes amarrados.

## Dependências

- Nenhuma. (Pré-requisito do fluxo de launch da OPS26.)

## Fora de escopo

- Alterar o conteúdo das skills `work-issue`/`plan-issue`.
- O launch automático do opencode a partir do CLI `worktree` — item próprio (OPS26).
- Comandos para outras skills (só as duas pedidas; qualquer outra segue o mesmo padrão quando alguém quiser).

## Rabbit holes de produto

- **"Um comando por skill do repo":** escopo explode para uma fileira de arquivos de comando. **Corte neste item:** só `work-issue` e `plan-issue`; o padrão fica documentado pelo par.
- **"Template do comando = skill copiada":** duplicação cara de manter — o comando referencia a skill pelo nome, não a reproduz.

## Questões em aberto (produto)

- **`model:` no frontmatter dos comandos?** **Opções:** A) `deepseek/deepseek-v4-flash` nos dois — sessão manual já abre no modelo de preferência, e o launch da OPS26 não precisaria do flag | B) herdar o modelo da sessão. **Recomendação:** A — é exatamente o "pré-selecionado" que o usuário pediu para o launch; por consistência, o atalho manual deve fazer o mesmo. _(assumido — validar no gate)_
- **Comando `work-issue` também define `agent`?** **Opções:** A) não (usa o agente da sessão) | B) fixar `build`. **Recomendação:** A — o ciclo da skill decide o agente, não o atalho.

## Referências

- GitHub Issue #570
- `.opencode/commands/worktree.md` e `.opencode/commands/issue.md` — precedentes do formato
- `.agents/skills/work-issue/SKILL.md`, `.agents/skills/plan-issue/SKILL.md` — nomes e fluxos a referenciar
- Docs opencode: https://opencode.ai/docs/commands — frontmatter (`description`, `model`, `agent`) e `$ARGUMENTS`
