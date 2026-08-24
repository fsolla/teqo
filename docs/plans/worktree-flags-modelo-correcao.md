# Corrigir mapa de modelos e launch do worktree CLI (follow-up OPS93)

Status: rascunho
Atualizado em: 2026-08-24
Issue: #876
Priority: P1
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

O delivery OPS93 (commit 8951f198, `worktree-flags-modelo-launch`, entregue hoje) quebrou o fluxo de abrir worktrees e entregou mapa de modelos diferente do pedido. Primeiro, o launch: `opencodeLaunchDirective` (scripts/lib/worktree.mjs L198) passou a emitir `--variant max` na diretiva `launch opencode <dir> --model X --variant max --auto …`, mas o TUI do opencode não aceita `--variant` — a flag existe só em `opencode run` (verificado empiricamente nos helps). O yargs do TUI rejeita a opção desconhecida, imprime o helper e sai: "opencode não abre mais sozinho, o comando não é reconhecido completamente, só dá o helper de volta". A quebra é incondicional (a diretiva emite `--variant max` com ou sem flag) e atinge `next`/`plan`/`new`. Segundo, o mapa: das cinco flags pedidas, três foram entregues com o modelo errado e uma com provider questionável. O dev quer abrir a próxima sessão no modelo certo, com um flag, e o TUI abrir sozinho como antes.

## Persona e fluxo

- **Persona / contexto:** dev no terminal, abrindo worktrees de Issue com `pnpm worktree next/plan/new`; hoje o fluxo parou de abrir o TUI (helper no lugar) e, quando abre, o modelo pode não ser o pedido.
- **Job principal:** abrir a sessão no modelo pedido com um flag, com o TUI abrindo sozinho — sem helper, sem erro de flag.
- **Fluxo desejado:** `pnpm worktree next --go` (ou `plan`/`new`, demais flags) no terminal → claim + worktree provisionado como hoje → diretiva `launch opencode <dir> --model <mapa corrigido> --auto [--prompt …]` → TUI abre na Issue já claimada, footer confirma modelo/provider.
- **Anti-goals de produto:** cardápio fechado de 5 flags não vira seletor `/models`; sem persistência de preferência; sem tocar cardápio de execução (`/work-issue`, `/plan-issue`); sem editar config global de variantes da máquina via repo; sem flag, nada muda (preset `deepseek/deepseek-v4-flash`).

## Objetivo e aceite

- `pnpm worktree next/plan/new --go | --pro | --cheap | --alibaba` (e `--zen`, conforme o gate) abre o TUI sozinho com o modelo correspondente do mapa corrigido — footer confirma modelo/provider; nenhuma das cinco flags imprime helper/erro de flag desconhecida.
- Sem flag, a sessão abre normalmente com o preset `deepseek/deepseek-v4-flash` — nenhuma invocação imprime helper/erro de flag desconhecida.
- Guardrail: `--variant max` sai da diretiva do TUI (flag inexistente lá; o guardrail "effort max" do OPS93 era baseado em premissa falsa e sai junto). Variantes seguem vivendo na config global da máquina (`~/.config/opencode/opencode.jsonc`, OPS78/OPS89 — o TUI seleciona via Ctrl+T; `opencode run --variant max` segue sendo a via CLI para runs headless) — fora do repo.
- Guardrail: as 7 superfícies que citam o mapa/`--variant` saem atualizadas na mesma entrega (docblocks e mapa em `scripts/lib/worktree.mjs`, docblock/help em `scripts/worktree.mjs`, `.agents/shell/worktree.sh`, `.opencode/commands/worktree.md`, 2 skills, pins de teste) — sem divergência de contrato.
- Guardrail: fora do terminal interativo (comando `/worktree`, sem `TEQO_WORKTREE_TERMINAL=1`), as flags são irrelevantes e não quebram nada.

## Dados (intenção)

