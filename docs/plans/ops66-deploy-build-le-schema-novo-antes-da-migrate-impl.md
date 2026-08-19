# Impl: OPS66 — deploy: build de geração estática lê schema novo antes do passo migrate (deadlock de migrations em caminho estático)

Status: aprovado
Atualizado em: 2026-08-19
Issue: #68
Intenção: docs/plans/ops66-deploy-build-le-schema-novo-antes-da-migrate.md
Appetite restante: herdado (~0,5 dia)

## Leitura da intenção

- **Outcome:** nenhuma migration nova pode mais travar o deploy para sempre por criar tabela lida em geração estática — o schema novo chega ao build do runner antes do `next build`.
- **O que NÃO negociar:** ordem migrate antes do build; nada de auto-migrate dentro da imagem do runner (o Dockerfile chama `next build` direto de propósito); não tocar migrations já aplicadas; não mudar arquitetura de geração estática.
- **O que reavaliar:** COMO rodar o migrate antes do build — o serviço canônico `teqo-1313-migrate` do compose depende do swap dos tags de imagem, que hoje acontece só depois do build. A intenção sugere "rodar o migrate antes do build" sem fixar o mecanismo.

## Abordagem recomendada

Reordenar as fases do `scripts/deploy-homeserver.sh`: o migrator (estágio que NÃO roda `next build` — não depende do schema) builda primeiro; o swap do compose (com backup) e o migrate via serviço de maintenance acontecem antes do build do runner.

```mermaid
flowchart LR
  G[HEAD guard + flock + already-deployed] --> B[Migrator: build + push + tag]
  B --> S[compose swap com backup — trap de rollback]
  S --> M[migrate: compose run teqo-1313-migrate — imagem nova]
  M --> R[Runner: build + push + tag — contra o banco migrado]
  R --> U[rollout + healthcheck + smoke]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — reordenar o script movendo o migrate para antes do build do runner, mantendo o `compose run teqo-1313-migrate` como caminho canônico (o swap passa a ser feito logo após o build do migrator). É a opção 1 da própria intenção, sem custo adicional (o migrate e o build do migrator já rodavam em todo deploy — só mudam de posição) e sem caminho paralelo ao serviço de maintenance.
**Rejeitadas:**

- **B — `payload migrate` pré-check dentro do build do runner:** efeito colateral de escrita no banco de prod a partir de um processo de build; contradiz o desenho deliberado do Dockerfile ("migrations run separately through the migrator") e a decisão (B) do OPS53. Qualquer build CI em ambiente errado migraria o banco de prod.
- **C — `docker run --rm --network stack_default --env-file ~/stack/teqo-1313.env localhost:5000/teqo-1313-migrator:<sha>` antes do build do runner** (o comando manual de recuperação do incidente): evita o swap precoce, mas duplica a definição do serviço de maintenance do compose (envs/networks/labels) e cria caminho paralelo ao serviço canônico que OPS51/53 e o runbook documentam. O swap precoce (A) é inofensivo: nada referencia o tag do runner até o `compose up -d`, que só roda depois do push.

### Componentes / mudanças

- **`scripts/deploy-homeserver.sh`**: mover o bloco `build_image migrator` + push/tag do migrator para ANTES do swap; mover o bloco swap (backup + sed + greps + trap) para antes do migrate; mover `build_image runner` + push/tag do runner para DEPOIS do migrate. Comentário no passo migrate explicando o porquê (OPS66).
- **`tests/unit/deployScript.unit.spec.ts`**: pin de ordem completo — migrator build < swap < migrate < runner build < rollout (substitui o pin atual migrate < rollout).
- **`docs/ops/teqo-1313-deploy.md`**: fluxo do passo 5 reescrito; caveat do rollback ajustado ("migrate roda antes do build do runner"); nova linha em Falhas conhecidas: build falha com `relation ... does not exist` (sintoma do incidente S2).
- **`Dockerfile`**: estender o comentário do estágio `builder` (migrations são aplicadas pelo deploy antes deste build — OPS66).
- **`AGENTS.md`**: precisão de uma linha no parágrafo do deploy (migrations aplicadas antes do build do runner).
- **Migration:** sem migration.
- **Access / Consent:** sem mudança.
- **UI:** sem mudança.

### Dados → forma

n/a (ops script).

## Fases verificáveis

1. **Script + teste** — reordenar `deploy-homeserver.sh`; atualizar `deployScript.unit.spec.ts` com os pins de ordem; `bash -n` + unit verde.
2. **Docs** — runbook (fluxo + caveat + falha conhecida), comentário no Dockerfile, AGENTS.md, changelog (`pnpm changelog:build` + `changelog:check`).
3. **Gates** — `pnpm gate:fast` na iteração; `pnpm push` para a entrega.

## Rabbit holes / Não escopo (engenharia)

- Não alterar o Dockerfile além do comentário (estágio migrator/builder ficam como estão).
- Não mexer no `.forgejo/workflows/ci.yml` (job deploy continua streamando o script — a mudança é toda no script).
- Não criar infra nova no homeserver (compose, proxy socat, service de maintenance ficam como estão).
- Não reescrever o histórico de changelog/AGENTS além da entrada nova + precisão da linha do deploy.

## Riscos e mitigação

- **Forward migration em build falho:** migrate antes do build do runner — se o build falhar depois do migrate, o banco fica à frente do código rodando. Mesma classe do caveat atual (rollout falho pós-migrate); migrations são append-only e revisadas antes do deploy (checklist AGENTS). Documentado no runbook.
- **Compose órfão em kill duro entre swap e push:** o compose referencia `teqo-1313:<sha>` ainda não existente. Backup `docker-compose.yml.pre-$SHA` existe; o próximo deploy re-swapa; restore manual documentado no runbook. Mesma classe do hazard atual (kill entre swap e rollout).
- **Migrate sem migrations pendentes:** `payload migrate` vira no-op (~1–2 min) — custo que já existia em todo deploy, só deslocado.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (migrate antes do build do runner)
- [x] Invariantes AGENTS/engineering-standards (sem caminho paralelo: compose run segue canônico; sem auto-migrate no build)
- [x] Testes previstos (unit pin de ordem no deployScript.unit.spec.ts)
