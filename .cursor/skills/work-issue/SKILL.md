---
name: work-issue
description: Conduz uma GitHub Issue rastreável do Teqo do claim ao merge em main — prep (pnpm i), claim (pnpm agent:claim), renomear a sessão + abrir o plano no editor, verificação do modelo declarado na Issue, freshness audit do plano, execução das fases (schema/server → UI via /impeccable → gates), /simplify (3 reviewers paralelos via Task) + capture-review-debts, PR --base main com Closes #N, acompanhamento do CI até o merge. Usar quando o usuário pedir para implementar/trabalhar uma Issue ("trabalha a issue #N", "implementa o B79", "pega a próxima issue", "vamos fazer o X", "continua a implementação").
---

# Trabalhar uma Issue (claim → merge em main)

Esta skill conduz UMA Issue rastreável do claim ao merge em `main`. Substitui o antigo fluxo implement-roadmap-item + close-delivery + ship-to-main. **GitHub Issues são a fonte canônica** de spec/status/deps/prio/modelo; `docs/roadmap.md` é legado congelado e nunca é editado aqui (registro de entrega vai na Issue + `docs/plans/<slug>.md` + notebook do projeto).

**Proibido neste fluxo:** qualquer acesso a DB de prod, merge sem CI green, editar outras Issues `in-progress`.

**Qualidade de decisão e dados:** aplique [decision-quality.md](../plan-issue/decision-quality.md) ao auditar e fatiar (caro vs barato, Opções+Recomendação+rejeitadas, appetite, rabbit holes, tracer bullet cedo) e [data-presentation.md](../plan-issue/data-presentation.md) ao auditar/fatiar superfícies com KPI/mapa/série/ranking.

## Checklist do fluxo