- **Vou apresentar dados?** Não — tooling de dev, sem métrica de produto.
- **Decisões desbloqueadas:** dev abre a sessão no modelo pedido por invocação (antes: TUI não abre e modelo pode divergir do pedido).
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição "5 flags nomeadas, mapa fixo com os IDs do pedido".

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs` (mapa L43-49 corrigido para os IDs pedidos; remoção de `--variant` da diretiva L198 e de `WORKTREE_VARIANT` L54-55; docblocks L40-41/L175 ajustados); `scripts/worktree.mjs` (docblock L24-29/L33-34 e help L821/L824/L842/L850); `.agents/shell/worktree.sh` (L15-19, L50); `.opencode/commands/worktree.md` (L7, L12); `.agents/skills/worktree-next-issue/SKILL.md` (L32, L34) e `.agents/skills/local-database/SKILL.md` (L29); `tests/unit/worktree.unit.spec.ts` (pins L160-215 da diretiva, L234-240 do mapa, L242/L274-280 do variant); nova entrada `docs/changelog/<data>-ops95.md`.
- **Precedente a olhar:** `docs/plans/worktree-flags-modelo-launch.md` (OPS93 — intenção imutável; `--variant max` e o mapa errado saíram daqui), OPS78 (`worktree-launch-default-llm-max-gateway.md` — variantes na config global), OPS24 (no-op `--go` documentado em 5 superfícies — o mesmo cuidado de sincronização de contrato vale aqui, agora em 7).
- **Risco de acoplamento:** `scripts/worktree.mjs` está em HIGH_RISK_EXACT (scripts/lib/test-affected-core.mjs:36) → diff nele = unit/int full + e2e curado no PR (E2E_CURATED_SPECS: campaignPermissionProfileHttp, campaignDemandVisibility, campaignAiTranscribe, campaignAgendaFeed, campaignNewsletter). `scripts/lib/worktree.mjs` NÃO é high-risk. `tests/unit/opencodeCommands.unit.spec.ts` NÃO é afetado (anti-goal — não mexer). Sem migration (CLI pura).

## Dependências

- Nenhuma dura. Soft: o gate decide a questão do `--zen` (Questões em aberto) antes de registrar a Issue.

## Fora de escopo

- Reabrir o cardápio de flags/preset — 5 flags fixas e preset `deepseek/deepseek-v4-flash` sem flag permanecem como no OPS93.
- Tocar prompts/cardápio de execução (`/work-issue`, `/plan-issue`) — intactos (pins de `opencodeCommands.unit.spec.ts` intocados).
- Persistir preferência de modelo por usuário/worktree — flags são por invocação.
- Editar a config global de variantes da máquina (`~/.config/opencode/opencode.jsonc`) ou `opencode.json` do repo — variantes são assunto da máquina, não do repo; se algo faltar, vira runbook, não commit.
- Reintroduzir effort/variante na diretiva do TUI por outro caminho — ver Rabbit holes.

## Rabbit holes de produto

- **Reabrir o cardápio.** Se alguém "só completar": aproveitar a correção para trocar flags, preset ou mapeamentos além do pedido. **Corte neste item:** somente os 5 mapeamentos pedidos (IDs verificados no catálogo) + remoção do `--variant`; preset e cardápio intactos.
- **Laboratório de variantes.** Reintroduzir effort max no TUI por outra via (env por worktree, config no repo) agora que a premissa do OPS93 caiu. **Corte:** variantes ficam na config global da máquina, seleção via Ctrl+T no TUI; nada disso entra no repo.
- **Sincronização parcial das 7 superfícies.** Atualizar só o código e esquecer docblock/help/shell/command/skills → contrato divergente de novo (histórico OPS24: no-op documentado em 5 superfícies saiu junto). **Corte:** as 7 superfícies saem da mesma entrega, pins de teste travam o mapa e a diretiva.

## Questões em aberto (produto)

- **Mapeamento do `--zen`?** O catálogo desta máquina NÃO tem provider `opencode-zen` (nem `opencode models`, nem `~/.config/opencode/opencode.jsonc`) — só `opencode-go/ox-alpha-free`. **Opções:** A) manter `opencode-go/ox-alpha-free` (mesmo modelo "Ox Alpha Free", provider corrigido — como o gate do OPS93 já decidiu e documentou); B) usuário informa um ID/provider `opencode-zen` que exista no catálogo. **Recomendação:** A — o modelo do catálogo casa com a intenção verbatim; se o provider `opencode-zen` surgir depois, vira item futuro. _(confirmado no gate — `--zen` → `opencode-go/ox-alpha-free`)_

## Referências

- Issue OPS95 (ID reservado, ainda não registrado)
- `docs/plans/worktree-flags-modelo-launch.md` (OPS93 — intenção imutável, exemplar estrutural; `--variant max` e o mapa errado saíram daqui)
- `docs/changelog/2026-08-24-ops93.md` (changelog do OPS93, imutável; a entrega grava entrada NOVA `docs/changelog/<data>-ops95.md` — nunca edita as existentes)
- `scripts/lib/worktree.mjs` (mapa L43-49, `WORKTREE_VARIANT` L54-55, `opencodeLaunchDirective` L188-198), `scripts/worktree.mjs` (help L821-850), `.agents/shell/worktree.sh`, `.opencode/commands/worktree.md`, `.agents/skills/worktree-next-issue/SKILL.md`, `.agents/skills/local-database/SKILL.md`, `tests/unit/worktree.unit.spec.ts` (L160-280)
- `scripts/lib/test-affected-core.mjs:36` (HIGH_RISK_EXACT de `scripts/worktree.mjs` → suíte full + e2e curado no PR)
