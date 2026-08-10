---
name: worktree-next-issue
description: >-
  Cria um worktree git a partir de main para a próxima Issue claimável da fila
  do projeto, com branch legível no formato <código>-<slug> (ex.
  C15-fullcalendar-em-campanha-agenda, slug pt-BR do título sem acentos).
  Read-only no GitHub — NÃO claima, NÃO altera Issues. Usar quando o usuário
  pedir "worktree da próxima issue", "cria o worktree para o próximo da fila",
  "prepara o ambiente do próximo item", ou quiser começar a trabalhar a próxima
  Issue sem abrir o pool/Cursor.
---

# Worktree da próxima Issue claimável

Prepara o ambiente git para a próxima Issue da fila de claim, **sem** tocá-la no GitHub (read-only por contrato — claim continua sendo `pnpm agent:claim`, feito à parte).

## Fonte canônica: `pnpm worktree` (script)

A lógica determinística (fila → código+slug → branch → worktree) vive em **`scripts/worktree.mjs`** — fonte única, coberta por `tests/unit/worktree.unit.spec.ts`. Não a reescreva à mão aqui.

```bash
pnpm worktree next [--stay] [--no-migrate]  # cria worktree de origin/main + provisiona o ambiente
pnpm worktree plan [bag] [--stay] [--no-migrate]  # worktree de PLANEJAMENTO (/plan-issue): um DIFERENTE por invocação
pnpm worktree new [bag] [--stay] [--no-migrate]  # worktree NEUTRO (sem função pré-definida): um DIFERENTE por invocação
pnpm worktree kill [--force]              # destrói o worktree atual + remove seus bancos gerados
```

No opencode, isso é o comando **`/worktree next`** / **`/worktree kill`** (`.opencode/commands/worktree.md`), que só repassa `$ARGUMENTS` para o script.

`plan` é o primo do `next`: worktree de **planejamento** para rodar a skill `/plan-issue` sem ocupar o main. **Cada invocação cria um DIFERENTE** (sessões paralelas): com `bag` opcional → branch `plans/plan-issue-<bag>` (sufixo `-2`/`-3` se o nome já estiver vivo); sem `bag` → próximo sequencial `plans/plan-issue-<n>` livre. Não é nomeado por Issue nenhuma — proposital, para um `next` posterior da próxima Issue nunca colidir em branch nem em slot (prefixo minúsculo `plans/…` vs branch `<Code>-<slug>` sempre uppercase-led). `new` é o irmão **neutro** (sem função pré-definida — explorar ideia, conversar, planejar sem registrar): mesma semântica de "um DIFERENTE por invocação", branch `work/<bag>` (sufixo `-2`/`-3` em colisão) ou `work/<n>` sequencial, prefixo `work/…` que não colide com `next` nem `plan`. O fluxo desta skill (fila → próxima Issue → implementação) é só `next`.

**Default-go:** `next`, `plan` e `new` imprimem `cd <dir>` na última linha **por padrão**; `--stay` suprime; `--go` explícito continua aceito como no-op. No terminal interativo, use a função `worktree()` de **`.agents/shell/worktree.sh`** (uma linha de `source` no profile) para o `cd` ser aplicado de verdade no shell que te chamou — node não consegue mudar o cwd do shell pai. `kill` também imprime `cd <main>` no fim (a sessão nunca fica num diretório destruído).

**Launch do opencode (OPS26 + OPS31):** só a função shell marca `TEQO_WORKTREE_TERMINAL=1`; com o marcador, `next`/`plan`/`new` imprimem também a diretiva `launch opencode <dir> --model deepseek/deepseek-v4-flash --auto [--prompt <comando>]` **antes** do `cd`, e a função a executa depois do cd — `next` abre o TUI com `/work-issue` já enviado (o comando OPS25 roda o ciclo completo); `plan` abre com `/plan-issue` já enviado (OPS31: o TUI já cai no fluxo de planejamento); `new` abre sem `--prompt` ("apenas conversar"). Sem `exec`: sair do opencode volta ao shell no worktree. Presets são constantes em `scripts/lib/worktree.mjs`. **O comando `/worktree` do opencode (e qualquer automação sem o marcador) nunca lança o TUI.**

## Fluxo quando invocado como skill (agentes que não têm opencode)

1. Rode `pnpm worktree next` e leia a saída inteira. Se a fila estiver vazia, ele para sozinho — não crie worktree sem Issue.
2. Se a saída reclamar de conflito (worktree/branch já existentes), o script já reporta o que reutilizar.
3. Reporte ao usuário: código, `#<N>`, branch (`<code>-<slug>`), path — e que a Issue **não** foi claimada.

## O que o script garante (contrato)

- **Fila = `pnpm agent:claim --dry-run`** (ready + desbloqueadas, por `prio:P*` e mais antiga primeiro — mesma ordenação do pool e de `project-status`).
- **Branch `<code>-<slug>`**: `code` = `id` do frontmatter; `slug` = título pt-BR via `src/lib/slug.ts` (acentos fora, não-alfanumérico → hífen); truncamento só no slug, nunca no código; valida com `git check-ref-format --allow-onelevel`.
- **Base `origin/main`** (com `git fetch` antes); dir em `~/.cursor/worktrees/teqo/<branch>`.
- **Provisiona o ambiente isolado do worktree** (determinístico, ver "Ambiente provisionado"): dev server na porta `3100+slot` e bancos próprios `teqo_wt<slot>` / `teqo_wt<slot>_test` no container compartilhado (`-p teqo`), com migrations aplicadas — agentes em paralelo não disputam porta 3000 nem o `teqo_test`. `--no-migrate` pula as migrations (bancos criados, envs escritos).
- **`kill`**: recusa destruir o worktree principal (main); recusa worktree sujo sem `--force`; remove e apaga o branch; remove os bancos gerados do worktree (best-effort).
- **NUNCA usa `--force` no `add`**, não inventa código de Issue, e é **read-only no GitHub**.

## Ambiente provisionado (leia a saída do script)

Cada worktree gerado ganha um ambiente próprio — reporte ao agente/humano os valores que o script imprime ao final:

- **dev**: `http://localhost:<porta>` (`pnpm dev`), banco `teqo_wt<slot>`.
- **test**: banco `teqo_wt<slot>_test` (as suites leem `.env.test.local`, que sobrepõe o `.env.test` commitado; `pnpm test:int` / `test:e2e` / `gate:push` rodam isolados).
- Sem Docker (Cursor Cloud): o script degrada para o compartilhado `teqo`/`teqo_test` com aviso — comportamento antigo.
- Envs geradas têm o marcador `# teqo worktree env (generated by pnpm worktree next)`; **`.env.local`/`.env.test.local` manuais nunca são sobrescritos** (o script pula o provisionamento com aviso).
- Detalhes e derivarão pura: `scripts/lib/worktree-env.mjs`; skill `local-database`.

## NÃO faz

- Não roda `pnpm agent:claim` (mudaria labels no GitHub).
- Não usa `git worktree add --force` nem destrói worktrees existentes (isso é `kill`, explícito).
- Não duplica a lógica: se o script falhar ou faltar (gh fora do ar), reporte e pare.
