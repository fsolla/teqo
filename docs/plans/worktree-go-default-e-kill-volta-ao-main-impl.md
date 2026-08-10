# Impl: Worktree CLI: `--go` vira o padrão (escape `--stay`) e `kill` volta ao main

Status: aprovado
Atualizado em: 2026-08-10
Issue: #569
Intenção: docs/plans/worktree-go-default-e-kill-volta-ao-main.md
Appetite restante: ~0,5 dia eng (herdado — mudança pequena, 7 arquivos de texto/CLI)

## Leitura da intenção

- **Outcome:** `worktree next`/`plan` sem flags aplicam o `cd` (hoje exigem `--go`); `--stay` suprime; `--go` vira no-op; `worktree kill` termina no main repo (cwd nunca num diretório destruído). Vale nas duas superfícies que aplicam o cd: função `worktree()` do shell e comando `/worktree` do opencode.
- **O que NÃO negociar:** lógica determinística de branch/slot/provisionamento intacta; `kill` não ganha `--stay` (decidido no gate: kill sempre volta ao main); nada de detectar terminal vs opencode no script (o script só imprime o `cd`; quem aplica decide).
- **O que reavaliar:** a hipótese da intenção manda "`cmdKill` imprime `cd <mainRoot>` no mesmo formato máquina". Verifiquei o formato real: `next`/`plan` imprimem `cd <dir>` na ÚLTIMA linha; `kill` hoje imprime `Volte ao main: cd ${mainRoot}` — linha que **não** casa com o sed `s/^cd //p` da função shell, por isso nada aplica. A correção é substituir a mensagem humana pela linha máquina (o contexto "Worktree destruído:" já diz o que aconteceu), não acrescentar as duas. Ajuste extra: a linha máquina do `kill` precisa ser a última do output — hoje o `dropWorktreeDatabases` (best-effort, imprime `[worktree] banco removido: …`) roda DEPOIS do print. O sed usa `tail -n 1` de linhas que casam `^cd `, então funcionaria mesmo assim, mas o contrato "última linha" fica limpo movendo o print para depois dos drops.

## Abordagem recomendada

