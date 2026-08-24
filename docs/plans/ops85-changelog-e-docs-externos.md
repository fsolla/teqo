# OPS85 — Estratégia para eliminar conflitos de merge no changelog e reavaliar migração da documentação para fora do repo

Status: rascunho
Atualizado em: 2026-08-24
Issue: #830
Priority: P1
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável + uma decisão documentada
Responsável: —

## Intenção

O `CHANGELOG-AGENTS.md` continua gerando conflitos de merge toda vez que dois agentes entregam em paralelo — cada PR reescreve o mesmo agregado no mesmo anchor e o rebase cobra a fatura. O plano antecessor (#713/OPS44) já resolveu as entradas por arquivo, mas deixou em aberto se o agregado commitado compensa; a evidência do dia a dia responde: não compensa. Quero eliminar essa classe de conflito de vez e, em paralelo, decidir com evidência se vale migrar a documentação de leitura humana para fora do repo — ou arquivar a ideia explicitamente.

## Persona e fluxo

- **Persona / contexto:** agentes paralelos (worktrees `plans/*`/`work/*`) fazendo claim→plano→PR ao mesmo tempo; humano revisando gates.
- **Job principal:** entregar uma PR sem gastar ciclo em rebase de changelog, e saber onde mora a verdade do histórico.
- **Fluxo desejado:** cada entrega grava sua entrada em `docs/changelog/<data>-<id>.md` (já imune); o agregado "Recently resolved" deixa de ser arquivo de conflito — vira leitura sob demanda (comando ou artefato não-commitado); a decisão sobre docs externos sai deste item documentada, com implementação ou arquivamento explícito.
- **Anti-goals de produto:** não perder a leitura "Recently resolved" estabelecida; não virar cerimônia de merge (mais passos por PR); não quebrar o ciclo claim→plano→PR (paths locais em skills/Issue body); não criar segundo "single source of truth" desincronizado; não tocar o núcleo do `AGENTS.md` além do apontamento mínimo.

## Objetivo e aceite

- Zero conflito em arquivo de changelog em N dias de agentes paralelos (N ≥ 14) — e o guard de sync deixa de ser requisito de CI.
- Leitura do histórico preservada: "Recently resolved" continua acessível, por comando ou artefato regenerável, com o mesmo conteúdo.
- Decisão sobre documentação externa documentada com evidência (prova de conceito mínima OU arquivamento explícito com motivo), sem deixar a pergunta "aberta para sempre".

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície nova; evidência é do fluxo de trabalho (contagem de conflitos/rebases observados e custo do guard).
- **Decisões desbloqueadas:** executor → escolha do mecanismo de leitura agregada pós-morte do arquivo; humano → migrar ou não docs agent-facing para fora (registro no changelog).
- **Forma:** N/A — sem métrica de produto nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/build-changelog.mjs` (+ `scripts/lib/changelog.mjs`) — agregado vira build under-demand; `scripts/gate-ci.mjs`/`ci-pr.yml` (`build-changelog.mjs --check` em `docs-guards`, OPS63) — guard de sync sai ou vira check de sanitidade; `docs/AGENT-OPS.md`, `AGENTS.md` (bullet do changelog), skills `plan-issue`/`work-issue` (contrato de entrada) — atualização de contrato.
- **Precedente a olhar:** #713 (`docs/plans/redesenhar-fluxo-reduzir-conflitos.md` L86 — questão reaberta), OPS44, OPS63 (`docs/plans/ops63-doc-guard-no-pre-push.md`), `docs/plans/restaurar-entradas-changelog-b183-c102.md` (a classe de perda que o guard protege).
- **Risco de acoplamento:** append-only do agregado protege contra perda silenciosa de entradas (incidente B183/C102) — a nova forma deve preservar essa garantia sem o arquivo commitado (ex.: guard por-arquivo + verificador de conjunto); `changelog-rewrite:` é escape CI-only e pode morrer com o arquivo.

## Dependências

- Nenhuma dura. Leitura: #713 (decisão antecessora). Candidatos externos dependem de decisão de infra do homeserver (nenhuma nova serviço instalado neste item — só avaliação, a menos que o gate escolha implementar).

## Fora de escopo

- Migrar o corpo inteiro de `docs/` para fora do repo — só a decisão (implementar um alvo OU arquivar) sai deste item; migração em massa, se escolhida, é Issue própria com plano dedicado.
- Tocar `docs/plans/` (o registro por-issue que funciona) ou as 647+ entradas históricas.
- Instalar/configurar serviço novo no homeserver como parte do plano — no máximo spike de avaliação se o gate decidir.
- Mudar o ciclo claim→plano→PR, o merge por rebase ou os guards não-changelog (marcadores de conflito em `docs/`, plans-only-closes).

## Rabbit holes de produto

- **"Migrar tudo para fora"** — 12 skills com paths hardcoded, Issue body com `Plano: docs/plans/...`, guards amarrados: explosão de escopo que não ataca a causa do conflito. **Corte neste item:** docs agent-facing (registro de entregas) permanece no repo; avaliação externa é só para leitura humana.
- **"Guard mais esperto em vez de matar o arquivo"** — merge driver git ou cerimônia nova apenas desloca o custo. **Corte:** a classe de conflito morre só quando o arquivo compartilhado deixa de ser commitado; alternativa de merge driver entra só como opção documentada, não implementada.
- **"Segunda fonte de verdade"** — wiki externa com docs agent-facing que os guards não enxergam vira registro desincronizado. **Corte:** se houver alvo externo, escopo restrito a leitura humana; agente continua lendo o repo.

## Questões em aberto (produto)

- **O agregado commitado deve morrer?** **Opções:** A) matar: `docs/changelog/` vira o único registro; "Recently resolved" é gerado sob demanda (`pnpm changelog:build` sem commit, ou artefato gitignored); guard de sync sai do CI; append-only preservado por guard por-arquivo. B) manter arquivo + merge driver git (`git merge drivers`) para resolver o anchor automaticamente. C) manter como está, com `serializes`/rebase (custo atual). **Recomendação:** **A** — elimina 100% da classe de conflito com custo mínimo e zero infra nova; preserva a leitura (comando) e a garantia append-only (por-arquivo + verificador de conjunto); B desloca o custo para uma máquina que ainda escreve o mesmo arquivo e C é a evidência do humano provando que não funciona. _(assumido — validar no gate se a perda do "arquivo sempre-presente" incomoda a leitura humana)._
- **Docs agent-facing (changelog, plans) migram para fora?** **Opções:** A) permanecem no repo — o conflito era do agregado, não das entradas por-arquivo; migração custaria reescrever 12+ skills e o ciclo de Issues com paths locais. B) migram — com plano próprio e migração em fases. **Recomendação:** **A** — documentar a rejeição com a evidência da questão 1 (causa eliminada); a migração externa fica arquivada como ideia revisitável só se um custo novo aparecer. _(assumido — confirmar com o humano no gate)._
- **Se externo um dia, qual alvo?** **Opções:** Wiki.js (Node+DB, revisões, edição paralela) | Docmost (OSS, colaborativo) | Outline (OSS, Postgres+Redis+MinIO — mais pesado) | BookStack (PHP) | coleção `Doc` versionada no próprio Payload (self-hosted, versioning nativo, mas acopla docs ao app e muda o fluxo de leitura dos agentes) | Pages estático (gera de um repo git — ainda conflita no git). **Recomendação:** se o gate algum dia implementar, **Wiki.js** no homeserver (postgres/registry já existentes; revisões por página = histórico preservado; edição paralela sem git); Outline fica como segunda opção quando o custo de infra adicional se justificar; Pages estático é a resposta errada para a classe "conflito de git"; Payload `Doc` é barato de nascer mas troca conflito de merge por conflito de deploy (docs presas ao ciclo do app). _Posição registrada neste plano; nada é instalado neste item._

## Referências

- GitHub Issue #713 (OPS44) — `docs/plans/redesenhar-fluxo-reduzir-conflitos.md` (L86: questão do agregado em aberto) e `-impl.md`
- OPS63 — `docs/plans/ops63-doc-guard-no-pre-push.md` (docs-guards no pre-push, `build-changelog.mjs --check`)
- OPS44 — entrada em `docs/changelog/2026-08-13-ops44.md`; contrato em `docs/AGENT-OPS.md` (escape `changelog-rewrite:`)
- Incidente que o append-only protege: `docs/plans/restaurar-entradas-changelog-b183-c102.md`
- Para o executor abrir primeiro: `scripts/build-changelog.mjs`, `scripts/lib/changelog.mjs`, `scripts/check-changelog-append-only.mjs`, `scripts/gate-ci.mjs` (L91-93), `AGENTS.md` (bullet do changelog)
