# Verificação pós-deploy em staging no fluxo `work-issue`

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1079
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

O fluxo `work-issue` termina no auto-merge e no flip `done` (`execution-pipeline.md:112-129`, `work-issue/SKILL.md:179-183`): ninguém olha o que o deploy de staging publicou. O merge em `main` já dispara `deploy.yml` sozinho (OPS104), o staging publica sem reviewer e a única validação pós-deploy existente é manual e do `bug-fix` (`bug-fix/SKILL.md:109`), focada em produção — não há dono de verificar funcionalmente a feature recém-entregue em staging.

Esta entrega fecha o loop: depois do merge, o agente espera o run de staging ficar verde e abre o navegador contra `https://staging.jorgesolla1313.com.br` para testar a funcionalidade que acabou de entregar; problemas encontrados viram Issues de correção. É a camada que as suítes locais e o `verify` do deploy não cobrem.

**Por que classe A:** o item só edita skills/docs de agente (markdown). O navegador é ferramenta de teste da feature entregue, não superfície de UI desenhada aqui — não há tela nova, novo estado visual nem artefato de design.

## Persona e fluxo

- **Persona / contexto:** o agente executor (work-issue) na máquina do humano, logo após o merge; humano presente mas não pilotando o teste.
- **Job principal:** confirmar, no ambiente real, que a feature entregue funciona — e transformar qualquer falha em Issue acionável.
- **Fluxo desejado:** merge verde → aguardar o run de deploy → abrir staging → exercitar só a funcionalidade entregue (390/1280, console/network) → se tudo ok, encerrar com o desfecho registrado; se falhar, abrir Issues e reportar.
- **Anti-goals de produto:** não é e2e automatizado de regressão contra staging (decidido fora de escopo no OPS103); não testa produção; não vira watchdog de deploy nem monitoramento contínuo.

## Objetivo e aceite

- Após o merge, o fluxo verifica funcionalmente a feature entregue em staging e registra o desfecho.
- A espera pelo deploy é limitada: em timeout, reporta e para — nunca segue em silêncio nem aguarda indefinidamente.
- Defeitos encontrados geram Issues de correção com o estado de fila correto (claimável quando cabível), sem editar a Issue original em `in-progress`.
- Nenhum passo toca o homeserver, o DB de produção ou aprova a produção; produção continua com approval humano.

## Dados (intenção)

- **Vou apresentar dados?** Não — é item de processo/skill; nada de superfície de dados.
- **Decisões desbloqueadas:** N/A (sem métrica); o "resultado" é o desfecho registrado na Issue/PR.
- **Forma:** _adiada ao plano de implementação._

## Dados da decisão (literais)

