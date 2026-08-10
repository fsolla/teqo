# CI e2e: paralelizar o job (cadeia serial só em dev + sharding do e2e)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #599
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem UI; infra de CI/testes)
Canvas UI: N/A — sem UI
Appetite: ~1 dia eng; um outcome verificável
Responsável: —

## Intenção

O job `e2e` é o mais longo da cascata CI (medido 2026-08-10: **617–635 s** no `ci.yml` de main, incluindo build+migrate+seed; job `int` ~248 s, `build` ~224 s). Duas fontes de serialização identificadas:

1. **Cadeia de projetos no Playwright** (`setup → campaign → frontend → admin`, `playwright.config.ts`): existe para o `setup` preaquecer rotas no **dev-mode** (compile frio do Next dev). No CI o servidor é o **build de produção** (`pnpm start`), onde não existe compile — o prewarm é custo puro e `frontend` (1 teste) e `admin` (3 testes) ficam travados depois de toda a família `campaign` (~29 arquivos).
2. **Um único runner** executa o job inteiro (~10 min), enquanto o runner fica ocioso na maior parte do tempo (2 workers Playwright).

Queremos o mesmo conjunto de testes, as mesmas asserções, com o job e2e rodando na metade do tempo e crescendo de forma sustentável.

## Persona e fluxo

- **Persona / contexto:** time de engenharia (humanos e agentes) esperando o merge em main / PR para deploy.
- **Job principal:** saber que o e2e passou no menor tempo possível, com o mesmo nível de confiança.
- **Fluxo desejado:** push/merge → job e2e conclui em ~metade do tempo atual → deploy desbloqueado antes.
- **Anti-goals de produto:** não remover/reduzir cobertura; não mudar asserções; não piorar o dev local (onde o prewarm ainda tem valor).

## Objetivo e aceite

- Job `e2e` do `ci.yml` (main, suite completa) cai de ~10 min para ≤ ~6 min de wall time (mesma classe de runner, comparando contra a linha de base de 2026-08-10).
- A mesma suite completa roda no CI de main e no modo full de PR — nenhuma spec removida nem alterada.
- O dev local (`pnpm test:e2e` sem CI/E2E_PROD) mantém o comportamento atual de prewarm e cadeia — a experiência de quem escreve specs não muda.
- A configuração de workers do CI é explícita e **não** altera o default local (que permanece 2).
- Sem classe nova de flake: a contagem de vermelhos por causa de paralelismo não piora vs. a linha de base (flakes conhecidos já ledgerados — 1-worker de `campaignMunicipalities`, ordem de arquivo de `campaignLeaderships` — são rastreados à parte).

## Dados (intenção)

Dados: N/A — não há superfície de dados de produto; a única métrica é duração do job CI (registrar antes/depois no changelog).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/ci.yml` e `ci-pr.yml` (job `e2e`), `playwright.config.ts` (projects/dependencies), `scripts/gate-ci.mjs` (paridade local), `scripts/run-e2e-affected.mjs`.
- **Precedente a olhar:** o job já usa `NEXT_DIST_DIR: .next/e2e` e `pnpm start` no CI (o prewarm do `setup.e2e.spec.ts` é documentado como dev-only); `test:e2e:affected` mostra o padrão de seleção de specs.
- **Risco de acoplamento:** sharding duplica o build por runner se cada shard compilar sozinho (~4 min de build por shard) — a escolha build-uma-vez-com-artefato vs. build-por-shard é uma decisão de engenharia com trade-off real (ver Questões em aberto); a cadeia de projetos precisa continuar existindo em dev.

## Dependências

- Nenhuma dura. Beneficia (mas não depende de) OPS35 (paradigma HTTP reduz o tamanho do e2e).

## Fora de escopo

- Mudar/remover asserções de qualquer spec (cada spec mantém o que garante hoje).
- Reduzir o que a CI roda (suite completa de main continua completa; seleção afetada do PR continua).
- Otimizar o job `build`/`int` (são ~4 min; fora deste item).
- Corrigir flakes pré-existentes (são outros items já rastreados).

## Rabbit holes de produto

- **"Melhorar o paralelismo também em dev"**: mexer na cadeia/prewarm do dev-mode para "ganhar mais" — quebra exatamente o que estabiliza o dev local sob carga. **Corte neste item:** CI/prod-mode apenas.
- **"Aproveitar e subir o default de workers para 4"**: altera o dev local e amplifica a classe de flake por carga. **Corte:** workers do CI via env explícita; default local intocado.
- **"Shard por família de spec para cache/afinidade"**: complexidade sem ganho medido. **Corte:** sharding padrão do Playwright (`--shard`), deterministicamente por teste.

## Questões em aberto (produto)

- **O build do e2e fica por shard ou vira artefato compartilhado?** **Opções:** A) cada shard compila (simples, wall time ≈ build + teste/2); B) job `build-e2e` próprio + upload/download de artefato `.next/e2e` (testes mais rápidos, acoplamento de artefato e custo de download). **Recomendação:** começar em A (simples, deterministicamente verde) e migrar para B se o wall time do build dominar depois que os testes encolherem. _(assumido — validar no gate)_
- **Quantos shards?** **Opções:** 2 | 3 | N pelo tamanho do job. **Recomendação:** 2 no primeiro passo (metade do wall time, sem estourar a quota de runners), reavaliar com medição. _(assumido — validar no gate)_
- **Workers do CI: manter 2 ou subir?** **Opções:** manter 2 | 3 | 4 via env. **Recomendação:** manter 2 inicialmente (a paralelização do shard já entrega o ganho; workers adicionais exigem medir `max_connections` do Postgres service e a classe de flake por carga). _(assumido — validar no gate)_

## Referências

- GitHub Issue #599
- `playwright.config.ts` (projects/cadeia/workers), `.github/workflows/ci.yml` + `ci-pr.yml` (job e2e), `scripts/gate-ci.mjs`, `tests/e2e/setup.e2e.spec.ts` (prewarm dev-only), `docs/CHANGELOG-AGENTS.md` (entradas OPS20/OPS30, medições de job e2e)
