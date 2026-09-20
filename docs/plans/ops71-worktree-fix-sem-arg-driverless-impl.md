# Impl: Tornar worktree `fix` (sem argumento) driverless, espelhando `plan`

Status: aprovado
Atualizado em: 2026-09-20
Issue: #1226
Intenção: docs/plans/ops71-worktree-fix-sem-arg-driverless.md
Appetite restante: ~0,5 dia eng (herdado da intenção)

## Leitura da intenção

- **Outcome:** `pnpm worktree fix` sem argumento abre sessão sem mensagem automática; `pnpm worktree fix "descrição"` continua funcionando; `pnpm worktree fix --auto` sem bag lança erro.
- **O que NÃO negociar:** `fix` com argumento continua enviando mensagem sanitizada; `--auto` exige bag; `plan` sem bag permanece driverless (não quebrar OPS119).
- **O que reavaliar:** Posição exata da linha no `agent-session.mjs`; comportamento de `assertSkillAutoSupported` para `--auto` sem bag.

## Abordagem recomendada

**Opções consideradas:** A (adição pontual) | B (refatoração unificada)
**Recomendação:** A — adicionar `if (purpose === 'fix' && !sanitized) return null` imediatamente abaixo da linha 212, sem refatorar o bloco `fix || plan`, porque minimize risco e escopo.
**Rejeitadas:** B — refatorar sanitização unificada é rabbit hole de produto (intenção define corte claro).

### Componentes / mudanças

- **`purposeInvocation`** (`scripts/lib/agent-session.mjs:212`): adicionar linha `if (purpose === 'fix' && !sanitized) return null` antes do check `--auto`
- **`assertSkillAutoSupported`** (`scripts/lib/worktree.mjs:142`): validar que `fix` sem bag + `--auto` lança erro (pode já existir; verificar)
- **Migration:** sem migration (tooling interno, sem schema)
- **Access / Consent:** sem mudança
- **UI:** sem mudança (N/A)

## Fases verificáveis

1. **Tracer / schema+server** — 0,1 dia: adicionar linha driverless no `agent-session.mjs`; verificar `assertSkillAutoSupported` para `--auto` sem bag
2. **Testes** — 0,2 dia: atualizar `agentSession.unit.spec.ts` para cobrir `fix` sem bag → `null`; atualizar `worktree.unit.spec.ts` para cobrir `fix --auto` sem bag → erro
3. **Gates** — 0,1 dia: rodar `pnpm gate:fast`; push via `pnpm push`

## Rabbit holes / Não escopo (engenharia)

- Refatorar sanitização unificada — explosão de escopo; cortar em adição pontual
- Mudar comportamento de `plan` sem bag — já validado em produção (OPS119)
- Alterar `new` ou `next` — fora do escopo

## Riscos e mitigação

- **Risco:** `assertSkillAutoSupported` pode não tratar `fix` sem bag corretamente → **Mitigação:** verificar lógica existente; se necessário, adicionar check explícito
- **Risco:** Testes existentes podem falhar após mudança → **Mitigação:** rodar suíte completa antes de push

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto: `fix` sem bag → sessão driverless; `fix` com bag → mensagem; `fix --auto` sem bag → erro
- [x] Invariantes AGENTS/engineering-standards: sem mudança de access/consent; tooling interno
- [ ] Testes de domínio previstos (unit/int) onde access/write paths mudam: testes unitários atualizados para cenários novos

## Decision Quality (resumo):

- Decisões caras têm rejeitadas? Sim — refatoração unificada rejeitada (rabbit hole)
- Abordagem cabe no appetite da intenção? Sim — 0,5 dia eng, mudança pontual
- Rabbit holes nomeados? Sim — refatoração unificada, mudança em `plan`, alterar `new`/`next`
- Depth check: reusa shells/helpers existentes? Sim — espelha padrão já implementado para `plan`
- Intenção (aceite de produto) permanece satisfeita — engenharia não reescreveu o outcome? Sim — behavior espelhado exato do `plan`

Self-score: 5 — decisão clara, escopo mínimo, riscos mapeados.
