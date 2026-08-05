# Desbloquear PR #50 — fix migration-lock + spec homeSearchLeaderships seed-proof

Status: entregue (2026-07-30 — executado em sessão única, fora do fluxo agent:register, a pedido do humano)
Atualizado em: 2026-07-30
Issue: —
Priority: P0
Model: kimi-k2.7-code
Impeccable: A — N/A (sem superfície UI)
Appetite: ~0,5 dia eng; 1 workflow step + 1 repair de spec int + watch de CI
Responsável: —

## Dados → decisão → apresentação

Dados: N/A — repair de CI/teste, sem superfície de dados.

## Contexto

O PR [#50](https://github.com/fsolla/teqo/pull/50) (`agent/B53-busca-global-demandas`, Issue #7, B53) está `MERGEABLE` mas `BLOCKED` com dois checks vermelhos (run [30558184687](https://github.com/fsolla/teqo/actions/runs/30558184687)):

1. **`migration-lock` FAIL** — duas causas de infra empilhadas no job em `.github/workflows/ci-pr.yml`: (a) `gh pr list --json number,files` **sem `actions/checkout@v4`** → `failed to run git: fatal: not a git repository`; (b) com o checkout, `GraphQL: Resource not accessible by integration (repository.pullRequests)` → o `GITHUB_TOKEN` padrão precisa de `permissions: pull-requests: read` explícita. Todo PR falhava esse job.
2. **`checks` FAIL** — `tests/int/homeSearchLeaderships.int.spec.ts:87`: `expected [ 1, 168, 169 ] to deeply equal [ 168, 169 ]`. O spec consulta `'Lider'` e asserta o conjunto global exato; em ci-pr, `pnpm db:seed:minimal` roda antes do int e semeia `Seed Liderança Um` (`scripts/lib/seed-minimal-manifest.mjs:103`) — word-start `Liderança` casa `Lider`. Em `ci.yml` (main) não há `seed:minimal`, então o defeito só aparece no ci-pr: **todo PR futuro contra `stage` está bloqueado**, não só o #50. O spec de Demandas do próprio PR (`tests/int/homeSearchDemands.int.spec.ts:76`) já usa o padrão correto: token único `fixtures.value('scope-demanda')`.

Decisão de produto (2026-07-30, brief do lote CI): done = **PR #50 mergeado em `stage` com CI verde**, não "feature implementada".

## Objetivos

- `gh pr checks 50` todo verde e merge automático em `stage` efetivado.
- `migration-lock` volta a exercer a regra real (≤1 PR tocando schema) em vez de falhar por infra.
- `homeSearchLeaderships.int.spec.ts` fica seed-proof: passa com e sem `db:seed:minimal` no banco.
- Sem migration, sem schema, sem mudança de comportamento de produto.

## Decisões travadas

- **Fix do spec no padrão token-único, não filtro-por-ids nem exclusão do seed.** O padrão `fixtures.value(...)` já existe no spec irmão (demandas) e mantém a asserção de conjunto exato (que pega regressão de escopo). **Rejeitado:** filtrar o resultado aos ids criados pela fixture (enfraquece a asserção de escopo do coordinator); remover as lideranças do `seed-minimal-manifest` (o contrato do DB mínimo — pinado por `tests/unit/seedMinimalManifest.unit.spec.ts` — existe para int specs que dependem de seed; quebraria outros consumidores).
- **Fix do `migration-lock` = `actions/checkout@v4` + `permissions: { contents: read, pull-requests: read }` no job.** As duas causas foram confirmadas em runs consecutivos (log do run 30561456683: GraphQL permission error após o checkout). **Rejeitado:** token dedicado/PAT (GITHUB_TOKEN com grant explícito é o padrão e não adiciona secret).
- **Fix vai na branch do próprio PR #50** (`agent/B53-busca-global-demandas`), não em branch separada: a política "CI vermelho = seu problema" (OPS7) começa valendo aqui. **Rejeitado:** PR separado de infra primeiro (duplo round-trip de CI; o #50 já é o PR afetado e está `MERGEABLE`).

## Questões em aberto

- **O spec `homeSearchStateDeputies`/`homeSearchAdvisors` etc. têm o mesmo padrão frágil?** **Opções:** A) auditar e corrigir todos neste PR | B) corrigir só o que falha e registrar o resto como débito. **Recomendação:** A se o audit mostrar o mesmo padrão de nome fixo + assert global (grep por `toEqual([` em `homeSearch*.int.spec.ts`) — custo marginal dentro do appetite, evita o próximo bloqueio; senão B.

## Abordagem proposta

Componentes:

- **`.github/workflows/ci-pr.yml`** — job `migration-lock`: inserir `- uses: actions/checkout@v4` como primeiro step.
- **`tests/int/homeSearchLeaderships.int.spec.ts`** — trocar nomes fixos (`Lider Cairu`, `Lider Feira`, `Zeca Pagodinho`, `Maria Silva`) por tokens únicos via `fixtures.value(...)` e usar o token como query (espelhando `homeSearchDemands.int.spec.ts:76-94`); manter asserts de conjunto exato.
- **Audit grep** — `rg "toEqual\(\[" tests/int/homeSearch*.int.spec.ts` para a questão em aberto acima.

Sem migration, sem collection, sem server action.

## Dependências

Nenhuma de outro plano. Reusa `installCampaignFixtures` (`tests/helpers/campaignFixtures.ts`) e o padrão `fixtures.value` já existente.

## Não escopo

- Refatoração estrutural do ci-pr (jobs paralelos) → OPS4.
- Affected tests / manifesto e2e → OPS5.
- Pre-push hooks → OPS6. Política de agente em docs → OPS7 (texto novo; a **prática** vale neste PR).

## Rabbit holes

- **"Já que toco o workflow, paralelizo logo".** Explode OPS4 dentro do P0 e atrasa o desbloqueio. **Mitigação:** diff do workflow limitado ao step de checkout.
- **Investigar por que `ci-stage` smoke não pegou isso.** O smoke roda contra Neon com subset curado; a falha é do ambiente mínimo. **Mitigação:** registrar observação no plano OPS4, não investigar aqui.

## Adiado com gatilho

Nenhum neste item.

## Referências

- GitHub Issue #7 (B53), PR #50, run 30558184687 (logs das duas falhas)
- `.github/workflows/ci-pr.yml` — job `migration-lock`
- `tests/int/homeSearchLeaderships.int.spec.ts` + `tests/int/homeSearchDemands.int.spec.ts` (padrão-alvo)
- `scripts/lib/seed-minimal-manifest.mjs` — `MINIMAL_LEADERSHIPS`
- `.agents/skills/work-issue/SKILL.md` — Passo 6 (acompanhar checks até o merge)
