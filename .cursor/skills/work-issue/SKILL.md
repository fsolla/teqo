---
name: work-issue
description: Conduz uma GitHub Issue rastreável do Teqo do claim ao merge em stage — prep (pnpm i), claim (pnpm agent:claim), abertura do plano no editor para o humano acompanhar, verificação do modelo declarado na Issue, freshness audit do plano, execução das fases (schema/server → UI via /impeccable → gates), /simplify + capture-review-debts, PR --base stage com Closes #N, acompanhamento do CI até o merge. Usar quando o usuário pedir para implementar/trabalhar uma Issue ("trabalha a issue #N", "implementa o B79", "pega a próxima issue", "vamos fazer o X", "continua a implementação").
---

# Trabalhar uma Issue (claim → merge em stage)

Esta skill conduz UMA Issue rastreável do claim ao merge em `stage`. Substitui o antigo fluxo implement-roadmap-item + close-delivery + ship-to-main. **GitHub Issues são a fonte canônica** de spec/status/deps/prio/modelo; `docs/roadmap.md` é legado congelado e nunca é editado aqui (registro de entrega vai na Issue + `docs/plans/<slug>.md` + notebook do projeto).

**Proibido neste fluxo:** `pnpm agent:promote` (promote stage→main é humano), qualquer acesso a DB de stage/prod, merge sem CI green, editar outras Issues `in-progress`.

**Qualidade de decisão e dados:** aplique [decision-quality.md](../plan-issue/decision-quality.md) ao auditar e fatiar (caro vs barato, Opções+Recomendação+rejeitadas, appetite, rabbit holes, tracer bullet cedo) e [data-presentation.md](../plan-issue/data-presentation.md) ao auditar/fatiar superfícies com KPI/mapa/série/ranking.

## Checklist do fluxo

```
- [ ] 0. Prep: pnpm i (node_modules obrigatório para agent:claim)
- [ ] 1. Claim: pnpm agent:claim (ou -- --issue <N>) — o brief do stdout é o contrato
- [ ] 1b. Abrir o plano no editor (cursor-app-control open_resource) para o humano acompanhar
- [ ] 2. Verificação de modelo (best effort): comparar model: da Issue com o modelo da sessão
- [ ] 3. Freshness audit (enxuto) do plano contra o repositório
- [ ] 4. Executar as fases (schema/server → UI via /impeccable → gates de engenharia)
- [ ] 5. /simplify no diff da sessão → capture-review-debts
- [ ] 6. Fechar em stage: fast gate → branch → commit → gh pr create --base stage (Closes #N)
       → gh pr merge --auto --merge → gh pr checks --watch até o merge → consolidar pontas soltas
```

## Passo 0 — Prep (deps)

`pnpm agent:claim` depende de `node_modules` (scripts em `scripts/` importam pacotes do projeto). Em worktree/clone fresco, ou quando `node_modules` não existir, rode **antes** do claim:

```bash
pnpm i
```

Não pule este passo — sem deps instaladas o claim falha antes de imprimir o brief.

## Passo 1 — Claim

```bash
pnpm agent:claim            # pega o topo da fila (ready, desbloqueadas, por prio)
pnpm agent:claim -- --issue <N>   # quando o usuário especifica
```

O brief impresso no stdout é o contrato: id, priority, **model**, spec, link do plano. O claim faz o swap de label `ready → in-progress` com lock otimista. Se falhar ("claimed by someone else"), re-rodar — nunca forçar.

### Abrir o plano para o humano

Logo após o claim bem-sucedido, **abra o arquivo do plano no editor** para quem acompanha a sessão — não basta `Read` no chat.

1. Extraia o caminho do plano do brief (`docs/plans/<slug>.md`) ou do link `Plano:` no body da Issue.
2. Chame `cursor-app-control` → `open_resource` com URI absoluta, ex.: `file:///…/docs/plans/foo.md` (caminho relativo resolvido a partir da raiz do workspace).
3. Informe em uma linha qual plano foi aberto (`B79 — docs/plans/…`).

Se `open_resource` não estiver disponível (fora da Agents Window), diga o caminho absoluto do plano para o humano abrir manualmente — mas tente o MCP primeiro.

## Passo 2 — Verificação de modelo (best effort, não programática)

Leia a propriedade `model:` do brief e compare com o modelo da sessão atual pela tabela de capacidade de `model-selection`. Regra **assimétrica** (decisão travada 2026-07-30):

- Sessão **mais fraca** que o especificado → assume-se escolha consciente do humano: **informa em uma linha e continua, sem pausar**.
- Sessão **mais forte** que o especificado → possível erro do humano: **informa e pausa** ("a Issue pede X, você está em Y — seguir mesmo assim?").
- Propriedade **ausente** → aplique `model-selection` uma vez e registre a escolha na Issue (`gh issue edit <N>` no body, frontmatter `model:`).

Subagentes despachados via `Task` saem **no modelo da propriedade** quando couber (`Task.model`).

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
3. **Gates de engenharia** — fast gate local: `pnpm gate:fast` (lint + typecheck + test:unit) e, antes do push, `pnpm gate:push` (fast + format:check + check:cycles — o pre-push hook roda exatamente isso) (+ `pnpm migrate && pnpm db:seed:minimal && pnpm test:int` se tocou schema). Scan Aikido dos arquivos editados. Comandos bare, nunca piped.

Tracer bullet: se a Issue for grande, a primeira fatia vertical real (schema mínimo → uma action → uma superfície UI) vem cedo.

## Passo 5 — /simplify + débitos

Rode `/simplify` sobre o diff da sessão. Follow-ups maiores que o cleanup → `capture-review-debts` (registra via `agent:register`/`agent:file-miss`; **nunca** edita Issue `in-progress` — nem esta; débito do mesmo pai vira Issue nova com `depends: [<id-do-pai>]`).

## Passo 6 — Fechar em stage

1. Fast gate verde (Passo 4.3).
2. Branch `agent/<id>-<slug>` (worktrees do Cursor são donos da criação; commits lógicos).
3. `gh pr create --base stage` com `Closes #<N>` no body.
4. `gh pr merge --auto --merge <PR>`.
5. **Acompanhe os checks até o merge** (`gh pr checks <PR> --watch`): falha no ci-pr → corrige na mesma branch e reempurra (o auto-merge dispara de novo quando verde). **Qualquer falha é tua** — infra do workflow, teste pré-existente ou regressão da feature; "fora do escopo da feature" não é critério de parada (política "Dono do PR, dono do CI" em `docs/AGENT-OPS.md`; exceção de blast radius: migration/access/Consent → para e escala).
6. O flip `in-progress → done` é **determinístico no CI** (workflow `issue-done-on-stage-merge.yml` lê o `Closes #N` no merge em stage). O agente espera o merge apenas para verificar e **consolidar pontas soltas**: débitos não registrados, doc da sessão pendente (notebook do projeto + `docs/plans/<slug>.md` com Status/Atualizado em), comentário de fechamento na Issue com o que entrou. Se o agente falhar depois do merge, o status já está correto.

## Resumo final ao usuário

Issue trabalhada + plano aberto no editor + verificação de modelo (declarado vs sessão, ou registro do ausente), veredito do freshness audit, o que entrou por fase, resultado do critique/polish (se UI), simplify + débitos registrados, gates, link do PR e estado do merge em stage, pontas soltas consolidadas. Nunca anuncie promote — `in-prod` é humano (`pnpm agent:promote --i-am-human`).
