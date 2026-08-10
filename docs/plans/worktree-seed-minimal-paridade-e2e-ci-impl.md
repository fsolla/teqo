# Impl: Worktrees provisionam os bancos e2e sem o seed mínimo — e2e diverge da CI

Status: aprovado
Atualizado em: 2026-08-10
Issue: #584
Intenção: docs/plans/worktree-seed-minimal-paridade-e2e-ci.md
Appetite restante: herdado (~0,5 dia eng; um outcome verificável)

## Leitura da intenção

- **Outcome:** um worktree recém-provisionado (`next` **e** `plan`) roda `pnpm test:e2e` com o mesmo resultado da CI nos specs dependentes de dados do seed (`campaignMunicipalities` FAB suggest, `campaignSavedFilters` e os que tocam `priority`/`expectedVotes`/`campaignGoals`); a CI continua sendo a fonte canônica (nada do que este item faz muda o que a CI executa); o seed roda idempotente e protegido pelo guard de banco local; re-provisionamento não duplica nem corrompe.
- **O que NÃO negociar:** não alterar specs e2e para "aceitar dados ausentes" (o provisão é o defeito); nunca rodar seed contra banco não-local; CI intocada; guard de regressão sem enfraquecer specs.
- **O que reavaliar:** a hipótese de "Direção no codebase" aponta `scripts/worktree.mjs` + `seed-minimal.mjs` + manifest + setup e2e — confirmada na exploração; a mecânica real das falhas foi verificada no código (FAB suggest filtra `priority === 'alta'` em `rankHomeSearchSuggestMunicipalities`; o recorte `?priority=alta` nasce vazio sem os pins; o nome sugerido vem de `formatMunicipalityActiveFiltersSummary(state)` — o fluxo quebra porque o recorte vazio derruba a linha 49 do spec).

## Abordagem recomendada

