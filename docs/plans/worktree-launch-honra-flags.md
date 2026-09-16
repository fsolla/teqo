# Launch do worktree honra as flags do humano: o modelo pedido e o `--auto` chegam onde deveriam

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1088
Priority: P2
Impeccable: A — N/A (CLI/shell, sem superfície de produto)
Design UI: N/A — sem UI
Appetite: ~1 dia eng; um outcome verificável — o que a pessoa digita na linha (`--zen`, `--go`, `--auto`) é o que a sessão e a mensagem inicial usam, ou a flag falha alto.
Responsável: —

## Intenção

Quem opera o `pnpm worktree` no terminal digita a intenção inteira na própria linha: o modelo (`--zen`, `--go`, …) e o modo autônomo (`--auto`). Hoje o launcher engole parte disso sem avisar. Dois relatos, dois sintomas do mesmo defeito:

- "Rodei `worktree plan --zen` e ele não abriu o opencode com o Muse Spark 1.3 Free do OpenCode Zen. Como esperava."
- "Rodei `worktree next --go --auto`, e a mensagem inicial não foi lançada com `--auto`, como esperado."

A raiz é a mesma: o `worktree` registra o modelo escolhido, mas em `plan`/`new` (driverless por OPS119) ele nunca é aplicado à sessão — o TUI anexado cai no pin global (`deepseek/deepseek-flash`). E `--auto` não existe no vocabulário do launcher: é parseado como booleano desconhecido e descartado em silêncio, então a skill começa supervisionada quando o humano pediu autonomia. A promessa implícita do terminal — "o que eu digitei é o que roda" — está quebrada.

## Persona e fluxo

- **Persona / contexto:** dev no terminal, começando um run do opencode; escolheu o modelo de propósito (custo/capacidade) e, às vezes, quer o run autônomo até o PR.
- **Job principal:** abrir a sessão do worktree já no modelo e no modo (`--auto`) que digitou — ou ser avisado de que aquela flag não será honrada.
- **Fluxo desejado:** digita `worktree plan --zen` → cai no worktree e no TUI da sessão já em Muse Spark; digita `worktree next --go --auto` → o driver auto-submete `/work-issue --issue <N> --auto` e a skill segue sem pausa.
- **Anti-goals de produto:** não virar um seletor de modelo/TUI de configuração; não reinterpretar `--auto` do humano como o `--auto` de permissões do `opencode run`; não mexer no preset nem no mapa de modelos.

## Objetivo e aceite

- **Modelo honrado em TODOS os purposes.** `pnpm worktree <next|plan|new|fix> --<modelo>` abre a sessão **a que a pessoa anexa** no modelo pedido, inclusive nos driverless (`plan` sem bag, `new`), onde não há driver para aplicar `--model`.
- **`--auto` do humano chega à mensagem inicial.** Com `--auto` na linha, o driver auto-submete exatamente `/work-issue --issue <N> --auto` (next), `/plan-issue --auto <bag>` (plan com bag) e `/bug-fix --auto <bag>` (fix); sem `--auto`, as formas atuais (supervisionadas) permanecem.
- **Flag não honrada falha alto.** Flag desconhecida ou que o launcher não sabe honrar morre com mensagem clara (e sugestão de vizinho, quando houver) — nunca é descartada em silêncio.
- **Guardrails:** preset default `deepseek/deepseek-flash` intocado; OPS119 mantido (`plan`/`new` sem driver não auto-submetem skill); ciclo de vida OPS110 (`serve`/`start`/`attach`/`stop`, marcador `TEQO_WORKTREE_TERMINAL`) e o contrato `purposeInvocation` preservados; nenhuma mudança de provider/auth.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — é comportamento de CLI, não superfície de dado; o efeito é observável no estado da sessão e no log do driver.
- **Forma:** _adiada ao plano de implementação_.

## Dados da decisão (literais)

