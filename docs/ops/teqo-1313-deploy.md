# Runbook: deploy do site 1313 no homeserver (OPS53, janela OPS65)

O deploy de produção é uma etapa do CI (`ci.yml` no Forgejo): mergir em `main`
com a suite verde publica o site em `jorgesolla1313.com.br` — sem passo manual.
Merge **com mudança de produção** = site atualizado em ~30 min (janela) + tempo
da suite/deploy (~15–25 min cada; tipicamente < 1 h no total).

## Gatilho e fluxo

1. `git push` para `main` (via PR merge) — o `ci.yml` **não dispara mais a cada
   push**: roda por **janela fixa de 30 min** (`schedule */30`) ou via
   `workflow_dispatch` (deploy manual, imediato, sempre full suite).
2. Job `gate` (barato, host, sem pnpm): lê a **revision do container rodando**
   no homeserver (`docker inspect` → label `org.opencontainers.image.revision`
   do `teqo-1313` — a fonte de verdade; o compose pode mentir após rollback
   falho, pois é trocado antes do rollout) e classifica "mudança de produção"
   com o `.dockerignore` como fonte da verdade (o que não entra na imagem não
   justifica build novo; `docs/`, `.agents/`, `.env*` viram skip;
   `scripts/`, `tests/`, `.forgejo/`, `AGENTS.md` contam como produção —
   conservador, qualquer dúvida roda a suite).
   - Deployed == HEAD → suite e deploy **skipped**; run verde.
   - Sem revision conhecida (label ausente, container sem label) → fail-open:
     suite + deploy rodam na janela (run verde; comportamento conservador).
   - Gate incapaz de classificar (erro de git/`.dockerignore`) → suite roda e
     o run fica **vermelho** — nunca blackout silencioso.
3. Com mudança de produção: suite completa verde (static/int/build/e2e/checks).
4. Job `deploy` (runs-on `host`, na **workstation**) roda
   `ssh homeserver "bash -s -- <sha>" < scripts/deploy-homeserver.sh`.
   O script é **idempotente**: se o container rodando já tem a revision do SHA
   (ex.: dispatch duplicado), sai verde "already deployed" sem rebuild.
5. O script, no **homeserver**: guarda de HEAD (`main` remoto == SHA do job,
   senão skip) → `flock` (serializa) → guard "already deployed" (revision do
   container) → **build do migrator** (o estágio migrator não roda `next
build` — builda mesmo contra o schema antigo; BuildKit, secrets do
   `~/stack/teqo-1313.env`) → push/tag do migrator em `localhost:5000` →
   swap dos tags de imagem no `~/stack/docker-compose.yml` (backup antes) →
   **migrations**
   (`docker compose --profile maintenance run --rm teqo-1313-migrate </dev/null`,
   já com a imagem do SHA novo) → **build do runner** (contra o banco JÁ
   migrado — o `next build` da geração estática lê o schema novo, OPS66;
   `--network host` com proxy socat `teqo-1313-build-proxy` na `stack_default`
   para alcançar o `postgres`; o proxy é criado idempotentemente pelo script)
   → push/tag do runner → `docker compose up -d teqo-1313` → healthcheck →
   smoke (`/`, `/campanha/login`, `/admin`, barreira 307, WebAuthn
   login-options, `api/revalidate` com o secret real).
6. Falha = job vermelho no commit; nada é publicado pela metade.

**Primeira janela (verificação ao vivo):** após o merge do OPS65, acompanhe um
run agendado — confira no log do job `gate` o `deployed_sha` lido do container e
o veredito da classificação, e que um dispatch manual roda suite + deploy
(idempotência: segundo dispatch no mesmo SHA sai "already deployed"). Isso
prova ao vivo a paridade Forgejo de `needs.<gate>.outputs` com gate falho
(suite roda; deploy pula; run vermelho).

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
roda após migrator build+push+swap ok; rollout só após runner build ok). Desde
o OPS66 o migrate roda **antes** do build do runner (o build precisa do schema
novo): um build do runner que falhe depois do migrate deixa o banco à frente
do código — migrations são append-only e revisadas antes do deploy (checklist);
a correção se re-mergeia e a próxima janela completa o deploy.

## Falhas conhecidas

