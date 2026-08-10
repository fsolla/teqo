# Worktree `new`: worktree genérico sem função pré-definida

Status: rascunho
Atualizado em: 2026-08-10
Issue: #572
Priority: P3
Model: composer-2.5
model-local: deepseek-v4-flash-high
Impeccable: A — N/A (CLI de dev; sem UI de produto)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável (worktree neutro criado e provisionado com um comando)

## Intenção

`worktree next` está amarrado à fila de claim (próxima Issue claimável) e `worktree plan` ao `/plan-issue` — os dois carregam uma função pré-definida. Mas às vezes a intenção é aberta: explorar uma ideia antes de virar Issue, planejar e executar algo sem registrar nada, ou só conversar com o agente num ambiente isolado (como esta sessão). Hoje não existe um subcomando para isso — o usuário precisaria de um `git worktree add` manual, sem provisionamento (porta, bancos próprios, envs). Queremos `worktree new [bag]`: um worktree **neutro**, com o mesmo ambiente isolado dos outros, sem propósito declarado.

## Persona e fluxo

- **Persona / contexto:** Francisco no terminal, querendo um espaço de trabalho isolado sem compromisso com a fila nem com a skill de planejamento.
- **Job principal:** criar um worktree provisionado e entrar nele, sem decidir antes o que vai fazer.
- **Fluxo desejado:** `worktree new` → branch `work/<n>` sequencial livre, provisionado (slot/porta/bancos próprios, comentário `gerado por pnpm worktree new`), e com o default-go (OPS24) termina com `cd` no worktree; com a OPS26, abre o opencode com os presets **sem** skill inicial — "apenas conversar". `worktree new <bag>` → branch `work/<bag>` (sufixo `-2`/`-3` em colisão). `--stay` suprime cd/launch.
- **Anti-goals de produto:** não virar um segundo `plan` (sem função de planejamento embutida); não colidir com a fila nem com os branches de claim; não propor branch sem provisionamento.

## Objetivo e aceite

- `worktree new [bag]` cria um worktree a partir de `origin/main` com branch `work/<bag>` (colisão → sufixo `-2`/`-3`) ou `work/<n>` sequencial livre sem bag — prefixo minúsculo `work/…` que **nunca** colide com `<Code>-<slug>` de `next` nem com `plans/plan-issue-…` de `plan`.
- Provisionamento idêntico ao `plan`: env isolado com `purpose: 'new'`, porta `3100+slot`, bancos próprios, migrations aplicadas; `--no-migrate` respeitado.
- Cada invocação cria um worktree **diferente** (mesmo comportamento de paralelismo do `plan`).
- Herda a semântica da OPS24 (`--go` default, `--stay`) e, quando a OPS26 estiver em main, o launch do opencode sem primeira mensagem.
- `worktree kill` funciona de dentro dele (já é o padrão dos outros — nada novo aqui além do teste de colisão de nomes).
- Help/uso do script (`pnpm worktree` sem args) documenta o subcomando; `AGENTS.md` atualizado.

## Dados (intenção)

- **Vou apresentar dados?** Não.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/worktree.mjs` (novo `cmdNew` análogo ao `cmdPlan` — mesmo `planBranchName`-like para o namespace `work/`, mesmo fluxo de taken-set, `purpose: 'new'` no provision); `scripts/lib/worktree.mjs` (função de nome de branch genérica, se valer a pena generalizar); `.agents/shell/worktree.sh` + `.opencode/commands/worktree.md` + `AGENTS.md` (documentação).
- **Precedente a olhar:** `cmdPlan` (`scripts/worktree.mjs:343-401`) é o molde — branch sem Issue, `code: null`, taken-set de refs locais+remotos.
- **Risco de acoplamento:** o namespace `work/…` precisa continuar minúsculo (a regra de colisão de `next` é o prefixo maiúsculo `<Code>-<slug>`); o `readLiveSlots`/`worktreeEnvironment` já tratam qualquer branch.

## Dependências

- OPS24 (semântica default-go/`--stay` — o `new` nasce já no novo padrão, sem `--go` explícito).
- OPS26 (opcional: launch do opencode sem skill inicial — o `new` funciona sem ela).

## Fora de escopo

- Uma "terceira função" embutida (ex.: `worktree new --issue`) — para isso existem `next` e `plan`.
- Nomeação automática por data/hash randômico — sequencial (`<n>`) e por `bag` cobrem os dois usos.
- Mudanças no provisionamento.

## Rabbit holes de produto

- **"Worktree sem nome = bag aleatório":** nomes legíveis (bag) ou sequenciais bastam; aleatório só atrapalha o `kill`/localização.
- **"`new` deveria perguntar o que vamos fazer":** o ponto é justamente não perguntar — worktree neutro, a conversa decide depois.

## Questões em aberto (produto)

- **Prefixo do branch?** **Opções:** A) `work/<slug>` | B) `wip/<slug>` | C) `sandbox/<slug>`. **Recomendação:** A — neutro, não dá a entender "em andamento" nem "brinquedo". _(confirmado no gate — `work/`)_
- **`new` abre o opencode (OPS26) com o quê?** **Opções:** A) com os presets mas **sem** primeira mensagem (só modelo + auto-approve; "apenas conversar") | B) sem abrir (só cd). **Recomendação:** A — é o caso de uso explícito do pedido ("apenas conversar com o agente"); quem não quer usa `--stay`. _(confirmado no gate)_

## Referências

- GitHub Issue #572
- `scripts/worktree.mjs:343-401` — `cmdPlan`: molde de branch sem Issue (taken-set, `code: null`, provision)
- `scripts/lib/worktree.mjs` — `planBranchName` (padrão de nome com sufixo de colisão a generalizar para `work/`)
- `AGENTS.md` seção "Per-worktree environments" — onde documentar o subcomando
