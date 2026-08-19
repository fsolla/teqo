# Runbook: deploy do site 1313 no homeserver (OPS53 + OPS71 — dispatch manual)

O deploy de produção é uma **action manual** (`workflow_dispatch` no GitHub
Actions, `.github/workflows/deploy.yml`): mergir em `main` **não** publica
nada. O operador dispara o deploy quando decide publicar; antes de tocar o
homeserver, o job `verify` (hosted) roda a suíte **full** (incl. e2e full).

## Gatilho e fluxo

1. GitHub → Actions → **Deploy (manual)** → Run workflow (ref: `main`).
2. Job `verify` (hosted `ubuntu-latest`, ~50 min): suíte full sem skips —
   check-test-locations → lint → format → typecheck → knip → cycles → unit →
   int (migrate+seed nos services) → build → e2e full.
3. Se `verify` verde, o job `deploy` (`needs: [verify]`,
   `runs-on: [self-hosted, homeserver]`) roda no **runner do GitHub instalado
   no homeserver** e executa `scripts/deploy-homeserver.sh <sha>` **localmente**
   (sem SSH; o runner conecta outbound ao GitHub — funciona atrás do
   Cloudflare tunnel; o hosted nunca toca o homeserver; o self-hosted não
   conta minutos hosted).
4. O script, no **homeserver**: guarda de HEAD (`git ls-remote` de
   `TEQO_REPO_URL` — default `https://github.com/fsolla/teqo.git`, público —
   == SHA do job, senão "stale run" skip) → `flock` (serializa) → guard
   "already deployed" (revision do container rodando) → **build do migrator**
   (o estágio migrator não roda `next build` — builda mesmo contra o schema
   antigo; BuildKit, secrets do `~/stack/teqo-1313.env`) → push/tag do
   migrator em `localhost:5000` → swap dos tags de imagem no
   `~/stack/docker-compose.yml` (backup antes) → **migrations**
   (`docker compose --profile maintenance run --rm teqo-1313-migrate </dev/null`,
   já com a imagem do SHA novo) → **build do runner** (contra o banco JÁ
   migrado — o `next build` da geração estática lê o schema novo, OPS66;
   `--network host` com proxy socat `teqo-1313-build-proxy` na `stack_default`
   para alcançar o `postgres`; o proxy é criado idempotentemente pelo script)
   → push/tag do runner → `docker compose up -d teqo-1313` → healthcheck →
   smoke (`/`, `/campanha/login`, `/admin`, barreira 307, WebAuthn
   login-options, `api/revalidate` com o secret real).
5. Falha = job vermelho; nada é publicado pela metade (rollback automático
   após o swap).

**Primeiro deploy (verificação ao vivo):** depois do cutover OPS71, dispare o
deploy manual e confira no log do job `deploy` o `set-url` do workspace
(origem Forgejo → GitHub), o `deployed_sha` lido do container e o guard
"already deployed" num segundo dispatch do mesmo SHA.

## Onde roda cada coisa

| Máquina                    | Papel                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub hosted** (ubuntu) | CI de PR (`ci-pr.yml`, job `checks`) e job `verify` do `deploy.yml` (suíte full). Nunca toca o homeserver.                                                                                                                                                                                                                                              |
| **homeserver** (8c/16GB)   | todo o stack (`~/stack/docker-compose.yml`): postgres `teqo_1313`, forgejo, registry `localhost:5000`, cloudflared, `teqo-1313` na 127.0.0.1:1313; **runner self-hosted do GitHub** (labels `self-hosted`, `homeserver`; instalado no cutover OPS71 — registrar em infra-solla); workspace `~/teqo-deploy` (clone de `github.com/fsolla/teqo`, público) |
| **workstation**            | dev/agentes apenas — o runner do Forgejo foi **desligado** no cutover (o schedule do `ci.yml` antigo não tem mais razão; religar é reversível)                                                                                                                                                                                                          |

Segredos **não** ficam no GitHub: o script sourceia `~/stack/teqo-1313.env` e
`~/stack/.env` (chmod 600) no próprio homeserver. O repo GitHub é público — o
clone do workspace não precisa de credencial. No GitHub ficam apenas os
secrets de integração: `FORGEJO_API_TOKEN` (flips pós-merge) e
`CURSOR_API_KEY` (archive helper, dormente).

## Cutover OPS71 (passos manuais, ordem)

1. Remotes locais (config compartilhada pelos worktrees):
   `git remote set-url origin git@github.com:fsolla/teqo.git` e
   `git remote add forgejo ssh://git@192.168.15.142:2222/fsolla/teqo.git`
   (ou `https://git.solla.dev/fsolla/teqo.git`) — o repo Forgejo congela em
   main; o tracker (Issues) segue vivo por API.
2. GitHub repo: secrets `FORGEJO_API_TOKEN` + `CURSOR_API_KEY`
   (Settings → Secrets and variables → Actions) e **`Allow auto-merge`**
   (Settings → General → Pull Requests; ou `PATCH /repos/...` com
   `allow_auto_merge: true`). Repo é público: em Settings → Actions →
   General, defina fork PR workflows como não executar (ou exigir aprovação).
3. PAT local: criar token GitHub com escopo `repo` e exportar `GITHUB_TOKEN`
   (para `node scripts/github-pr.mjs` e `pnpm configure:branch-protection`).
