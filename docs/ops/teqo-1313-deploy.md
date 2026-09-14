# Runbook: deploy do site 1313 no homeserver (OPS53 + OPS71 + OPS103 — dispatch manual)

O deploy é uma **action manual** (`workflow_dispatch` no GitHub Actions,
`.github/workflows/deploy.yml`): mergir em `main` **não** publica nada. O
operador dispara o deploy quando decide publicar; antes de tocar o homeserver,
o job `verify` (hosted) roda a suíte **full** (incl. e2e full) **uma vez** e
gateia os dois alvos: `deploy-staging` → aprovação do environment `production`
→ `deploy-production` (OPS103).

## Gatilho e fluxo

1. GitHub → Actions → **Deploy (manual)** → Run workflow (ref: `main`).
2. Job `verify` (hosted `ubuntu-latest`, ~50 min): suíte full sem skips —
   check-test-locations → lint → format → typecheck → knip → cycles → unit →
   int (migrate+seed nos services) → build → e2e full. **Intocado pela
   OPS103**: verifica o commit, não o alvo.
3. Se `verify` verde, o job `deploy-staging` (`needs: [verify]`,
   `environment: staging`, sem reviewer) roda no runner self-hosted e executa
   `TEQO_ENV=staging bash scripts/deploy-homeserver.sh <sha>` — publica o SHA
   em `staging.jorgesolla1313.com.br` (container `teqo-staging`,
   `127.0.0.1:1314`).
4. Com staging verde, o job `deploy-production` (`needs: [deploy-staging]`,
   `environment: production`) **aguarda a aprovação do reviewer** e então
   executa `TEQO_ENV=production bash scripts/deploy-homeserver.sh <sha>` —
   publica o **mesmo SHA** em produção (`teqo-1313`, `127.0.0.1:1313`).
   Staging vermelho = produção nunca roda; a corrida entre os dois é
   serializada pela `concurrency: deploy-homeserver`.
5. O script, no **homeserver**: `flock` único (compose, workspace e registry
   são compartilhados — um deploy por vez no host; o `concurrency` do
   workflow serializa os runs e o lock cobre invocação manual; desde a OPS102
   o run vai até o fim com o SHA do dispatch mesmo se `main` avançar durante o
   verify; o workspace é clonado/atualizado de `TEQO_REPO_URL` — default
   `https://github.com/fsolla/teqo.git`, público) →
   guard "already deployed" (revision do container do ambiente) → **build do
   migrator** (o estágio migrator não roda `next build` — builda mesmo contra o
   schema antigo; BuildKit, secrets do env file do ambiente) → push do migrator
   em `localhost:5000` (tag **qualificada de registry** — INF13: a única ref
   que o compose referencia) → swap dos tags de imagem no
   `~/stack/docker-compose.yml` (backup antes; sed ancorado ao serviço do
   ambiente — a linha do outro ambiente não é tocada) → **migrations**
   (`docker compose --profile maintenance run --rm teqo-<env>-migrate
</dev/null`, já com a imagem do SHA novo) → **build do runner** (contra o
   banco JÁ migrado — o `next build` da geração estática lê o schema novo,
   OPS66; `--network host` com proxy socat por ambiente na `stack_default` para
   alcançar o `postgres`; o proxy é criado idempotentemente pelo script) →
   push do runner (tag qualificada de registry) → `docker compose up -d
teqo-<env>` → healthcheck → smoke (`/`, `/campanha/login`, `/admin`,
   barreira 307, WebAuthn login-options, `api/revalidate` com o secret real do
   ambiente).
6. Falha = job vermelho; nada é publicado pela metade (rollback automático
   após o swap, **só do ambiente que falhou**).

**Primeiro deploy (verificação ao vivo):** depois do cutover OPS71, dispare o
deploy manual e confira no log do job `deploy-production` o `set-url` do
workspace (origem Forgejo → GitHub), o `deployed_sha` lido do container e o
guard "already deployed" num segundo dispatch do mesmo SHA. Na OPS103, o
caminho de estreia é o mesmo dispatch: staging primeiro (bootstrap abaixo),
inspeção humana, aprovação, produção.

## Onde roda cada coisa

