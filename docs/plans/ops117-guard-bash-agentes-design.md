# OPS117 — Guard de escrita dos agentes de design além dos file tools (bash)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1063
Priority: P2
Impeccable: A — N/A sem UI de produto
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

Os agentes `designer` e `designer-degraded` (OPS113) são fail-closed para os **file tools** (`edit`/`write`/`patch` negados fora de `docs/plans/*-ui-design*`), mas o anti-goal "o designer nunca escreve em `src/`" ainda é contornável por **bash** (redirecionamento, `sed -i`, `tee`). O gate cobre o caminho principal; falta fechar o desvio — sem transformar o agente num sandbox de SO.

## Objetivo e aceite

- Escrita em disco via bash pelos dois agentes falha fechado (negada ou ask conforme o mecanismo escolhido) para caminhos fora do artefato `docs/plans/<slug>-ui-design*`.
- Gravar o próprio artefato (`docs/plans/<slug>-ui-design.html` e `-ui-design-assets/*.svg`) segue permitido — inclusive o `prettier --write` do artefato, se necessário ao fluxo.
- Smoke em subprocesso prova: `echo > src/...` negado; artefato permitido.
- Nada de sandbox de SO, nada de agente twin, nada de bloquear leitura (`cat`/`sed -n`).

## Dados (intenção)

- **Vou apresentar dados?** Não — configuração de agente.
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.opencode/agent/designer.md` e `.opencode/agent/designer-degraded.md` (`permission.bash` por agente), doutrina `.agents/skills/plan-issue/ui-design-html.md` (nota do teto) e `docs/AGENT-OPS.md` (parágrafo OPS113) se a semântica mudar.
- **Precedente a olhar:** o próprio bloco `permission.edit` fail-closed dos agentes; docs opencode de `permission.bash` (padrões por comando, last-match-wins).
- **Risco de acoplamento:** `permission.bash` casa **comando** (não caminho de arquivo) — a forma exata precisa ser confirmada no schema/docs antes de pinar; falso-deny do `prettier --write` do artefato é o risco a evitar.

## Fora de escopo

- Sandbox de SO/container para agentes.
- Mexer no allowlist de escrita do artefato (já resolvido no OPS113).
- Bloquear leitura ou comandos não-escrita (`git diff`, `cat`, `sed -n`).

## Rabbit holes

- **"Já que mexeu, faz sandbox de SO."** Vira infraestrutura para um risco de ferramenta de design. **Corte neste item:** só a `permission.bash` dos dois agentes.
- **"Bloqueia bash inteiro."** O designer pode precisar de `prettier --write` no artefato (docs/plans é format-checked). **Corte neste item:** bloquear escrita fora do artefato, não o shell.

## Verificação

- Smoke em subprocesso (`opencode run --agent designer`; degraded via task): `echo x > src/…` negado; escrita no artefato permitida; `opencode agent list` mostra o ruleset resolvido.
- `pnpm gate:fast` verde; sem mudança em `src/`.

## Riscos

- **Semântica de `permission.bash` por caminho não existir.** Então o desenho vira "ask" para bash (humano no loop) ou hook/plugin — decidir no impl plan com evidência das docs, sem pinar adivinhação.

## Referências

- GitHub Issue #1063
- `docs/plans/ops113-agentes-designer-e-designer-degraded-impl.md` — decisão 1 (resíduo declarado do bash)
- `.opencode/agent/designer.md` · `.opencode/agent/designer-degraded.md` — `permission` fail-closed dos file tools
