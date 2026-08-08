# worktree — CLI determinístico de worktrees em torno da fila de claim, com um
# `--go` que realmente troca de diretório.
#
# A lógica determinística (fila → branch → worktree) vive em scripts/worktree.mjs;
# esta função é só a camada de shell que APLICA o `cd <dir>` que o script imprime,
# porque um processo filho (node) não consegue mudar o cwd do shell que o chamou.
#
# Instalação (uma linha no profile):
#   source <repo>/.agents/shell/worktree.sh
#
# Uso (terminal interativo):
#   worktree next [--go]   cria/reutiliza o worktree da próxima Issue claimável;
#                          com --go, cd para dentro dele
#   worktree plan [--go]   cria/reutiliza o worktree de planejamento do /plan-issue
#                          (branch fixo plans/plan-issue, sem vínculo com a fila);
#                          com --go, cd para dentro dele
#   worktree kill [--force]
#
# Read-only no GitHub — claim continua sendo `pnpm agent:claim`.

worktree() {
  local src="${BASH_SOURCE[0]:-$0}"
  local root
  root="$(cd "$(dirname "$src")/../.." && pwd)"

  local has_go=0
  local arg
  for arg in "$@"; do
    if [ "$arg" = "--go" ]; then
      has_go=1
    fi
  done

  if [ "$has_go" -eq 0 ]; then
    node "$root/scripts/worktree.mjs" "$@"
    return $?
  fi

  local out
  out="$(node "$root/scripts/worktree.mjs" "$@")" || return $?
  printf '%s\n' "$out"

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