- Mapa de modelos (não alterar valores): `zen -> opencode/muse-spark-1.3-contributor-free`; `go -> opencode-go/deepseek-v4.1-flash`; preset sem flag `deepseek/deepseek-flash`.
- Formas exatas do comando auto-submetido: `/work-issue --issue <N> --auto`; `/plan-issue --auto <bag>`; `/bug-fix --auto <bag>`.
- O modelo pedido deve constar na **sessão** (`model` no estado em `~/.local/state/teqo/agent-sessions/<slug>.json` e na sessão do servidor), não só no argv do driver.
- API do servidor: `POST /session` aceita `model: { id, providerID, variant? }` na criação (e há rota de troca de modelo da sessão).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/worktree.mjs` (parser e `printLaunchDirective`), `scripts/lib/worktree.mjs` (`opencodeLaunchDirective`, `resolveWorktreeModel`), `scripts/lib/agent-session.mjs` (`purposeInvocation`, `driverArgs`, criação de sessão no CLI `scripts/agent-session.mjs`), `.agents/shell/worktree.sh`.
- **Precedente a olhar:** `validateSessionFlags` + `nearestAcceptedFlag` (OPS110-F1, `scripts/lib/agent-session.mjs`) é o padrão pronto de "flag desconhecida falha alto" a espelhar no `parseArgs` do worktree; `attachArgs`/`driverArgs` mostram onde o modelo entra (e não entra).
- **Risco de acoplamento:** o `opencode attach` não tem `--model`; aplicar o modelo só faz sentido via sessão (criação/rota de troca) ou via driver — o executor deve escolher o ponto que cobre o anexo, sem duplicar estado.

## Dependências

- OPS110 (sessões persistentes attach/detach) — entregue.
- OPS119 (`plan` sem bag driverless) — entregue; comportamento a preservar.

## Fora de escopo

- Variantes de modelo (`--variant`): continuam na config global do opencode via Ctrl+T (OPS95).
- Alterar o mapa `WORKTREE_MODEL_MAP` ou o preset default.
- Provider/auth, servidor compartilhado, painel OPS109 e o caminho headless do auto-unblock (`opencode run --auto`) — não é este defeito.
- Redesenho da semântica de `--auto` das skills (`plan-issue`/`work-issue`/`bug-fix`) — o contrato documentado é a fonte; aqui só o transporte.

## Rabbit holes de produto

- **"Já que mexo no modelo, faço um seletor no TUI".** Explode para UX de configuração e interage com Ctrl+T. **Corte neste item:** só passar o modelo que veio na linha.
- **"`--auto` também poderia ligar permissões".** Misturar o `--auto` de skill com o `--auto` do `opencode run` cria dois significados incompatíveis. **Corte:** `--auto` do humano = opt-out do GATE da skill; permissões seguem como hoje.
- **"Valido todas as flags do opencode command também".** O caminho `/worktree` (sem `TEQO_WORKTREE_TERMINAL`) tem escopo próprio. **Corte:** fail-high no parser do script, sem estender a varredura além dele.

## Questões em aberto (produto)

- **Como aplicar o modelo no caminho driverless?** **Opções:** A) driver mínimo só para fixar o modelo; B) criar a sessão com `model` (`POST /session` já aceita; o TUI anexado herda); C) aplicar só quando há driver (deixa `plan`/`new` quebrados). **Recomendação:** B — sem processo fantasma, sem mensagem espúria e sem reintroduzir auto-submit que a OPS119 removeu; se o TUI não herdar, cair para a rota de troca de modelo da sessão. _(assumido — validar na implementação)_
- **Onde `--auto` é anexado?** **Opções:** A) em `purposeInvocation`, junto do `--issue N`/bag; B) na diretiva de launch. **Recomendação:** A — é lá que o comando auto-submetido nasce, um único dono.
- **Rejeitar flag desconhecida ou só avisar?** **Opções:** A) falhar alto (padrão OPS110-F1); B) avisar e seguir. **Recomendação:** A — o defeito nasceu justamente do descarte silencioso.

## Referências

- GitHub Issue #1088
- Design UI (gate): N/A — sem UI
- Arquivos: `scripts/worktree.mjs`, `scripts/lib/worktree.mjs`, `scripts/lib/agent-session.mjs`, `scripts/agent-session.mjs`, `.agents/shell/worktree.sh`
- Testes que pinam os contratos: `tests/unit/worktree.unit.spec.ts`, `tests/unit/agentSession.unit.spec.ts`
- Doc das flags de skill (contrato do `--auto`): `.opencode/commands/plan-issue.md`, `.opencode/commands/work-issue.md`, `.opencode/commands/worktree.md`, `.agents/skills/worktree-next-issue/SKILL.md`
- `docs/AGENT-OPS.md` — ciclo de vida das sessões (OPS110/OPS119)

## Self-score (shaping)

4/5 — (1) fatia = um outcome verificável (as duas flags têm o efeito pedido ou falham alto); (2) appetite ~1 dia para parser + transporte + modelo na sessão; (3) persona no terminal e aceite em linguagem de uso; (4) direção no codebase é hipótese (áreas e precedente como pista); (5) pontos de injeção são questões abertas com recomendação.