| Máquina                    | Papel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub hosted** (ubuntu) | CI de PR (`ci-pr.yml`, job `checks`) e job `verify` do `deploy.yml` (suíte full). Nunca toca o homeserver.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **homeserver** (8c/16GB)   | todo o stack (`~/stack/docker-compose.yml`): postgres `teqo_1313`, forgejo, registry `localhost:5000`, cloudflared, `teqo-1313` na 127.0.0.1:1313 e `teqo-staging` na 127.0.0.1:1314 (OPS103; DB `teqo_staging`, env `~/stack/teqo-staging.env`, bucket `teqo-media-staging`); **runner self-hosted do GitHub** (labels `self-hosted`, `homeserver`; instalado 2026-08-19 — Issue #113 OPS71-INFRA; `~/actions-runner` v2.336.0, systemd user `actions.runner.fsolla-teqo.teqo-1313-runner.service` — `systemctl --user status/restart`); workspace `~/teqo-deploy` (clone de `github.com/fsolla/teqo`, público) |
| **workstation**            | dev/agentes apenas — o runner do Forgejo foi **desligado** no cutover (o schedule do `ci.yml` antigo não tem mais razão; religar é reversível)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Segredos **não** ficam no GitHub: o script sourceia o env file do ambiente
(`~/stack/teqo-1313.env` em produção, `~/stack/teqo-staging.env` em staging) e
`~/stack/.env` (chmod 600) no próprio homeserver. O repo GitHub é público — o
clone do workspace não precisa de credencial. No GitHub ficam apenas os
secrets de integração: `FORGEJO_API_TOKEN` (flips pós-merge) e
`CURSOR_API_KEY` (archive helper, dormente).

## Staging (OPS103)

Alvo real e descartável para validar o SHA (migração/build/rollout/smoke) antes
de produção. Mesmo dispatch, mesmo `verify`, mesmo script — o que muda é
`TEQO_ENV=staging` e o environment `staging` (sem reviewer; a aprovação que
importa é a de `production`).

| Item        | Staging                                                                        | Produção                                   |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| Container   | `teqo-staging` (127.0.0.1:1314)                                                | `teqo-1313` (127.0.0.1:1313)               |
| Migrator    | `teqo-staging-migrate`                                                         | `teqo-1313-migrate`                        |
| DB          | `teqo_staging`                                                                 | `teqo_1313`                                |
| Env file    | `~/stack/teqo-staging.env`                                                     | `~/stack/teqo-1313.env`                    |
| Imagens     | `localhost:5000/teqo-staging(-migrator):$SHA`                                  | `localhost:5000/teqo-1313(-migrator):$SHA` |
| Bucket      | `teqo-media-staging`                                                           | `teqo-media`                               |
| URL         | `https://staging.jorgesolla1313.com.br` (noindex)                              | `https://jorgesolla1313.com.br`            |
| Build proxy | `teqo-staging-build-proxy` (127.0.0.1:5434)                                    | `teqo-1313-build-proxy` (127.0.0.1:5433)   |
| Lock        | `/tmp/teqo-deploy.lock` (compartilhado — compose/workspace/registry são um só) | idem                                       |

### Bootstrap do homeserver (uma vez, manual — fora do repo)

1. **DB:** criar `teqo_staging` no Postgres do stack
   (`docker compose exec postgres createdb -U teqo teqo_staging`).
2. **Env file:** `~/stack/teqo-staging.env` (chmod 600) com `DATABASE_URL`
   apontando para `teqo_staging`, `PAYLOAD_SECRET` próprio,
   `NEXT_PUBLIC_SITE_URL=https://staging.jorgesolla1313.com.br`,
   `REVALIDATE_SECRET` próprio e `S3_*` do bucket `teqo-media-staging`.
3. **Compose:** adicionar `teqo-staging` e `teqo-staging-migrate` ao
   `~/stack/docker-compose.yml`, espelhando os serviços de produção
   (`pull_policy: never`, label `org.opencontainers.image.revision` **por
   serviço**, healthcheck, `extra_hosts: host-gateway`) e a porta
   `127.0.0.1:1314`.
4. **Bucket:** criar `teqo-media-staging` no Garage com key própria — nunca
   reutilizar a key/bucket de produção.
5. **Tunnel/DNS:** ingress `staging.jorgesolla1313.com.br` →
   `http://localhost:1314` no cloudflared + DNS no Cloudflare. Opcional
   (defesa em profundidade): header `X-Robots-Tag: noindex` no ingress — o
   noindex versionado (robots.ts + metadata, OPS103) já cobre crawlers.
6. **GitHub Environments:** criar `staging` (sem reviewer) e `production`
   (required reviewer `fsolla`) em Settings → Environments — **antes do
   primeiro dispatch** (environment `production` sem reviewer é fail-open).
7. **Migrate + seed sintético (antes do primeiro dispatch):** no homeserver,
   com o workspace em `~/teqo-deploy`, criar o proxy de staging manualmente
   (o deploy também cria, idempotente), migrar e semear. O guard local passa
   porque o alvo é `127.0.0.1` — **sem** `ALLOW_REMOTE_DB`:

   ```bash
   ssh homeserver
   cd ~/teqo-deploy && pnpm install
   docker inspect teqo-staging-build-proxy >/dev/null 2>&1 || docker run -d \
     --name teqo-staging-build-proxy --network stack_default \
     --restart unless-stopped -p 127.0.0.1:5434:5434 \
     alpine/socat TCP-LISTEN:5434,fork TCP:postgres:5432
   set -a; source ~/stack/teqo-staging.env; set +a
   export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5434}"
   pnpm migrate
   pnpm db:seed:minimal
   ```

   Nunca copiar dados de produção (PII/LGPD): o seed mínimo é sintético.

### Limites do staging (o que ele NÃO valida)

- e2e automatizado (o full continua no `verify`, que valida o commit);
- carga, caos, multi-região;
- integrações origin-bound sem configuração própria: WebAuthn/passkeys,
  Google OAuth e envio de e-mail (Resend). "Staging verde" ≠ "produção
  garantida" — é validação de migração/build/rollout/smoke + inspeção humana;
- dados são sintéticos; nunca PII real.

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
abrir PRs no Forgejo a partir do main congelado — os workflows de
`.forgejo/workflows/` foram removidos na OPS71 Fase 2, mas restauram do git
history (`git revert` do PR da remoção, ou clone do main congelado do Forgejo)
— remotes: `git remote set-url origin ssh://git@192.168.15.142:2222/fsolla/teqo.git`.

## Rollback (do deploy)

A imagem anterior **não** fica mais local após a limpeza pós-deploy (INF3/F2:
`docker builder prune` + remoção das tags locais antigas, exceto o SHA em uso)
— o registry `localhost:5000` **nunca deleta** e é a fonte do rollback. O
compose anterior fica em `~/stack/docker-compose.yml.pre-<sha-do-deploy-que-falhou>`
(um por deploy; como o staging roda antes no mesmo SHA, o backup de produção é
o compose já com a linha do staging — o restore devolve o arquivo inteiro, o
que é o correto).

```bash
ssh homeserver
cd ~/stack
# 1. apontar o compose de volta para o SHA anterior (o que estava rodando):
#    o backup do deploy que falhou é o compose com os tags antigos
ls docker-compose.yml.pre-*          # escolha o anterior ao deploy ruim
cp docker-compose.yml.pre-<sha-anterior> docker-compose.yml
# 2. puxar do registry (a imagem antiga já não fica local após a limpeza;
#    o compose referencia a tag qualificada — INF13 — e o pull basta):
docker pull localhost:5000/teqo-1313:<sha-anterior>
#    Cuidado (janela de transição pós-INF13): backups gerados ANTES do fix
#    usam tags bare (`image: teqo-1313:<sha>`); se o backup escolhido tiver
#    tag sem prefixo, recrie o alias antes de subir:
#      docker tag localhost:5000/teqo-1313:<sha-anterior> teqo-1313:<sha-anterior>
# 3. subir:
docker compose up -d teqo-1313
```

Para **staging**, o mesmo procedimento com as identidades do ambiente
(`teqo-staging`, `localhost:5000/teqo-staging:<sha-anterior>`,
`docker compose up -d teqo-staging`) — o rollback de um ambiente não toca o
container do outro (só restaura as linhas de imagem do arquivo compartilhado).

**Caveat:** uma migration de schema aplicada no passo de migrate **não** é
desfeita pelo rollback (Payload é append-only). Código velho sobre schema novo
pode se comportar mal — o caminho primário minimiza essa janela (migrate só
roda após migrator build+push+swap ok; rollout só após runner build ok). Desde
o OPS66 o migrate roda **antes** do build do runner (o build precisa do schema
novo): um build do runner que falhe depois do migrate deixa o banco à frente
do código — migrations são append-only e revisadas antes do deploy (checklist);
a correção se re-mergeia e o próximo deploy completo publica.

## Falhas conhecidas

| Sintoma                                                                                          | Causa                                                                                                                                                   | Tratamento                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prod regride para um SHA antigo após re-dispatch fora de ordem                                   | O `flock` serializa mas não ordena; o "already deployed" não pega revision diferente                                                                    | Não re-dispatchar SHA antigo; se acontecer, re-dispatchar o `main` atual (rollback manual disponível na seção Rollback). Revisitar se o deploy ganhar frequência/automação ou se uma regressão fora-de-ordem acontecer                                                                                                                                                                 |
| Job verde sem deploy ("already deployed")                                                        | O container rodando já tem a revision do SHA do job (ex.: `workflow_dispatch` duplicado da mesma HEAD)                                                  | Nada a fazer — o site já roda esse SHA. Forçar rebuild da MESMA HEAD não é suportado via dispatch: edite o tag da imagem no compose (`image: localhost:5000/teqo-1313:<sha>-rebuild`) e `docker compose up -d`, ou espere um commit novo                                                                                                                                               |
| Job de deploy nunca roda / runner offline                                                        | Runner self-hosted do homeserver não instalado ou parado (passo manual do cutover OPS71)                                                                | Instalar/religar o runner (labels `self-hosted`, `homeserver`); os PRs e o `verify` não dependem dele — só os deploys                                                                                                                                                                                                                                                                  |
| Deploy dispara mas o job `verify` falha                                                          | Regressão real na suíte full                                                                                                                            | Corrigir e re-dispatchar — o homeserver nunca é tocado                                                                                                                                                                                                                                                                                                                                 |
| `No such image` ao recriar o container fora de deploy (ex.: `compose up -d` pós-reboot/migração) | O compose referenciava uma tag local bare (`teqo-1313:<sha>`) que desapareceu sem recriação (achado INF8/INF13, 24/08: só restava a ref do registry)    | Corrigido no INF13: o compose passa a referenciar a tag **qualificada** (`localhost:5000/teqo-1313:<sha>`) a partir do primeiro deploy pós-fix — até lá, produção ainda roda o compose bare (recrie o alias via `docker tag` se necessário). Recovery geral: `docker pull localhost:5000/teqo-1313:<sha>` (+ `docker tag` se o compose em uso tiver tag bare) e `docker compose up -d` |
| Deploy para logo após o migrate ("Done." e nada mais, EXIT=0)                                    | `docker compose run` anexa stdin por padrão — o container consome o resto do script; o bash chega a EOF e termina sem rodar o rollout                   | O script já usa `< /dev/null` no `run --rm` do migrate (não remover); sintoma visto 2026-08-17 no primeiro deploy                                                                                                                                                                                                                                                                      |
| Build falha: `network mode "stack_default" not supported by buildkit`                            | BuildKit (drivers docker e docker-container) recusa rede bridge custom no `--network`                                                                   | O script builda com `--network host` + proxy socat do ambiente (prod `teqo-1313-build-proxy` em 127.0.0.1:5433; staging `teqo-staging-build-proxy` em 127.0.0.1:5434, na `stack_default`, criado idempotentemente com `restart: unless-stopped`) + `DATABASE_URL` reescrita para o loopback                                                                                            |
| Build OOM no homeserver                                                                          | Laptop 8c/16GB com o stack ativo (~12GB livres medidos)                                                                                                 | Re-dispatch; se recorrente, item futuro: build na workstation com túnel                                                                                                                                                                                                                                                                                                                |
| Build do runner falha: `relation "..." does not exist` no `next build`                           | Migration nova criou tabela lida em geração estática. Pré-OPS66 a ordem era build→migrate e o deploy morria aqui para sempre (incidente 2026-08-18, S2) | Pós-OPS66 não deve ocorrer: migrate roda antes do build do runner. Se reaparecer, confira no log se o passo migrate rodou; recovery manual: `docker build --target migrator` + `docker run --rm --network stack_default --env-file ~/stack/teqo-1313.env localhost:5000/teqo-1313-migrator:<sha>` e re-dispatch do workflow                                                            |
| Workspace clone sem o SHA novo                                                                   | O workspace antigo apontava para o Forgejo local (pré-OPS71) e o fetch não achou o SHA                                                                  | O script agora re-aponta `origin` para `TEQO_REPO_URL` (idempotente) antes do fetch — se ainda falhar, `git -C ~/teqo-deploy remote -v` e corrigir manualmente                                                                                                                                                                                                                         |
| Migrate falha                                                                                    | Drift/erro de schema                                                                                                                                    | Job vermelho; site segue no container antigo; corrigir e re-mergear                                                                                                                                                                                                                                                                                                                    |
| Smoke falha pós-up                                                                               | Regressão de runtime                                                                                                                                    | Rollback automático (restore + `up -d`) + job vermelho; investigar                                                                                                                                                                                                                                                                                                                     |
| `deploy-staging` falha cedo (`teqo-staging.env`/serviço ausente)                                 | Bootstrap do staging incompleto (DB, env file, serviços no compose ou environment `staging`)                                                            | Rodar o bootstrap da seção Staging; produção nunca é tocada (staging vermelho fail-closa o job `deploy-production`)                                                                                                                                                                                                                                                                    |

## Backup passivo no Forgejo (OPS76-FOLLOWUP, 2026-08-21)

O GitHub é a única fonte (main, branches, PRs, CI, tracker). O Forgejo mantém
um **backup passivo** via **pull mirror nativo**: o repo `teqo-backup` no
Forgejo (`https://git.solla.dev/fsolla/teqo-backup`) espelha o GitHub
automaticamente — **não serve push, não recebe PRs, é somente leitura**.

- **Repo:** `fsolla/teqo-backup` no Forgejo (`mirror: true`), criado via
  `POST /api/v1/repos/migrate` com `clone_addr=https://github.com/fsolla/teqo.git`,
  `service=github`, `mirror=true`, intervalo **8h** (`mirror_interval`).
- **Automação:** o próprio Forgejo sincroniza no intervalo (sem workflow).
  Force sync manual: `POST /api/v1/repos/fsolla/teqo-backup/mirror-sync`
  (o "Synchronize now" da UI).
- **Cobertura:** espelha todas as branches (54/54 verificadas) e tags; o
  histórico do mirror reflete o do GitHub (que é a convergência OPS75 +
  OPS76). Não espelha issues/PRs/labels (GitHub é o tracker).
- **Validação:** `git ls-remote` do `teqo-backup` deve retornar o mesmo SHA
  de `refs/heads/main` do GitHub; conferir em `mirror_updated` o último sync.
- **O repo `fsolla/teqo` original do Forgejo** fica **congelado** no ponto da
  convergência (OPS75) — arquivo histórico, sem mais uso.

## Segurança (decisão deliberada)

- Os jobs `deploy-staging`/`deploy-production` usam
  `runs-on: [self-hosted, homeserver]` — executam como o usuário do runner no
  homeserver. Estão **apenas** no `deploy.yml` (dispatch manual), nunca no
  `ci-pr.yml`; o hosted (`verify`) não tem acesso ao homeserver e o self-hosted
  não recebe secrets de produção (as envs vivem no próprio homeserver,
  inclusive as de staging — nunca como GitHub secrets). `main` só anda por PR
  mergeado com CI verde; o deploy só roda com `verify` full verde. Fork-PRs
  não rodam CI (same-repo gate + setting do repo).
- Segredos nunca ecoados: sem `set -x`, senhas via `--password-stdin` /
  build-secrets; envs só no homeserver.
- Staging sem PII real (seed sintético), bucket/DB/env próprios e noindex —
  nunca compartilha credencial, bucket ou dados com produção.

## C149 — Google OAuth da agenda (envs novas + GCP)

O botão **"Conectar com o Google"** da agenda usa um OAuth client do GCP. Sem
as envs, o diálogo cai no runbook antigo da service account — que segue como
fallback e não foi removida por esta entrega.

1. No GCP (mesmo projeto da service account), crie um OAuth client **Web
   application** com os redirect URIs:
   - `https://jorgesolla1313.com.br/campanha/agenda/google-oauth/callback`
   - `http://localhost:<porta>/campanha/agenda/google-oauth/callback` (dev)
2. Publique o app em produção — **unverified** é aceito (uso interno). Em
   "Testing" o refresh token expira em ~7 dias e o estado vira `erro` na UI.
3. Adicione ao `~/stack/teqo-1313.env` (homeserver, chmod 600):
   `GOOGLE_CALENDAR_OAUTH_CLIENT_ID` e `GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET`.
4. Deploy normal (`workflow_dispatch` do `deploy.yml`). O callback monta o
   redirect a partir de `NEXT_PUBLIC_SITE_URL` — precisa bater exatamente com
   o URI registrado no passo 1.

Desconectar no Teqo apaga o refresh token daquele lado; para revogar o acesso
de fato, revogue o app em `myaccount.google.com/permissions` (a UI orienta o
passo).

## OPS79 — última migração da plataforma antiga → nova (vertical campanha)

Operação de dados executada em 2026-08-23. Ver assistência lógica completa:
`docs/plans/ops79-ultima-migracao-dados-campanha.md` (intenção) e
`…campanha-impl.md` (impl). **A fonte (Neon, plataforma antiga) está congelada
desde o OPS80** — zero escritas desde 2026-08-23 22:30 UTC; a URL antiga segue
viva na Vercel apenas tecnicamente (desligamento de infra é o OPS81).

**Descoberta-chave da reconciliação:** a vertical campanha JÁ estava 100% íntegra
no `teo_1313` após o OPS51 (dump Neon→homeserver) — nenhum dado de operação de
campanha ficou órfão; o time de campanha não escreveu na URL antiga depois do
OPS51. O único residual real entre as plataformas era a `signature` pública
1486 (e seu contato/subscription), cujo contato originário **não existia** no
target (o id 2221 do target é OUTRA pessoa, Jorge Solla).

### Reconciliador (read-only, repetível)

Compara contagens + junta de IDs das 13 coleções da vertical e o conteúdo
semântico das join-tables de relações contra a fonte Neon.

```bash
ssh homeserver
cd ~/teqo-deploy
git fetch origin main && git checkout main && git pull --ff-only origin main
pnpm install
set -a; source ~/stack/.env; set +a            # fornece NEON_DATABASE_URL
set -a; source ~/stack/teqo-1313.env; set +a   # fornece DATABASE_URL (teqo_1313)
# o host `postgres` só resolve dentro da rede stack_default; do host usa-se o
# proxy socat do build (127.0.0.1:5433):
export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5433}"
NEON_DATABASE_URL="$NEON_DATABASE_URL" DATABASE_URL="$DATABASE_URL" pnpm ops79:reconcile
```

Esperado: `19/19 PASS` (a `municipality_rels` reporta `+3 absorvida pós-OPS51` —
edições de portfólio na plataforma nova, não-dado). Exit `1` em qualquer nova
divergência. Nunca imprime PII.

### Migração do residual (one-off, com guard de confirmação)

Copia a `signature` 1486 + seu contato + subscription (a transação que o
`submitPetitionSignature` faz junto), reusando petition/consent já presentes e
criando o contato com **id novo** (nunca o 2221, ocupado por outra pessoa).

```bash
# dry-run (valida referentes e imprime o plano sem escrever):
NEON_DATABASE_URL="$NEON_DATABASE_URL" DATABASE_URL="$DATABASE_URL" pnpm ops79:migrate --dry-run
# aplica (ESCREVE em prod — exige a flag de intenção explícita):
OPS79_MIGRATE_CONFIRM=1 NEON_DATABASE_URL="$NEON_DATABASE_URL" DATABASE_URL="$DATABASE_URL" pnpm ops79:migrate --apply
```

Resultado registrado em 2026-08-23: contact novo **2225** (Juares Lagimar de
Souza), signature **1486** preservada (petition `fim-escala-6x1`, consent 2),
subscription **1492**; sequences ajustadas (`setval` com `true` → próximo id =
último+1). Sequências conferidas após: contact 2225 / signature 1486 /
subscription 1492. Pós-verificação: `signature` 1485=1485 (Neon×target) e
reconcile 19/19; smoke `/`, `/campanha`, `/admin` 200.

### Rollback

A migração é idempotente (fail-closed: aborta se referentes/ids divergirem). Se
precisar desfazer, DELETar as 3 linhas + ajustar sequences de volta:
`DELETE FROM signature WHERE id=1486; DELETE FROM subscription WHERE id=1492;
DELETE FROM contact_phones WHERE _parent_id=2225; DELETE FROM contact WHERE id=2225;`
e `setval('contact_id_seq',2224)`, `setval('signature_id_seq',1485)`,
`setval('subscription_id_seq',1491)`.

## OPS84 — Verificação de valores (não só entidades) da migração

Extensão do reconciliador OPS79: compara TODAS as colunas de conteúdo (não só
ids/contagens) das 13 tabelas da vertical campanha entre a fonte congelada
(Neon) e a base nova (`teqo_1313`). Foco confirmado em `vote_pledge` (votos
declarados + 3 cenários de estimativa).

**Resultado registrado em 2026-08-24:** 13/13 tabelas PASS — **0 divergências
de conteúdo**. A migração de valores está 100% íntegra. Neon e target com
dados idênticos em todas as 13 tabelas da vertical.

### Verificador de valores (read-only, repetível)

```bash
ssh homeserver
cd ~/teqo-deploy && git fetch origin main && git checkout main && git pull --ff-only origin main
pnpm install
set -a; source ~/stack/.env; set +a            # fornece NEON_DATABASE_URL
set -a; source ~/stack/teqo-1313.env; set +a   # fornece DATABASE_URL (teqo_1313)
export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5433}"

# Todas as 13 tabelas (foco em vote_pledge):
NEON_DATABASE_URL="$NEON_DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
  pnpm ops84:reconcile-values

# Tabela isolada (debug/iteração):
NEON_DATABASE_URL="$NEON_DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
  pnpm ops84:reconcile-values --table vote_pledge

# Com relatório markdown (anexável ao issue):
NEON_DATABASE_URL="$NEON_DATABASE_URL" DATABASE_URL="$DATABASE_URL" \
  pnpm ops84:reconcile-values --report /tmp/ops84-report.md
```

**Esperado:** `13/13 PASS` com 0 content diffs. Exit `1` se houver divergência
de conteúdo. Colunas classified em 3 buckets:

- **content** — falha o run (aceite: "0 divergência" ou "N listadas")
- **derived** — hook-derivadas (`declared_at/by`, `estimated_at/by`,
  `created_at`, `updated_at`); informativas, não falham
- **sensitive** — PII; valores nunca impressos, só contados

Colunas jsonb comparadas via `col::text` (preserva `1` vs `1.0` como
divergência; SQL NULL ≠ JSON null). Zero normalização (trim/round/coalesce).

### Fallback: Neon inacessível (OPS81 já executado)

Se o Neon estiver inacessível (OPS81 desligou a infra), usar o dump do OPS51
como base de comparação:

```bash
# Restaurar dump em scratch DB local:
createdb teqo_1313_compare_src
pg_restore -d teqo_1313_compare_src \
  /srv/hdd/backups/teqo-neon-pre-migracao/teqo-neon-full-20260817-204800.dump

# Apontar NEON_DATABASE_URL para o scratch:
NEON_DATABASE_URL="postgresql://teqo:teqo@localhost:5432/teqo_1313_compare_src" \
DATABASE_URL="$DATABASE_URL" \
  pnpm ops84:reconcile-values --report /tmp/ops84-report-dump.md
```

**Nota:** dump é pré-freeze (2026-08-17) — deltas legítimos entre 08-17 e
08-23 (quando o Neon foi congelado) aparecem como divergências derivadas. O
relatório declara qual base foi usada.

### Rollback

Não há escrita; "rollback" = rodar de novo (idempotente, read-only).

## C155 — backfill do acervo de falas em produção

Operação de dados do catálogo de falas (`speech`/`speechSegment`, C153/C154):
processa as 54ª–57ª legislaturas (~1.011 discursos) contra o `teqo_1313` e
imprime um relatório por legislatura + a cobertura do banco. O import é
idempotente por `sourceKey` (reexecutar atualiza metadados e pula VOD/ASR do
que já tem segmentos), então o run é resumível — falha de rede em uma
legislatura não derruba as outras.

**Pré-requisitos:** o deploy que aplicou as migrations do catálogo
(`20260913_001112_add_speech_catalog`, `20260913_001200_add_speech_segment_trgm_index`,
`20260913_145820_add_speech_search_text`, `20260913_150000_backfill_speech_search_text_trgm_index`)
já está em produção desde o deploy de `424ee311` (2026-09-13); `DEEPINFRA_API_KEY`
no `~/stack/.env` do homeserver; `~/teqo-backfill` no SHA desejado com
`pnpm install`; espaço em `/srv/hdd/backups/teqo-camara` para o cache de MP4
(o cache do C153 foi descartado com o worktree; o backfill baixa de novo).

```bash
ssh homeserver
source ~/.nvm/nvm.sh            # Node 24 (engines do repo)
cd ~/teqo-backfill && git fetch origin && git checkout <SHA> && pnpm install
set -a; source ~/stack/.env; set +a            # DEEPINFRA_API_KEY
set -a; source ~/stack/teqo-1313.env; set +a   # DATABASE_URL + NODE_ENV=production
# o host `postgres` só resolve na rede do stack; do host usa-se o proxy socat:
export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5433}"
export CAMARA_IMPORT_CONFIRM=1                 # guard C155: escrita em produção

# smoke (4 discursos, ~2 min; repetir para provar idempotência: 0 criados/0 ASR):
pnpm camara:import --all --limit 1 --out /srv/hdd/backups/teqo-camara
# run completo (tmux; ~10–15h de parede, resumível):
tmux new -d -s c155 "pnpm camara:import --all --out /srv/hdd/backups/teqo-camara 2>&1 | tee -a /srv/hdd/backups/c155-run.log"
# validação pós-run (read-only):
pnpm camara:import --coverage --out /srv/hdd/backups/teqo-camara
pnpm camara:import --verify-links 3 --out /srv/hdd/backups/teqo-camara
```

O guard `CAMARA_IMPORT_CONFIRM=1` é exigido sempre que a escrita não é
provadamente local (`NODE_ENV=production`, host remoto ou `ALLOW_REMOTE_DB`);
`--coverage` e `--verify-links` são read-only e não exigem a flag. A escrita é
confinada a `speech`/`speechSegment`/rels; nenhum objeto de mídia vai para o
S3 (os MP4 ficam só no cache local). Crédito CC BY 4.0 da Câmara mantido no
admin/relatórios.

**Resultado registrado (2026-09-13/14):** **997 discursos** em produção
(54ª=1, 55ª=348, 56ª=414, 57ª=234) — 947 com trecho, 924 com vídeo, 920 com
segmentos; ASR 925 chamadas / 45,4h / ~US$1,23; LLM ~US$0,11; ~11h de máquina
(9h de runs + ~2h de retry por data). A 55ª veio pelo fallback de listagem
por ano/mês (a API responde 500 em **outubro/2018**; ~14 discursos ficaram
fora — reexecutar `pnpm camara:import --date <dia>` quando a fonte voltar).
O smoke idempotente (`--all --limit 1` duas vezes) provou 0 criados/0 ASR/0 LLM
na segunda passada; `--verify-links 3` deu 17/18 ok (1 warning transitório de
CDN). Relatórios completos em `/srv/hdd/backups/teqo-camara/reports/` e no
changelog `docs/changelog/2026-09-13-c155.md`.

### Rollback

O import é aditivo e idempotente; não há migração para desfazer. Para remover
uma legislatura (ex.: reimportar do zero), apagar os discursos e seus
segmentos — as rels (`speech_rels`, `speech_topics`, `speech_scopes`) caem por
cascade:

```sql
DELETE FROM "speech_segment" WHERE "speech_id" IN (SELECT id FROM "speech" WHERE "legislature" = '55');
DELETE FROM "speech" WHERE "legislature" = '55';
```

Para desfazer o acervo inteiro: `DELETE FROM "speech_segment"; DELETE FROM "speech";`
(a cobertura `--coverage` volta a zero). Reexecutar `--all` reconstrói.

## C160 — reparo do link oficial do acervo (PDF direto do Diário)

Operação de dados do acervo de falas (C153/C154/C155): troca o
`officialTextUrl` legado (`dc_20b.asp`/`dc_20.asp`/`montaPdf.asp`, que pendura
no browser) pelo PDF direto do Diário
(`https://imagem.camara.leg.br/Imagem/d/pdf/<arquivo>#page=<página>`). É
script-only (nenhuma migration): resolve uma vez por publicação
(`<out>/diario/`), é idempotente e reporta cobertura (falas/datas atualizadas,
falhas e legado restante).

**Pré-requisitos:** o SHA do branch/commit com o C160 (a passada original rodou
de `~/teqo-backfill` no SHA `766e4ae9`, 2026-09-14); `~/stack/.env` +
`~/stack/teqo-1313.env`; `~/teqo-backfill` com `pnpm install` no SHA. O
`git fetch` do homeserver alcança o GitHub pelo bundle/com o remote disponível
(na passada original o clone apontava para repo local e usou-se `git fetch
~/c160.bundle <branch>`).

```bash
ssh homeserver
source ~/.nvm/nvm.sh
cd ~/teqo-backfill && git fetch origin && git checkout <SHA> && pnpm install
set -a; source ~/stack/.env; set +a
set -a; source ~/stack/teqo-1313.env; set +a
export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5433}"
export CAMARA_IMPORT_CONFIRM=1                 # guard C160: escrita em produção

# dry-run (read-only; aquece o cache por publicação em <out>/diario):
pnpm camara:import --repair-links --dry-run --out /srv/hdd/backups/teqo-camara
# escrita (idempotente; 2ª passada = 0 atualizações):
pnpm camara:import --repair-links --out /srv/hdd/backups/teqo-camara
# validação (0 legadas restantes):
pnpm camara:import --repair-links --dry-run --out /srv/hdd/backups/teqo-camara
```

O guard `CAMARA_IMPORT_CONFIRM=1` é exigido sempre que a escrita não é
provadamente local (`NODE_ENV=production`, host remoto ou `ALLOW_REMOTE_DB`);
`--dry-run` é read-only e não exige a flag. A escrita é confinada a
`speech.officialTextUrl`; VOD, transcrições e segmentos não são tocados.

**Comportamento medido da Câmara (2026-09-14):** o legado `.gov.br` responde
302 para `.leg.br` (hop lento, 25–135s) e o `.leg.br` responde 302 para
`montaPdf.asp?narquivo=…&npagina=…` (~5s); o PDF direto responde 200/206
`application/pdf` em <1s. O resolver reescreve `.gov.br`→`.leg.br` no lookup,
segue o redirect e parseia o `montaPdf`; a resolução é cacheada uma vez por
publicação (`diario/<data>-<coleção>[-s<suplemento>].json`) e cada PDF é
provado com GET Range antes de gravar. Falha de resolução deixa a fala
intocada, o run sai 1 e a próxima passada é idempotente.

**Resultado registrado (2026-09-14):** 965 falas legadas em 510 publicações
resolvidas; 0 legadas restantes na validação; 32 falas sem link (fallback
YouTube/oculto). Relatórios em
`/srv/hdd/backups/teqo-camara/reports/repair-links-*.json` e changelog
`docs/changelog/2026-09-14-c160.md`.

### Rollback

Não há migração; o reparo só reescreve `speech.officialTextUrl` e o valor
anterior de cada fala está em `updates[].previousUrl` no JSON do run. O import
(`pnpm camara:import --date <dia>`) reconstrói o link a partir da API (a fonte
é a URL legada devolvida pela Câmara); reexecutar o reparo é idempotente.

## Referências

- `scripts/deploy-homeserver.sh` — o script (fonte da verdade do fluxo; parametrizado por `TEQO_ENV`)
- `.github/workflows/deploy.yml` — verify → deploy-staging → deploy-production (OPS103)
- `docs/plans/ops53-ci-deploy-homeserver*.md` — intenção e decisões (era Forgejo)
- `docs/plans/ops71-ci-github-actions-tracker-forgejo*.md` — o cutover
- `docs/plans/ops103-staging-homeserver*.md` — staging com verify único e aprovações separadas
- infra-solla: `STATE.md`, `plano-infra-final.md` §"Arquitetura de deploy"
