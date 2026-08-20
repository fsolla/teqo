# Impl: Runner self-hosted do GitHub no homeserver (deploy do dispatch manual) + CURSOR_API_KEY

Status: aguardando aprovação
Atualizado em: 2026-08-19
Issue: #113
Intenção: o body da Issue #113 (OPS71-INFRA) é a spec — sem plano de intenção separado
Appetite: horas de operação (não é Issue de código — nada de schema/UI/access)

## Leitura da intenção

- **Outcome:** o job `deploy` do `.github/workflows/deploy.yml` (dispatch manual)
  roda no **runner self-hosted do GitHub instalado no homeserver** (labels
  `self-hosted` + `homeserver`), executando `scripts/deploy-homeserver.sh <sha>`
  localmente (sem SSH). O hosted (`verify`) nunca toca o homeserver.
- **O que NÃO negociar:** runner só no `deploy.yml` (nunca no `ci-pr.yml`);
  usuário com docker group + leitura de `~/stack/`; outbound-only (funciona
  atrás do Cloudflare tunnel); registro do runner em infra-solla `STATE.md`.
- **Já validado na sessão (pre-flight):**
  - SSH ao homeserver OK (LAN `192.168.15.142`, user `fsolla`).
  - `fsolla` tem `docker` no groups + `sudo`; lê `~/stack/teqo-1313.env` e
    `~/stack/.env` (modo 600, dono = fsolla). Arch `x86_64` → tarball linux-x64.
  - **Runner ainda NÃO existe** no homeserver (sem `~/actions-runner`, sem unit
    systemd do runner; o `runner-watch.*` é outra coisa — WoL/shutdown da
    workstation).
  - **PAT do OPS71 funciona** (local, `~/.bashrc`): `GET /repos/fsolla/teqo` 200
    e `POST …/actions/runners/registration-token` 201 → admin no repo OK.
  - Versão estável atual do runner: **v2.336.0** linux-x64, 226 MB,
    sha256 `04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d`
    (digest da API de releases do GitHub).
  - **Linger do homeserver já ativo** (`loginctl show-user fsolla` →
    `Linger=yes`) → systemd **user** funciona sem sudo (o `runner-watch` já é
    user service persistente lá — prova do padrão).
  - Workspace `~/teqo-deploy` existe mas ainda aponta origin → Forgejo
    (`http://localhost:3000/…`): o `set-url` idempotente do
    `deploy-homeserver.sh` re-aponta para `TEQO_REPO_URL` (GitHub) no primeiro
    deploy — nada a fazer, mas é o que o log do primeiro deploy deve mostrar.

## Abordagem recomendada

Sequência **operacional no homeserver** (nenhum commit no repo teqo — o código
do OPS71 já foi mergeado; o único artefato commitado desta Issue é o registro no
`STATE.md` do infra-solla, repo separado):

1. **Download** (homeserver, `~/actions-runner`): tarball v2.336.0 linux-x64 da
   release oficial, **sha256 conferido** contra o digest da API de releases.
2. **Registration token** (workstation, PAT local): `POST
/repos/fsolla/teqo/actions/runners/registration-token` (TTL 1 h — gerar e
   configar na sequência, um único passo encadeado).
3. **config.sh** (homeserver, user fsolla):
   `./config.sh --url https://github.com/fsolla/teqo --token <token> --labels
self-hosted,homeserver --name teqo-1313-runner --work _work`.
4. **svc.sh como systemd USER** (`./svc.sh install` sem root → unit
   `~/.config/systemd/user/actions.runner.fsolla-teqo-1313-runner.service`) +
   `systemctl --user enable --now …` (start). Linger já ativo → persiste sem
   login; roda como fsolla (docker + `~/stack` envs).
5. **Verificação do runner**: `systemctl --user status …` ativo; runner listado
   em `GET /repos/fsolla/teqo/actions/runners` como online.
6. **Registro em infra-solla** (`~/Code/infra-solla/STATE.md`): entrada na
   seção do Teqo + nota na tabela de topologia (runner GitHub no homeserver,
   labels, dir, systemd user) — e no runbook `docs/ops/teqo-1313-deploy.md` do
   teqo (a tabela "Onde roda cada coisa" já o menciona prospectivamente; só
   confirmar o texto com o estado real). Changelog `docs/changelog/2026-08-20-ops71-infra.md` + `pnpm changelog:build`.
