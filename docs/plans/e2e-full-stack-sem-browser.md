# E2E full-stack sem browser (paradigma HTTP) para asserções de servidor

Status: rascunho
Atualizado em: 2026-08-10
Issue: #600
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem UI de produto; infra de testes)
Canvas UI: N/A — sem UI
Appetite: ~1–1,5 dia eng; um outcome verificável
Responsável: —

## Intenção

Uma parte grande dos testes e2e existe para garantir **comportamento de servidor**: criar fixture → navegar até uma lista/detalhe → o servidor renderiza o dado certo para o papel certo (RBAC), persistência, redirects/404, rotas JSON de mutação. Esses testes pagam browser + hidratação + interação client mesmo quando a asserção é 100% server-side.

Já existe a prova de que o paradigma funciona: o `setup.e2e.spec.ts` roda contra o servidor real **sem lançar browser** (só a fixture `request` do Playwright) — cobrindo SSR, cookies, redirects e as rotas JSON POST de `/campanha`.

Queremos um modo de spec e2e full-stack **sem browser** (servidor + DB reais, HTTP real, sem UI): as famílias cujas asserções são de servidor migram para ele, mantendo as mesmas garantias e gastando uma fração do tempo — e a suíte continua crescendo sem crescer o browser.

## Persona e fluxo

- **Persona / contexto:** agentes e humanos mantendo/estendendo a suíte e2e; CI rodando o job e2e.
- **Job principal:** garantir o contrato HTTP/SSR/RBAC/persistência das rotas de campanha sem pagar o custo do browser.
- **Fluxo desejado:** spec nova de família "sem browser" → roda no mesmo job e2e (mesmo servidor e DB) → assere o mesmo conteúdo renderizado e o mesmo efeito de persistência que o teste de browser asseria → verde em ~frações do tempo.
- **Anti-goals de produto:** não é para substituir os testes de browser onde o client importa (hidratação, autosave otimista, Drawers, WebAuthn, PWA, viewports mobile, guard de console); não é para chamar server actions por HTTP cru (protocolo RSC criptografado — frágil e caro de manter).

## Objetivo e aceite

- Um modo novo de spec e2e roda no job e2e existente **sem lançar browser**, contra o servidor real (prod build no CI, dev local idem).
- A primeira leva de famílias migra com **asserções equivalentes às atuais** (mesmos fixtures, mesmas expectativas — o que era DOM vira conteúdo renderizado/efeito verificado) — nada é removido sem equivalente em outro lugar.
- Migração com medição: para cada família migrada, tempo de browser vs. tempo sem browser registrado no changelog (o ganho é o outcome, não o artefato).
- RBAC continua assegurado: o escopo de assessor/liderança é asserido no conteúdo renderizado pelo servidor (ex.: lista de um assessor não contém municípios fora do portfolio dele).
- Autenticação funciona no modo sem browser (sessão real de campanha, cookie `campaign-token`), sem duplicar lógica de auth no teste.
- O guard de falhas client (console.error/pageerror) permanece exclusivo das specs de browser — o modo HTTP não finge cobrir o que ele não observa.

## Dados (intenção)

Dados: N/A — não há superfície de dados de produto; métrica de processo = wall time por família migrada.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `tests/e2e/` (nova família ou projeto no `playwright.config.ts`), fixtures existentes `tests/e2e/fixtures/campaignE2EFixtures.ts` (reuso do ownership/cleanup), `tests/e2e/setup.e2e.spec.ts` (precedente da fixture `request`), rotas JSON `/campanha/...` já criadas por `campaignJsonMutationRoute`.
- **Precedente a olhar:** `setup.e2e.spec.ts` (request fixture sem browser); `tests/helpers/login.ts`/`seedUser.ts` (auth reutilizável); docs/plans `porta-e2e-isolada-por-worktree.md` (contrato do job).
- **Risco de acoplamento:** a sessão precisa chegar ao `request` context (storageState/cookie); fixtures de dados continuam sendo criados via Payload in-process (o mesmo padrão atual) — não criar um caminho de seed paralelo.

## Dependências

- Nenhuma dura. Beneficia-se de OPS34 (job e2e mais rápido) e da existência das rotas JSON (já presentes).

## Fora de escopo

- Migrar famílias de interação/hidratação (WebAuthn, PWA, viewports, Sollinha/chat, sticky header, colunas/saved filters, autosave) — continuam em browser.
- Chamar server actions via HTTP cru (ação Next criptografada).
- Criar um runner/modo de teste fora do Playwright (o paradigma é um modo Playwright sem browser, não um framework novo).
- Reduzir o que a suíte garante hoje (asserções migradas 1:1 em cobertura).

## Rabbit holes de produto

- **"Migrar tudo para HTTP"**: o guard de console e a hidratação são justamente o que o browser testa — migrar tudo perderia segurança. **Corte neste item:** apenas asserções de servidor, com medição por família.
- **"Reimplementar login sem browser"**: duplicaria a lógica de sessão do app no teste. **Corte:** sessão real via cookie/storageState produzida pelo fluxo existente.
- **"Aproveitar e criar um framework de teste próprio"**: o Playwright `request` já cobre servidor+DB+HTTP; framework paralelo seria custo sem ganho. **Corte:** paradigma dentro do Playwright.

## Questões em aberto (produto)

- **Como o teste sem browser obtém a sessão de campanha?** **Opções:** A) um login de browser real por run (setup) → `storageState` → `request.newContext` com o cookie; B) login via API REST do Payload e cópia manual do token/cookie. **Recomendação:** A — usa exatamente o fluxo real de login e o cookie canônico `campaign-token`, sem duplicar lógica. _(assumido — validar no gate)_
- **Convenção de nomenclatura e projeto?** **Opções:** nova família `*.http.e2e.spec.ts` no projeto `campaign` existente | projeto Playwright próprio sem dependências. **Recomendação:** família própria no projeto existente (menos configuração, mesmo servidor). _(assumido — validar no gate)_
- **Qual a primeira leva de famílias?** **Opções:** agenda/feed e atividades (asserções de render+persistência) | lideranças e municípios (as mais pesadas) | começar por uma família pequena para validar o paradigma. **Recomendação:** começar pequeno (uma família com poucas specs) para provar o paradigma com medição, depois escalar para as pesadas. _(assumido — validar no gate)_

## Referências

- GitHub Issue #600
- `tests/e2e/setup.e2e.spec.ts` (prova do paradigma), `tests/e2e/fixtures/campaignE2EFixtures.ts` (ownership/cleanup reutilizável), `playwright.config.ts`, `src/utilities/campaignJsonMutationRoute.ts` (rotas JSON HTTP-testáveis), `docs/CHANGELOG-AGENTS.md`
