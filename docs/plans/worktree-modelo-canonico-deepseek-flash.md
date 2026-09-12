# Modelo padrão do worktree → DeepSeek V4.1 Flash (`deepseek/deepseek-flash`)

Status: rascunho
Atualizado em: 2026-09-12
Issue: #944
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng — config-only + textos + pins
Responsável: —

## Intenção

O DeepSeek lançou o V4.1 Flash em 2026-09-10 e o nome canônico do modelo na API passou a ser `deepseek-flash` (DeepSeek-V4.1-Flash). Os nomes legados `deepseek-v4-flash` e `deepseek-v4-flash-vision-exp` seguem aceitos, mas os modelos correspondentes foram aposentados: as requisições já são servidas pelo V4.1-Flash ao preço Flash (fonte oficial: https://api-docs.deepseek.com/quick_start/pricing, verificada em 2026-09-12). Hoje o fluxo `pnpm worktree next/plan/new/fix` sem flag abre o TUI com `--model deepseek/deepseek-v4-flash`, e os comandos `/work-issue`, `/plan-issue`, `/bug-fix`, `/testing-audit` pinam o nome legado no frontmatter — que sobrescreve o modelo default da sessão (docs oficiais do opencode). O humano quer o fluxo de worktree no nome canônico novo por padrão.

Isto é **future-proofing de nome canônico**, não economia: o alias legado já é cobrado ao preço Flash. O nome legado pode sumir sem aviso.

## Persona e fluxo

- **Persona / contexto:** o próprio mantenedor/agente operando o fluxo de worktrees no terminal; sem tela, sem interface.
- **Job principal:** disparar o worktree sem flag e a sessão opencode nascer já no modelo canônico `deepseek/deepseek-flash`, sem depender de flag ou config global.
- **Fluxo desejado:** o humano roda `pnpm worktree next` (ou `plan`/`new`/`fix`); o TUI abre com `/work-issue` (ou o comando do propósito) já no modelo novo; quem quiser outro modelo continua usando as flags existentes ou o override `OPENCODE_WORKTREE_MODEL`.
- **Anti-goals de produto:** não é "mais barato"; não é redesenhar o menu de flags; não é mudar comportamento dos comandos além do nome do modelo; não é mexer na config global da máquina.

## Objetivo e aceite

- O preset do fluxo de worktree (sem flag) passa a apontar para `deepseek/deepseek-flash`.
- Os quatro comandos do fluxo deixam de pinar o nome legado no frontmatter.
- Textos, help e docblocks que citam o preset refletem o nome novo; nada além do nome do modelo muda.
- O override `OPENCODE_WORKTREE_MODEL` e as 7 flags (`--cheap/--pro/--zen/--go/--alibaba/--glm/--free`) seguem intactos.
- A suíte unitária que pina o preset e o frontmatter passa com os literais novos.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — decisão única de configuração, sem ator/consumidor de dado.
- **Forma:** N/A — item config-only, sem superfície de dados.

## Dados da decisão (literais)

- Modelo canônico novo: `deepseek/deepseek-flash` (DeepSeek-V4.1-Flash).
- Modelo legado hoje no preset: `deepseek/deepseek-v4-flash`; variante legada também aposentada: `deepseek-v4-flash-vision-exp`.
- Frontmatter hoje nos 4 comandos: `model: deepseek/deepseek-v4-flash`.
- Fallback do preset: `process.env.OPENCODE_WORKTREE_MODEL || 'deepseek/deepseek-v4-flash'`.
- Regex que pina o frontmatter: `/^model: deepseek\/deepseek-v4-flash$/m`.
- Capacidades do canônico: 1M contexto, 384K output, thinking mode default, tool calls, JSON, visão (imagem).
- Preço Flash (referência, **não** ganho): cache-hit $0.003/M off-peak e $0.006/M peak; cache-miss $0.15/M off-peak e $0.3/M peak; output $0.6/M off-peak e $1.2/M peak (peak = 01:00–04:00 e 06:00–10:00 UTC, seg–sex).
- `opencode models` local lista `deepseek/deepseek-flash` (2026-09-12); models.dev descreve com reasoning options low/high/max.
- Superfícies com o literal (levantadas em 2026-09-12): `scripts/lib/worktree.mjs:36-37` (fonte única) e docblocks :43/:64/:74/:214; `scripts/worktree.mjs:29-30` e help :877; `.agents/shell/worktree.sh:22`; `.agents/skills/worktree-next-issue/SKILL.md:34`; `.opencode/commands/work-issue.md:3`, `plan-issue.md:3`, `bug-fix.md:3`, `testing-audit.md:3`; `tests/unit/worktree.unit.spec.ts:46` e :245; `tests/unit/opencodeCommands.unit.spec.ts:37`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs` (constante do preset e docblocks), os 4 `.opencode/commands/*.md` (frontmatter), textos de `scripts/worktree.mjs`, `.agents/shell/worktree.sh`, `.agents/skills/worktree-next-issue/SKILL.md` e os dois specs unitários.
- **Precedente a olhar:** OPS93 (menu de flags), OPS95 (removeu `--variant`), OPS100 (`--glm`/`--free`) — mesmo fluxo, mesmas superfícies.
- **Risco de acoplamento:** o preset é a única fonte do fallback; flags, override e aliases legados de outros providers (`cheapestinference/deepseek-v4-flash`, `alibaba-token-plan/deepseek-v4-flash`) ficam intocados.

## Dependências

- Nenhuma.

## Fora de escopo

- Menu de flags (`WORKTREE_MODEL_MAP`), o override `OPENCODE_WORKTREE_MODEL` e aliases legados de outros providers.
- Config global da máquina, `opencode.json` do repo, variantes/Ctrl+T, `--variant` na diretiva (OPS95).
- Sollinha (B201) e pool/Cursor.
- Docs históricos/congelados (`docs/plans/*`, `docs/changelog/*`, HISTORY).

## Rabbit holes de produto

- **Trocar o "cardápio" inteiro de modelos.** Se alguém "só completar": revisar preço/capacidade de todas as flags e reescrever o mapa. **Corte neste item:** só o preset sem flag + o pin dos 4 comandos.
- **Adicionar variante/thinking config ao preset.** Se alguém "só completar": emitir `--variant` (proibido pelo OPS95) ou mexer no config global. **Corte neste item:** sem flag nova, sem variante.
- **Vender economia.** Se alguém "só completar": justificar a troca como redução de custo — falso, o alias legado já é servido pelo V4.1-Flash ao preço Flash. **Corte neste item:** registrar como nome canônico/future-proofing.

## Questões em aberto (produto)

- Nenhuma — a única pergunta (incluir o frontmatter dos 4 comandos + o pin do `opencodeCommands.unit.spec.ts`?) foi decidida no gate de 2026-09-12: **opção A (sim, todos)**.

## Referências

- GitHub Issue #944 (OPS101, após `pnpm agent:register`)
- Rascunho UI (gate): N/A
- `scripts/lib/worktree.mjs` — preset e mapa de flags (fonte única do fallback)
- `tests/unit/worktree.unit.spec.ts` e `tests/unit/opencodeCommands.unit.spec.ts` — pins que o executor atualiza
- `docs/AGENT-OPS.md` — operação do paradigma de agentes paralelos
- https://api-docs.deepseek.com/quick_start/pricing — nomes canônicos e preço (verificada em 2026-09-12)
