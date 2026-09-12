# OPS102 — Deploy manual roda até o fim mesmo com main à frente (sem guard de stale run)

Status: rascunho
Atualizado em: 2026-09-12
Issue: #962
Priority: P1
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

O deploy manual falha quando o HEAD do `main` anda depois do momento em que a action foi disparada: _"Looks like the manual deploy flow fails when the main head is ahead of the moment when the action was deployed. That made sense when it was automatic, but now that it is manual, it should run til the end, even when main moves."_

O guard de stale run nasceu na era automática (OPS53): `main` andava sozinho e publicar um SHA velho era errado. A OPS71 tornou o deploy um `workflow_dispatch` deliberado — o operador escolhe o SHA —, mas o guard ficou: hoje, se alguém mergeia em `main` durante os ~50 min do `verify`, o job `deploy` morre com "stale run" mesmo com o dispatch legítimo. A premissa caducou; o dispatch manual deve rodar até o fim com o SHA do run.

## Persona e fluxo

- **Persona / contexto:** operador do deploy — humano que dispara o workflow no GitHub Actions depois de mergear algo que precisa ir a prod; espera ~50 min de `verify` e mais o build no homeserver, hoje torcendo para `main` não andar nesse meio tempo.
- **Job principal:** publicar o SHA que ele deliberadamente escolheu, sem ser sabotado por merges alheios no meio do verify.
- **Fluxo desejado:** dispara o deploy → `verify` roda a suíte full → o job `deploy` publica o SHA do run até o fim, mesmo se `main` avançou no meio → vê verde só porque prod de fato roda o SHA; num re-dispatch do mesmo SHA, vê "already deployed" e nada é reconstruído.
- **Anti-goals de produto:** não voltar a ser deploy automático; não criar mecanismo novo de ordenação de dispatches; não voltar ao falso verde do #953 (skip silencioso com job verde e prod no build velho).

## Objetivo e aceite

- Um dispatch manual do `deploy.yml` completa o deploy do SHA do run mesmo que `main` avance durante o verify — sem "stale run" abortando.
- Sem falso verde: job verde = o SHA do run foi de fato publicado (build + rollout + smoke) ou o container já o rodava ("already deployed") — nunca skip silencioso.
- O guard "already deployed" permanece: container já roda a revision do SHA → no-op verde.
- Nenhum mecanismo novo anti-out-of-order entra neste item.
- Registro vivo alinhado: comentários do workflow/script, runbook (fluxo + "Falhas conhecidas") e `AGENT-OPS` deixam de descrever o guard removido; as specs unitárias pinam o contrato novo sem perder o pin do "already deployed".

## Dados (intenção)

- **Vou apresentar dados?** Não — item de infraestrutura de deploy; sem superfície de dados de produto e sem métrica que desbloqueie decisão.
- **Decisões desbloqueadas:** N/A — nenhuma escolha de produto depende de dado aqui.
- **Forma:** N/A — nada a apresentar.

## Dados da decisão (literais)

- ID reservado: **OPS102**; kind **chore**; sem UI (Impeccable A).
- Gatilho: `workflow_dispatch` manual do `.github/workflows/deploy.yml` — o operador escolhe o SHA; não há verifier automático de `main` (OPS71).
- Remover de `scripts/deploy-homeserver.sh` os dois guards de stale run. Pré-flock (l.49–52):

  ```bash
  main_head="$(git ls-remote "$TEQO_REPO_URL" refs/heads/main | awk '{print $1}')"
  if [ "$main_head" != "$SHA" ]; then
    fatal "stale run: main is $main_head, job deploys $SHA — refusing to deploy an outdated SHA"
  fi
  ```

- Pós-flock (l.57–60): a mesma comparação, com `fatal "stale run after lock: main is $main_head, job deploys $SHA — refusing to deploy an outdated SHA"`. O comentário de fluxo l.11–12 ("HEAD guard … stale run FAILS the job") deixa de valer e é atualizado.
- Preservar o guard "already deployed" (l.70–74) — permanece intacto:

  ```bash
  running_rev="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' teqo-1313 2>/dev/null || true)"
  if [ -n "$running_rev" ] && [ "$running_rev" = "$SHA" ]; then
    say "already deployed: teqo-1313 runs $SHA — nothing to do"
    exit 0
  fi
  ```

