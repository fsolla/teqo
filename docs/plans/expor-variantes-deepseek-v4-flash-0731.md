# Default de launch do worktree passa a usar o DeepSeek V4 Flash 0731 (mais barato) + limpeza de duplicatas do Cheapest Inference

Status: rascunho
Atualizado em: 2026-08-23
Issue: #817
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia; config-only; outcomes verificáveis
Responsável: —

## Intenção

Três problemas de config do opencode neste repo, todos config-only:

1. **Variantes ausentes no DeepSeek V4 Flash 0731.** O `vercel/deepseek/deepseek-v4-flash-0731` (opção mais barata do DeepSeek no Vercel AI Gateway — input $0.076/M vs $0.13/M) não tem variantes expostas, então não dá para selecionar o esforço de raciocínio "max". Fix: espelhar o override da OPS78 (#784) para este model key.

2. **Default de launch apontando para o modelo mais caro.** `OPENCODE_PRESET_MODEL` ainda aponta para `vercel/deepseek/deepseek-v4-flash` ($0.13/M). Fix: trocar para `vercel/deepseek/deepseek-v4-flash-0731` — pagar menos pelo mesmo raciocínio forte na sessão que abre nos lançamentos `pnpm worktree next/plan/new` (mecanismo OPS26: "trocar de modelo é editar a constante").

3. **Duplicatas do Cheapest Inference no TUI.** O global `~/.config/opencode/opencode.jsonc` já define o provider `cheapestinference` (sem hífen) com `deepseek-v4-flash` (com variantes low/high/max) e `mimo-v2.5`. O repo `opencode.json` define um provider `cheapest-inference` (com hífen) com os mesmos modelos sem variantes. Resultado: dois DeepSeek e dois MiMo aparecem no TUI — um com variantes (global), outro sem (repo). Fix: remover o bloco `cheapest-inference` inteiro do `opencode.json` do repo — o global já cobre tudo, melhor e com variantes.

## Persona e fluxo

- **Persona / contexto:** dev que lança worktrees de planejamento/execução e cai direto numa sessão opencode com a tarefa pela frente; quer pagar menos pelo mesmo raciocínio forte do DeepSeek e uma lista de modelos limpa no TUI.
- **Job principal:** a sessão do worktree abrir já no modelo mais barato do DeepSeek (V4 Flash 0731), com a variante `max` selecionável, e o TUI mostrar apenas um DeepSeek e um MiMo no Cheapest Inference (sem duplicatas).
- **Fluxo desejado:** rodar `pnpm worktree next/plan/new` → a sessão abre com `vercel/deepseek/deepseek-v4-flash-0731` → selecionar a variante `max` no TUI (sticky por model) → trabalhar na opção mais barata com o esforço máximo. No TUI, um único DeepSeek V4 Flash e um único MiMo v2.5 aparecem no Cheapest Inference.
- **Anti-goals de produto:** não mudar o cardápio de execução de Issues (`work-issue.md`/`plan-issue.md` nem o pin `opencodeCommands.unit.spec.ts`); não tocar no `~/.config/opencode/opencode.jsonc` global do humano; não editar docs históricos.

## Objetivo e aceite

- A variante `max` do DeepSeek V4 Flash 0731 fica selecionável — verificável por `opencode debug config` mostrando as variants no override do model key `deepseek/deepseek-v4-flash-0731` e por `opencode run --model vercel/deepseek/deepseek-v4-flash-0731 --variant max` funcionando.
- O preset de launch do worktree emite `--model vercel/deepseek/deepseek-v4-flash-0731` — verificável pela linha de launch e pelos literais + pin da constante em `tests/unit/worktree.unit.spec.ts` atualizados.
- O TUI mostra um único DeepSeek V4 Flash e um único MiMo v2.5 no Cheapest Inference (sem duplicatas) — verificável ao abrir o seletor de modelo no TUI.
- Guardrails: cardápio de execução de Issues intacto; config global do humano intocada; docs históricos congelados.

## Dados (intenção)

Dados: N/A — item de tooling/config, sem superfície de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `opencode.json` — (a) bloco `provider.vercel.models` (linhas 34–50): adicionar `deepseek/deepseek-v4-flash-0731` com `variants` (low/high/max); (b) bloco `provider.cheapest-inference` (linhas 11–33): **remover inteiro** — o global `~/.config/opencode/opencode.jsonc` já define `cheapestinference` (sem hífen) com os mesmos modelos e variantes.
  - `scripts/lib/worktree.mjs:28` (`OPENCODE_PRESET_MODEL` → `'vercel/deepseek/deepseek-v4-flash-0731'`, emitido em `:145`).
  - `tests/unit/worktree.unit.spec.ts` (8 literais + pin `:185`).
  - Textos em `scripts/worktree.mjs`, `.agents/shell/worktree.sh:10`, `.agents/skills/worktree-next-issue/SKILL.md:34`.
- **Precedente a olhar:** OPS78 (commit 67c21358, Issue #784, mergeado 2026-08-23) — o mesmo override de `variants` e a troca da constante do preset; planos `docs/plans/worktree-launch-default-llm-max-gateway.md` e `-impl.md`.
- **Risco de acoplamento:** baixo — acréscimo sob uma model key que hoje não existe no override + remoção de provider duplicado (o global `cheapestinference` já cobre tudo) + troca da constante single-source (testes pínam o literal, o que é a verificação do item).

## Dependências

- Nenhuma dura. Soft: o model key `deepseek/deepseek-v4-flash-0731` permanecer disponível no gateway Vercel (já confirmado no cache do catálogo opencode).

## Fora de escopo

- Cardápio de execução de Issues (`work-issue.md`/`plan-issue.md` e o pin `opencodeCommands.unit.spec.ts`) — não muda.
- Config global `~/.config/opencode/opencode.jsonc` do humano — fica de fora por decisão de produto.
- Documentos históricos (`docs/plans`, `docs/CHANGELOG-AGENTS.md`) — congelados, não editar.

## Rabbit holes de produto

- **"Expor variantes em todos os modelos do repo".** Se alguém aproveitar para "completar" outros models keys, vira inventário de catálogo. **Corte neste item:** apenas o model key 0731, espelhando o que a OPS78 fez para o `deepseek-v4-flash`.
- **"Trocar o cardápio de execução junto".** Se alguém mudar o modelo nos frontmatters dos comandos (`work-issue.md`/`plan-issue.md`), muda a execução de Issues — fora de escopo. **Corte neste item:** a mudança é no default de LAUNCH do worktree (preset + provider no repo), não no cardápio de execução.
- **"Remover o provider global também".** Se alguém tentar limpar o `~/.config/opencode/opencode.jsonc` para "evitar conflito", perde a config de auth e os models param de autenticar. **Corte neste item:** o global é intocado por decisão de produto; só o repo `opencode.json` muda.

## Questões em aberto (produto)

- **Além de `max`, expor `low` e `high`?** **Opções:** A) as três, espelhando a OPS78 | B) só `max`. **Recomendação:** A — espelhar a OPS78 mantém o mecanismo uniforme e é o mesmo bloco, sem custo extra.

## Referências

- OPS78 (Issue #784) — precedente do override de `variants` e da troca da constante do preset
- `opencode.json` (bloco `provider.vercel.models`, linhas 34–50) · `scripts/lib/worktree.mjs:28` (`OPENCODE_PRESET_MODEL`) · `tests/unit/worktree.unit.spec.ts` (literais + pin `:185`) · `.agents/shell/worktree.sh:10` · `.agents/skills/worktree-next-issue/SKILL.md:34`
- Cache do catálogo opencode: `/home/fsolla/.cache/opencode/models.json` (provider `vercel`, model `deepseek/deepseek-v4-flash-0731`)
- `docs/plans/worktree-launch-default-llm-max-gateway.md` e `-impl.md`
