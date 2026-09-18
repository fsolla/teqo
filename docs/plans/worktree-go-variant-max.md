# `pnpm worktree … --go` abre a sessão no DeepSeek V4.1 Flash (`opencode-go`) na variante `max`

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1149
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5 dia eng — config/plumbing de launch + textos + pins
Responsável: —

## Intenção

Quando o humano pede `pnpm worktree plan --go` ou `pnpm worktree new --go`, a sessão opencode deve nascer em DeepSeek V4.1 Flash do provider OpenCode Go (`opencode-go/deepseek-v4.1-flash`) na variante `max` — e hoje isso não acontece: falta a variante (roda no default) e o humano relata que o lançamento **nem sempre pousa no provider correto** (sintoma a reproduzir: a TUI anexada pode abrir no default global `deepseek/deepseek-flash` antes de aplicar o modelo da sessão). O humano quer o worktree já em `max`, sem configurar nada na mão — e `max` é a única variante que usamos, em todos os propósitos.

O que reabre o veto OPS95: o servidor opencode 1.18.31 aceita `variant` no `model` de `POST /session` e persiste (`Session.model.variant`), e a TUI anexada herda — não é mais preciso emitir flag no `opencode attach` (que segue sem `--variant`).

## Persona e fluxo

- **Persona / contexto:** mantenedor/agente abrindo worktrees de Issue no terminal, escolhendo o modelo com uma flag no momento da invocação.
- **Job principal:** abrir a sessão já no `--go` **na variante `max`** com o mesmo flag de sempre, sem editar config global nem decorar variante.
- **Fluxo desejado:** `pnpm worktree plan --go` (ou `new --go`, `next --go`, `fix --go`) → provisioning como hoje → sessão criada em `opencode-go/deepseek-v4.1-flash` variante `max` → TUI anexada exibe modelo e variante corretos; sem flag, o preset segue o mesmo modelo, também em `max`; `fix --headless` idem.
- **Anti-goals de produto:** não vira seletor de variantes nem flag nova; não muda os modelos do cardápio nem o preset (só a variante); não mexe na config global da máquina; não muda o `attach`.

## Objetivo e aceite

- **Todos os lançamentos** do worktree (`next`, `plan`, `new`, `fix` — incluindo `fix --headless`/auto-unblock e o preset sem flag) pedem a variante `max` para o modelo selecionado; `--go` continua selecionando `opencode-go/deepseek-v4.1-flash`. Verificável na sessão criada (`Session.model.variant`) e nos pins unitários atualizados.
- O modelo pedido **pousa de fato**: `plan --go` e `new --go` abrem a sessão em `opencode-go/deepseek-v4.1-flash` (provider e modelo corretos) mesmo com a TUI anexada e com o pin global `deepseek/deepseek-flash`; o relato de hoje ("nem no provider correto") vira caso de aceite — não pode se repetir.
- Guardrail: nenhuma flag de variante no `opencode attach`; config global da máquina fora; lançamento nunca quebra por variante inexistente no modelo selecionado.
- Superfícies que descrevem o `--go` sincronizadas na mesma entrega (código, help/docblocks, shell, command, skill, pin, changelog).

## Dados (intenção)

- **Vou apresentar dados?** Não — tooling de dev, sem superfície de dados.
- **Decisões desbloqueadas:** N/A.
- **Forma:** N/A.

## Dados da decisão (literais)

- Variante pedida: `max` (reasoningEffort; opções do modelo: `low`, `high`, `max`) — **única** variante usada; sem flag nova de variante.
- Modelo: `opencode-go/deepseek-v4.1-flash` (provider `opencode-go`) — já correto em `WORKTREE_MODEL_MAP.go` (OPS112).
- Flag: `--go`; escopo decidido no gate de 2026-09-18: **todos** os propósitos (`next|plan|new|fix`), incluindo `fix --headless` (auto-unblock) e o preset sem flag (mesmo modelo, também `max`).
- Fato novo (opencode 1.18.31): `POST /session` aceita `model: { providerID, id, variant }` e persiste em `Session.model.variant`; a TUI anexada herda. `opencode run` tem `--variant`; o `opencode attach` continua sem esses flags (era o veto OPS95).
- Verificação viva (2026-09-18, servidor compartilhado): sessões recentes registram `opencode-go/deepseek-v4.1-flash`, mas a variante só vira `max` por seleção manual (Ctrl+T) — lançamentos recentes com `variant: default`. O relato do humano ("nem no provider correto") fica como sintoma a reproduzir no aceite.

## Direção no codebase (hipótese)

- **Áreas prováveis:** dono provável `resolveWorktreeModel`/`WORKTREE_MODEL_MAP` (`scripts/lib/worktree.mjs`) + `buildCreateSessionBody`/`driverArgs` (`scripts/lib/agent-session.mjs`); superfícies a sincronizar: `scripts/worktree.mjs`, `.agents/shell/worktree.sh`, `.opencode/commands/worktree.md`, `.agents/skills/worktree-next-issue/SKILL.md`, `.agents/skills/local-database/SKILL.md`, `docs/AGENT-OPS.md`, pins `tests/unit/worktree.unit.spec.ts` e `tests/unit/agentSession.unit.spec.ts` (hoje travam a ausência de variant), changelog novo.
- **Precedente a olhar:** OPS110 (sessão persistente; `buildCreateSessionBody`), OPS95 (veto do variant, reaberto pelo fato novo), OPS112 (`--go` → V4.1 Flash).
- **Risco de acoplamento:** `scripts/worktree.mjs` é `HIGH_RISK_EXACT` → diff nele dispara unit/int full + e2e curado no PR; `scripts/lib/*` não é. Sem DB, migration, access, UI ou e2e novo.

## Dependências

- Nenhuma dura. Soft: opencode 1.18.31 no ambiente aceitando `variant` no body da sessão (fato verificado).

## Fora de escopo

- Outras flags/cardápio (modelos intocados) e a config global da máquina / Ctrl+T.
- Reintroduzir flags de variante no `opencode attach`.
- Docs históricos congelados (`docs/plans/*` anteriores, changelogs, HISTORY).

## Rabbit holes de produto

- **Revisar o cardápio de flags.** Se alguém "só completar": re-checar preço/capacidade e reescrever o mapa. **Corte neste item:** variante `max` em todos os lançamentos; cardápio/preset de modelos intocados.
- **Mexer na config global da máquina ou no Ctrl+T.** Se alguém "só completar": forçar `max` no `opencode.json` global. **Corte:** a mudança é no launch do worktree, no repo.
- **Trazer `--variant` de volta à diretiva do TUI.** Se alguém "só completar": emitir flag no attach. **Corte:** variante vai no body da sessão; o attach não emite flags.

## Questões em aberto (produto)

- Nenhuma — decisões do gate de 2026-09-18: (1) **todos** os propósitos, não só `plan`/`new`; (2) `--go` implica variante `max`, sem flag nova ("só usamos a variant max"); (3) `fix --headless` incluído ("pode deixar todos no max", preset incluído).

## Referências

- GitHub Issue #1149
- Design UI (gate): N/A
- `docs/plans/worktree-modelos-go-zen.md` (OPS112), `docs/plans/worktree-flags-modelo-correcao.md` (OPS95)
- `scripts/lib/worktree.mjs`, `scripts/lib/agent-session.mjs`
- `tests/unit/worktree.unit.spec.ts`, `tests/unit/agentSession.unit.spec.ts`
- `docs/AGENT-OPS.md`
