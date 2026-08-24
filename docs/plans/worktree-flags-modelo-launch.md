# Flags de modelo no launch do worktree CLI (`--cheap` / `--pro` / `--zen` / `--go` / `--alibaba`)

Status: rascunho
Atualizado em: 2026-08-24
Issue: #859
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Hoje, "trocar de modelo no worktree" = editar uma constante no código (OPS26). O dev quer escolher o modelo **na hora** de abrir a sessão, como argumento do comando: `pnpm worktree next --cheap` deve abrir o TUI do opencode já com DeepSeek V4 Flash (Cheapest Inference) em effort max, sem editar nada e sem depender da config da máquina. Cinco cardápios fixos: `--cheap`, `--pro`, `--zen`, `--go`, `--alibaba`. O `--go` histórico (no-op do OPS24) ganha significado real sem quebrar o hábito.

## Persona e fluxo

- **Persona / contexto:** dev no terminal, abrindo worktrees de Issue; quer trocar de modelo conforme o custo/qualidade do momento, sem lembrar de config global nem editar arquivo.
- **Job principal:** abrir a próxima sessão no modelo certo com um flag, no mesmo fluxo que já usa.
- **Fluxo desejado:** `pnpm worktree next --cheap` (ou `plan`/`new`) no terminal → claim + worktree provisionado como hoje → diretiva `launch opencode <dir> --model <mapa> --variant max --auto --prompt …` → TUI abre na Issue já claimada, footer confirma modelo/provider/effort.
- **Anti-goals de produto:** não vira seletor genérico de modelos (tipo `/models`); não muda o cardápio de execução de Issues (`/work-issue`, `/plan-issue`); não persiste preferência; não toca a config global do humano via repo; sem flag, nada muda.

## Objetivo e aceite

- Rodar `pnpm worktree next --cheap | --pro | --zen | --go | --alibaba` no terminal abre o TUI com o modelo correspondente do mapa e o footer indicando effort `max` — nas cinco flags.
- Guardrail: a sessão abre em effort max **sempre**; se o modelo não expuser variante max, falha alto — nunca abrir silenciosamente em effort errado.
- Guardrail: fora do terminal interativo (comando `/worktree`, sem `TEQO_WORKTREE_TERMINAL=1`), as flags são irrelevantes e não quebram nada.
- Guardrail: sem flag, o comportamento atual permanece intacto (preset `deepseek/deepseek-v4-flash`, effort max, no-op de `--stay`).

## Dados (intenção)

