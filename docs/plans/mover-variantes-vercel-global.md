# Mover as variantes do provider Vercel AI Gateway para a config global do opencode

Status: rascunho
Atualizado em: 2026-08-24
Issue: #836
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,25–0,5 dia, config-only
Responsável: —

## Intenção

O `opencode.json` do repo expõe as variantes low/high/max dos dois models DeepSeek V4 Flash (`deepseek-v4-flash` e `-0731`) no Vercel AI Gateway. Essas variantes são preferência de máquina: não carregam secret (a auth vive em `~/.local/share/opencode/auth.json`), e configs do opencode são merged — global e projeto somam, não substituem. O próprio repo já decidiu isso no OPS82: o global é o dono natural das variantes (removeu o twin local `cheapest-inference` com "edit the owner, don't twin"), e o anti-goal original do OPS78 era não commitar config de opencode no repo. A pergunta do humano — "é possível mudar para global?" — tem resposta sim, sem nada quebrar: o preset de launch referencia o MODEL ID (`vercel/deepseek/deepseek-v4-flash-0731`), não o bloco de config. Resultado: repo mínimo (só `mcp.penpot`), variantes donas no global, textos do repo que localizam as variantes atualizados para não mentir.

## Persona e fluxo

- **Persona / contexto:** dono do repo (fsolla) configurando o opencode local; editou o `~/.config/opencode/opencode.jsonc` à mão e quer consistência entre a máquina e o repo.
- **Job principal:** ter as variantes low/high/max do Vercel disponíveis no opencode sem depender de config commitada no repo.
- **Fluxo desejado:** o repo `opencode.json` fica só com `$schema` + `mcp.penpot`; o global ganha `provider.vercel` com os dois model keys e as variants (espelhando o bloco atual, comentário explicativo no estilo JSONC do arquivo); `opencode debug config` continua resolvendo vercel com variants; o TUI cicla variantes (Ctrl+T) e `opencode run --variant max` responde; `pnpm worktree next` segue emitindo o `--model vercel/deepseek/deepseek-v4-flash-0731`.
- **Anti-goals de produto:** não mover o preset de launch para o repo (fica no script — model ID, não bloco de config); não mexer em auth/gateway (a rota Vercel e suas chaves permanecem como estão); não editar docs históricos congelados.

## Objetivo e aceite

- Repo `opencode.json` sem `provider.vercel` (fica `$schema` + `mcp.penpot`).
- Global `~/.config/opencode/opencode.jsonc` com `provider.vercel` e os 2 model keys × variants low/high/max, no estilo JSONC do arquivo (comentário explicativo).
- Textos vivos do repo que localizam as variantes ("exposed by the `provider.vercel` override in `opencode.json`" no docblock de `OPENCODE_PRESET_MODEL` e a prosa do `worktree-next-issue/SKILL.md`) apontando para a config global.
- `opencode debug config` mostra vercel com variants (antes/depois equivalentes); `opencode run --model vercel/deepseek/deepseek-v4-flash-0731 --variant max` responde; TUI mostra as variantes.
- `pnpm worktree next` (branch descartável) continua emitindo o `--model` sem erro; teste unitário de `worktree.unit.spec.ts` segue verde.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de tooling/config, sem dados de negócio.
- **Decisões desbloqueadas:** dono + onde vive a preferência de variantes (global vs repo) — resolvida nesta entrega.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `opencode.json` (raiz), `scripts/lib/worktree.mjs` (docblock da constante, ~linha 26-29), `.agents/skills/worktree-next-issue/SKILL.md` (prosa do launch, ~linha 34). Fora do repo: `~/.config/opencode/opencode.jsonc` (aplicado manualmente pelo dono — não é commitado).
- **Precedente a olhar:** OPS78 (`docs/plans/worktree-launch-default-llm-max-gateway.md` — anti-goal "não commitar config de opencode no repo"), OPS82 (remoção do twin `cheapest-inference` do repo), global `cheapestinception` (padrão de variants já existente no `opencode.jsonc` global).
- **Risco de acoplamento:** nenhum gate/lint/CI lê `opencode.json` estruturalmente (achado do explorador — zero referências fora do `scripts/worktree.mjs` que só usa `mcp.penpot`); remover `mcp` quebraria o launch, remover `provider` não.

## Dependências

- Nenhuma dura. A parte global é manual (arquivo fora do repo) — aceite condicionado à edição pelo dono.

## Fora de escopo

- Preset de launch do repo (`OPENCODE_PRESET_MODEL` — model ID, fica como está).
- Cardápio de execução de Issues e docs históricos (`docs/plans/*`, `docs/CHANGELOG-AGENTS.md`, `docs/changelog/*` — congelados).
- `AGENTS-infra.md` (menciona `opencode.json` só pelo `mcp.penpot` — não muda).
- Auth/mudança de rota do gateway Vercel.

## Rabbit holes de produto

- **"Já que vou mexer no global, aproveito e reorganizo o arquivo inteiro."** Se alguém "só completar": refactor cosmético do `opencode.jsonc` global fora do escopo do repo. **Corte neste item:** tocar apenas no que diz respeito a vercel/variantes; o resto do global fica intacto.
- **"Sem o bloco no repo, o launch pode quebrar."** Se alguém "só completar": manter o bloco por medo — twin. **Corte neste item:** a verificação de aceite cobre o launch (`worktree next` + `debug config`); se algo quebrar, o `-impl.md` volta ao repo com evidência.

## Questões em aberto (produto)

- **As variantes devem continuar também no repo para reprodutibilidade por outros devs?** **Opções:** A) mover tudo para o global | B) manter cópia no repo | C) global + nota no repo (doc-only). **Recomendação:** A — config de opencode é preferência de máquina; repo fica mínimo; precedente OPS82 e anti-goal OPS78. _(assumido — validar com produto)_
- **Os textos vivos que citam onde as variants vivem devem ser atualizados nesta entrega?** **Opções:** A) sim, junto | B) só o docblock, adiar a skill. **Recomendação:** A — senão os textos mentem para o próximo dev que ler a skill. _(assumido — validar com produto)_

## Referências

- GitHub Issue #784 (OPS78) e #817 (OPS82) — precedentes do bloco e da remoção do twin
- `opencode.json` (raiz), `scripts/lib/worktree.mjs:22-29`, `.agents/skills/worktree-next-issue/SKILL.md:34`
- `~/.config/opencode/opencode.jsonc` (global, fora do repo), `~/.local/share/opencode/auth.json` (auth `vercel`)
- Docs oficiais opencode: https://opencode.ai/docs/config (merge e precedência), https://opencode.ai/docs/models (variants)