- `.github/workflows/deploy.yml`: atualizar o comentário l.23–25 ("HEAD guard only deploys when the dispatched SHA is main's HEAD (a stale dispatch skips)"); a invocação do job `deploy` (l.159, `bash scripts/deploy-homeserver.sh "$GITHUB_SHA"`) não muda.
- `tests/unit/deployScript.unit.spec.ts`: as specs l.19–23 e l.25–30 (pinam `fatal "stale run` 2× e a ausência de `say "stale run`) passam a pinar o contrato novo (deploya o SHA do dispatch mesmo com `main` à frente); a spec l.32–38 ("already deployed") permanece. `ciSkipInvariants.unit.spec.ts` (pina só `workflow_dispatch:`) não muda.
- `docs/ops/teqo-1313-deploy.md`: atualizar o fluxo (l.20–22) e a linha "Job verde sem deploy ('stale run')" da tabela "Falhas conhecidas" (l.132); `docs/AGENT-OPS.md` l.81 e l.110 citam "HEAD guard" — atualizar.
- Histórico intocável: `docs/postmortems/2026-09-12-deploy-build-importmap.md` e os `docs/changelog/2026-09-12-*` são registro — a entrega escreve uma entrada nova `docs/changelog/<data>-ops102.md`, nunca edita os existentes.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/deploy-homeserver.sh` (guards + comentário de fluxo), `.github/workflows/deploy.yml` (comentário HEAD), `tests/unit/deployScript.unit.spec.ts`, `docs/ops/teqo-1313-deploy.md`, `docs/AGENT-OPS.md`.
- **Precedente a olhar:** OPS65 (guard "already deployed" — o no-op idempotente que fica), OPS66/OPS71 (dispatch manual e build-after-migrate — contratos que não mudam), #953/#952 (o fix recente que tornou o stale run `fatal`; agora reverte-se só a parte que a era manual tornou obsoleta).
- **Risco de acoplamento:** o miolo do script (flock, migrator→migrate→runner, rollback, smoke) não muda; remover o guard não é licença para refatorar o pipeline nem para enfraquecer os pins de segurança existentes.

## Dependências

- Nenhuma. Histórico: #953 (tornou o stale run fatal) e #952 (mesmo postmortem) já estão em `main`; OPS65, OPS66, OPS71 e OPS99 ficam intactos.

## Fora de escopo

- Qualquer mecanismo novo de ordenação/anti-out-of-order de dispatches (o `flock` serializa; a fila natural do verify ordena) — risco declarado, não feature.
- Reintroduzir verifier automático de `main` ou deploy automático.
- Mudar o `verify`, o build da imagem, a ordem migrator→migrate→runner, rollback ou smoke.
- Editar postmortem/changelog históricos.

## Rabbit holes de produto

- **"Já que o guard saiu, qualquer SHA pode."** Se a remoção virar licença para dispatchar SHA velho/arbitrário, a regressão por fora-de-ordem deixa de ser teórica. **Corte neste item:** a remoção é sobre `main` avançar durante o verify, não sobre ignorar ordem; nenhum guard novo entra, mas o risco fica escrito no runbook.
- **"Aproveitar e enxugar o script."** Refatorar flock/migrate/build/rollback de passagem explode o appetite e arrisca o pipeline recém-recuperado. **Corte:** tocar só os guards e a documentação viva.
- **"Pôr um guard de ordem no lugar."** Substituir o stale run por outro mecanismo (fila ordenada, comparação de timestamp, recusa de SHA não-descendente) é a tentação simétrica. **Corte:** não — dispatch é ato humano deliberado e raro; a decisão é explicitamente não adicionar mecanismo.

## Questões em aberto (produto)

- **Dispatch duplicado fora de ordem pode regredir prod?** Um SHA antigo re-dispatchado depois de um deploy mais novo regride prod: o `flock` serializa mas não ordena, e o "already deployed" não pega revision diferente. **Opções:** A) não adicionar mecanismo agora — dispatch é ato humano deliberado e raro e a fila natural do verify ordena os dispatches; B) adicionar guard de ordem (recusar SHA não-descendente do que roda); C) restringir o dispatch na UI ao SHA atual. **Recomendação:** A, deixando o risco explícito na tabela "Falhas conhecidas" com o gatilho para revisitar — se o deploy ganhar frequência/automação, ou se uma regressão fora-de-ordem acontecer de fato. _(assumido — validar com produto)_

## Referências

- GitHub Issue #962
- `scripts/deploy-homeserver.sh` — guards atuais (l.49–52, l.57–60), "already deployed" (l.70–74), comentário de fluxo (l.11–12)
- `.github/workflows/deploy.yml` — comentário HEAD (l.23–25) e job `deploy` (l.159)
- `tests/unit/deployScript.unit.spec.ts` — pins do stale run (l.19–30) e do "already deployed" (l.32–38)
- `docs/ops/teqo-1313-deploy.md` — fluxo (l.20–22) e "Falhas conhecidas" (l.132)
- `docs/postmortems/2026-09-12-deploy-build-importmap.md` — falso verde e contexto do #953
- `docs/AGENT-OPS.md` (l.81, l.110) — menções ao "HEAD guard"
- `docs/plans/ops53-ci-deploy-homeserver.md` / `…-impl.md` — origem do guard (era automática); `docs/plans/ops65-ci-main-janela-30min-e-matar-pool-impl.md` — origem do "already deployed"
