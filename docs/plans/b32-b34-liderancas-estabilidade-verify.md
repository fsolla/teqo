# B32/B34 — Raiz dos testes de lideranças que quebraram o verify 3 runs seguidos (regressão ou flake sob carga)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1036 (blocked via --plan — promover com agent:ready após merge em main)
Priority: P1 (proposto — validar no gate; alternativa P2 abaixo)
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng (diagnóstico + fix + prova verde)
Responsável: —

## Intenção

Quero saber por que a lista de lideranças quebrou o deploy três vezes seguidas — o auto-save do status (B32) e os chips de municípios (B34) falhando até o retry #2 — e se foi regressão real da trilha C165/B32-B34 ou só flake sob carga. Quero o diagnóstico com prova verde, sem mexer no contrato de deploy.

## Persona e fluxo

- **Persona / contexto:** equipe de campanha que usa `/campanha/liderancas` todo dia + quem opera o deploy em `main` e hoje vê o `verify` vermelho sem saber se pode aprovar.
- **Job principal:** confiar que o `verify` full verde significa que a lista de lideranças está estável.
- **Fluxo desejado:** merge em `main` → `verify` full roda → B32 e B34 passam de primeira → deploy segue sem retry manual nem investigação de log.
- **Anti-goals de produto:** não virar redesign da lista de lideranças; não virar segundo mecanismo de estabilidade paralelo ao `verify`.

## Objetivo e aceite

- Diagnosticado se B32/B34 é regressão real (ex.: via C165-F1) ou flake sob carga (4 workers), com evidência nos logs dos 3 runs.
- `tests/e2e/campaignLeaderships.e2e.spec.ts:15` (B32) e `:59` (B34) passam de forma estável no `verify` full (hosted, 4 workers).
- Guardrails: sem mudar contrato de deploy; sem mudar comportamento visível da lista salvo se o diagnóstico provar que a UI é a causa (ver Fora de escopo); HEAD atual segue verde — isto é anti-recorrência.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de estabilidade de suíte, sem métrica, contagem ou ranking novo.
- **Decisões desbloqueadas:** nenhuma decisão de campanha; a decisão desbloqueada é operacional (aprovar deploy com `verify` verde).
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: leitura de estabilidade é no `verify` full, nunca em run local isolado.

## Dados da decisão (literais)

- `tests/e2e/campaignLeaderships.e2e.spec.ts:15` (B32 — POST `/campanha/liderancas/support-status`)
- `tests/e2e/campaignLeaderships.e2e.spec.ts:59` (B34 — POST `/campanha/liderancas/municipalities`)
- Runs deploy-push em `main` com `verify` vermelho: `34997300602` (sha `8dece9cd`, "fix(C165-F1)"), `34991826170` (sha `2e2813fe`), `34984805702` (sha `897154b`)
- Contagens run `34997300602`: 232 tests, 1 failed / 227 passed; B32 falha persistente (fail + retry #1 + retry #2)
- B34 passou no retry no run `34997300602`, falhou até retry #2 no run `34991826170`
- Falhas vizinhas nos mesmos runs: `campaignActivity:525` (badge "Sem município", C165), `campaignAiChatResize:44`, `campaignColumnPicker:21`, `campaignMunicipalities:659` (advisor scopes), `campaignSavedFilters:35`, `campaignActivity:55`
- JobIds para logs: `104476711539`, `104458195479`, `104434116739` via `gh api repos/fsolla/teqo/actions/jobs/<jobId>/logs`
- HEAD atual `13aeb9bb` está verde — anti-recorrência

## Direção no codebase (hipótese)

- **Áreas prováveis:** specs em `tests/e2e/campaignLeaderships.e2e.spec.ts` + helpers `campaignE2EFixtures.ts` / `expectPostResponse`; rotas `/campanha/liderancas/support-status/` e `/campanha/liderancas/municipalities/` (+ `state-deputies/`); células `LeadershipListSupportStatusControl.tsx`, `LeadershipMunicipalitiesColumnCell.tsx`, `LeadershipStateDeputiesColumnCell.tsx` sobre `shared/RelationChipCell.tsx` / `MunicipalityPortfolioCell`; actions `liderancas` + schemas.
- **Precedente a olhar:** `docs/plans/autosave-status-lista-liderancas.md` (B32) e `docs/plans/chips-municipios-lista-liderancas.md` (B34) — contexto, não suspeitos; OPS83 `#824` já listava `campaignLeaderships:59` (B34); `docs/plans/e2e-flake-cast-rotativa-pos-ops83-impl.md` (o que o #882 cobre — NÃO cobre B32/B34).
- **Risco de acoplamento:** leader lockdown e escopos de assessor nas células da lista; não afrouxar access para fazer o spec passar.

## Dependências

- Nenhuma dura.
- Soft: #882 (cast rotativa C131/B176/B197/concepts — escopo distinto, NÃO cobre B32/B34 persistentes); #878 (open, C145 — mesma família de células, outra superfície `/pessoas`); C165 #1010 + C165-F1 #1030 closed/in-prod (regressão via C165-F1 é hipótese, não fato).

## Fora de escopo

- Contrato de deploy (workflow `deploy.yml`, jobs `verify`/`deploy-staging`/`deploy-production`, runners) — sem mudança.
- Mudança de UI, salvo se o diagnóstico provar que a causa é visual/comportamental — **condição explícita:** se provar UI, o rascunho `docs/plans/b32-b34-liderancas-estabilidade-verify-ui-draft.html` vira obrigatório antes do registro.
- Reescrita ampla dos specs B32/B34 ou de outras superfícies da cast (`campaignActivity`, `campaignColumnPicker`, `campaignMunicipalities`) — vizinhos são evidência, não alvo.

## Rabbit holes de produto

- **Marcar como flaky / aumentar retry como curativo.** Se alguém "só completar": `verify` verde por tolerância, com a regressão viva embaixo. **Corte neste item:** retries e timeouts só entram com diagnóstico que prove flake sob carga; persistência 3/3 começa como regressão.
- **Reabrir a cast rotativa do #882.** Se alguém "só completar": este item vira segundo dono dos flakes C131/B176/B197. **Corte neste item:** #882 segue dono da cast; aqui só B32/B34 + vizinhos como evidência.

## Questões em aberto (produto)

- **Regressão real ou flake sob carga?** **Opções:** regressão real via trilha C165/C165-F1 | flake sob carga (4 workers, stream RSC / debounce). **Recomendação:** tratar como regressão até prova de flake, dado o 3/3 persistente do B32 até retry #2 — flake não repete idêntico três runs seguidos. _(assumido — validar com os logs no plano de implementação)_
- **P1 ou P2?** **Opções:** P1 (classe que quebra `verify`/deploy, precedente #906 P1) | P2 (HEAD verde, anti-recorrência). **Recomendação:** P1 proposto — quebrou deploy 3x seguidas; rebaixar para P2 só se o gate mostrar que o HEAD verde já contém o fix. _(proposto — validar no gate)_

## Referências

- GitHub Issue #1032 (reservado)
- Rascunho UI (gate): N/A
- `tests/e2e/campaignLeaderships.e2e.spec.ts` (specs `:15` B32 e `:59` B34)
- `docs/plans/autosave-status-lista-liderancas.md` (B32, precedente entregue)
- `docs/plans/chips-municipios-lista-liderancas.md` (B34, precedente entregue)
- `docs/plans/e2e-flake-cast-rotativa-pos-ops83-impl.md` (o que o #882 cobre)
- `AGENTS-campaign.md` — camada relevante
