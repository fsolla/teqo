# Ciclo de vida do plan-issue — colaboração fechada antes de claim

Status: registrado (blocked até plano em main)
Atualizado em: 2026-08-02
Issue: #292
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: A — N/A (processo/skills + tooling do paradigma; sem UI)
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Enquanto se colabora no `/plan-issue`, o agente às vezes registra Issues e abre o PR de planos **antes** do lote estar fechado. Como `agent:register` nasce com label `ready`, o pool (ou outro claim) pode pegar a Issue — e o humano ainda está mudando a intenção. Pior: a ordem atual (Issue `ready` → depois PR do plano) permite claim **antes** do plano existir em `main`; o link de plano hoje é só _warn_, não bloqueio.

Queremos um ciclo em que colaborar é barato de reverter, e só vira trabalho claimável quando a intenção está confirmada **e** o plano de intenção está em `main`.

## Persona e fluxo

- **Persona / contexto:** humano moldando um lote com o agente; pool autônomo rodando em paralelo.
- **Job principal:** fechar intenção sem medo de que o pool já esteja executando a versão errada.
- **Fluxo desejado:**
  1. Explorar / fatiar / rascunhar planos locais (`Issue: —`).
  2. Overview do lote (gate) → iterar até o humano **confirmar explicitamente**.
  3. Só então: registrar Issues **ainda não claimáveis**, commit + PR dos planos (`Related #N`), merge em `main`.
  4. Só então: Issues passam a `ready` e entram na fila.
- **Anti-goals de produto:** não inventar um segundo tracker fora do GitHub; não exigir revisão humana no PR de planos além do auto-merge já existente; não travar chores sem plano (`agent:file-miss`, débitos triviais).

### Esboço de fluxo (B/C/D)

Omitido — superfície A (processo).

## Objetivo e aceite

- Colaborar no lote **não** cria Issue no GitHub nem PR até confirmação explícita do humano após o overview.
- Issue nascida de `plan-issue` com plano **não** é claimável (`ready`) enquanto o plano de intenção não estiver em `main`.
- Depois do plano em `main`, a Issue fica claimável sem passo humano extra opaco (promote determinístico no fim do registro / pós-merge).
- Chores/specs sem `--plan` continuam podendo nascer `ready` (comportamento atual preservado onde não há plano).
- Critério verificável: com pool ligado, uma Issue recém-registrada com plano linkado **não** aparece na fila elegível até o promote pós-plano-em-`main`.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — processo do paradigma, não métrica de campanha.
- **Forma:** _adiada ao plano de implementação_

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.cursor/skills/plan-issue/` (SKILL + checklist Passo 5/6), `scripts/agent-register.mjs`, elegibilidade do pool (`scripts/lib/agent-pool-eligibility.mjs` + pins em `tests/unit/agentPoolEligibility.unit.spec.ts`), menção curta em `docs/AGENT-OPS.md` / skill `agent-pool` se o contrato de labels mudar.
- **Precedente a olhar:** gate Passo 5 já escrito na skill (hoje só soft); `needs:consent` / `requirements-changed` como “não claimar”; OPS12 `plans-only-closes` (`Related #N`).
- **Risco de acoplamento:** fila `ready` é o contrato compartilhado de `agent:claim` e do pool — mudar o momento do flip afeta os dois.

## Dependências

- Nenhuma dura. Soft: pool ativo torna a race visível; o contrato vale mesmo com pool parado.

## Fora de escopo

- Reescrever o paradigm inteiro / bipartir plan-exec.
- UI de board / segundo estado visual no GitHub Projects.
- Exigir plano em arquivo para **toda** Issue (chores body-only continuam ok).
- Safety net Action “no merge de `docs/plans/**` promove Issues” — nice-to-have; v1 pode ser o próprio Passo 6 pós-merge do PR de planos.

## Rabbit holes de produto

- **Novo label `spec`/`planning`.** Se alguém “só completar”: proliferação de estados. **Corte neste item:** reusar `blocked` (ou um `needs:*` já no vocabulário de gate humano) até o promote → `ready`; só criar label nova se `blocked` confundir demais com dep bloqueada.
- **Verificar blob do plano no tick do pool (IO no GitHub a cada 10 min).** **Corte neste item:** preferir “não nasce `ready` até promote”; checagem de arquivo em `main` só se o promote sozinho não fechar o buraco.
- **Frase mágica rígida demais.** **Corte:** confirmação explícita após o overview (ex. “confirma o lote” / “pode registrar”); não exigir token cerimonial único se o humano já disse claramente para registrar.

## Questões em aberto (produto)

- **Enquanto espera o plano em `main`, a Issue fica com qual label?** **Opções:** A) `blocked` (já exclui claim/pool) · B) novo `needs:plan` no conjunto human-gate · C) sem Issue até o plano mergear (inverte ordem; complica `Related #N`). **Recomendação:** A — register com `--plan` implica não-`ready` (`blocked`); promote `blocked`→`ready` quando o plano estiver em `main`. _(assumido — validar)_
- **Quem promove para `ready`?** **Opções:** A) fim do Passo 6 na mesma sessão (após merge do PR de planos) · B) Action no merge de `docs/plans/**` · C) sempre humano. **Recomendação:** A no v1; B fora de escopo salvo se A falhar na prática. _(assumido — validar)_
- **Confirmção do gate:** basta overview + “pode registrar”, ou o agente pode registrar se o humano só disser “ok” ambíguo no meio da edição? **Opções:** A) só após overview apresentado + OK explícito ao lote · B) qualquer “ok” conta. **Recomendação:** A. _(assumido — validar)_

## Referências

- GitHub Issue #292
- `.cursor/skills/plan-issue/SKILL.md` (Passo 5 gate / Passo 6 register)
- `scripts/agent-register.mjs` (default `ready`)
- `scripts/lib/agent-pool-eligibility.mjs` (`issueHasPlanLink` = warn)
- `docs/AGENT-OPS.md`
- `.cursor/skills/agent-pool/SKILL.md`
