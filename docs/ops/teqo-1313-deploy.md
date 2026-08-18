# Runbook: deploy do site 1313 no homeserver (OPS53)

O deploy de produção é uma etapa do CI (`ci.yml` no Forgejo): mergir em `main`
com a suite verde publica o site em `jorgesolla1313.com.br` — sem passo manual.

## Gatilho e fluxo

1. `git push` para `main` (via PR merge) — ou `workflow_dispatch` no `ci.yml`
   para re-deployar a HEAD de `main` manualmente.
2. Suite completa verde (static/int/build/e2e/checks).
3. Job `deploy` (runs-on `host`, na **workstation**) roda
   `ssh homeserver "bash -s -- <sha>" < scripts/deploy-homeserver.sh`.
4. O script, no **homeserver**: guarda de HEAD (`main` remoto == SHA do job,
   senão skip) → `flock` (serializa) → build da imagem standalone + migrator
   (BuildKit, secrets do `~/stack/teqo-1313.env`, `--network host` com proxy
   socat `teqo-1313-build-proxy` na `stack_default` para o build alcançar o
   `postgres` — o proxy é criado idempotentemente pelo script) →
   push em `localhost:5000` → swap dos tags de imagem no
   `~/stack/docker-compose.yml` (backup antes) → **migrations**
   (`docker compose --profile maintenance run --rm teqo-1313-migrate </dev/null`) →
   `docker compose up -d teqo-1313` → healthcheck → smoke (`/`,
   `/campanha/login`, `/admin`, barreira 307, WebAuthn login-options,
   `api/revalidate` com o secret real).
5. Falha = job vermelho no commit; nada é publicado pela metade.

## Onde roda cada coisa

| Máquina                    | Papel                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **workstation** (16c/61GB) | runner Forgejo (`workstation-runner`); job `deploy` roda no host (chave SSH `~/.ssh/id_ed25519` → `ssh homeserver`)                                                                                   |
| **homeserver** (8c/16GB)   | todo o stack (`~/stack/docker-compose.yml`): postgres `teqo_1313`, forgejo, registry `localhost:5000`, cloudflared, `teqo-1313` na 127.0.0.1:1313; workspace `~/teqo-deploy` (clone do Forgejo local) |

Segredos **não** ficam no Forgejo: o script sourceia `~/stack/teqo-1313.env` e
`~/stack/.env` (chmod 600) no próprio homeserver. Nenhum secret novo em
Settings → Actions.

## Rollback

A imagem anterior continua local e no registry (`localhost:5000/teqo-1313:<sha>`
— o registry nunca deleta). O compose anterior fica em
`~/stack/docker-compose.yml.pre-<sha-do-deploy-que-falhou>`.

```bash
ssh homeserver
cd ~/stack
# 1. apontar o compose de volta para o SHA anterior (o que estava rodando):
#    o backup do deploy que falhou é o compose com os tags antigos
ls docker-compose.yml.pre-*          # escolha o anterior ao deploy ruim
cp docker-compose.yml.pre-<sha-anterior> docker-compose.yml
# 2. a imagem antiga ainda está local; se não, puxe do registry:
docker pull localhost:5000/teqo-1313:<sha-anterior>
docker tag localhost:5000/teqo-1313:<sha-anterior> teqo-1313:<sha-anterior>
# 3. subir:
docker compose up -d teqo-1313
```

**Caveat:** uma migration de schema aplicada no passo de migrate **não** é
desfeita pelo rollback (Payload é append-only). Código velho sobre schema novo
pode se comportar mal — o caminho primário minimiza essa janela (migrate só
roda após build+push ok; rollout só após migrate ok).

## Falhas conhecidas

| Sintoma                                                                       | Causa                                                                                                                                                                                                                                            | Tratamento                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Job verde sem deploy ("stale run")                                            | Push mais novo venceu; o deploy antigo saiu da fila                                                                                                                                                                                              | Nada a fazer — o run do SHA novo deploya                                                                                                                                                                                       |
| Todo job docker quebra com `exec: "node": executable file not found in $PATH` | `runner.envs.PATH` do `~/.forgejo-runner/config.yaml` (workstation) com paths só de host (nvm/bun) — o container perde o node do toolcache (`/opt/acttoolcache`); edição do config exige o toolcache primeiro (ver comentário no próprio config) | Corrigir o PATH no config (toolcache primeiro — ver comentário no próprio arquivo) + `systemctl --user restart forgejo-runner` (incidente 2026-08-17)                                                                          |
| Deploy para logo após o migrate ("Done." e nada mais, EXIT=0)                 | `docker compose run` anexa stdin por padrão — o container consome o resto do script que vai no pipe do `bash -s`; o bash chega a EOF e termina sem rodar o rollout                                                                               | O script já usa `< /dev/null` no `run --rm` do migrate (não remover); sintoma visto 2026-08-17 no primeiro deploy                                                                                                              |
| Build falha: `network mode "stack_default" not supported by buildkit`         | BuildKit (drivers docker e docker-container) recusa rede bridge custom no `--network`                                                                                                                                                            | O script builda com `--network host` + proxy socat `teqo-1313-build-proxy` (na `stack_default`, publicado em 127.0.0.1:5433, criado idempotentemente com `restart: unless-stopped`) + `DATABASE_URL` reescrita para o loopback |
| Build OOM no homeserver                                                       | Laptop 8c/16GB com o stack ativo (~12GB livres medidos)                                                                                                                                                                                          | Re-dispatch; se recorrente, item futuro: build na workstation com túnel                                                                                                                                                        |
| `checkout@v5` falha no job `host`                                             | Label host do act_runner                                                                                                                                                                                                                         | Fallback: baixar o script direto do Forgejo (`curl -s https://git.solla.dev/fsolla/teqo/raw/branch/main/scripts/deploy-homeserver.sh`)                                                                                         |
| Migrate falha                                                                 | Drift/erro de schema                                                                                                                                                                                                                             | Job vermelho; site segue no container antigo; corrigir e re-mergear                                                                                                                                                            |
| Smoke falha pós-up                                                            | Regressão de runtime                                                                                                                                                                                                                             | Rollback automático (restore + `up -d`) + job vermelho; investigar                                                                                                                                                             |

## Segurança (decisão deliberada)

- O job `deploy` usa `runs-on: host` — executa como `fsolla` na workstation.
  Está **apenas** no `ci.yml` (push em `main` + dispatch), nunca no `ci-pr.yml`.
  `main` só anda por PR mergeado com suite verde. Fork-PRs não disparam
  workflows no Forgejo (default off — verificado).
- Segredos nunca ecoados: sem `set -x`, senhas via `--password-stdin` /
  build-secrets; envs só no homeserver.

## Referências

- `scripts/deploy-homeserver.sh` — o script remoto (fonte da verdade do fluxo)
- `docs/plans/ops53-ci-deploy-homeserver*.md` — intenção e decisões
- infra-solla: `STATE.md`, `plano-infra-final.md` §"Arquitetura de deploy"
