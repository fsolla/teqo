# OPS111 — Auto-unblock volta a despachar no homeserver (fix do setup pnpm/Node 18)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1035 (blocked via --plan — promover com agent:ready após merge em main)
Priority: P1 (proposto — validar no gate; alternativa P2 abaixo)
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

O launcher do auto-unblock que o OPS106 entregou nunca chegou a rodar: toda vez que o `verify` fica vermelho, o job morre no setup de pnpm antes de despachar qualquer agente, e a rede de segurança do deploy está morta na prática. Quero que esse launcher saia do `pnpm/action-setup` quebrado no runner Node 18 do homeserver — reordenando o setup do Node 24 para antes, ou pinando/corepackando, o que for dono do concern — e volte a despachar. Nada além disso: sem auto-retry, sem aprovar produção sozinho.

## Persona e fluxo

- **Persona / contexto:** eu (mantenedor), com o deploy bloqueado por um `verify` vermelho e ninguém de plantão.
- **Job principal:** ver o auto-unblock despachar um único agente sozinho quando o `verify` falha.
- **Fluxo desejado:** `verify` de push em `main` falha → em minutos vejo o run `Auto-unblock` verde com o registro visível (Issue token ou comentário single-flight) linkando o run vermelho → um único agente `fix/*` trabalhando; se já há agente ativo, a nova falha só comenta.
- **Anti-goals de produto:** virar auto-heal de qualquer job; aprovar produção sozinho; reintroduzir retry automático do deploy.

## Objetivo e aceite

- O próximo `verify` vermelho de `push` em `main` gera um run `Auto-unblock: success` (nunca `failure` no setup) com token Issue `auto-unblock` ou comentário single-flight.
- O launcher chega a executar e despacha no máximo um agente por run vermelho, mantendo o single-flight do OPS106.
- Nenhum auto-retry ou auto-approve do deploy é introduzido (proibição do OPS104 continua valendo).
- Guardrails do OPS106 seguem intactos: sem tocar prod/staging, sem segundo agente simultâneo.

## Dados (intenção)

- **Vou apresentar dados?** Não — infraestrutura, sem métrica de produto.
- **Decisões desbloqueadas:** N/A — não há decisão de negócio; é reparo do encanamento operacional.
- **Forma:** N/A — sem superfície de dados neste item.

## Dados da decisão (literais)

- Step que falha: `pnpm/action-setup@v6` em `.github/workflows/auto-unblock.yml` (bloco das linhas 57–64), com `actions/setup-node@v5` (`node-version: 24`, `package-manager-cache: false`) declarado DEPOIS.
- Erro verbatim: `Node.js v18.19.1` no runner + `TypeError paths[0] undefined em @pnpm/exe/setup.js:64` — os scripts `scripts/auto-unblock.sh` / `scripts/auto-unblock.mjs` nunca rodaram.
- Runs Auto-unblock com essa falha: `34994058878`, `34987287001`, `34999635390` (+ `34971560192` como quarto exemplar); nenhum criou token Issue `auto-unblock`, nenhum subiu agente `fix/*`.
- HEAD de referência: SHA `13aeb9bb`, run `35002372682` com `verify` + staging success e production `waiting` — plano anti-recorrência, não desbloqueio imediato.
- Versões fixas: `packageManager pnpm@10.11.0` (`package.json:199`); runner homeserver em Node 18 vs alvo Node 24.
- Gatilho intocado: só falha do job `verify` de `.github/workflows/deploy.yml`, só `push` em `main`; sem auto-retry, sem auto-approve de production.
- Arquivos donos do concern: `.github/workflows/auto-unblock.yml` + validação; `deploy.yml` intocado (decisão D1 do impl plan do OPS106).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/auto-unblock.yml` (ordem/setup do Node+pnpm no runner self-hosted do homeserver).
- **Precedente a olhar:** plano pai OPS106 (Issue #995, CLOSED/in-prod, imutável); workflows que vivem sem pnpm no runner (`issue-done-on-main-merge.yml:48-53`, `agent-pr-ready-automerge.yml:48-49`, `plan-issue-ready-on-main-merge.yml:56-58`); OPS23; `Dockerfile:7,28` (corepack) + postmortem `2026-09-13-deploy-staging-migrator-corepack.md`; pins `tests/unit/autoUnblockWorkflow.unit.spec.ts`, `tests/unit/autoUnblock.unit.spec.ts`; launcher `scripts/auto-unblock.sh → scripts/auto-unblock.mjs → scripts/auto-unblock-agent.mjs` + `scripts/lib/auto-unblock.mjs` (puros, intocados salvo necessidade).
- **Risco de acoplamento:** mexer só no setup do launcher; single-flight (token Issue + flock), guardrails de banco local e `deploy.yml` intocado não podem regredir.

## Dependências

- Nenhuma dura. Suave (herdada do pai): #882 (flakes de e2e em main) pode amplificar falso positivo do gatilho, mas não bloqueia.

## Fora de escopo

- Auto-retry / auto-heal / auto-dispatch do deploy; auto-approve de production.
- Qualquer mudança em `deploy.yml` (verify, staging, production, requeue).
- Ressurreição do pool de agentes (OPS65), tick agendado, dashboard/telemetria de agentes.
- Falhas de PR-CI e flakes de main (seguem em #882 e cia.).

## Rabbit holes de produto

- **"Já que o setup quebrou, reescrever o launcher".** Vira segundo dispatcher paralelo ao owner. **Corte neste item:** editar o owner, não duplicar.
- **"Aproveitar e dar retry no deploy junto".** Reabre o anti-goal do OPS104. **Corte neste item:** só o despacho voltar a funcionar.
- **"Cobrir todos os runners/versões de Node".** Vira matriz de compatibilidade. **Corte neste item:** só o runner homeserver + Node 24.

## Questões em aberto (produto)

- **Prioridade P1 ou P2?** **Opções:** P1 (rede de segurança do deploy está morta) | P2 (pai era P2 e o HEAD está verde). **Recomendação:** P1 — sem o despacho, o OPS106 não existe em produção; o HEAD verde só adia a próxima falha. _(proposto — validar com produto no gate)_
- **Como provar o aceite sem quebrar main de propósito?** **Opções:** A) aguardar o próximo `verify` vermelho real | B) disparo manual controlado do workflow em run vermelho existente. **Recomendação:** A como aceite, B só como smoke se o executor julgar seguro e sem tocar prod. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1031 (reservado)
- Plano pai (imutável, só precedente): `docs/plans/ops106-auto-unblock-verify-falha-agente.md` (Issue #995)
- Owner a editar: `.github/workflows/auto-unblock.yml`
- `AGENTS-infra.md` (seção Auto-unblock do `verify`/OPS106)