4. `GITHUB_TOKEN=… pnpm configure:branch-protection` — required check
   `CI (PR) / checks` (literal de match: `checks` — o GitHub casa pelo nome do
   check-run; a UI exibe workflow/job; pin PR #742), 0 reviews,
   `enforce_admins: true`. **Antes do primeiro push** (senão o PR mergearia
   sem required check).
5. **Desligar o runner do Forgejo** na workstation (ex.:
   `systemctl --user stop forgejo-runner`) — após o primeiro PR GitHub
   validado; para o schedule do `ci.yml` antigo.
6. Instalar o runner self-hosted do GitHub no homeserver (labels
   `self-hosted` + `homeserver`; usuário com docker + acesso a `~/stack`;
   registrar em infra-solla: `STATE.md`).
7. Push do PR do OPS71 → CI verde → auto-merge → flip da Issue no Forgejo →
   deploy manual de validação.

Rollback do cutover (se o GitHub falhar cedo): religar o runner do Forgejo e
abrir PRs no Forgejo (os workflows de `.forgejo/workflows/` seguem no repo
até a Fase 2) — remotes: `git remote set-url origin ssh://git@192.168.15.142:2222/fsolla/teqo.git`.

## Rollback (do deploy)

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
a correção se re-mergeia e o próximo deploy completo publica.

## Falhas conhecidas

| Sintoma                                                                | Causa                                                                                                                                                   | Tratamento                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job verde sem deploy ("stale run")                                     | Push mais novo venceu; o dispatch apontava um SHA que não é mais o HEAD do main do GitHub                                                               | Nada a fazer — dispatch novo no main atual                                                                                                                                                                                                                                                                                  |
| Job verde sem deploy ("already deployed")                              | O container rodando já tem a revision do SHA do job (ex.: `workflow_dispatch` duplicado da mesma HEAD)                                                  | Nada a fazer — o site já roda esse SHA. Forçar rebuild da MESMA HEAD não é suportado via dispatch: edite o tag da imagem no compose (`image: teqo-1313:<sha>-rebuild`) e `docker compose up -d`, ou espere um commit novo                                                                                                   |
| Job `deploy` nunca roda / runner offline                               | Runner self-hosted do homeserver não instalado ou parado (passo manual do cutover OPS71)                                                                | Instalar/religar o runner (labels `self-hosted`, `homeserver`); os PRs e o `verify` não dependem dele — só o deploy                                                                                                                                                                                                         |
| Deploy dispara mas o job `verify` falha                                | Regressão real na suíte full                                                                                                                            | Corrigir e re-dispatchar — o homeserver nunca é tocado                                                                                                                                                                                                                                                                      |
| Deploy para logo após o migrate ("Done." e nada mais, EXIT=0)          | `docker compose run` anexa stdin por padrão — o container consome o resto do script; o bash chega a EOF e termina sem rodar o rollout                   | O script já usa `< /dev/null` no `run --rm` do migrate (não remover); sintoma visto 2026-08-17 no primeiro deploy                                                                                                                                                                                                           |
| Build falha: `network mode "stack_default" not supported by buildkit`  | BuildKit (drivers docker e docker-container) recusa rede bridge custom no `--network`                                                                   | O script builda com `--network host` + proxy socat `teqo-1313-build-proxy` (na `stack_default`, publicado em 127.0.0.1:5433, criado idempotentemente com `restart: unless-stopped`) + `DATABASE_URL` reescrita para o loopback                                                                                              |
| Build OOM no homeserver                                                | Laptop 8c/16GB com o stack ativo (~12GB livres medidos)                                                                                                 | Re-dispatch; se recorrente, item futuro: build na workstation com túnel                                                                                                                                                                                                                                                     |
| Build do runner falha: `relation "..." does not exist` no `next build` | Migration nova criou tabela lida em geração estática. Pré-OPS66 a ordem era build→migrate e o deploy morria aqui para sempre (incidente 2026-08-18, S2) | Pós-OPS66 não deve ocorrer: migrate roda antes do build do runner. Se reaparecer, confira no log se o passo migrate rodou; recovery manual: `docker build --target migrator` + `docker run --rm --network stack_default --env-file ~/stack/teqo-1313.env localhost:5000/teqo-1313-migrator:<sha>` e re-dispatch do workflow |
| Workspace clone sem o SHA novo                                         | O workspace antigo apontava para o Forgejo local (pré-OPS71) e o fetch não achou o SHA                                                                  | O script agora re-aponta `origin` para `TEQO_REPO_URL` (idempotente) antes do fetch — se ainda falhar, `git -C ~/teqo-deploy remote -v` e corrigir manualmente                                                                                                                                                              |
| Migrate falha                                                          | Drift/erro de schema                                                                                                                                    | Job vermelho; site segue no container antigo; corrigir e re-mergear                                                                                                                                                                                                                                                         |
| Smoke falha pós-up                                                     | Regressão de runtime                                                                                                                                    | Rollback automático (restore + `up -d`) + job vermelho; investigar                                                                                                                                                                                                                                                          |

## Segurança (decisão deliberada)

- O job `deploy` usa `runs-on: [self-hosted, homeserver]` — executa como o
  usuário do runner no homeserver. Está **apenas** no `deploy.yml`
  (dispatch manual), nunca no `ci-pr.yml`; o hosted (`verify`) não tem acesso
  ao homeserver e o self-hosted não recebe secrets de produção (as envs vivem
  no próprio homeserver). `main` só anda por PR mergeado com CI verde; o
  deploy só roda com `verify` full verde. Fork-PRs não rodam CI (same-repo
  gate + setting do repo).
- Segredos nunca ecoados: sem `set -x`, senhas via `--password-stdin` /
  build-secrets; envs só no homeserver.

## Referências

- `scripts/deploy-homeserver.sh` — o script (fonte da verdade do fluxo)
- `.github/workflows/deploy.yml` — verify → deploy
- `docs/plans/ops53-ci-deploy-homeserver*.md` — intenção e decisões (era Forgejo)
- `docs/plans/ops71-ci-github-actions-tracker-forgejo*.md` — o cutover
- infra-solla: `STATE.md`, `plano-infra-final.md` §"Arquitetura de deploy"