- ID reservado: **OPS121**; kind **chore**; prio **P2**; slug `ops121-verificacao-pos-deploy-staging-work-issue`; sem UI (Impeccable A).
- Staging: `https://staging.jorgesolla1313.com.br` (noindex); container `teqo-staging`; DB `teqo_staging`; porta `127.0.0.1:1314`; bucket `teqo-media-staging`.
- Workflow: `deploy.yml` — jobs `preflight` → `verify` (hosted, full, ~50 min) → `deploy-staging` (`environment: staging`, sem reviewer) → `requeue` + `deploy-production` (`environment: production`, required reviewer).
- Consulta a runs: `scripts/lib/github-api.mjs` — `listWorkflowRuns(workflowFile, {status, branch, limit})` (:326-342), `getWorkflowRunJobs(runId)` (:349-365), `getBranchHead` (:398); token `GITHUB_TOKEN` (:80). Não existe função de poll/watch.
- Criar Issue claimável: `pnpm agent:register` — label de estado `ready` (claimável; `resolveRegisterStateLabel`, `agent-register.mjs:53-71`). Observação/guardrail: `pnpm agent:file-miss --kind defect` — `kind:defect` + `prio:P2`, **sem** `ready` ⇒ não claimável (`agent-file-miss.mjs:24,37`).
- Browser: Playwright MCP já configurado (`~/.config/opencode/opencode.jsonc`, `@playwright/mcp`, chromium).
- Skills do fluxo: `.agents/skills/work-issue/SKILL.md`, `agent-work-issue/SKILL.md`, `work-issue/execution-pipeline.md`, `browser-testing-with-devtools/SKILL.md`, `bug-fix/SKILL.md`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/work-issue/execution-pipeline.md` (dono da mecânica de fechamento compartilhada) ganha §Verificação pós-deploy (staging); `work-issue/SKILL.md` (Passo 7 + checklist) e `agent-work-issue/SKILL.md` (Passo 6 + checklist) declaram o delta do ator.
- **Precedente a olhar:** `bug-fix/SKILL.md:109` (validação pós-deploy, versão manual/prod); `deploy-preflight.mjs` / `auto-unblock.mjs` (consumo de `github-api.mjs` e gate do `verify`).
- **Risco de acoplamento:** a espera deve ser limitada e não pode aprovar produção nem tocar o homeserver; o `verify` full pode levar ~50 min, então a espera precisa de teto explícito.

## Dependências

- Nenhuma dura. Contexto: OPS103 (staging), OPS104 (trigger no merge), OPS107 (aprovação) — todos já entregues.

## Fora de escopo

- E2E automatizado de regressão contra staging (decidido fora no OPS103: `ops103-staging-homeserver.md:69,80,87`) — destino: item próprio se houver evidência.
- Verificação/approve de produção — permanece humano; `bug-fix` mantém sua confirmação manual em prod.
- Watchdog/monitoramento contínuo do deploy.

## Rabbit holes de produto

- **Virar suíte e2e contra staging.** Se alguém "só completar": duplicates de cobertura, flaky e manutenção de ambiente. **Corte neste item:** teste manual via navegador limitado à funcionalidade entregue.
- **Esperar o deploy indefinidamente.** Se alguém "só completar": sessão pendurada ~50 min+ por run. **Corte neste item:** teto de tempo + timeout que reporta e para.
- **Absorver o passo do bug-fix.** Se alguém "só completar": duas fontes de verdade sobre pós-deploy. **Corte neste item:** donos separados (staging funcional aqui; prod manual no bug-fix).

## Questões em aberto (produto)

- **Escopo do passo: só `work-issue` ou também `agent-work-issue`?** **Opções:** A só `work-issue` | B ambos via pipeline | C pipeline declara a mecânica e o pool declara delta "sem browser no Cloud". **Recomendação:** C — dono é `execution-pipeline.md`; `work-issue` executa; `agent-work-issue` (autônomo, dormente, Cloud sem browsers) registra justificativa/defer no delta em vez de fingir o passo. _(assumido — validar com produto)_
- **Espera pelo deploy (tempo/polling e timeout)?** **Opções:** A poll curto + teto ~60 min | B só reportar o run ao humano e não esperar | C espera infinita. **Recomendação:** A — polling do run do `deploy-staging` pelo head SHA, teto explícito (~60 min, `verify` ~50 min); em timeout, reportar e parar. _(assumido — validar com produto)_
- **O que testar e como tratar backend-only?** **Opções:** A test plan derivado dos critérios de aceite + `*-impl.md`, 390/1280, console/network | B testar tudo que a página oferece. **Recomendação:** A limitado à funcionalidade entregue; sem superfície de browser (backend-only), registrar smoke HTTP/API mínimo ou N/A justificado, sem inventar UI. _(assumido — validar com produto)_
- **Mecanismo para defeitos: claimável vs triage, e reabrir a Issue original?** **Opções:** A `agent:register` com `ready` para defeito funcional no escopo e `agent:file-miss --kind defect` para observações | B só `file-miss`. **Recomendação:** A; a Issue original (já `done`) **não** reabre — recebe um comentário linkando a Issue nova. _(assumido — validar com produto)_
- **Relação com `bug-fix` (que tem passo pós-deploy manual)?** **Opções:** A unificar | B manter separados e cruzados. **Recomendação:** B — `bug-fix` é dono da confirmação manual em prod de um bug; OPS121 é dono da verificação funcional em staging de uma feature; compartilham nomenclatura/links, não código.

## Referências

- GitHub Issue #1079
- Design UI (gate): N/A
- `.agents/skills/work-issue/execution-pipeline.md` (§Fechar em main), `.agents/skills/work-issue/SKILL.md` (Passo 7), `.agents/skills/agent-work-issue/SKILL.md` (Passo 6), `.agents/skills/bug-fix/SKILL.md:106-109`, `.agents/skills/browser-testing-with-devtools/SKILL.md`
- `scripts/lib/github-api.mjs`, `scripts/agent-register.mjs`, `scripts/agent-file-miss.mjs`, `.github/workflows/deploy.yml`
- `docs/ops/teqo-1313-deploy.md:193-200` (limites de staging: WebAuthn/OAuth/Resend não validados)
