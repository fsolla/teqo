# Admin do Payload segue em branco em produção — deploy do fix OPS69 + verificação pós-deploy

Status: rascunho
Atualizado em: 2026-08-19
Issue: #114
Priority: P1
Model: composer-2.5
Impeccable: A — sem mudança de UI (deploy do que já está em main)
Rascunho UI: N/A
Appetite: ~0,5 dia — deploy + verificação funcional; um outcome verificável
Responsável: —

## Intenção

O time editorial e de campanha está **sem CMS**: `/admin` em produção (jorgesolla1313.com.br) abre em branco (tela preta) — a página carrega, o shell hidrata, mas o formulário de login nunca renderiza. O bug raiz já foi diagnosticado e corrigido em `main` pelo **OPS69** (Issue #77, fechada): o `importMap` commitado ficou sem a entrada `@payloadcms/storage-s3/client#S3ClientUploadHandler` e o admin não monta as views quando o plugin `s3Storage` está ativo (envs `S3_*` de produção). O fix está em main desde `7162c65e` (2026-08-19).

**Mas produção nunca recebeu o fix.** O container roda um build de 2026-08-18 21:49 (`e6bd1d26`), anterior ao merge: o deploy automático antigo morreu (#85 OPS70 — runs agendados skipped) e o caminho novo (dispatch manual do `deploy.yml` no GitHub Actions) depende do runner self-hosted no homeserver, que ainda não está instalado (#113 OPS71-INFRA). A verificação pós-deploy do OPS69 (aceite do próprio plano) nunca rodou.

Verificado ao vivo em 2026-08-19: `/admin` de produção renderiza o shell vazio — **0 inputs, 0 botões, body sem texto** — mesmo sintoma do diagnóstico OPS69. `main` no GitHub hoje (`f5862c9b`) contém o fix.

## Persona e fluxo

- **Persona / contexto:** editor de conteúdo do mandato/campanha (staff que alimenta notícias e campanhas pelo Painel de Controle), bloqueado há ~1 dia.
- **Job principal:** abrir o admin, logar e voltar a editar publicações — sem depender de infra nova.
- **Fluxo desejado:** abre `jorgesolla1313.com.br/admin` → formulário de login aparece (não mais tela preta) → credenciais → dashboard com as coleções → consegue abrir uma coleção.
- **Anti-goals de produto:** não rediagnosticar o bug (OPS69 já fechou o diagnóstico com evidência); não reabrir a Issue #77; não entregar nenhuma mudança de código nova — só publicar o que já está aprovado em main.

## Objetivo e aceite

- `/admin` em produção renderiza o formulário de login para quem tem credencial (tela preta some).
- O container de produção roda uma revisão que contém o fix do importMap (`7162c65e` ou posterior — HEAD atual `f5862c9b`).
- O log do container de produção não re-emite `getFromImportMap: PayloadComponent not found in importMap` para o handler do storage.
- Um editor loga e abre uma coleção sem editar nada (smoke mínimo de leitura).
- Guardrail: nada de schema/migration/Consent/UI nesta entrega — é o deploy do que já está em `main`.

## Dados (intenção)

- **Vou apresentar dados?** Não — a verificação é funcional (render do login + log do container), nenhum número novo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/deploy-homeserver.sh` (o script de deploy — fonte da verdade do fluxo, roda no homeserver), `.github/workflows/deploy.yml` (dispatch manual `verify` → `deploy`), runbook `docs/ops/teqo-1313-deploy.md`, `src/app/(payload)/admin/importMap.js` (o fix já commitado — conferir a revision do container, não o arquivo).
- **Precedente a olhar:** OPS69 (`docs/plans/ops69-admin-branco-importmap-s3*.md`, #77) — aceite de verificação pós-deploy pendente; OPS71 (cutover do deploy) e #113 (runner); OPS66 (ordem migrate→build já resolvida no script).
- **Risco de acoplamento:** o deploy de `main` leva junto outras mudanças já aprovadas (ex.: S7, cards da home) — esperado e desejado (deploy do HEAD); o smoke do script cobre `/`, `/campanha/login`, `/admin`; rollback = restore do compose (runbook).

## Dependências

- Nenhuma dura. #113 (runner self-hosted) é o habilitador do caminho A, não pré-requisito — o caminho B desbloqueia sem ele.

## Fora de escopo

- Rediagnóstico do bug e guard de CI do importMap — #87 OPS70 já na fila (P2).
- Instalação do runner self-hosted do GitHub — #113 (Issue própria).
- Deploy contínuo automático — decisão OPS71 é deploy manual; #85 OPS70 (pipeline antigo) parece obsoleto pós-cutover — sugestão de fechamento à parte, não escopo daqui.

## Rabbit holes de produto

- **"A tela preta voltou → reabrir o diagnóstico."** Se alguém só completar o desejo: regressar ao OPS69. **Corte neste item:** conferir a revision do container antes de qualquer diagnóstico — a evidência (build de 2026-08-18 sem o fix, main com o fix desde 2026-08-19) já explica o sintoma.
- **"Já que vou mexer, instalo o runner/automatizo tudo."** **Corte:** #113 (runner) e #87 (guard) são Issues separadas; este item entrega admin no ar.

## Questões em aberto (produto)

- **Caminho do deploy?** **Opções:** A) dispatch manual do `deploy.yml` no GitHub Actions (verify full ~50 min → deploy no runner do homeserver — exige instalar o runner, #113, antes); B) executar `scripts/deploy-homeserver.sh <sha>` direto no homeserver (mesmo script idempotente que o runner rodaria; smoke + rollback documentados; não espera #113); C) instalar o runner primeiro e depois A. **Recomendação:** **B agora** — admin caído = CMS indisponível; o script é o mesmo e o runbook cobre smoke e rollback; depois, o primeiro dispatch via A valida o pipeline OPS71. _(assumido — validar com produto)_
- **Prioridade?** **Opções:** P0 (mesma dor do incidente original) | P1 (o fix já existe em main; resta entrega + verificação). **Recomendação:** **P1** — claimável já, sem precisar de re-P0 da fila. _(assumido — validar com produto)_
- **Quem toca o homeserver?** O agente não tem acesso ao homeserver nem ao GitHub para dispatch sem ação do operador. **Opções:** o executor prepara os comandos do runbook e o humano roda (2 passos, ~5 min) | o executor dispara via GitHub API (`GITHUB_TOKEN` disponível) quando o runner estiver em pé (#113). **Recomendação:** humana para o caminho B imediato; o agente executa o restante (conferir SHA, verificar `/admin` no browser, checar log) e registra a evidência. _(assumido — validar com produto)_

## Referências

- OPS69: `docs/plans/ops69-admin-branco-importmap-s3.md` + `-impl.md`, Issue #77 (fechada — fix `7162c65e` em main)
- Runbook de deploy: `docs/ops/teqo-1313-deploy.md` (smoke, rollback, falhas conhecidas)
- OPS71 cutover: `docs/plans/ops71-ci-github-actions-tracker-forgejo.md`; runner: #113; guard de importMap: #87; pipeline antigo morto: #85
- Evidência (gate): `docs/plans/ops73-deploy-admin-prod-evidence.png` — `/admin` de produção em 2026-08-19 (shell vazio, sem login)

![Admin em branco em produção — 2026-08-19](ops73-deploy-admin-prod-evidence.png)
