# Promote plan-issue — agente + Action no merge (dual path)

Status: em execução
Atualizado em: 2026-08-03
Issue: #296
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: A — N/A (workflow + skill; sem UI)
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: pool

## Intenção

A OPS17 fecha o ciclo “colaborar → register não-claimável → plano em `main` → `ready`”. O promote `blocked`→`ready` ainda pode ficar só na sessão do agente (como no registro do #292/#293). Se a sessão cair ou o Passo 6 pular o flip, a Issue fica `blocked` para sempre com plano já em `main`.

Queremos o promote **robusto**: caminho feliz no agente **e** caminho determinístico no merge, sem reabrir a race de claim antes do plano existir em `main`.

## Persona e fluxo

- **Persona / contexto:** humano/agente no `/plan-issue`; pool claimando Issues `ready`.
- **Job principal:** depois do plano mergeado, a Issue vira claimável mesmo se o agente do plan-issue não promoveu.
- **Fluxo desejado:**
  1. Register com plano → Issue `blocked` (contrato OPS17).
  2. PR de planos com `Related #N` → merge em `main`.
  3. **Agente** (Passo 6) tenta `blocked`→`ready` (idempotente).
  4. **Action no merge** também lê `Related #N` e promove se a Issue ainda estiver aguardando plano.
- **Anti-goals de produto:** não promover no CI do PR **aberto** (Issue `ready` antes do merge); não promover qualquer `blocked` citado em `Related` (deps de produto).

### Esboço de fluxo (B/C/D)

Omitido — superfície A.

## Objetivo e aceite

- Action (ou job irmão de `issue-done-on-main-merge.yml`) roda só quando o PR **mergeia** em `main`.
- Body com `Related #N`: se a Issue alvo está no estado “aguardando plano” (`blocked` + link `docs/plans/` no body, ou heurística equivalente conservadora) → remove `blocked`, adiciona `ready`, comenta o motivo.
- Idempotente com o promote do agente (segunda execução é no-op / seguro).
- Skill `plan-issue` Passo 6 documenta o promote do agente **e** aponta o safety net da Action.
- Critério verificável: Issue `blocked`+plano, PR só-planos com `Related #N` mergeado **sem** flip do agente → Issue fica `ready` via Action.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A
- **Forma:** _adiada ao plano de implementação_

## Direção no codebase (hipótese)

- **Áreas prováveis:** novo workflow (ou extensão cuidadosa de `issue-done-on-main-merge.yml`), helper puro testável para parse de `Related #N` + regra de promote, `.agents/skills/plan-issue/SKILL.md` (Passo 6), nota em `docs/AGENT-OPS.md`.
- **Precedente a olhar:** `issue-done-on-main-merge.yml` (`Closes`→`done`); OPS12 `plans-only-closes`; OPS17 `#292` / `docs/plans/plan-issue-lifecycle-ready.md`.
- **Risco de acoplamento:** flip frouxo promove Issue `blocked` por dependência de produto; misturar com o job de `Closes` sem cuidado.

## Dependências

- Soft/dura: **OPS17** (`#292`) — o contrato “register com `--plan` → `blocked`” é o que a Action consome. Pode aterrissar em paralelo se a Action for no-op até esse contrato existir; preferir `depends: [OPS17]` para não claimar promote sem o ciclo de register.

## Fora de escopo

- Reabrir / reescrever o plano da OPS17 (intenção congelada para quem já claimou).
- Promover no job `ci-pr` enquanto o PR está aberto.
- Exigir plano em arquivo para Issues sem `--plan`.
- UI / Projects board.

## Rabbit holes de produto

- **Promover todo `Related #N`.** **Corte:** heurística conservadora (link de plano e/ou estado inequívoco de “aguardando plano”).
- **Só Action, matar promote do agente.** **Corte:** manter os dois — sessão feliz + safety net.

## Questões em aberto (produto)

- **Heurística do flip?** **Opções:** A) `blocked` + link `docs/plans/` no body · B) label `needs:plan` · C) qualquer `blocked` em `Related`. **Recomendação:** A. _(assumido — validar)_
- **Depends duro em OPS17?** **Opções:** A) sim (`depends: [OPS17]`) · B) soft / paralelo. **Recomendação:** A. _(assumido — validar)_

## Referências

- GitHub Issue #296
- GitHub Issue OPS17 #292
- `.github/workflows/issue-done-on-main-merge.yml`
- `.agents/skills/plan-issue/SKILL.md`
- `docs/plans/plan-issue-lifecycle-ready.md`
