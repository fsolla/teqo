# Hardening e2e em dev: prewarm de rotas frias + login resiliente a compile

Status: rascunho
Atualizado em: 2026-08-10
Issue: #586
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (sem UI; infra de testes)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Dois flakes e2e reproduzidos nesta sessão em dev (worktree, 2 workers) na suíte que a CI roda verde — a classe "compile-frio do dev server" que faz `pnpm test:e2e` local acusar vermelho em `main` verde:

1. **`campaignMunicipalities` "coordinator opens the municipalities list, edits strategy and assigns an advisor" — 3/4 runs falharam** com `page.goto: net::ERR_ABORTED; maybe frame was detached?` navegando para `/campanha/municipios/<slug>/editar` (linha 107). O mecanismo está documentado no próprio `setup.e2e.spec.ts` (linhas 26-30): "Next dev compiles a route on its first hit, and that compile can trigger a full-page reload for any client currently connected — which aborts an in-flight fetch mid test". O setup prewarms o detail (`/campanha/municipios/e2e-prewarm`) **mas não a rota `/editar`** — que é a única rota de edição que specs navegam (verificado por grep) e compila fria no meio do teste.
2. **`campaignMunicipalities` "coordinator sets trend status and justification with auto-save (B24)" — 1/2 runs falhou** com `page.waitForURL` (login do fixture) estourando os 60 s: o login é a primeira jornada pesada do teste e o compile frio do server action de login + as rotas do `(app)` sob 2 workers não couberam no budget. O comentário do `playwright.config.ts` já registra a classe (P3-C mediu login estourando o budget antigo); o budget de 60 s cobre a maioria, mas não todas.

Ambos são **infra de teste/dev-mode**, não defeito de produto: o fluxo real do usuário (clicar em Editar; fazer login) funciona — é a navegação do browser racionando contra o rebuild do dev server. A CI usa o build de produção (`pnpm start`) e não tem esse mecanismo.

## Persona e fluxo

- **Persona / contexto:** agente ou humano rodando `pnpm test:e2e` em dev (padrão local, inclusive worktrees).
- **Job principal:** rodar a suíte local e ler o resultado como espelho da CI.
- **Fluxo desejado:** `pnpm test:e2e` em dev → verde estável para o que é verde em prod/CI; vermelho só por regressão real.
- **Anti-goals de produto:** não tocar asserções de produto (nenhuma asserção desses testes está errada); não mudar o comportamento do app para satisfazer o dev server.

## Objetivo e aceite

- `campaignMunicipalities` (arquivo inteiro) roda **verde ×3 consecutivos** em dev a 2 workers — incluindo `:78` e `:518` — nesta sessão de verificação.
- O setup do e2e prewarms as rotas que specs navegam de fato (incl. `/campanha/municipios/e2e-prewarm/editar` e qualquer outra rota de edição usada por specs — verificar por grep, não por palpite), seguindo o mecanismo já documentado no setup.
- O login do fixture fica resiliente a compile frio (ex.: retry-único da espera de navegação, ou budget maior só no login) **sem** enfraquecer asserção de produto — login é setup, não contrato.
- P4-L verificado e fechado no ledger: `campaignLeaderships` (chips) era "falha determinística em dev na árvore limpa" (row 59 do TECH-DEBT); o spec foi reescrito pelo B34 desde então e passou 2/2 nesta sessão — re-rodar ×3 em dev + 1× com `E2E_PROD=1` e atualizar o ledger com a evidência.

## Dados (intenção)

- **Vou apresentar dados?** Não — confiabilidade do gate local; o "dado" é estabilidade de execução.
- **Decisões desbloqueadas:** "e2e local verde = entrega pronta para CI" sem re-tentativas de máquina.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `tests/e2e/setup.e2e.spec.ts` (lista de prewarm — GET e POST), `tests/e2e/fixtures/campaignE2EFixtures.ts` (`campaign.login`, linha ~546-555), `docs/TECH-DEBT.md` (row 59 — fechar P4-L com evidência).
- **Precedente a olhar:** o guard `e2eNavigationConventions` (miss #54) que bane goto→goto sem settle; o comentário do próprio setup sobre o mecanismo de full-reload; P4-L documentado em `docs/plans/entrega-engenharia-p4.md` (onda 4, "Debug com evidência").
- **Risco de acoplamento:** o prewarm não pode virar "aguardar resposta 200 de rota autenticada" (o setup roda sem sessão — as GETs de prewarm usam `e2e-prewarm` justamente por isso); o retry de login não pode engolir falha real de credencial (o retry só na espera de navegação, não na validação de credenciais).

## Dependências

- Nenhuma (a investigação do B188 — chat Sollinha — é da #562, em progresso; se o executor encontrar evidência de que o contexto do chat interfere nessas navegações, registrar como achado da #562, não reabrir o assunto aqui).

## Fora de escopo

- Flake de dados de seed (`campaignMunicipalities` FAB suggest, `campaignSavedFilters`) → OPS28 (provisionamento) / OPS29 (estado vazio).
- Flakes já registrados: #562 (agenda mobile, em progresso), #553, #573.
- Refatorar o spec `campaignMunicipalities` além do mínimo para a estabilidade.

## Rabbit holes de produto

- **"Adicionar `waitForLoadState('networkidle')` antes de todo goto."** Esconde o flake por sorte e deixa a suíte mais lenta; o prewarm ataca a causa (rota quente antes do teste). **Corte neste item:** prewarm das rotas reais + retry-único só no login.
- **"Aproveitar e trocar o dev server por build de produção no padrão local."** Isso é decisão de fluxo de dev (já existe `E2E_PROD=1` como modo honesto documentado); muda o trade-off de velocidade para todo mundo. **Corte:** deixar o padrão `pnpm dev` intacto.

## Questões em aberto (produto)

- **O retry de login deve ser no fixture (para todos os specs) ou um helper opcional?** **Opções:** A) retry-único dentro do `campaign.login` (todos os specs herdam) | B) helper que os specs chamam quando sabem que estão em dev. **Recomendação:** A — login é infra em todos os specs; um helper opcional volta a depender de cada spec lembrar. _(assumido — validar com quem mantém os fixtures)_
- **P4-L: fechar o ledger ou manter aberto com "verificado"?** **Opções:** A) fechar com evidência (×3 dev + 1 prod) | B) manter aberto como dívida de verificação contínua. **Recomendação:** A — dívida fechada com evidência é o padrão do ledger; reabrir se um agente reproduzir com a spec nova.

## Referências

- Evidência da sessão: `:78` falhou 3× e passou 1× (sempre `ERR_ABORTED` no goto de `/editar`); `:518` falhou 1× (`waitForURL` do login, 60 s); `campaignLeaderships` 2/2 verde (spec reescrita pós-B34).
- `tests/e2e/setup.e2e.spec.ts` (mecanismo do full-reload + lista de prewarm atual), `playwright.config.ts` (comentários de budget P3-C).
- `docs/TECH-DEBT.md` row 59 (P4-L) e `docs/plans/entrega-engenharia-p4.md` (onda 4).