- **Vou apresentar dados?** Não — tooling de dev, sem métrica de produto.
- **Decisões desbloqueadas:** dev escolhe modelo por invocação (antes: escolha só na edição da constante).
- **Forma:** *adiada ao plano de implementação* — aqui só a restrição "cardápio fixo de 5 flags nomeadas".

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs` (mapa flag→`{model, variant}` + emissão de `--model`/`--variant` em `opencodeLaunchDirective`); `scripts/worktree.mjs` (parseArgs/help/docblock); `.agents/shell/worktree.sh` e `.opencode/commands/worktree.md` (contrato do `--go`, docs); `tests/unit/worktree.unit.spec.ts` e `tests/unit/opencodeCommands.unit.spec.ts` (pins das 5 flags); skills que citam o preset.
- **Precedente a olhar:** OPS78 (`worktree-launch-default-llm-max-gateway.md` — variante max + gateway), OPS33 (`worktree-next-claima-issue-deterministicamente.md`), OPS24 #569 (`worktree-go-*.md` — no-op documentado em 5 superfícies), OPS26 (troca de modelo = constante).
- **Risco de acoplamento:** `scripts/worktree.mjs` está em HIGH_RISK_EXACT → e2e curado no PR; o contrato `--go` está documentado em 5 superfícies (docblock/help do script, `worktree.sh`, `worktree.md`, 2 skills) e todas precisam sair da mesma entrega.

## Dependências

- Nenhuma dura. Soft: validação empírica do `--variant max` nos alvos sem variante configurada (ver Questões em aberto) — pode exigir ajuste de config de máquina, que fica fora do repo.

## Fora de escopo

- Mudar prompts/cardápio de execução (`/work-issue`, `/plan-issue`) — intactos.
- Aceitar modelo/provider arbitrário (cardápio aberto) — vira o `/models` do opencode; destino: upstream.
- Persistir preferência por usuário/worktree — `OPENCODE_WORKTREE_MODEL` já cobre default fixo manual.
- Mudar o default sem flag — reabriria OPS26/OPS78 sem evidência nova; destino: outro item.
- Editar config global de variantes da máquina via repo — se necessário, vira runbook, não commit.

## Rabbit holes de produto

- **Cardápio aberto.** Se alguém "só completar": aceitar qualquer `provider/model` como flag. **Corte neste item:** mapa fixo commitado com as 5 flags nomeadas.
- **Persistência de preferência.** "Guarda o último `--cheap` pra sempre" → estado e sobrescrita confusa do TUI (histórico OPS78). **Corte:** flags são por invocação; env continua sendo o escape de default.
- **Laboratório de variantes.** Verificar `--variant max` nos alvos sem `variants` pode virar caça de configs experimentais. **Corte:** verificação pontual + falha alta; sem inventar config no repo.

## Questões em aberto (produto)

- **Mapeamento do `--zen`?** O "Ox Alpha Free (Unlimited)" existe só como `opencode-go/ox-alpha-free`; o provider "OpenCode Zen" não tem ox-alpha-free. **Opções:** A) `--zen` → `opencode-go/ox-alpha-free` (nome de exibição bate com o pedido; a atribuição de provider no pedido foi engano); B) `--zen` → um modelo free do Zen (hy3-free etc.). **Recomendação:** A — o nome de exibição casa com a intenção verbatim; correção do provider é documentada no plano. _(confirmado no gate — `--zen` → `opencode-go/ox-alpha-free`)_
- **Escopo das flags: só `next` ou também `plan`/`new`?** **Opções:** A) só `next`; B) os três, mesmo caminho de diretiva. **Recomendação:** B — a diretiva é compartilhada; separar criaria handoff inútil. _(confirmado no gate — os três)_
- **`--variant max` em modelo sem variante configurada?** **Opções:** A) abrir mesmo assim e aceitar o que vier; B) falhar alto se a variante não aplicar. **Recomendação:** B — effort max é guardrail; impl verifica empiricamente cada alvo e documenta no impl-plan. _(confirmado no gate — humano afirma que os 5 alvos expõem a variante max; guardrail defensivo permanece)_
- **Convivência do novo `--go` com o no-op histórico?** **Opções:** A) manter no-op e criar flag diferente; B) remapear `--go` para o provider OpenCode Go. **Recomendação:** B — o no-op só reproduzia o default (transição suave), mas o contrato documentado nas 5 superfícies sai atualizado nesta mesma entrega. _(confirmado no gate — remapear)_

## Referências

- Issue OPS93 (ID reservado, ainda não registrado)
- `docs/plans/worktree-launch-default-llm-max-gateway.md` (OPS78 — variante max, gateway sem créditos)
- `docs/plans/worktree-next-claima-issue-deterministicamente.md` (OPS33) e `docs/plans/worktree-go-*.md` (OPS24 — no-op `--go`, histórico congelado)
- `scripts/lib/worktree.mjs` (preset L32-33, `opencodeLaunchDirective` L150-162, skill commands L47-51), `scripts/worktree.mjs` (parseArgs L762, help L769-800), `.agents/shell/worktree.sh`, `.opencode/commands/worktree.md`, `tests/unit/worktree.unit.spec.ts` L145-206, `tests/unit/opencodeCommands.unit.spec.ts` L36-38
