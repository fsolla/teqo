# CI — cooldown de deploy de produção: 30 → 15 min

Status: registrado
Atualizado em: 2026-08-02
Issue: #259
Priority: P0
Model: composer-2.5
Impeccable: A — N/A (sem superfície UI)
Appetite: ~0,25–0,5 dia eng; ajuste de constante + logs/pins; sem migration
Responsável: —

## Intenção

O cooldown entre deploys de produção (Hobby Vercel / teto `api-upload-free`) já existe e está em produção via OPS11 (#102): mínimo **30 minutos** entre um deploy READY e o próximo, com skip “adiado” + requeue.

Pedido novo (2026-08-02): **baixar esse intervalo para 15 minutos**. Com o pool de agentes mergeando em sequência, 30 min atrasa demais o tip de `main` em produção; 15 min ainda protege o teto diário de upload, mas deixa o código chegar à URL canônica na metade do tempo.

## Persona e fluxo

- **Persona / contexto:** quem entrega via merge em `main` (agente ou humano) e quem valida feature em `pt.jorgesolla.com.br` logo depois.
- **Job principal:** ter o tip de `main` em produção com atraso máximo de ~15 min após o último deploy READY (quando o verificador está verde).
- **Fluxo desejado:** merge → `ci.yml` verde → se o último prod deploy tem &lt; 15 min, o job **adia** (não falha) e **reagenda**; quando o residual acaba, sobe o tip atual.
- **Anti-goals de produto:** não virar “deploy a cada merge sem freio”; não exigir upgrade de plano Vercel neste item; não mudar o gate de merge.

## Objetivo e aceite

- Intervalo mínimo entre deploys de produção READY passa a ser **15 minutos** (antes: 30).
- Skip por cooldown continua **não vermelho** e continua **reagendando** até o tip ir a prod.
- Mensagens/logs e pins de teste que citam “30 minutos” acompanham o novo valor (sem mentir na UI do Actions).
- Guardrails: sem migration; não tocar preview Git; não alterar required checks de PR.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — gate de infra; não há KPI de produto nesta superfície.
- **Forma:** _adiada ao plano de implementação_ — N/A.

Dados: N/A — ajuste de política de CI/deploy; sem superfície de métrica.

## Direção no codebase (hipótese)

- **Áreas prováveis:** dono atual do cooldown em `scripts/lib/` + entrypoint CLI usado pelo job `deploy` em `.github/workflows/ci.yml`; pin unitário em `tests/unit/`; log de deferral no workflow que ainda fala “30 minutes”.
- **Precedente a olhar:** OPS11 / `docs/plans/ci-deploy-cooldown-vercel.md` (política já entregue — este item só muda a duração).
- **Risco de acoplamento:** preservar ordem tip-stale → cooldown → credenciais → deploy; não reinventar fonte da idade (último READY production na Vercel).

## Dependências

- Soft: OPS11 (#102) já em prod — este item assume a máquina de cooldown + requeue existente.
- Nenhuma dependência dura de Issue aberta.

## Fora de escopo

- Mudar a fonte da idade (continuar Vercel READY production, não “último run do Actions”).
- Batch de merges → um deploy (já adiado com gatilho no OPS11).
- Upgrade de plano Vercel / limites da conta.
- Alterar `ci-pr.yml`, `migration-lock`, ou auto-merge.

## Rabbit holes de produto

- **“Já que toco, retiro o cooldown.”** Volta o risco do teto diário que motivou o OPS11. **Corte neste item:** só 30→15.
- **“Sobe para 1 h / desce para 5 min.”** Fora do pedido. **Corte:** 15 min é a decisão deste lote.

## Questões em aberto (produto)

- **15 min ainda protege o teto Hobby sob carga alta do pool?** **Opções:** A) 15 min agora e observar 429s | B) manter 30 | C) 15 + teto diário de N deploys. **Recomendação:** **A** — pedido explícito; se voltar `api-upload-free`, reabrir com evidência (não inventar teto diário neste item). _(assumido — validar com ops se 429 voltar)_

## Referências

- GitHub Issue #259
- OPS11 #102 — `docs/plans/ci-deploy-cooldown-vercel.md`
- `.github/workflows/ci.yml` (job `deploy` / `requeue`)
- `scripts/lib/vercel-deploy-cooldown.mjs` / `scripts/vercel-deploy-cooldown.mjs`
- `tests/unit/vercelDeployCooldown.unit.spec.ts`
- `docs/AGENT-OPS.md` — entrega = merge em `main`; deploy gated por `ci.yml`