| Sintoma                                                                       | Causa                                                                                                                                                                                                                                            | Tratamento                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job verde sem deploy ("stale run")                                            | Push mais novo venceu; o deploy antigo saiu da fila                                                                                                                                                                                              | Nada a fazer — o run do SHA novo deploya                                                                                                                                                                                                                                                                                    |
| Job verde sem deploy ("already deployed")                                     | O container rodando já tem a revision do SHA do job (ex.: `workflow_dispatch` duplicado da mesma HEAD)                                                                                                                                           | Nada a fazer — o site já roda esse SHA. Forçar rebuild da MESMA HEAD não é suportado via dispatch: edite o tag da imagem no compose (`image: teqo-1313:<sha>-rebuild`) e `docker compose up -d`, ou espere um commit novo                                                                                                   |
| Gate `gate` vermelho (erro de git/`.dockerignore`)                            | SHA deployado ilegível para o git (ex.: história reescrita) ou `.dockerignore` corrompido no checkout                                                                                                                                            | Fail-open: suite roda; deploy pula (nunca deploy às cegas). Corrigir a causa e esperar a próxima janela (auto-cura). Se `ssh homeserver` estiver fora, o gate lê revision vazia e roda tudo (verde) — checar tailnet se a suite roda sem deploy recorrente                                                                  |
| Sem revision no container (label ausente no compose)                          | O compose do homeserver não define `org.opencontainers.image.revision` (deploy pré-OPS53 ou edição manual)                                                                                                                                       | Degradação conservadora: toda janela roda suite + rebuild (verde). Corrigir adicionando o label ao serviço `teqo-1313` no compose e re-deployando                                                                                                                                                                           |
| Todo job docker quebra com `exec: "node": executable file not found in $PATH` | `runner.envs.PATH` do `~/.forgejo-runner/config.yaml` (workstation) com paths só de host (nvm/bun) — o container perde o node do toolcache (`/opt/acttoolcache`); edição do config exige o toolcache primeiro (ver comentário no próprio config) | Corrigir o PATH no config (toolcache primeiro — ver comentário no próprio arquivo) + `systemctl --user restart forgejo-runner` (incidente 2026-08-17)                                                                                                                                                                       |
| Deploy para logo após o migrate ("Done." e nada mais, EXIT=0)                 | `docker compose run` anexa stdin por padrão — o container consome o resto do script que vai no pipe do `bash -s`; o bash chega a EOF e termina sem rodar o rollout                                                                               | O script já usa `< /dev/null` no `run --rm` do migrate (não remover); sintoma visto 2026-08-17 no primeiro deploy                                                                                                                                                                                                           |
| Build falha: `network mode "stack_default" not supported by buildkit`         | BuildKit (drivers docker e docker-container) recusa rede bridge custom no `--network`                                                                                                                                                            | O script builda com `--network host` + proxy socat `teqo-1313-build-proxy` (na `stack_default`, publicado em 127.0.0.1:5433, criado idempotentemente com `restart: unless-stopped`) + `DATABASE_URL` reescrita para o loopback                                                                                              |
| Build OOM no homeserver                                                       | Laptop 8c/16GB com o stack ativo (~12GB livres medidos)                                                                                                                                                                                          | Re-dispatch; se recorrente, item futuro: build na workstation com túnel                                                                                                                                                                                                                                                     |
| Build do runner falha: `relation "..." does not exist` no `next build`        | Migration nova criou tabela lida em geração estática. Pré-OPS66 a ordem era build→migrate e o deploy morria aqui para sempre (incidente 2026-08-18, S2)                                                                                          | Pós-OPS66 não deve ocorrer: migrate roda antes do build do runner. Se reaparecer, confira no log se o passo migrate rodou; recovery manual: `docker build --target migrator` + `docker run --rm --network stack_default --env-file ~/stack/teqo-1313.env localhost:5000/teqo-1313-migrator:<sha>` e re-dispatch do workflow |
| `checkout@v5` falha no job `host`                                             | Label host do act_runner                                                                                                                                                                                                                         | Fallback: baixar o script direto do Forgejo (`curl -s https://git.solla.dev/fsolla/teqo/raw/branch/main/scripts/deploy-homeserver.sh`)                                                                                                                                                                                      |
| Migrate falha                                                                 | Drift/erro de schema                                                                                                                                                                                                                             | Job vermelho; site segue no container antigo; corrigir e re-mergear                                                                                                                                                                                                                                                         |
| Smoke falha pós-up                                                            | Regressão de runtime                                                                                                                                                                                                                             | Rollback automático (restore + `up -d`) + job vermelho; investigar                                                                                                                                                                                                                                                          |

## Segurança (decisão deliberada)

- O job `deploy` usa `runs-on: host` — executa como `fsolla` na workstation.
  Está **apenas** no `ci.yml` (janela `*/30` em `main` + dispatch), nunca no
  `ci-pr.yml`. O job `gate` tem o mesmo perfil e é restrito a
  `github.ref == 'refs/heads/main'` (dispatch em branch não roda código do
  branch no host — a suite roda fail-open em containers com secrets de teste).
  `main` só anda por PR mergeado com suite verde. Fork-PRs não disparam
  workflows no Forgejo (default off — verificado).
- Segredos nunca ecoados: sem `set -x`, senhas via `--password-stdin` /
  build-secrets; envs só no homeserver.

## Referências

- `scripts/deploy-homeserver.sh` — o script remoto (fonte da verdade do fluxo)
- `docs/plans/ops53-ci-deploy-homeserver*.md` — intenção e decisões
- infra-solla: `STATE.md`, `plano-infra-final.md` §"Arquitetura de deploy"
