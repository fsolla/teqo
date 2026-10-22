# OPS131 — Cutover do domínio jorgesolla.com.br para o Teqo e desativação do WordPress

Status: rascunho
Atualizado em: 2026-10-21
Issue: #1445
Priority: P1
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~1–2 dias + propagação DNS; um outcome verificável (o domínio canônico serve o Teqo e o WordPress não serve mais)
Responsável: —

## Intenção

O site do mandato ainda vive em duas casas: o Teqo em `jorgesolla1313.com.br` (campanha) e o WordPress em `jorgesolla.com.br` (site antigo, fonte dos artigos). Com a eleição encerrada e o acervo sincronizado (OPS130), o endereço definitivo deve ser `jorgesolla.com.br` — o domínio que as pessoas conhecem, que já está nos materiais e no e-mail do mandato. O `jorgesolla1313.com.br` cumpriu o papel de campanha e deve redirecionar; o WordPress deve ser desativado sem perder SEO, e-mail ou o acesso da equipe.

## Persona e fluxo

- **Persona / contexto:** eleitor/leitor que digita `jorgesolla.com.br` ou clica num link antigo; equipe do mandato que usa `/campanha`; ops que opera o homeserver.
- **Job principal:** abrir o domínio oficial e ver o site novo, com os links antigos funcionando; a equipe continua entrando em `/campanha`.
- **Fluxo desejado:** pré-flight (DNS, URLs do WP, mídia, auth) → congela escritas no WP → sync final (OPS130) → troca `NEXT_PUBLIC_SITE_URL`/`metadata.URL` → deploy → ingress/DNS do novo domínio → 301 dos links antigos e do domínio 1313 → verificação → desliga o WordPress.
- **Anti-goals de produto:** não migrar plugins/temas/usuários do WordPress; não mudar o e-mail (`@jorgesolla.com.br` já é o domínio do mandato); não perder artigos; não deixar duas fontes de verdade; não quebrar o login da equipe em silêncio.

## Objetivo e aceite

- `https://jorgesolla.com.br` e `https://www.jorgesolla.com.br` servem o Teqo (200), com canonical/OG no domínio novo.
- `https://jorgesolla1313.com.br` responde 301 para o domínio novo, preservando o path (incluindo `/campanha`, conforme a decisão de auth abaixo).
- URLs antigas do WordPress (`/YYYY/MM/DD/<slug>/`) respondem 301 para o caminho canônico do artigo no Teqo (`/[type]/[category]/[slug]`); páginas antigas vão para o equivalente ou para `/`; nenhuma URL indexada fica 404 sem decisão.
- O WordPress deixa de servir o site depois da janela de rollback; o DNS/ingress do novo domínio aponta para o túnel do homeserver.
- MX/TXT/SPF/DKIM/DMARC e subdomínios que não são o site ficam intocados; o e-mail `campanha@jorgesolla.com.br` continua funcionando.
- `NEXT_PUBLIC_SITE_URL=https://jorgesolla.com.br` no env de produção (rebuild, pois é inlined) e `metadata.URL` no admin com o mesmo valor; convites, calendário e OAuth usam o novo origin.
- WebAuthn/passkeys: a decisão do gate é explícita — reenrollment dos usuários de campanha no novo domínio ou manutenção do `/campanha` no domínio antigo; nenhuma credencial quebra em silêncio.
- Mídia/OG: `/api/media/file/...` e as imagens OG continuam 200 no domínio novo; o `next.config.mjs` aceita o host do novo domínio.
- O runbook de cutover/rollback fica em `docs/ops/teqo-1313-deploy.md`, com a evidência do pré-flight.

## Dados (intenção)

- **Vou apresentar dados?** Sim, no pré-flight/runbook: inventário de DNS, contagem de URLs do WP, mapa de redirects, contagem de usuários com passkey.
- **Decisões desbloqueadas:** ops decide o momento do corte; a equipe sabe o que reenrolar; o leitor não perde o link.
- **Forma:** contagens absolutas e mapa URL→URL; sem dashboard.

## Dados da decisão (literais)

