---
name: react-audit
description: 'Audit React/Next.js anti-patterns com ciclo fechado: sweep focado → plano per-fix → implementação com gate completo → um único PR ready SEM auto-merge cuja descrição é o relatório.'
---

# React Audit (ciclo fechado plan→implement)

Skill para rodar **sozinha** (à noite, sem supervisão): varre o repo por anti-patterns
**React/Next.js** do catálogo fixo (`anti-patterns.md` desta pasta), planeja e implementa
cada fix com o gate completo, e entrega **um único PR** para `main` — ready,
**sem auto-merge**, CI green, mergeable, sem conflitos — com **um commit por fix** e a
**descrição do PR como relatório consolidado**. Aí PARA: o humano explora os commits
e mescla quando quiser. Feedback humano = comentário no PR → ajusta na MESMA branch.

Complementar ao `engineering-audit` (qualidade geral); NÃO re-varre o que ele já cobre.
Context7 MCP é aceleração opcional — ver `context7-setup.md`; sem ele, use as fontes
oficiais embutidas no catálogo. Nunca bloqueie por falta do MCP.

## Proibido

- DB de prod / `ALLOW_REMOTE_DB` / repontar envs — local only (`teqo_test` nos testes).
- Mergear qualquer coisa ou armar auto-merge. O PR da run nasce e PERMANECE sem auto-merge.
- Abrir draft e flipar ready no fim (corrida de instant-merge com check já verde).
- Expandir o catálogo de famílias durante a run; fix fora das 9 famílias vira follow-up.
- Fix sem os TRÊS selos (file:line + família + fonte oficial) — "cartilha genérica" não entra.
- `Closes #N` de Issue alheia no body do PR da run (use `Refs #N`).
- Tocar Issues `in-progress` alheias ou claimar na sessão.
- Gate commands piped (`| tail` engole exit code); `knip --fix` cego.
- Migration/schema Payload em commit noturno — fix que exigir migration vira follow-up.

## Checklist

```
- [ ] 0. Precheck fail-closed (read-only): worktree provisionado, branch ≠ main, GITHUB_TOKEN válido, baseline bare anotada
- [ ] 1. Sweep read-only por família do catálogo (canon primeiro; Tasks ad-hoc por área)
- [ ] 2. Triage per-fix: 3 selos, dedup TECH-DEBT/guardas vivas, dono travado → follow-up, cap ≤ 6
- [ ] 3. Loop por fix: mini-plano → implementar (editar o dono) → gate completo BARE → 1 commit → push da branch (sem PR)
- [ ] 4. Relatório consolidado (body do PR) + follow-ups como Issues + changelog da run
- [ ] 5. Abrir o PR ÚNICO Ready via scripts/github-pr.mjs → DESARMAR auto-merge → verificar auto_merge null
- [ ] 6. Estabilizar até checks green ∧ mergeable ∧ auto_merge null → PARAR sem mergear
```

## Passo 0 — Precheck fail-closed (read-only)

Tudo aqui é leitura. Falhou um item → pare com o remédio nomeado, não improvise às 3h.

1. Estar DENTRO do worktree provisionado da run (`pnpm worktree next --issue <N>` já
   claimou e criou envs/DBs/porta dedicadas). Nunca rodar no repo principal nem claimar na sessão.
2. `git status --porcelain` limpo (commit/stash pendências alheias antes? Não são suas — PARE e relate).
3. Branch corrente ≠ `main`. Se estiver em main/detached, crie `agent/<N>-react-audit`
   a partir de `origin/main` — nunca commitar fix em main.
4. `GITHUB_TOKEN` presente e validado com chamada barata ANTES do trabalho:
   `node -e "import('./scripts/lib/github-api.mjs').then(m=>m.githubApi.getIssue(901)).then(i=>console.log(i?.state))"`.
5. Baseline bare dos gates estáticos — vermelhos pré-existentes são BASELINE (política
   "dono do PR, dono do CI", `docs/AGENT-OPS.md`), anote-os:
   `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec knip`, `pnpm check:cycles`.
6. Pool morto desde OPS65 — nada a pausar.

