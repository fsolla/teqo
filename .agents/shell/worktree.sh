# worktree — CLI determinístico de worktrees em torno da fila de claim, com
# troca de diretório por padrão (e `kill` que volta ao main).
#
# A lógica determinística (fila → branch → worktree) vive em scripts/worktree.mjs;
# esta função é só a camada de shell que APLICA o `cd <dir>` que o script imprime
# na última linha, porque um processo filho (node) não consegue mudar o cwd do
# shell que o chamou.
#
# No terminal (esta função), o script também imprime a diretiva `launch
# opencode <dir> --model vercel/deepseek/deepseek-v4-flash --auto [--prompt "…"]` (OPS26):
# a função executa o cd e então a linha (tokenizada por xargs — honra as aspas
# do prompt, nunca eval), e o TUI do opencode abre no worktree — `next` com
# `/work-issue --issue <N>` já enviado (OPS33: a Issue claimada vai no prompt),
# `plan` com `/plan-issue` já enviado (OPS31), `new` sem prompt (apenas
# conversar). Sem `exec` de propósito: ao sair do opencode, o terminal volta ao
# shell dentro do worktree. Presets são constantes em scripts/lib/worktree.mjs;
# o marcador TEQO_WORKTREE_TERMINAL=1 é o que separa esta superfície da do comando
# `/worktree` do opencode (que nunca lança TUI). `--stay` suprime cd e launch.
#
# Instalação (uma linha no profile; requer bash ou zsh — usa BASH_SOURCE, arrays e here-strings):
#   source <repo>/.agents/shell/worktree.sh
#
# Uso (terminal interativo):
#   worktree next [--issue N] [--stay]
#                            CLAIMA a próxima Issue claimável e cria/reutiliza o
#                            worktree dela, cd para dentro por padrão; --issue N
#                            claima a Issue direcionada ou reabre a já claimada
#                            (sem re-claim); --stay não troca
#   worktree plan [bag] [--stay]   cria um worktree de planejamento do /plan-issue
#                            DIFERENTE a cada chamada (sessões paralelas): com bag,
#                            branch plans/plan-issue-<bag> (sufixo -2/-3 se o nome
#                            já existir), sem bag o próximo plans/plan-issue-<n>
#                            sequencial; cd para dentro dele por padrão; --stay não
#                            troca
#   worktree new [bag] [--stay]   cria um worktree NEUTRO (sem função pré-definida)
#                            DIFERENTE a cada chamada: com bag, branch work/<bag>
#                            (sufixo -2/-3 se o nome já existir), sem bag o próximo
#                            work/<n> sequencial; cd para dentro dele por padrão;
#                            --stay não troca
#   worktree kill [--force]  destrói o worktree atual e cd para o main por padrão
#
# `--go` explícito continua aceito como no-op (era o antigo padrão).
# Claim determinístico: `next` claima antes de criar o worktree (mesma fila e
# lock de `pnpm agent:claim`); `plan`/`new`/`kill` não tocam Issues.

worktree() {
  local src="${BASH_SOURCE[0]:-$0}"
  local root
  root="$(cd "$(dirname "$src")/../.." && pwd)"

  local stay=0
  local arg
  for arg in "$@"; do
    if [ "$arg" = "--stay" ]; then
      stay=1
    fi
  done

  local out
  out="$(TEQO_WORKTREE_TERMINAL=1 node "$root/scripts/worktree.mjs" "$@")" || return $?
  printf '%s\n' "$out"

  if [ "$stay" -eq 1 ]; then
    return 0
  fi

  local dir
  dir="$(printf '%s\n' "$out" | sed -n 's/^cd //p' | tail -n 1)"
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    cd "$dir" || return $?
    printf '→ %s\n' "$PWD"
  else
    printf 'worktree: não consegui aplicar o `cd` da saída do script.\n' >&2
    return 1
  fi

  # Diretiva `launch` (só existe quando TEQO_WORKTREE_TERMINAL=1 e sem --stay): o
  # script a gera a partir de constantes + dir slugificado (sem espaços), e desde
  # o OPS33 o valor do `--prompt` carrega espaço e vem CITADO (`"/work-issue
  # --issue <N>"`) — o split por IFS=' ' não honra aspas, então a tokenização usa
  # xargs (processa aspas duplas como um shell, NÃO é eval; o conteúdo é 100%
  # gerado por constantes + número, sem input livre). Falha do launch (ex.:
  # opencode fora do PATH) só avisa: o worktree já está pronto e utilizável.
  local launch
  launch="$(printf '%s\n' "$out" | sed -n 's/^launch //p' | tail -n 1)"
  if [ -n "$launch" ]; then
    local -a launch_args
    while IFS= read -r token; do
      launch_args+=("$token")
    done < <(printf '%s\n' "$launch" | xargs -n 1 printf '%s\n')
    "${launch_args[@]}" || printf 'worktree: launch do opencode falhou (código %s) — o worktree segue pronto em %s.\n' "$?" "$PWD" >&2
  fi
}