- Domínio canônico: `https://jorgesolla.com.br` (apex); `www` → 301 para o apex.
- Domínio de campanha: `https://jorgesolla1313.com.br` → 301 para o canônico.
- Env de produção: `NEXT_PUBLIC_SITE_URL=https://jorgesolla.com.br` (inlined no build; exige rebuild) e `metadata.URL=https://jorgesolla.com.br` (global no admin).
- Cloudflare: o túnel é remotely-managed; o ingress do novo domínio aponta para `http://localhost:1313`; a zona `jorgesolla1313.com.br` hoje é `2ae7416abc4ea930db5ce6782504c578` — a zona de `jorgesolla.com.br` deve ser lida no dashboard, não hardcoded.
- WordPress: `https://jorgesolla.com.br` hoje resolve para `128.201.75.110`; a API de posts é a fonte do OPS130; o site antigo usa permalinks `/<ano>/<mês>/<dia>/<slug>/`.
- Auth: o RP ID do WebAuthn é o hostname de `NEXT_PUBLIC_SITE_URL` (`src/utilities/webauthn/campaignWebAuthnConfig.ts:87`); credenciais criadas em `jorgesolla1313.com.br` não valem em `jorgesolla.com.br`.
- SEO: o canonical prefere `metadata.URL` e cai para `NEXT_PUBLIC_SITE_URL` (`src/utilities/seo.ts:60-72`); o origin das imagens OG é o deployment (`seo.ts:86-93`).
- Redirects: não há redirects em `next.config.mjs` nem middleware hoje; o único redirect in-app é o canonical de artigo (`[type]/[category]/[slug]/page.tsx:140-142`).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/seo.ts`, `src/utilities/campaignInviteOrigin.ts`, `src/utilities/webauthn/campaignWebAuthnConfig.ts`, `src/payload.config.ts` (serverURL, se aplicável), `next.config.mjs` (host de imagem), `src/app/robots.ts` (robots/sitemap), `docs/ops/teqo-1313-deploy.md`, `~/stack/teqo-1313.env`, Cloudflare tunnel/DNS.
- **Precedente a olhar:** OPS51/OPS52 (cutover de DB/mídia), OPS80/OPS81 (cutoff de `pt.jorgesolla.com.br`, que deixou `jorgesolla.com.br`/SEO fora de escopo), OPS103 (staging/noindex), OPS130 (sync).
- **Risco de acoplamento:** `NEXT_PUBLIC_SITE_URL` governa convite/WebAuthn/calendar/OAuth; trocar sem reenrollment quebra o login por passkey; `metadata.URL` governa canonical/OG; o e-mail usa o mesmo domínio (não tocar em MX/TXT).

## Dependências

- **OPS130 (dura):** o acervo precisa estar no Teqo antes de desligar o WordPress.
- **S47 (dura ou suave):** o site deve estar pós-eleição antes de virar o domínio oficial; se o corte vier antes, o domínio novo abriria com a home de campanha.
- **S48 (suave):** a petição pode estar no ar antes do corte para o link já nascer no domínio novo.

## Fora de escopo

- Migrar páginas institucionais/plugins/usuários do WordPress (PUB2).
- Redesenho do site (S47).
- Migração de e-mail (já está no domínio).
- Apagar o backup do WordPress; o conteúdo antigo fica arquivado.
- SEO além do canonical/redirects mínimos (sitemap completo é follow-up).
- Manter os dois domínios como canônicos.

## Rabbit holes de produto

- **"Migrar o WordPress inteiro."** Vira reescrita de páginas/plugins. **Corte:** só posts + redirects; páginas são PUB2.
- **"Resolver o passkey com um RP ID pai."** `jorgesolla1313.com.br` não é subdomínio de `jorgesolla.com.br`; não existe RP ID comum. **Corte:** decisão explícita de reenrollment OU manter `/campanha` no domínio antigo.
- **"Cortar DNS e ver depois."** Sem mapa de redirects e sem pré-flight, perde SEO e links. **Corte:** pré-flight + 301 + verificação antes de desligar.

## Questões em aberto (produto)

- **Passkeys:** **Opções:** A) cutover total + reenrollment dos usuários de campanha; B) manter `/campanha` em `jorgesolla1313.com.br` e só o site público no novo domínio; C) adiar o cutover até um mecanismo de migração. **Recomendação:** A — a eleição acabou e a equipe é pequena; reenrollment assistido é aceitável, com aviso prévio. _(assumido — decisão humana obrigatória)_
- **Janela do WordPress:** **Opções:** A) desligar após a verificação, com backup/arquivo; B) manter read-only por 30 dias. **Recomendação:** B — janela curta de rollback, sem escritas. _(assumido)_
- **Redirect de `jorgesolla1313.com.br`:** **Opções:** A) 301 permanente; B) 302 por 90 dias. **Recomendação:** A — o 1313 não volta; 301 preserva o SEO. _(assumido)_
- **Escopo dos redirects antigos:** **Opções:** A) posts + páginas conhecidas; B) todas as URLs do sitemap do WP. **Recomendação:** B — inventariar o sitemap e mapear; o que não tiver equivalente vai para `/`. _(assumido)_

## Referências

- GitHub Issue #1445
- `docs/ops/teqo-1313-deploy.md` (homeserver, tunnel, envs, staging); `AGENTS-infra.md`
- `src/utilities/seo.ts`, `src/utilities/campaignInviteOrigin.ts`, `src/utilities/webauthn/campaignWebAuthnConfig.ts`, `next.config.mjs`
- OPS80/OPS81 (`pt.jorgesolla.com.br`), OPS130 (sync), S47 (site pós-eleição)