```
- [ ] 0. Prep: `pnpm i` antes do `agent:claim` (Cloud Agents já rodam via `.cursor/environment.json` → `install`; worktrees locais: obrigatório, ou deixe para o `ensure-repo-deps` do `pnpm push`). Cloud → §Prep Cloud (sem Docker; não use `db:start`)
- [ ] 1. Claim: pnpm agent:claim (ou -- --issue <N>) — o brief do stdout é o contrato
- [ ] 1b. Renomear a sessão (cursor-app-control rename_chat) — padrão `#<N> <id> — <título>` (linha `rename_chat:` do brief)
- [ ] 1c. Abrir o plano no editor (cursor-app-control open_resource) para o humano acompanhar
- [ ] 2. Verificação de modelo (best effort): comparar model: da Issue com o modelo da sessão
- [ ] 3. Freshness audit (enxuto) do plano contra o repositório
- [ ] 4. Executar as fases (schema/server → UI via /impeccable → gates de engenharia)
- [ ] 5. /simplify no diff da sessão → capture-review-debts
- [ ] 6. Fechar em main: branch → commit → **`pnpm push -u origin HEAD`** (não `git push` nu) → gh pr create --base main (Closes #N, sem --draft)
       → gh pr merge --auto --merge → gh pr checks --watch --required até o merge → consolidar pontas soltas
```

## Passo 0 — Prep (deps)

`pnpm agent:claim` depende de `node_modules` (scripts em `scripts/` importam pacotes do projeto). Em worktree/clone fresco, ou quando `node_modules` não existir, rode **antes** do claim:

```bash
pnpm i
```

Não pule este passo — sem deps instaladas o claim falha antes de imprimir o brief.

### Prep Cursor Cloud (sem Docker)

VMs Cloud **não têm Docker** — `pnpm db:start` (docker compose) **não funciona** aqui. O ambiente já sobe Postgres nativo via `.cursor/environment.json` (`cloud-setup.sh` no install + `ensure-postgres.sh` no start): bancos `teqo` e `teqo_test` migrados e com `db:seed:minimal`.

- **`pnpm gate:fast` e `pnpm gate:push` não precisam de Postgres** — `test:unit` usa `DATABASE_URL` inválida de propósito (sem conexão real).
- Só `pnpm test:int` / `pnpm migrate` tocam o banco — já preparado no install; se conexão falhar: `bash ./.cursor/ensure-postgres.sh`.
- **Proibido `git push --no-verify`** no fechamento da Issue. O pre-push roda `pnpm gate:push` (~1–2 min) — espere passar; CI não substitui o hook local.

## Passo 1 — Claim

```bash
pnpm agent:claim            # pega o topo da fila (ready, desbloqueadas, por prio)
pnpm agent:claim -- --issue <N>   # quando o usuário especifica
```

O brief impresso no stdout é o contrato: id, priority, **model**, spec, link do plano. O claim faz o swap de label `ready → in-progress` com lock otimista. Se falhar ("claimed by someone else"), re-rodar — nunca forçar.

### Renomear a sessão

Logo após o claim bem-sucedido, **renomeie a aba desta conversa** para o humano identificar o trabalho em curso — não espere ele pedir. Política do repo: no fluxo `work-issue` isso **não** é opcional — a descrição padrão da ferramenta MCP ("só quando o usuário pedir") não se aplica aqui.

**Padrão canônico** (decisão travada — use sempre este formato, sem variações):

| Campo | Fonte no brief | Regra |
| ----- | --------------- | ----- |
| `#<N>` | linha `Claimed #<N> — …` | número GitHub da Issue; sempre presente |
| `<id>` | linha `id: …` | id de roadmap (`B79`, `C11`, `FD2+`…); omita o segmento se `(none)` |
| `<título>` | título da Issue (após `Claimed #<N> — `) | se começar com `<id> — `, remova esse prefixo para não duplicar |

**Montagem:**

- Com `id`: `#<N> <id> — <título>` — ex.: `#456 B79 — Mapa LQ na legenda`
- Sem `id`: `#<N> — <título>` — ex.: `#789 — Hotfix cookie path`

**Truncagem:** limite da ferramenta = 200 caracteres. Preserve intactos `#<N>` e `<id>`; encurte só o `<título>` no final (reticências opcionais).

**Passos:**

1. Monte o título pelo padrão acima a partir do stdout do claim.
2. Chame `cursor-app-control` → `rename_chat` com `title`.
3. Se `rename_chat` não estiver disponível (fora da Agents Window), informe em uma linha o título exato sugerido para o humano renomear manualmente — mas tente o MCP primeiro.

Se a sessão continuar uma Issue já claimada (sem re-rodar claim), derive os mesmos campos do brief anterior na conversa ou de `gh issue view <N> --json number,title` + frontmatter `id:`.

### Abrir o plano para o humano

Em seguida, **abra o arquivo do plano no editor** para quem acompanha a sessão — não basta `Read` no chat.

1. Extraia o caminho do plano do brief (`docs/plans/<slug>.md`) ou do link `Plano:` no body da Issue.
2. Chame `cursor-app-control` → `open_resource` com URI absoluta, ex.: `file:///…/docs/plans/foo.md` (caminho relativo resolvido a partir da raiz do workspace).
3. Informe em uma linha qual plano foi aberto (`B79 — docs/plans/…`).

Se `open_resource` não estiver disponível (fora da Agents Window), diga o caminho absoluto do plano para o humano abrir manualmente — mas tente o MCP primeiro.

## Passo 2 — Verificação de modelo (best effort, não programática)

Leia a propriedade `model:` do brief e compare com o modelo da sessão atual pela tabela de capacidade de `model-selection` (Composer 2.5 ↔ Grok 4.5 ↔ Kimi K3 Low). Regra **assimétrica** (decisão travada 2026-07-30):

- Sessão **mais fraca** que o especificado → assume-se escolha consciente do humano: **informa em uma linha e continua, sem pausar**.
- Sessão **mais forte** que o especificado → possível erro do humano: **informa e pausa** ("a Issue pede X, você está em Y — seguir mesmo assim?").
- Propriedade **ausente** → aplique `model-selection` uma vez e registre a escolha na Issue (`gh issue edit <N>` no body, frontmatter `model:`).
- Issue `{id}-exec` / `kimi-k3-low` sem a dep de plan `done` → **pare** (não execute sem plano fechado).

Subagentes despachados via `Task` saem **no modelo da propriedade** quando couber (`Task.model` ∈ `composer-2.5` | `cursor-grok-4.5-high` | `kimi-k3-low`).

## Passo 3 — Freshness audit (enxuto)

O plano foi escrito no passado e o repositório andou. Cheque, afirmação por afirmação:

- Arquivos citados no plano existem? Utilities "a reusar" têm a assinatura que o plano assume?
- Premissas de schema batem com `src/payload-types.ts` e `src/migrations/`?
- Deps do frontmatter estão `done`/`in-prod` (ou fechadas)? Dependência dura não entregue → pare e proponha (fazer a dep primeiro ou corte explícito).
- Questões em aberto já respondidas pelo código/notebook?

Desfechos: **divergência factual** (caminho renomeado, assinatura) → corrija o plano na mesma sessão e siga; **divergência material de produto** → pare e pergunte. Não reescreva o plano inteiro: freshness audit é enxuto, não uma re-planificação.

## Passo 4 — Executar as fases

Ordem fixa, fases pequenas e verificáveis, respeitando o appetite do plano:

1. **Schema e server** — migrations (`pnpm migrate:create`, seguir `payload-migrations`), collections, utilities, server actions, testes de domínio. Guardrails do repo: Local API com `user` → `overrideAccess: false`; escrita multi-collection → transação com `req: { transactionID }`; pessoa → join com `Contact`; opt-in/PII → `Consent` por chave estável falhando fechado.
2. **UI via /impeccable** (classes B/C/D — a classe está no plano; se A, declare "Impeccable: N/A" e siga só engenharia): shape conforme a classe → craft → critique → (harden/optimize **só sob gatilho**) → polish. Paleta = tokens `data-theme='campaign'`; reusar `src/components/ui` e shells existentes; shape obrigatório em C **para** para confirmação do brief antes do craft.
3. **Gates de engenharia** — iteração: `pnpm gate:fast`. Push: **`pnpm push -u origin HEAD`** (ensure-deps + `gate:push` no script — não depende do hook Husky). `pnpm gate:push` manual só para debug sem push. Scan Aikido dos arquivos editados. Comandos bare, nunca piped. **Nunca** `git push --no-verify` cru (pula o gate) — em Cloud não há Docker, mas `gate:fast`/`gate:push` não precisam de banco (ver §Prep Cloud).

Tracer bullet: se a Issue for grande, a primeira fatia vertical real (schema mínimo → uma action → uma superfície UI) vem cedo.

## Passo 5 — /simplify + débitos

Rode `/simplify` sobre o diff da sessão **antes** do Passo 6. Não pule os reviewers — o simplify deste fluxo é o comando completo, não uma leitura manual do diff.

### Escopo

1. `git diff --no-color` + `git diff --cached --no-color` (diff combinado da sessão).
2. Se vazio, arquivos/símbolos citados na conversa; se ainda vazio, `git show --stat --patch --no-color HEAD`.

### Reviewers paralelos (obrigatório)

Lance **três** subagentes via `Task` **em paralelo** na mesma mensagem — read-only, mesmo modelo da sessão, **sem editar arquivos**. Passe o diff combinado (ou lista de arquivos + hunks relevantes se o diff for grande):

1. **Code quality** — comentários vazios, helpers de uso único, nullable desnecessário, try/catch amplos, abstração prematura, casts fracos, estado derivado duplicado, código morto.
2. **Performance** — I/O bloqueante em hot path, recomputação sem cache, busy-wait, concatenação em loop, N+1, logging em loop.
3. **Reuse** — padrões/helpers existentes no repo ou já presentes no diff que o escopo deveria reutilizar.

### Fixes + débitos

1. Agregue os achados dos três reviewers e aplique **fixes pontuais** no diff (comportamento preservado).
2. Achados maiores que o cleanup da sessão → skill `capture-review-debts` (registra via `agent:register`/`agent:file-miss`; **nunca** edita Issue `in-progress` — nem esta; débito do mesmo pai vira Issue nova com `depends: [<id-do-pai>]`).
3. Resuma o que corrigiu e o que ficou como recomendação/débito.

## Passo 6 — Fechar em main

1. Branch `agent/<id>-<slug>` (worktrees do Cursor são donos da criação; commits lógicos).
2. **`pnpm push -u origin HEAD`** — canonical; roda `ensure-repo-deps` + `gate:push` + push (não depende do Husky). Não use `git push` nu.
3. `gh pr create --base main` com `Closes #<N>` no body — **nunca `--draft`** (`.cursor/rules/agent-pr-workflow.mdc`).
4. `gh pr merge --auto --merge <PR>` imediatamente após criar o PR (`strict=false` na proteção de `main`).
5. **Acompanhe só os checks obrigatórios** (`gh pr checks <PR> --watch --required`): gate = `checks` + `migration-lock`; Vercel Git não bloqueia. Falha no ci-pr → corrige na mesma branch. **Conflito de merge** → rebase em `main` e reempurre.
6. O flip `in-progress → done` + `in-prod` é **determinístico no CI** (`issue-done-on-main-merge.yml`). Deploy gated fica em `ci.yml` — não é passo do agente. Consolide pontas soltas após o merge.

## Resumo final ao usuário

Issue trabalhada + sessão renomeada + plano aberto no editor + verificação de modelo (declarado vs sessão, ou registro do ausente), veredito do freshness audit, o que entrou por fase, resultado do critique/polish (se UI), simplify (3 reviewers paralelos) + débitos registrados, gates (`pnpm push`, sem `--no-verify` cru), link do PR e estado do merge em main, pontas soltas consolidadas. `done`+`in-prod` no merge; deploy gated em `ci.yml`.
