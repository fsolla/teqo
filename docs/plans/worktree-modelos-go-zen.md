# Modelos padrão do worktree: `--go` → DeepSeek V4.1 Flash e `--zen` → Muse Spark 1.3 Free

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1048
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng — 2 valores do mapa + textos + pin
Responsável: —

## Intenção

Com o lançamento do DeepSeek V4.1 Flash (2026-09-10), ele virou também o modelo mais vantajoso no OpenCode Go — hoje `pnpm worktree … --go` abre a sessão em `opencode-go/hy3`, e o humano quer a flag apontando para o V4.1 Flash. Na mesma passada, `--zen` deve abrir no "Muse Spark 1.3 Free" em vez do atual `opencode-go/ox-alpha-free`. São dois valores do mapa fixo de flags: nada de mecanismo, cardápio ou preset.

## Persona e fluxo

- **Persona / contexto:** mantenedor/agente abrindo worktrees de Issue no terminal, escolhendo o modelo com uma flag no momento da invocação.
- **Job principal:** abrir a sessão já no modelo desejado com um único flag, sem editar config nem decorar ID.
- **Fluxo desejado:** `pnpm worktree next|plan|new|fix --go` (ou `--zen`) → claim/provisionamento como hoje → diretiva `launch … --model <novo ID>` → sessão nasce no modelo certo; footer confirma modelo/provider.
- **Anti-goals de produto:** não vira seletor de modelos nem flag nova; não muda o preset sem flag; não mexe nas outras flags; não persiste preferência.

## Objetivo e aceite

- `pnpm worktree next|plan|new|fix --go` abre a sessão em `opencode-go/deepseek-v4.1-flash`; `--zen` abre em `opencode/muse-spark-1.3-contributor-free`.
- Superfícies que citam o mapa saem sincronizadas na mesma entrega (código, docblocks/help, shell, command, skill, pin unitário) — sem contrato divergente.
- Sem flag, o preset `deepseek/deepseek-flash` permanece byte a byte; `cheap/pro/alibaba/glm/free` e o fail-high at-most-one intactos.
- Guardrail: nenhuma menção a `--variant` volta à diretiva; config global da máquina fora do repo.

## Dados (intenção)

- **Vou apresentar dados?** Não — tooling de dev, sem métrica de produto.
- **Decisões desbloqueadas:** dev/agente confia que `--go`/`--zen` apontam para os modelos correntes, sem consultar o catálogo antes de cada invocação.
- **Forma:** N/A — item config-only.

## Dados da decisão (literais)

| Flag    | Valor hoje                  | Valor novo                                 |
| ------- | --------------------------- | ------------------------------------------ |
| `--go`  | `opencode-go/hy3`           | `opencode-go/deepseek-v4.1-flash`          |
| `--zen` | `opencode-go/ox-alpha-free` | `opencode/muse-spark-1.3-contributor-free` |

- Preset sem flag (intocado): `deepseek/deepseek-flash` (`OPENCODE_PRESET_MODEL`; override `OPENCODE_WORKTREE_MODEL`).
- IDs verificados no catálogo local (`opencode models`, 2026-09-15): `opencode-go` tem `deepseek-v4.1-flash` ("DeepSeek V4.1 Flash"); o `-free` do Muse Spark só existe no provider `opencode` (OpenCode Zen) — `opencode-go` só tem `muse-spark-1.3-contributor` (sem free); logo `--zen` passa a apontar para o provider `opencode`, coerente com o nome da flag.
- Chaves intocadas do mapa: `cheap=cheapestinference/deepseek-v4-flash`, `pro=deepseek/deepseek-v4-pro`, `alibaba=alibaba-token-plan/deepseek-v4-flash`, `glm=opencode-go/glm-5.3-flash`, `free=openrouter/openrouter/free`.

## Superfícies a sincronizar (caminho, não linha)

- `scripts/lib/worktree.mjs` — `WORKTREE_MODEL_MAP` (dono do mapa) + docblock do mapa (nota OPS112).
- `scripts/worktree.mjs` — docblock (o help interpola o mapa e se atualiza sozinho).
- `.agents/shell/worktree.sh` — docblock da função (lista de IDs e nota histórica do `--go`).
- `.opencode/commands/worktree.md` — bloco do `next`.
- `.agents/skills/worktree-next-issue/SKILL.md` — prosa do default-go e do launch (manter a história OPS93/95 e ajustar os valores correntes).
- `tests/unit/worktree.unit.spec.ts` — pin `toEqual` do mapa.
- `.agents/skills/local-database/SKILL.md` — cita o mapa sem IDs: confirmar que nada muda.
- Nova entrada `docs/changelog/2026-09-15-ops112.md` (histórico existente não se edita).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs` (fonte única), textos que o citam (acima) e o pin unitário.
- **Precedente a olhar:** OPS95 (`docs/plans/worktree-flags-modelo-correcao.md` — values-only em 2 chaves + sync + pin), OPS100 (`--glm`/`--free`), OPS101 (preset canônico).
- **Risco de acoplamento:** `scripts/worktree.mjs` está em `HIGH_RISK_EXACT` (`scripts/lib/test-affected-core.mjs`) → diff nele dispara unit/int full + e2e curado no PR; `scripts/lib/worktree.mjs` não é high-risk. Sem DB, migration, access, UI ou e2e novo.

## Dependências

- Nenhuma.

## Fora de escopo

- Preset sem flag (`deepseek/deepseek-flash`) e override `OPENCODE_WORKTREE_MODEL`.
- Demais flags do mapa (`cheap/pro/alibaba/glm/free`) e o mecanismo fail-high at-most-one.
- Reintroduzir `--variant`/variantes na diretiva (OPS95) ou mexer na config global da máquina.
- Editar docs históricos/congelados (`docs/plans/*` anteriores, changelogs, HISTORY).

## Rabbit holes de produto

- **Revisar o cardápio inteiro.** Se alguém "só completar": re-checar preço/capacidade e reescrever todas as chaves. **Corte neste item:** só `go` e `zen`.
- **Sincronização parcial.** Atualizar código e esquecer shell/command/skill/pin → contrato divergente (histórico OPS24/OPS95). **Corte:** todas as superfícies acima na mesma entrega.
- **Trocar o preset "de brinde".** O V4.1 Flash já é o preset; qualquer mudança nele fica fora.

## Questões em aberto (produto)

- Nenhuma — a única dúvida (o `--zen` apontar para o provider `opencode`/Zen, não `opencode-go`) foi resolvida na exploração: o ID do catálogo com o nome "Muse Spark 1.3 Free" é `opencode/muse-spark-1.3-contributor-free`, coerente com o nome da flag.

## Referências

- `docs/plans/worktree-flags-modelo-correcao.md` (OPS95 — precedente de correção values-only + sync)
- `docs/plans/worktree-modelo-canonico-deepseek-flash.md` (OPS101 — preset canônico; não mexer)
- `scripts/lib/worktree.mjs` (mapa/preset — fonte única), `tests/unit/worktree.unit.spec.ts` (pin)
- `scripts/lib/test-affected-core.mjs` (HIGH_RISK_EXACT de `scripts/worktree.mjs`)

## Self-score (shaping ≥4)

1. Um outcome verificável? **Sim** — flags resolvem para os IDs novos. 2. Appetite declarado e cabe? **Sim** — 2 valores + textos + pin. 3. Persona/job/aceite claros? **Sim**. 4. Direção é hipótese? **Sim** — caminhos sem contrato técnico. 5. Zero decisão dura de engenharia? **Sim** — valores literais são produto (IDs pedidos). **Total: 5/5.**
