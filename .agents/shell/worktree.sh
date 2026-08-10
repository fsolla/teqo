# worktree — CLI determinístico de worktrees em torno da fila de claim, com
# troca de diretório por padrão (e `kill` que volta ao main).
#
# A lógica determinística (fila → branch → worktree) vive em scripts/worktree.mjs;
# esta função é só a camada de shell que APLICA o `cd <dir>` que o script imprime
# na última linha, porque um processo filho (node) não consegue mudar o cwd do
# shell que o chamou.
#
# Instalação (uma linha no profile):
#   source <repo>/.agents/shell/worktree.sh
#
# Uso (terminal interativo):
#   worktree next [--stay]   cria/reutiliza o worktree da próxima Issue claimável
#                            e cd para dentro dele por padrão; --stay não troca
#   worktree plan [bag] [--stay]   cria um worktree de planejamento do /plan-issue
#                            DIFERENTE a cada chamada (sessões paralelas): com bag,
#                            branch plans/plan-issue-<bag> (sufixo -2/-3 se o nome
#                            já existir), sem bag o próximo plans/plan-issue-<n>
#                            sequencial; cd para dentro dele por padrão; --stay não
#                            troca
#   worktree kill [--force]  destrói o worktree atual e cd para o main por padrão
#
# `--go` explícito continua aceito como no-op (era o antigo padrão).
# Read-only no GitHub — claim continua sendo `pnpm agent:claim`.

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
  out="$(node "$root/scripts/worktree.mjs" "$@")" || return $?
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
}
