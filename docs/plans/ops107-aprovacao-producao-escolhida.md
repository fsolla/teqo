# OPS107 — Aprovar e deployar em produção a versão escolhida, sem fila de pendentes

Status: rascunho
Atualizado em: 2026-09-14
Issue: #1002
Priority: P2
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

> _"A ação deploy atual não me permite aceitar o production deploy do ultimo run, eu preciso ir aceitando e deployando em prod todos os que estão pending na ordem. Não quero isso. Quero poder aceitar e fazer o deploy da versão que eu quiser. O que geralmente será o ultimo deploy bem sucedido em staging. Não quero ter que voltar deployando um a um em prod pra chegar no mais recente."_

Desde a OPS104 o deploy começa sozinho no push para `main`: `preflight` → `verify` completo → staging automático → produção aguardando o reviewer humano. O que produto não previu é o efeito colateral da aprovação em espera: um job aguardando aprovação **segura** o grupo `deploy-homeserver` (a avaliação de concurrency do GitHub acontece antes do approval), então os runs seguintes ficam `pending` — inclusive o staging deles. Evidência ao vivo (2026-09-14): o run 34818635060 ficou com `deploy-production` aguardando de ~08:22 a ~10:12; nesse intervalo, os runs 34822356060 e 34824353858 tiveram o `deploy-staging` preso desde 08:38 e 09:06. Para chegar no mais recente, o operador é forçado a aprovar — e portanto **publicar** — os antigos em ordem. O runbook já registrou isso como falha conhecida (`docs/ops/teqo-1313-deploy.md` l.256) com o gatilho de revisita explícito: "aprovações demorando sistematicamente". Este item é esse gatilho, disparado.

## Persona e fluxo

- **Persona / contexto:** o operador do deploy (hoje o `fsolla`) aprovando produção pelo GitHub Actions, de mesa, com vários runs empilhados no mesmo dia.
- **Job principal:** escolher e publicar em produção o run que ele quiser — tipicamente o último com staging verde — sem ser obrigado a aprovar/deployar os anteriores.
- **Fluxo desejado:** merges chegam → cada run faz verify e staging (sem esperar aprovação alheia) → o operador vê os runs aprováveis e escolhe um → aprova esse e o SHA dele publica; os antigos continuam parados onde estão, sem publicar nada.
- **Anti-goals de produto:** nunca auto-aprovar ou auto-publicar produção; nunca atalhar o `verify` completo; nunca introduzir um segundo pipeline/workflow gêmeo para produção; nunca cancelar runs automaticamente sem decisão de produto.

## Objetivo e aceite

- Com N runs empilhados, o operador aprova e publica **qualquer** um deles — tipicamente o último com staging verde — sem tocar nos anteriores.
- Um run aguardando aprovação **não** bloqueia o staging nem a aprovação de runs novos (esta é a mudança central).
- Aprovar o run escolhido publica o SHA dele; runs antigos não aprovados não deployam nada.
- A publicação segue exclusivamente humana, com `verify` completo verde; nada é auto-aprovado, auto-cancelado ou atalhado.

## Dados (intenção)

- **Vou apresentar dados?** Não — N/A: sem superfície de dados para o usuário final; a evidência é o estado dos runs no Actions (jobs `pending`/`waiting`, ordem de liberação do grupo).
- **Decisões desbloqueadas:** o operador decide qual run virar produção, na ordem que quiser; ninguém precisa "limpar a fila" para chegar ao mais recente.
- **Forma:** N/A — nada a apresentar.

## Dados da decisão (literais)

