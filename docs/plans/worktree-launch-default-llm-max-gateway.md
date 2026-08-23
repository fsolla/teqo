# Default de launch do worktree opencode passa a usar o DeepSeek na variante max servido pelo gateway da Vercel

Status: rascunho
Atualizado em: 2026-08-23 (fix de variantes)
Issue: #784
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Hoje `pnpm worktree next/plan/new` terminam abrindo o opencode com o DeepSeek no modo default, servido direto pelo provedor de inferência mais barato. A política mudou: a sessão que abre nesses lançamentos deve usar a variante de raciocínio mais forte (max) do DeepSeek, servida pelo gateway de IA da Vercel — rota com cache, estabilidade e failover, em vez da rota direta atual. Trocar o default é editar a constante do preset (o próprio mecanismo OPS26 diz "trocar de modelo é editar a constante"), mas hoje o repo não expõe a variante max nem o provider do gateway — este item expõe os dois e só isso. Não queremos mudar o cardápio de modelos de execução de Issues, nem a config de máquina do humano.

## Persona e fluxo

- **Persona / contexto:** dev que lança worktrees de planejamento/execução e cai direto numa sessão opencode com a tarefa pela frente.
- **Job principal:** abrir a sessão do worktree já no modelo de raciocínio mais forte, sem nenhuma ação manual.
- **Fluxo desejado:** rodar `pnpm worktree next/plan/new` → a sessão abre com a variante max servida pelo gateway → trabalho começa.
- **Anti-goals de produto:** não trocar o modelo de execução de Issues (work-issue); não tocar no `~/.config/opencode/opencode.jsonc` do humano; não virar item de infra/credencial do gateway em si.

## Objetivo e aceite

- Ao rodar cada um dos três comandos de launch, a sessão abre com a variante max via gateway — verificável pela linha de launch emitida pelo preset e pelos testes unitários atualizados.
- Guardrails: nenhuma mudança no fluxo de execução de Issues; config global do humano intocada; docs históricos congelados.

## Dados (intenção)

Dados: N/A — item de tooling/launch, sem superfície de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs:23` (constante do preset, emitida em `:143`); testes `tests/unit/worktree.unit.spec.ts:151-197` e `tests/unit/opencodeCommands.unit.spec.ts:37`; repo `opencode.json` (adicionar provider OpenAI-compatible do gateway e expor a variante max); textos de doc `.agents/shell/worktree.sh:10`, `scripts/worktree.mjs:27,778`, `.agents/skills/worktree-next-issue/SKILL.md:34`.
- **Fix de variantes (observação ao vivo):** as variantes `low`/`high`/`max` não aparecem no TUI do opencode para um provider Vercel AI Gateway porque o campo `variants` precisa estar declarado no **modelo** dentro do `opencode.json`. O repo hoje define `cheapest-inference/deepseek-v4-flash` sem `variants`; o global define `cheapestinference/deepseek-v4-flash` COM `variants`. Ao adicionar o provider do gateway em `opencode.json`, o model config DEVE incluir `variants` com as definições (low/high/max com `reasoningEffort`) — sem isso, o TUI nunca oferece a seleção. Formato: `provider.<name>.models.<modelId>.variants.<variantName>.{ reasoningEffort: "max", ... }`.
- **Precedente a olhar:** OPS26 (criou o preset e o mecanismo "trocar modelo = editar a constante"), OPS31/OPS25 (extensões do launch).
- **Risco de acoplamento:** baixo — a constante é single source e os testes a seguram; qualquer mudança de string quebra testes, o que é a verificação do item. Fix de variantes é config-only em `opencode.json`.

## Dependências

- Nenhuma dura. Soft: provider do gateway disponível/validável no ambiente de dev local para o executor confirmar a rota.

## Fora de escopo

- Config global `~/.config/opencode/opencode.jsonc` do humano — fica de fora por decisão de produto.
- Cardápio de modelos de execução de Issues (work-issue/plan-issue como comandos de trabalho) — não muda.
- Documentos históricos (`docs/plans`, `docs/CHANGELOG-AGENTS.md`) — congelados, não editar.
- Infra/credenciais do gateway — o repo só expõe o provider; chaves/endpoint continuam fora do repo.

## Rabbit holes de produto

- **"Só completar a string nos comandos".** Se alguém apenas trocar o modelo nos frontmatters dos comandos, muda a execução de Issues (fora de escopo) e ignora o provider do gateway. **Corte neste item:** a mudança é no default de LAUNCH do worktree (preset + provider no repo), não no cardápio de execução.
- **"Configurar o gateway no global".** Se alguém criar o provider no opencode.jsonc global, vira config de máquina do humano e contamina todas as sessões. **Corte neste item:** provider no repo `opencode.json`, apenas para expor o caminho que o preset usa.
- **"Adicionar o provider sem variantes".** Se alguém adicionar o provider Vercel AI Gateway no `opencode.json` mas esquecer o campo `variants` no model config, as variantes não aparecem no TUI e a max não pode ser selecionada. **Corte neste item:** ao adicionar o provider, o model config DEVE incluir `variants` com as definições low/high/max (cada uma com `reasoningEffort`). O fix é config-only em `opencode.json` — sem migration, sem code.

## Questões em aberto (produto)

- **Os comandos de execução de Issues acompanham o novo default ou ficam como estão?** **Opções:** A) ficam como estão (execução = escolha estável, só o launch muda) | B) alinhar também. **Recomendação:** A — o item é o default de LAUNCH; o cardápio de execução é outro mecanismo e está fora de escopo.
- **Onde expor a variante max: no provider do repo ou como flag no preset?** **Opções:** A) default no provider (campo `variants` no model config) | B) flag nova (`--variant max`) na emissão do launch. **Recomendação:** A — default explícito no provider, mantendo a emissão atual de `--model` intacta e o teste unitário como guarda. Observação: o campo `variants` no model config é o que faz as variantes aparecerem no TUI (Ctrl+T) — sem ele, nenhuma variante é selecionável.

## Referências

- GitHub Issue #784 (registro)
- `scripts/lib/worktree.mjs` · `scripts/worktree.mjs` · `tests/unit/worktree.unit.spec.ts` · `opencode.json` · `.opencode/commands/work-issue.md` · `.opencode/commands/plan-issue.md` · `.agents/shell/worktree.sh` · `.agents/skills/worktree-next-issue/SKILL.md`