## Passo 1 — Sweep read-only

Zero writes em `src/`, `tests/`, `scripts/` neste passo.

1. Canon primeiro: `.agents/rules/engineering-standards.mdc`, `.agents/rules/codebase-map.mdc`,
   `AGENTS.md`, `docs/TECH-DEBT.md` (dedup).
2. Carregue `.agents/skills/react-audit/anti-patterns.md` — as 9 famílias e suas heurísticas.
3. Âncora de delta: data da última entrada react-audit em `docs/changelog/` (primeira run =
   repo inteiro). Foque o esforço no churn desde a âncora:
   `git log --since="<âncora>" --name-only --format= | sort -u`.
4. Tasks ad-hoc por família/área (padrão `work-issue`: input mínimo + instrução explícita):
   prompt do subagente carrega a seção da família + a âncora de delta e exige output ≤25 linhas
   no formato `file:line | família | sintoma observado` — "**Não escrever código nem planos**".
5. Com Context7 ativo, consulte a doc oficial vigente ANTES de classificar (evita fix contra
   a versão atual); sem Context7, confie nas URLs do catálogo e confirme na citação.

## Passo 2 — Triage per-fix

Para cada candidato do sweep:

1. Exija os TRÊS selos: `file:line` conferido por você (abra o arquivo), família do catálogo,
   fonte oficial. Faltou um → linha "observado sem fix" no relatório; não invente justificativa.
2. Dedup: já está em `docs/TECH-DEBT.md` (classe B14/P4-F aberta)? Guarda viva cobre
   (ESLint restrictions, `tests/unit/codebaseConventions.unit.spec.ts`)? Já registrado → pule.
3. Dono travado (URL pública congelada, Consent/LGPD, migration shipped, collection schema)
   → follow-up no Passo 4, NUNCA fix noturno.
4. Priorize churn × severidade; corte em **≤ 6 fixes por run** (cap duro — PR maior derrota
   a revisão matinal commit a commit). Resto vira follow-up ou "adiado" no relatório.

## Passo 3 — Loop de implementação (por fix)

Um fix = mini-plano + gate completo + UM commit + push da branch (sem PR ainda — push de
branch isolada não dispara workflow nenhum).

