# Tornar worktree `fix` (sem argumento) driverless, espelhando `plan`

Status: rascunho
Atualizado em: 2026-09-20
Issue: #1226
Priority: P2
Impeccable: A — N/A
Design UI: N/A
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

`pnpm worktree fix` sem argumento hoje abre a sessão e auto-envia a string vazia como mensagem do usuário, resultando em um prompt vazio para o agente. O `plan` (sem bag) já é driverless — abre a sessão sem mensagem, esperando o humano digitar o contexto. O `fix` deve espelhar esse comportamento: sem argumento → sessão aberta, nenhuma mensagem automática.

## Persona e fluxo

- **Persona / contexto:** dev que identificou um bug e quer diagnosticar interativamente (campo/mesa, terminal)
- **Job principal:** Abrir uma sessão `fix` sem bag sem que o agente receba uma mensagem vazia
- **Fluxo desejado:** `pnpm worktree fix` → sessão abre, prompt vazio → humano digita o contexto do bug
- **Anti-goals de produto:** Não quebrar `pnpm worktree fix "descrição do bug"` — o caso com argumento continua funcionando como hoje

### Esboço de fluxo

```text
fix (sem arg) → sessão aberta, prompt vazio → humano digita
fix (com arg)  → sessão aberta, argumento sanitizado auto-enviado (como hoje)
plan (sem arg) → sessão aberta, prompt vazio (referência — sem mudança)
```

## Objetivo e aceite

- `pnpm worktree fix` (sem argumento) abre sessão driverless — nenhuma mensagem automática enviada
- `pnpm worktree fix "descrição"` continua funcionando como hoje (argumento sanitizado → mensagem auto-enviada)
- `pnpm worktree fix --auto` (sem argumento) lança erro alto explicando que `--auto` exige um bag
- Testes unitários atualizados cobrem o novo comportamento

## Dados (intenção)

- **Vou apresentar dados?** N/A — feature de tooling interna, sem métrica de produto
- **Decisões desbloqueadas:** Executor — comportamento driverless do fix sem bag
- **Forma:** adiada ao plano de implementação

## Dados da decisão (literais)

- `if (purpose === 'plan' && !sanitized) return null` — padrão existente em `scripts/lib/agent-session.mjs:212`
- Nova linha: `if (purpose === 'fix' && !sanitized) return null` — posição imediatamente abaixo, antes do `auto` check

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/agent-session.mjs` (`purposeInvocation`), `scripts/lib/worktree.mjs` (`assertSkillAutoSupported`), `tests/unit/agentSession.unit.spec.ts`, `tests/unit/worktree.unit.spec.ts`
- **Precedente a olhar:** OPS119 — `plan` sem bag driverless (linha 212 do `agent-session.mjs`)
- **Risco de acoplamento:** Baixo — mudança pontual em lógica de sanitização de argumento, não toca collections/negócio

## Dependências

- OPS119 (referência de padrão já implementado para `plan`)

## Fora de escopo

- Mudar comportamento de `plan` sem bag (já é driverless)
- Alterar `new` ou `next` (fora do escopo desta issue)

## Rabbit holes de produto

- **Refatorar sanitização unificada.** Se alguém "só completar" a limpeza: explosão de escopo. **Corte neste item:** adicionar apenas a linha `if (purpose === 'fix' && !sanitized) return null`, sem refatorar o bloco `fix || plan`.

## Questões em aberto (produto)

- Nenhuma — comportamento espelhado do `plan` já validado em produção (OPS119).

## Referências

- `scripts/lib/agent-session.mjs:208-217` — `purposeInvocation`, bloco `fix || plan`
- `scripts/lib/worktree.mjs:142` — `assertSkillAutoSupported`, lógica de `--auto`
- `tests/unit/agentSession.unit.spec.ts:243-252` — testes de `fix` com/san bag
- `tests/unit/worktree.unit.spec.ts:599-604` — testes de `assertSkillAutoSupported`
- `AGENTS.md` — convenção de sessões driverless (OPS119)
