# OPS88 — Verify do CI (PR e deploy): um Postgres, um build, migrate/seed sem repetição

Status: rascunho
Atualizado em: 2026-08-24
Issue: #834
Priority: P1
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

O verify — o check do PR e o verify do deploy — reconstrói o mesmo estado várias vezes na mesma run: dois Postgres (um deles existe só para o e2e não herdar resíduo dos testes de integração), dois migrates explícitos, dois seeds, dois builds — e cada build ainda re-roda o migrate por baixo. No fim, o build "default" nem é servido por nada no CI: o e2e roda sobre o build `.next-e2e`, e o deploy de verdade compila no homeserver com a URL real.

Queremos um setup único e compartilhado: um Postgres por run com um reset determinístico entre fases (limpa o schema, migrate, seed minimal), e um build só quando build+e2e rodam juntos. Menos tempo de máquina por run, menos pontos de falha, mesma garantia — o que protege o e2e do resíduo do int não é o segundo container, é o reset entre fases.

## Persona e fluxo

- **Persona / contexto:** mantenedor do pipeline (humano ou agente) que espera a cor da run do PR antes de mergear, ou que dispara o deploy manual e espera o verify fechar; contexto: fila de checks, minutos contados, re-run por falha.
- **Job principal:** saber que o PR está pronto para merge e que a publicação é segura, sem pagar o custo de reconstruir o mesmo estado quatro vezes numa run só.
- **Fluxo desejado:** numa run de PR que toca código, os testes de integração rodam num Postgres; um reset determinístico limpa o banco entre fases; o e2e serve o mesmo build compilado para produção (`.next-e2e`) — nada compilado duas vezes "só para conferir". No deploy verify, o mesmo fluxo, e a publicação continua gated pelo verify full. Se uma fase falha, a falha aponta a fase, e a re-run parte de um estado limpo.
- **Anti-goals de produto:** não virar "rodar menos testes" nem "pular o verify"; não virar paralelização do job único (fail-fast estrutural continua valendo); não mexer no deploy do homeserver.

## Objetivo e aceite

- Uma run de PR com build+e2e compila o app uma única vez e roda integração, build e e2e no mesmo Postgres, com reset determinístico entre fases — sem segundo container.
- O verify do deploy usa o mesmo setup único e continua gateando a publicação (rede de segurança inegociável).
- Nenhuma perda de garantia: os pins de contagem dos testes de integração rodam antes do reset; o e2e continua contra o build de produção, nunca dev; migrate-before-build (OPS66) preservado.
- Mensurável: migrates/seeds/builds repetidos caem (4× migrate → ~2×), run mais curta, e o ganho não volta em re-run.

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície de dados para usuário; tempos de run são telemetria de CI, não dado de produto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/ci-pr.yml` e `.github/workflows/deploy.yml` (passos de setup/seed/build), `tests/helpers/` (lease/reset/seed), `playwright.config.ts`, scripts de banco/build em `package.json`.
- **Precedente a olhar:** `docs/plans/ci-e2e-paralelizar-job.md` (2026-08-10, timings por fase) e `docs/ops/teqo-1313-deploy.md` (contrato build-after-migrate).
- **Risco de acoplamento:** o reset determinístico precisa cobrir exatamente o que o e2e não pode herdar do int (linhas fora de ownership, pins de contagem exata, resíduo de run abortada) — quem executa deve provar o reset antes de confiar no banco único; a ordem int → reset → build+e2e é o contrato novo.

## Dependências

- Nenhuma dura. Beneficia-se de OPS86 (classifier) e OPS87 (famílias HTTP no mesmo job) — suaves.

## Fora de escopo

- Sharding/paralelização do verify — fail-fast estrutural se mantém.
- Mudar workers/retries dos jobs de teste.
- Migrar testes de nível (OPS87).
- Ajustar o classifier de e2e (OPS86).
- Qualquer mudança no deploy homeserver, que segue compilando com a URL real.

## Rabbit holes de produto

- **"Já que estou aqui, reduzo a suíte."** Se o setup compartilhado virar desculpa para rodar menos testes ou tirar o e2e do build de produção, a garantia cai. **Corte:** nada de rodar menos testes; e2e sempre no build de produção.
- **"Economizar o reset."** Se o reset determinístico for visto como custo e removido, o resíduo do int volta a contaminar o e2e — o risco exato que o segundo container existia para resolver. **Corte:** o reset entre fases é a proteção; se não couber no appetite, o item encolhe para o build único e a separação de Postgres fica como está.
- **"Unificar os dois builds sempre."** O build default só tem valor quando é o único build da run (PRs sem e2e); colapsá-lo à força exigiria decidir env em tempo de build. **Corte:** colapsar só quando build+e2e rodam juntos.

## Questões em aberto (produto)

- **O que garante o e2e limpo: isolamento físico ou reset determinístico?** **Opções:** A) um Postgres com reset entre fases | B) manter dois containers. **Recomendação:** A — o reset é o que protege; o segundo container é o workaround de hoje, e o resíduo do int é finito e conhecido (fixtures, pins de contagem, claims).
- **O build default continua existindo?** **Opções:** A) sim, quando é o único build necessário (runs sem e2e) | B) sempre um build só. **Recomendação:** A — o custo de mantê-lo só existe nas runs que já rodam sem e2e. _(assumido — validar com produto)_
- **O verify do deploy muda de rigor?** **Opções:** A) mantém o fluxo full, só com setup compartilhado | B) reduz para o setup novo. **Recomendação:** A — a rede de segurança da publicação é inegociável.

## Referências

- `docs/plans/ci-e2e-paralelizar-job.md` — timings por fase e histórico do job e2e
- `.github/workflows/ci-pr.yml` e `.github/workflows/deploy.yml` — passos atuais de Postgres/seed/build
- `tests/helpers/campaignFixtures.ts` e `tests/helpers/testDatabaseLease.ts` — resíduo conhecido do int e leases de banco
- `playwright.config.ts` — qual build o e2e serve
- `docs/ops/teqo-1313-deploy.md` — contrato build-after-migrate (OPS66)