1. Task escritor (input: achado com os 3 selos + seção da família + norma citada; "Não escrever
   código"): devolve mini-plano — receita, blast radius, pins/testes a tocar, critério de feito.
2. Implemente você mesmo (agente principal), **editar o dono, não twinar**: contratos client-safe /
   `import type` ao cruzar fronteira server→client; nada de módulo paralelo ao lado do dono.
3. Gate completo BARE por fix (na ordem, cada comando sozinho no shell):
   `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`,
   `pnpm check:cycles`, `pnpm test`, `pnpm build`.
   Export órfão previsto? Resolva NO MESMO fix (`git grep -w <symbol>` antes de remover;
   nunca `knip --fix`). Vermelho pré-existente da baseline do Passo 0 não é seu — documente.
4. E2E afetado (discricionário, OPS72): `pnpm test:e2e:affected` quando o fix tocar superfície
   com spec; `gate:push` NÃO roda e2e — este passo é quem cobre.
5. Commit único do fix: mensagem citando família + `file:line`
   (ex.: `react-audit(família 3): derived state via effect em MunicipalityFilter.tsx:88`).
   Push: `git push -u origin HEAD` (branch sem PR ⇒ nenhum safety net dispara).
6. Volte ao Passo 2 para o próximo elegível.

## Passo 4 — Relatório + follow-ups + changelog

1. Monte o relatório consolidado (será o BODY do PR) com, nesta ordem:
   (i) escopo/data/números do sweep (arquivos varridos, candidatos, fixes);
   (ii) tabela de achados: file:line | família | fonte oficial;
   (iii) POR FIX: decisão (implementado/rejeitado/adiado/follow-up) e O PORQUÊ (decisão,
   gate, custo, sobreposição com dono existente) + SHA do commit + resultado do gate;
   (iv) estado final do PR; (v) follow-ups recomendados com destino.
2. Follow-ups que sobrevivem ao PR → Issues reais via caminho canônico
   (`scripts/lib/github-api.mjs` `createIssue`), título prefixado `[react-audit]`,
   body com file:line + fonte + link do PR. Sem Issue per-fix implementada (geminação).
3. Changelog da run: `docs/changelog/<data>-react-audit-run.md` (uma entrada curta;
   docs-guards são additions-only — jamais tocar HISTORY/agregado).

## Passo 5 — PR único + desarme do auto-merge

O PR nasce UMA vez, já estabilizado localmente, e fica SEM auto-merge.

1. `GITHUB_TOKEN=<PAT> node scripts/github-pr.mjs --head <branch> \
   --title "react-audit <data>: <N> fixes" --base main --body-file <relatorio.md>`
   — nunca draft; `Refs #N` apenas; jamais `Closes` de Issue alheia.
2. Imediatamente após abrir, DESARME O AUTO-MERGE COM VERIFICAÇÃO EM LAÇO — o safety net
   `agent-pr-ready-automerge.yml` arma ASSINCRONAMENTE depois da abertura (na corrida real
   capturada no dogfood #905, um desarme único perdeu: o armar aconteceu ENTRE o primeiro
   GET e o DELETE; e o endpoint REST `DELETE /pulls/N/auto-merge` responde **404 mesmo
   armado-via-GraphQL** — não serve). Use o helper do dono, que codifica essa lição:

   ```js
   // node --input-type=module
   import { githubApi } from './scripts/lib/github-api.mjs'
   const pr = await githubApi.getPullRequest(<N>)      // confere head.sha = branch
   await githubApi.ensureAutoMergeDisabled(<N>)        // mutation GraphQL disablePullRequestAutoMerge
                                                      // + re-poll até auto_merge null (lança se não convergir)
   ```

   `ensureAutoMergeDisabled` resolve `true` só quando um poll lê `auto_merge = null`;
   lança erro nomeando o PR se esgotar as tentativas — nesse caso, trate como falha de Done.

3. REGRA DURA: todo push pós-abertura (fix de CI vermelho, rebase) é seguido IMEDIATAMENTE
   de `ensureAutoMergeDisabled(<N>)` — cada `synchronize` RE-ARMA o auto-merge silenciosamente.

## Passo 6 — Estabilizar até o fim (Done condition)

Loop até a condição de Done — a entrega só termina estável:

1. CI: polle o check-run literal `checks` do head SHA (API check-runs ou `gh pr checks`)
   com backoff. Vermelho dentro do blast radius dos fixes → conserte na branch (novo commit
   próprio, gate completo, push, REDESARME). Infra estrutural → aplique o CAP (abaixo),
   registre honestamente no relatório e pare com estado declarado.
2. Conflitos: `getPullRequest().mergeable` — `null` = GitHub computando (backoff, re-poll);
   `false` = rebase sobre `origin/main`, resolva, push, REDESARME.
3. Caps anti-loop infinito: máx. 3 ciclos de fix pós-abertura OU 90 min de estabilização —
   estourou → relatório declara o estado real e a skill termina SEM Done falso.
4. **Done = checks green ∧ `mergeable === true` ∧ `auto_merge === null` ∧ PR open+ready.**
   Então PARAR. Não mergear. Não armar nada. O humano revisa de manhã.
5. Feedback humano posterior: pedido de mudança no PR → commits novos NA MESMA branch,
   relatório atualizado (PATCH do body), re-estabilize pelo mesmo loop.

## Context7 MCP (aceleração opcional)

Setup manual do dono da máquina, FORA do git: `.agents/skills/react-audit/context7-setup.md`.
A skill FUNCIONA sem — fallback são as fontes oficiais do catálogo.

## Done when

Precheck verde (ou parada fail-closed nomeada); sweep com achados mapeados file:line+família+fonte;
cada fix com mini-plano, gate completo bare e commit próprio; cap ≤6 respeitado; relatório
consolidado É a descrição do PR; follow-ups com destino (Issue/relatório); changelog da run
escrito; PR único open+ready com checks green, mergeable true e `auto_merge` null — e a skill
PAROU, sem mergear nada.