```mermaid
flowchart LR
  A[worktree next/plan] --> B[flags: --stay suprime, --go no-op]
  A2[kill] --> B2[sempre imprime cd mainRoot como última linha]
  B --> C[worktree.mjs imprime cd dir por default]
  B2 --> C
  C --> D[worktree.sh: aplica cd por default; --stay não aplica]
  C --> E[/worktree opencode: agente aplica cd sempre]
  D --> F[terminal termina no worktree / no main]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — inversão do flag na origem (script), com shell e opencode command consumindo a mesma linha máquina.
**Rejeitadas:**

- **B — inverter só na função shell** (shell decide aplicar por default e passa `--stay` ao script): deixaria o opencode command e consumidores diretos do script com a semântica velha; a superfície `/worktree` também precisa do default-go. Rejeitada por inconsistência.
- **C — detectar "terminal vs opencode" no script** (ex.: env `WORKTREE_TERMINAL`): anti-goal explícito da intenção; o contrato continua sendo "script imprime `cd`; quem aplica decide". Rejeitada.
- **D — `kill --stay`** (ficar no cwd morto): anti-goal de produto (é exatamente o bug que se corrige). Rejeitada — `kill` com `--stay` morre com mensagem clara.

### Componentes / mudanças

- **`scripts/worktree.mjs`**:
  - Header (docblock, linhas 5-34) e bloco de uso (`pnpm worktree` sem args, linhas 486-504): `next [--stay]`, `plan [bag] [--stay]`, `kill [--force]`; nota de que `--go` segue aceito como no-op.
  - `cmdNext(go, skipMigrate)` / `cmdPlan(go, skipMigrate, bag)`: parâmetro `go` → `stay`; `if (go) console.log(\`cd ${dir}\`)`vira`if (!stay) console.log(\`cd ${dir}\`)` (linhas 329 e 400).
  - `cmdKill(force)`: troca `Volte ao main: cd ${mainRoot}` por `cd ${mainRoot}` como **última** linha (depois de `await dropWorktreeDatabases`); `flags.go` no kill vira no-op aceito (consistente com o novo status do flag); `flags.stay` no kill → `die('--stay não se aplica a kill — ele sempre volta ao main')`.
  - Dispatch (linhas 508-514): `cmdNext(Boolean(flags.stay), …)`, `cmdPlan(Boolean(flags.stay), …)`, `kill` valida `--stay`.
- **`.agents/shell/worktree.sh`**: a função sempre captura o output e aplica o `cd` da linha máquina; `--stay` detectado nos args → repassa ao script e **não** aplica cd (retorno 0 após imprimir). Remove o ramo `has_go` (o `--go` nem precisa ser tratado — vira default). Funciona para `next`/`plan`/`kill` com o mesmo sed.
- **`.opencode/commands/worktree.md`**: frontmatter + corpo — `next [--stay]`, `plan [bag] [--stay]`, `kill [--force]`; o agente aplica o `cd <dir>` da última linha **sempre** (default), suprimido só com `--stay`; `kill` também aplica o `cd <mainRoot>`.
- **`AGENTS.md`** (seção "Per-worktree environments"): `worktree next [--go]` → `worktree next [--stay]`, `worktree plan [bag] [--go]` → `[bag] [--stay]`, `kill` volta ao main; nota `--go` no-op.
- **`.agents/skills/worktree-next-issue/SKILL.md`**: linhas de uso (`next [--go]` → `[--stay]`) e a nota sobre a função `worktree()` (agora default).
- **`.agents/skills/local-database/SKILL.md`**: menção `pnpm worktree next [--go]` → `[--stay]`.
- **`docs/CHANGELOG-AGENTS.md`**: entrada curta da entrega (padrão OPS17+).
- **Migration:** sem migration (nenhum schema).
- **Access / Consent:** N/A — CLI de dev fora do runtime.
- **UI:** Impeccable A — N/A (sem superfície de usuário de produto).

## Fases verificáveis

1. **Script** — `scripts/worktree.mjs` (flags + kill line) + shell function + opencode command + docs (AGENTS.md, skills, CHANGELOG). Verificação manual de contrato: `node scripts/worktree.mjs` sem args mostra o uso novo; `next --stay`/`--go`/sem flag imprimem/omitem a linha `cd` (a fila pode estar vazia → testar via `cmdPlan` que não depende da fila, ou pela mensagem de `die` da fila vazia — o que importa é o contrato de flags não quebrar).
2. **Verificação real do kill** (a única parte que toca estado real): criar worktree de teste barato não é viável nesta sessão (kill precisa estar DENTRO de um worktree e destrói DBs) — o contrato do kill fica coberto pelo mesmo formato de linha `cd <mainRoot>` e pela lógica simples de print; validar o caminho feliz com um worktree de planejamento descartável se o ambiente permitir.
3. **Gates** — `pnpm gate:fast` (lint + typecheck + unit); `pnpm push` (gate completo: format/knip/cycles/test/build) — este item é scripts/docs puro, sem testes de domínio novos.

## Rabbit holes / Não escopo (engenharia)

- Não adicionar um helper "puro" para a linha `cd <dir>` com unit test — a derivação não muda, o contrato é uma template string de 1 linha já pinada por 3 usos no mesmo arquivo; testes unitários do `cmdNext` exigiriam mock de git/pg que não existe no repo (as duas libs puras já são cobertas).
- Não tocar `scripts/lib/worktree-env.mjs` / `worktree.mjs` (derivação pura) — nenhuma mudança de branch/slot/provisionamento.
- Não criar "vários escapes" (`--no-go`, `--here`…) — a intenção pinou `--stay` como o único.
- Não alterar o marker `GENERATED_ENV_MARKER` (pinado por teste de unidade).
- OPS26 (abrir opencode no go) e OPS27 (`worktree new`) são itens próprios — esta entrega só muda a semântica de flags; OPS26 já nasce sobre o default-go.

## Riscos e mitigação

- **Quebrar automação/scripts que dependem da ausência do cd sem `--go`** — mitigação: `--go` continua aceito como no-op e o formato da linha máquina é idêntico ao de hoje; quem não quer o cd usa `--stay` (novo) — documentado nas duas superfícies.
- **`kill` imprimir a linha máquina antes do drop dos DBs** — mitigação: print movido para depois de `dropWorktreeDatabases`; a linha é a última do output (contrato do sed `tail -n 1`).
- **Shell function: perda do streaming de output** (antes, sem `--go`, o node imprimia direto; agora sempre captura e reimprime) — mitigação: comportamento idêntico ao do `--go` de hoje (já capturava); `printf '%s\n' "$out"` preserva o texto; o `|| return $?` preserva o exit code do script.
- **`kill --stay` ambíguo** — mitigação: die com mensagem clara (mesmo padrão do `--go` antigo), nunca silêncio.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (default-go nas duas superfícies; `--stay`; kill volta ao main; `--go` no-op)
- [ ] Invariantes AGENTS/engineering-standards (nenhuma mudança em branch/slot/provisionamento; docs atualizadas)
- [ ] Testes de domínio previstos (unit/int): sem mudança de access/write paths — `pnpm test:unit` existente verde; verificação manual do contrato de flags/linha `cd`
