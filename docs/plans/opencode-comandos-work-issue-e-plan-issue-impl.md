# Impl: OpenCode: comandos `/work-issue` e `/plan-issue` (atalho direto para as skills)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #570
Intenção: docs/plans/opencode-comandos-work-issue-e-plan-issue.md
Appetite restante: herdado (~0,5 dia eng) — não estoura

## Leitura da intenção

- **Outcome:** digitar `/work-issue` ou `/plan-issue` no TUI do opencode dispara, com zero fricção, a skill de mesmo nome — carregada pela ferramenta de skills, seguida ponta a ponta, com `$ARGUMENTS` repassado; os comandos aparecem no autocomplete.
- **O que NÃO negociar:** o corpo do comando **não** transcreve a skill (fonte canônica é `.agents/skills/`); não existe terceiro fluxo de planejamento; só as duas skills pedidas ganham comando.
- **O que reavaliar:** a hipótese de `model:` no frontmatter (ver decisão 1) e se o comando deve fixar `agent` (ver decisão 2) — ambas já direcionadas pela intenção, confirmadas contra a fonte oficial do opencode.

## Abordagem recomendada

```mermaid
flowchart LR
  A[Usuário digita /work-issue ou /plan-issue] --> B[opencode expande .opencode/commands/<nome>.md]
  B --> C[Frontmatter: description p/ autocomplete + model deepseek/deepseek-v4-flash]
  C --> D[Corpo: instrução curta — carregar skill pelo nome exato via ferramenta de skills]
  D --> E[$ARGUMENTS repassados no fim]
  E --> F[Agente carrega .agents/skills/<nome>/SKILL.md e segue o fluxo ponta a ponta]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — dois arquivos markdown em `.opencode/commands/` seguindo o mecanismo nativo de commands (mesmo precedente de `issue.md`/`worktree.md`), frontmatter `description` + `model`, corpo de instrução sem transcrição, `$ARGUMENTS` no fim. Porque é o único caminho que usa o mecanismo do produto (autocomplete no TUI vem do frontmatter `description`) sem criar infra paralela.

### Decisões de engenharia

**1. `model:` no frontmatter dos comandos?**

- Opções: A) `deepseek/deepseek-v4-flash` nos dois | B) herdar o modelo da sessão.
- Recomendação: **A** — o OPS26 já lança o opencode com `--model deepseek/deepseek-v4-flash` e `/work-issue` como primeira mensagem; o atalho manual deve produzir a mesma sessão de modelo de preferência. `model` é frontmatter documentado do opencode (formato `provider/model`). O pool roda em Cursor, não no TUI do opencode — o pin não conflita com o `model:` da Issue.
- Rejeitada: B porque a sessão herdaria o último modelo usado, e o launch automático e o atalho manual divergiriam.

**2. `agent` no frontmatter?**

- Opções: A) não fixar (usa o agente da sessão) | B) fixar `build`.
- Recomendação: **A** — o fluxo de `work-issue` exige pausa para confirmação humana e deliberação (Plan mode), que vivem no agente da sessão; fixar `build` quebraria o gate humano e `plan-issue` tem gate próprio. `agent` é opcional e defaults para o agente da sessão.
- Rejeitada: B porque o atalho não deve escolher o agente — a skill decide o modo.

**3. Como guardar o acoplamento nome-comando ↔ nome-skill?**

- Opções: A) teste unit leve que pina os dois nomes | B) confiar em convenção (nomes amarrados "na mão").
- Recomendação: **A** — spec novo `tests/unit/opencodeCommands.unit.spec.ts` (sem DB, síncrono, barato): para cada comando novo, existe o arquivo, o frontmatter tem `description` e `model: deepseek/deepseek-v4-flash`, o corpo referencia o nome exato da skill **e** `.agents/skills/<nome>/SKILL.md` existe. Renomear uma skill → build falha → renomear o comando junto.
- Rejeitada: B porque o risco da intenção ("renomeou a skill, o comando quebra silencioso") é exatamente o que um teste de 20 linhas elimina.

### Componentes / mudanças

- **`.opencode/commands/work-issue.md`** (novo): frontmatter `description` (pt-BR, autocomplete) + `model: deepseek/deepseek-v4-flash`; corpo instruindo carregar a skill `work-issue` pela ferramenta de skills e segui-la ponta a ponta; `$ARGUMENTS` no fim.
- **`.opencode/commands/plan-issue.md`** (novo): idem, referenciando a skill `plan-issue`.
- **`tests/unit/opencodeCommands.unit.spec.ts`** (novo): guard de acoplamento (decisão 3).
- **Migration:** sem migration (nada de schema).
- **Access / Consent:** N/A — arquivos de configuração do opencode.
- **UI:** Impeccable A — N/A (sem UI de produto).

### Formato do comando (exemplo)

```markdown
---
description: <descrição curta em pt-BR para o autocomplete>
model: deepseek/deepseek-v4-flash
---

Carregue a skill `<nome>` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta. A fonte canônica é `.agents/skills/<nome>/SKILL.md` — não a transcreva nem recrie o fluxo.

$ARGUMENTS
```

## Fases verificáveis

1. **Comandos** — criar `.opencode/commands/work-issue.md` e `plan-issue.md` (frontmatter + corpo + `$ARGUMENTS`); sem tocar em `issue.md`/`worktree.md` nem em `opencode.json`.
2. **Guard de acoplamento** — `tests/unit/opencodeCommands.unit.spec.ts` (frontmatter, nome da skill, `$ARGUMENTS`, existência da skill referenciada).
3. **Gates** — `pnpm gate:fast` (inclui prettier — `.opencode/` não está no `.prettierignore` —, lint, tsc, testes); `pnpm push`; PR Ready `--base main` com `Closes #570` + auto-merge.

Verificação manual pós-merge (pelo humano, não em CI): `/work-issue` e `/plan-issue` no autocomplete do TUI.

## Rabbit holes / Não escopo (engenharia)

- Um comando por skill do repo (só as duas; o padrão fica provado pelo par).
- Transcrever o corpo das skills dentro do comando (duplicação cara de manter).
- Validar o TUI em CI (autocomplete é comportamento do produto, não testável headless aqui).
- `subtask`/plugins/`opencode.json` — nada disso é necessário.

## Riscos e mitigação

- **Diferença de versão do opencode no parsing do frontmatter:** mitigado usando só chaves documentadas (`description`, `model`) — verificadas na fonte oficial (opencode.ai/docs/commands, atualizada 2026-08-09).
- **Renome de skill quebra o comando silenciosamente:** mitigado pelo guard unit (decisão 3) — o build falha junto.
- **`model:` no frontmatter sobrescreve o modelo da sessão:** é o comportamento desejado (OPS26 alinhado); documentado na decisão 1.
- **Prettier rejeitar o frontmatter YAML:** mitigado escrevendo frontmatter mínimo no estilo dos arquivos existentes e rodando `pnpm format:check` na fase 3.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (atalho direto às duas skills, sem transcrição, `$ARGUMENTS` repassado, autocomplete)
- [x] Invariantes AGENTS/engineering-standards (sem DB, sem schema, sem PII — arquivos de config)
- [x] Testes previstos: `tests/unit/opencodeCommands.unit.spec.ts` (guard de acoplamento)
