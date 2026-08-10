# E2E: journeys seriais nos arquivos pesados (amortizar overhead por teste)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #601
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (sem UI de produto; infra de testes)
Canvas UI: N/A — sem UI
Appetite: ~1 dia eng; um outcome verificável
Responsável: —

## Intenção

Três arquivos concentram uma fração grande da suite e2e: `campaignHomeActions` (17 testes), `campaignMunicipalities` (20 testes) e `campaignBottomNav` (9 testes). Cada teste paga sozinho o mesmo overhead fixo: inicializar o Payload in-process (`getPayload`), criar fixtures próprios, login + `waitForURL` no browser, e o cleanup com `discoverOwnedRows` (~10 queries + transação de delete). Esse overhead se repete 46 vezes onde poderia ser pago uma vez por jornada.

Queremos transformar esses arquivos em **journeys seriais**: um `beforeAll` que paga a inicialização e o login uma única vez, e testes sequenciais dentro do mesmo worker aproveitando a sessão — sem perder granularidade de diagnóstico nem reduzir asserções.

## Persona e fluxo

- **Persona / contexto:** agentes e humanos rodando/estendendo a suite e2e; CI no job e2e.
- **Job principal:** as mesmas 46 garantias, com o wall time dos três arquivos reduzido pela amortização do overhead repetido.
- **Fluxo desejado:** rodar `campaignHomeActions`/`campaignMunicipalities`/`campaignBottomNav` → cada arquivo inicializa payload + sessão uma vez → testes sequenciais reusam a sessão → falha continua apontando para o teste exato.
- **Anti-goals de produto:** não é "um mega-teste" (retry caro, falha no meio perde diagnóstico); não é aplicar a todos os 32 arquivos (perda de paralelismo sem ganho).

## Objetivo e aceite

- Wall time dos três arquivos cai de forma mensurável (registrar antes/depois no changelog).
- Cada teste continua sendo um teste separado no relatório — falha localizada, retry por teste preservado.
- Nenhuma asserção removida nem enfraquecida; nenhum caminho deixa de ser testado.
- A classe de flake por interação não piora: a ordem serial é estável e o retry continua por teste.
- Arquivos com testes de viewport/estado variado não são forçados ao padrão (decisão por arquivo, com medição).

## Dados (intenção)

Dados: N/A — não há superfície de dados de produto; métrica de processo = wall time por arquivo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `tests/e2e/campaignHomeActions.e2e.spec.ts`, `tests/e2e/campaignMunicipalities.e2e.spec.ts`, `tests/e2e/campaignBottomNav.e2e.spec.ts`, fixtures `tests/e2e/fixtures/campaignE2EFixtures.ts` + `e2eTest.ts` (sessão/storageState compartilhado).
- **Precedente a olhar:** `tests/e2e/fixtures/campaignE2EFixtures.ts` (ownership por runID — já tolerante a reuso de worker), `playwright.config.ts` (fullyParallel por arquivo), padrões de `test.describe.configure({ mode: 'serial' })` no repo.
- **Risco de acoplamento:** testes hoje paralelos dentro do arquivo passam a ser seriais — a sessão compartilhada muda o isolamento (cookies por contexto); o cleanup de fixtures continua necessário por teste (ownership por runID já cobre).

## Dependências

- Nenhuma dura. Composição com OPS35 (specs sem browser) e OPS34 (job CI): cada um é independente e mensurável à parte.

## Fora de escopo

- Migrar os outros ~29 arquivos para o padrão serial (decisão por medição, não por princípio).
- Mesclar testes num journey único (perde granularidade de retry/diagnóstico).
- Mudar asserções ou caminhos cobertos.
- Corrigir flakes pré-existentes (ledger separado).

## Rabbit holes de produto

- **"Fazer tudo serial para ganhar mais"**: paralelismo entre arquivos é o que mantém a suite dentro do budget — serializar tudo inverte o ganho. **Corte neste item:** só os três arquivos medidos, com decisão por arquivo.
- **"Compartilhar fixtures entre testes para economizar mais"**: acopla estado e transforma falha isolada em falha em cascata. **Corte:** fixtures continuam por teste; só payload+sessão são amortizados.
- **"Aproveitar para 'limpar' asserts redundantes"**: reduzir asserções muda o contrato de segurança. **Corte:** zero asserções removidas.

## Questões em aberto (produto)

- **Login compartilhado por arquivo ou por grupo de testes?** **Opções:** A) um login no `beforeAll` do arquivo inteiro (máximo de amortização, jornada longa); B) um login por `describe` (granularidade média, falha contida). **Recomendação:** B — um login por grupo de jornada coeso, balanceando amortização e isolamento de falha. _(assumido — validar no gate)_
- **Sessão via storageState ou login reutilizado no worker?** **Opções:** A) `storageState` salvo no primeiro login; B) reutilizar a página/contexto do `beforeAll` em modo serial. **Recomendação:** B — no modo serial do mesmo worker, reusar o contexto do grupo é o padrão Playwright mais simples e determinístico. _(assumido — validar no gate)_
- **Ordem de ataque?** **Opções:** começar pelo arquivo de maior overhead absoluto (medir primeiro) | começar pelo menor risco (homeActions/BottomNav) | todos juntos. **Recomendação:** medir os três e começar pelo que paga mais cedo — o executor decide com a medição na mão. _(assumido — validar no gate)_

## Referências

- GitHub Issue #601
- `tests/e2e/campaignHomeActions.e2e.spec.ts`, `tests/e2e/campaignMunicipalities.e2e.spec.ts`, `tests/e2e/campaignBottomNav.e2e.spec.ts`, `tests/e2e/fixtures/campaignE2EFixtures.ts`, `playwright.config.ts`, `docs/CHANGELOG-AGENTS.md`
