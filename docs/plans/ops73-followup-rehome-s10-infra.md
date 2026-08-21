# Follow-up pós-OPS73 — re-home S10 no GitHub, origin do workspace homeserver + fix da race de seedUser do e2e

Status: rascunho
Atualizado em: 2026-08-20
Issue: OPS73-FOLLOWUP (depends #114)
Intenção: Origem — débitos colhidos no fechamento do OPS73 (#114)
Appetite: ~0,4 dia (fase 1 dominante)

## Contexto

O OPS73 revelou que o cutover OPS71 **divergiu as plataformas**: o Forgejo main congelou em `e339ceec` (com S8/S9/S10) e o GitHub main recebeu OPS69/OPS71/OPS74 — as features S8/S9 foram re-homadas no OPS73 (PR #751), mas o **S10 (pixel Meta) não**. Além disso, duas pendências de infra/teste apareceram no ciclo.

## Já resolvido (não reabrir)

- Re-home do S8 (488dcf7d) e S9 (8d2352c0) no GitHub main → **PR #751** (merged `624126da`/rebase `dba75ff8`), admin fix + deploy verificado.
- ImportMap com handler S3 no main (regen com envs dummy — diff vazio).

## Fases (mesma família: infra/deploy pós-cutover)

### F1 — Re-home do S10 (pixel Meta) no GitHub main + deploy

O S10 está `done`+`in-prod` no tracker (#94, PR #109 merged Forgejo `e339ceec`), mas o código **não está no GitHub main nem em prod** (a revision deployada `dba75ff8` não tem o pixel; `8c734ba` só tem o `facebookPixel.ts` antigo do petition, `be1106f8`). Cherry-pick do commit S10 (`e339ceec`) sobre o main do GitHub (mesma mecânica do OPS73), revisar a migration `20260819_213947_add_site_settings_facebook_pixel_id` (aditiva), rodar gates + e2e e deployar. Verificar `/campanha` com `SiteSettings.facebookPixelId` configurado → `#meta-pixel-*` presente.

### F2 — Apontar o origin do workspace do homeserver para o GitHub

`~/teqo-deploy` ainda tem `origin = http://localhost:3000/fsolla/teqo.git` (Forgejo local). O `deploy-homeserver.sh` já re-aponta para `TEQO_REPO_URL` (https://github.com/fsolla/teqo.git) a cada deploy (idempotente), mas o estado depois de um deploy devia ficar GitHub. Ação: `git -C ~/teqo-deploy remote set-url origin https://github.com/fsolla/teqo.git`. Sem code change.

### F3 — Race de `seedTestUser` no e2e full do GitHub CI

`tests/helpers/seedUser.ts` faz delete-then-create de `dev@payloadcms.com`. Com a suíte full no CI do GitHub (4 workers paralelos; `frontend`, `admin` e `campaignNewsletter` specs chamam `seedTestUser`), dois workers podem intercalar `delete`/`create` → `duplicate key value violates unique constraint "users_email_idx"` reportado como `ValidationError: email`. Mitigar: `on conflict` na criação ou serializar o seed (blocking lock), ou uma chamada com retry. Impacto: é o 2º sinal do e2e full (novo no pipeline GitHub); o deploy `verify` roda full e pode flakear por isso.

## Rabit holes / Explicitamente fora

- **Não** reabrir o diagnóstico do admin (OPS73 fechou).
- **Não** "re-homar" o re-home do S8/S9 de novo (já em main).
- Guard #87 (importMap sem envs S3\_) é Issue própria (já absorve a lição do S9); não duplicar aqui.

## Aceite

- S10 rodando em prod (pixel presente) e no GitHub main.
- `~/teqo-deploy` com origin = GitHub após a mudança.
- e2e full do GitHub CI estável no `seedTestUser` (sem flake de duplicate email).