- Nunca auto-approve; nunca atalhar o `verify` completo; aprovação de produção é sempre humana.
- Um run aguardando aprovação **não** pode bloquear o staging nem a aprovação de runs novos.
- Aprovar o run escolhido publica o SHA dele; runs antigos não escolhidos não deployam nada.
- Fora de escopo: re-deploy de SHA arbitrário (rollback continua manual no homeserver, seção Rollback do runbook) e auto-cancelamento destrutivo (decidido no gate: não).
- Multi-aprovação: o último deploy executado vence; o runbook registra "aprove só o escolhido; rejeite os demais" (decidido no gate).
- ID reservado **OPS107**; kind **chore**; sem UI (Impeccable A).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.github/workflows/deploy.yml` (jobs `deploy-staging` e `deploy-production`, environments e o grupo `deploy-homeserver`; staging l.213–221, produção l.267–270); pins em `tests/unit/ciSkipInvariants.unit.spec.ts` (l.156–178) e `tests/unit/deployTrigger.unit.spec.ts`.
- **Precedente a olhar:** OPS103/OPS104 (`docs/plans/ops104-disparo-automatico-do-deploy.md` l.25, 43, 60, 77–79, 90) e o job `requeue` do `deploy.yml` (l.229–249) — que já fica **fora** do grupo exatamente para um `waiting` não bloqueá-lo; este item generaliza a lição.
- **Risco de acoplamento:** `scripts/deploy-homeserver.sh` já tem `flock` único e guard "already deployed" — a serialização real no host não pode ser afrouxada; `verify` e `ci-pr.yml` não se tocam; nenhum workflow gêmeo.

## Dependências

- Nenhuma.

## Fora de escopo

- Auto-approve/auto-publicação (destino: nunca) e atalho do `verify` completo (destino: nunca).
- Auto-cancelamento destrutivo de runs antigos (só com decisão de produto pela opção B).
- Re-deploy de SHA arbitrário/rollback por versão: rollback continua manual no homeserver (seção Rollback do runbook).
- Mexer no `verify`, no `ci-pr.yml`, nos guards de banco ou na proteção de branch.

## Rabbit holes de produto

- **"Já que destrava a fila, deixa automático."** Auto-approve remove o único gate que valida o SHA antes de produção. **Corte neste item:** produção só publica com reviewer humano; approve automático não existe.
- **"Cancela tudo que é antigo."** Automação destrutiva sem pedido apaga a escolha do operador e complica auditoria. **Corte neste item:** antigos ficam pendentes e podem ser rejeitados na UI sem deployar (opção B só se produto pedir).
- **"Faz um workflow só de produção."** Pipeline gêmeo cria drift e um lugar a mais onde o fluxo escapa dos gates. **Corte neste item:** o dono continua sendo o `deploy.yml`.

## Questões em aberto (produto)

- **Como liberar a escolha sem auto-aprovar nada?** **Decidido no gate (2026-09-14): A** — desacoplar a aprovação da lane de deploy; runs com staging verde ficam todos aprováveis independentemente; antigos seguem pendentes (rejeitáveis na UI, sem publicar); **sem** supersessão/cancelamento automático (B) e **sem** produção por dispatch manual (C).
- **Aprovar mais de um run (acidental ou de propósito): quem vence?** **Decidido no gate (2026-09-14): A** — manter a serialização por ordem de aprovação/execução (o último deploy executado vence); o runbook registra "aprove só o escolhido; rejeite os demais"; nenhum mecanismo novo de trava (B).

## Referências

- GitHub Issue #— (a registrar via `pnpm agent:register`)
- `.github/workflows/deploy.yml` — environments e concurrency (staging l.202–227; requeue l.229–249; produção l.251–276)
- `docs/ops/teqo-1313-deploy.md` — "Gatilho e fluxo" (l.12–87) e "Falhas conhecidas" (l.256, o gatilho de revisita)
- `tests/unit/ciSkipInvariants.unit.spec.ts` (l.156–178) e `tests/unit/deployTrigger.unit.spec.ts` — pins do fluxo atual
- `docs/plans/ops104-disparo-automatico-do-deploy.md` — decisões revisitadas (runs antigos ficam pendentes ou são cancelados à mão)
- `scripts/deploy-homeserver.sh` — `flock` único e guard "already deployed" (não afrouxar)
- `docs/AGENT-OPS.md`, `AGENTS-infra.md`, `AGENTS.md`, `README.md` — citações do fluxo de deploy a realinhar; entrada em `docs/changelog/`