```mermaid
flowchart LR
  A[provision worktree] --> B[runMigrate dev]
  B --> C[runSeedMinimal dev]
  C --> D[runMigrate test]
  D --> E[runSeedMinimal test]
  E --> F[env files + porta do slot]
  F --> G[e2e igual à CI]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — rodar `pnpm db:seed:minimal` dentro de `provision()` em `scripts/worktree.mjs`, logo após cada `runMigrate`, para os DOIS bancos (dev e test), reusando o mesmo padrão de env (`DATABASE_URL` + `PAYLOAD_SECRET` explícitos) e o mesmo script npm da CI (`pnpm db:seed:minimal` — idempotente por upsert, guard `assertLocalDatabase` já embutido). `--no-migrate` pula migrations **e** o seed (o seed depende do catálogo migrado). Re-provisionamento (`next` num worktree existente) roda tudo de novo — migrate e seed são idempotentes, o aceite "não duplica nem corrompe" vale por construção.
**Rejeitadas:**

- **B — seedar só o banco de teste** (test-only): corrige o e2e mas deixa o `pnpm dev` do worktree divergente (FAB suggest vazio no navegador manual) e cria dois contratos de provisionamento; o custo de seedar o dev é o mesmo.
- **C — documentar no AGENTS.md "rode o seed manualmente no worktree"**: trata o sintoma no papel; o ambiente padrão de entrega continua divergente e o agente segue aprendendo a ignorar o e2e vermelho (o padrão exato do ledger TECH-DEBT row 19).

### Componentes / mudanças

- **`runSeedMinimal`** (`scripts/worktree.mjs`): irmã de `runMigrate` — `execFileSync('pnpm', ['db:seed:minimal'], { cwd: dir, env: { ...process.env, DATABASE_URL, PAYLOAD_SECRET }, stdio: 'inherit' })`. O script npm já carrega `tsx/esm` + `seed-loader`; o seed faz `loadCliEnv()` sem `override`, então os env explícitos vencem.
- **`provision()`** (`scripts/worktree.mjs`): `migrate dev → seed dev → migrate test → seed test`; `skipMigrate` passa a pular os dois (mensagem atualizada).
- **Fallback sem Docker** (`writeFallbackEnv` path): **decisão Q1 aprovada no gate — paridade total (opção A)**: `migrate + seed:minimal` também no `teqo`/`teqo_test` compartilhados (ler `PAYLOAD_SECRET` do main env nesse branch; `--no-migrate` pula igualmente).
- **Guard de regressão** (Q2 da intenção, **decisão aprovada no gate — opção B, setup e2e**): spec novo `tests/e2e/seedParity.setup.e2e.spec.ts` no projeto `setup` do Playwright (o match `/setup\.e2e\.spec\.ts/` pega o arquivo; projeto `setup` roda primeiro e os projetos dependentes pulam se ele falhar): boota `getPayload({ config })` (padrão já usado nos fixtures) e falha com mensagem clara ("rode `pnpm migrate && pnpm db:seed:minimal` — ou `pnpm worktree next` para reprovisionar") se o banco de teste não estiver seedado. **Evidência checada = `MINIMAL_CAMPAIGN_USERS`** (users sintéticos do seed), deliberadamente NÃO os pins de `priority: 'alta'`: o cleanup dos fixtures e2e reseta `priority` dos municípios tocados (round-robin por sequência persistente — `campaignE2EFixtures.ts`), então pins morrem legitimamente após runs repetidas no mesmo banco de worktree e não são evidência indelével; os users do seed nunca são deletados pelo cleanup (que só deleta o que os fixtures criaram). Mensagem clara em vez de spec vermelho confuso. (Sem extensão extra do manifest unit — o pin existente de slugs fica como está.)
- **`HIGH_RISK_EXACT`** (`scripts/lib/test-affected-core.mjs`): adicionar `scripts/worktree.mjs` — mudança no provisionador deve rodar a suíte cheia na CI, não só o diff.
- **Docs:** AGENTS.md "Per-worktree environments" (migrations → migrations + seed mínimo, paridade com a CI); header/uso do `scripts/worktree.mjs` (`--no-migrate` agora pula migrate+seed); `.agents/skills/local-database/SKILL.md` (linhas 32/34, mesmo contrato); entrada curta em `docs/CHANGELOG-AGENTS.md`.
- **Migration:** nenhuma (sem schema/dados novos).
- **Access / Consent:** nenhum (o seed já faz `provisionOnda0ConsentAndPrivacy` + chaves fail-closed — intocado).
- **UI:** Impeccable A — N/A (sem UI).

### Dados → forma (se aplicável)

Não aplicável — infra de provisionamento; o "dado" é a paridade de estados entre ambientes, verificada pelo guard do setup (pin `alta` no banco de teste) e pelo e2e real.

## Fases verificáveis

1. **Tracer — provisionamento** (quota principal): `runSeedMinimal` + chamadas no `provision()` (Docker path) + `--no-migrate` → verificação manual num banco de teste recém-criado (seed aplicado, idempotência em re-execução). Fallback sem Docker segue a decisão do gate (Q1).
2. **Guard** — `seedParity.setup.e2e.spec.ts` no projeto `setup` (falha com mensagem clara contra banco não-seedado — incluindo banco nunca-migrado, via try/catch com a mesma mensagem; verde com seed) + `HIGH_RISK_EXACT`.
3. **Gates** — `pnpm gate:fast` na iteração; depois `pnpm test:e2e -- tests/e2e/campaignSavedFilters.e2e.spec.ts` + o spec do FAB suggest contra o banco do worktree seedado (reprodução real das duas falhas da intenção); `pnpm test:int` (unit+int); `pnpm check:cycles`/`format:check`/`knip`; entrega com `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Não tocar em nenhum spec e2e existente (o único arquivo de teste novo é o guard).
- Não mudar o CI (`ci.yml`/`ci-pr.yml` já rodam `migrate → seed:minimal` — nada a fazer).
- Não alterar o `seed-minimal.mjs` nem o manifest (já idempotentes e corretos).
- Não mexer nos bancos compartilhados `teqo`/`teqo_test` no fluxo Docker (fora do contrato de worktree).
- Não adicionar lock/transação ao seed para o caso de dois fallbacks seedarem o mesmo `teqo_test` em paralelo (fallback é degradado; colisão de upsert find-before-create é raça rara e ruidosa — documentar no impl, não engenhar).
- Gap observado (não deste item): o fallback não grava `PAYLOAD_SECRET` no `.env.local`/`.env.test.local` gerados — o seed receberá o secret explícito no env; o gap do dev no fallback é pré-existente e fica fora de escopo.

## Riscos e mitigação

- **Seed adiciona ~10–30 s por banco no provisionamento** (boot do Payload + upserts): aceitável — migrations já levam ~30 s cada; é one-time por banco e idempotente.
- **Re-execução em worktree existente**: `next` re-roda `provision()`; migrate+seed idempotentes → sem duplicação (upsert por chave estável/slug/email/phone).
- **Guard do setup com banco compartilhado do fallback**: se dois fallbacks rodarem e2e no mesmo `teqo_test`, o guard lê estado do banco — o seed é idempotente; risco residual documentado (raça find-before-create) e ruidoso se ocorrer.
- **E2E novo no projeto `setup` pode afetar a duração do setup**: boot do payload ~2–5 s; aceitável (o setup já prewarms 13 rotas).

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (e2e do worktree = CI; CI intacta; idempotência)
- [ ] Invariantes AGENTS/engineering-standards (local-only via `assertLocalDatabase`; nenhum schema/access/Consent tocado)
- [ ] Testes previstos: guard e2e (falha clara + verde), unit do manifest estendido, reprodução real dos 2 specs que falhavam