7. **Aceite (verificação ao vivo)**: dispatch manual do `deploy.yml` (ref main)
   → `verify` full verde → job `deploy` roda no runner do homeserver → log com
   o `set-url` do workspace (Forgejo → GitHub) + smoke ok → **segundo dispatch
   do mesmo SHA** → guard "already deployed".

**Decisões:**

- **systemd user + linger (já ativo) vs. `svc.sh install` via root:** user — sem
  senha sudo interativa, mesmo padrão do `runner-watch` (persistência provada no
  próprio homeserver); o unit system-level não adicionaria nada (o unit user
  roda com `User=fsolla` de qualquer forma).
- **`~/actions-runner` + workdir `_work`:** convenção oficial; `~/teqo-deploy`
  permanece como workspace do deploy (o script seta `TEQO_REPO_URL` nele).
- **Sem mudanças em código/workflows:** `runs-on: [self-hosted, homeserver]`
  já está no `deploy.yml`; o `deploy-homeserver.sh` já tem o `set-url`
  idempotente. O runner vem do GitHub com o token de registro — sem secrets
  novos no repo (o repo é público; as envs de produção ficam no homeserver).

**Rejeitadas:**

- **`svc.sh install` como root** — exigiria sudo interativo; nada ganho sobre o
  unit user (mesmo usuário efetivo, linger já garante auto-start no boot).
- **Rodar o runner em container/docker** — complexidade extra; o padrão oficial
  do GitHub é o binário com svc; o runner-watch local prova o user service.
- **Instalar agora o helper `archive-cursor-agent` / criar o secret
  `CURSOR_API_KEY` no GitHub** — item secundário da Issue, dormente (pool morto,
  OPS65): a key não existe no ambiente; fica **registrado como pendência** no
  fechamento (pedir a key ao humano quando quiser reativar o helper), sem ação
  agora.

## Fases verificáveis

1. Runner baixado + sha256 conferido.
2. Runner configurado (`.runner` + `.credentials` no `~/actions-runner`),
   labels corretas, nome `teqo-1313-runner`.
3. Unit systemd user ativo e **persistente** (`systemctl --user is-enabled …`),
   runner online na API do GitHub.
4. `STATE.md` (infra-solla) + runbook + changelog registrados.
5. Dispatch manual de validação (verify → deploy → already-deployed no segundo
   dispatch) — **aceite final, exige o humano** (dispara no GitHub UI).

## Rabbit holes / Não escopo (engenharia)

- Não re-engenharia do `deploy-homeserver.sh` (fluxo compose/migrate intacto).
- Não mexer no stack/registry/env do homeserver.
- Não criar secret `CURSOR_API_KEY` (dormente — só com a key do usuário).
- Não editar o `ci-pr.yml` nem a branch protection.

## Riscos e mitigação

- **Token de registro expira em 1 h** → o `config.sh` roda na mesma sequência
  do POST (script encadeado da workstation → homeserver).
- **`svc.sh install` gerar unit system em vez de user** (se detectar root):
  rodar sem sudo garante o user unit; se algo criar system unit, desfazer com
  `svc.sh uninstall` e repetir como user.
- **Runner offline no dispatch** → falha conhecida já documentada no runbook
  ("job deploy nunca roda / runner offline"): checar `systemctl --user status`,
  o runner-watch local não cuida deste runner (não é o forgejo-runner).
- **verify full ~50 min hosted antes do deploy** → aceite da Issue é um ciclo
  completo; nada do homeserver é tocado até `verify` verde.
- **Rollback**: `~/actions-runner/./svc.sh uninstall` + `rm -rf ~/actions-runner`
  (desregistra no GitHub); o deploy volta a ficar indisponível até o runner ser
  religado — comportamento conhecido, documentado no runbook.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (deploy self-hosted no homeserver,
      verify hosted nunca toca o homeserver)
- [ ] Runner instalado como fsolla (docker + `~/stack`), systemd user com
      linger, outbound-only
- [ ] Registrado em infra-solla `STATE.md` + runbook + changelog
- [ ] Validação ao vivo: dispatch manual → deploy no runner → "already
      deployed" no segundo dispatch
