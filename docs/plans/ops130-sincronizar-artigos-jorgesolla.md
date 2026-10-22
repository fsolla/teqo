# OPS130 — Sincronizar todos os artigos do jorgesolla.com.br e revisar os escondidos

Status: rascunho
Atualizado em: 2026-10-21
Issue: #1444
Priority: P1
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5–1 dia (operação no homeserver + revisão de taxonomia)
Responsável: —

## Intenção

O site antigo (`jorgesolla.com.br`, WordPress) é a fonte dos artigos do mandato e será desativado no cutover (OPS131). O Teqo tem hoje 43 posts publicados, todos visíveis; o seed `pnpm db:seed:posts` é create-only e já sincronizou o lote de agosto. Antes de desligar o WordPress, o Teqo precisa ter todos os artigos publicados lá — inclusive os que ficaram de fora ou estavam escondidos no período eleitoral — para que o acervo não se perca e o leitor encontre o mesmo conteúdo no novo domínio.

## Persona e fluxo

- **Persona / contexto:** equipe de comunicação do mandato; leitor que chega pelo Google/links antigos.
- **Job principal:** garantir que todo artigo disponível no jorgesolla.com.br exista no Teqo, com capa e URL canônica, antes de o WordPress sair do ar.
- **Fluxo desejado:** dry-run (o que seria criado/saltado) → revisão dos slugs novos/classificação → sync em produção (create-only, idempotente) → bust do cache `posts` → verificação de contagem/capas/páginas → auditoria dos "escondidos" → runbook atualizado.
- **Anti-goals de produto:** não é upsert nem espelho bidirecional; não importa páginas institucionais do WP (PUB2); não publica rascunho/privado do WP sem revisão; não toca PII; não muda o contrato de URL dos artigos.

## Objetivo e aceite

- Todo post publicado no WP REST (`/wp-json/wp/v2/posts`) existe no Teqo como post publicado; a diferença é zero ou está documentada no runbook.
- Os posts já existentes permanecem intocados (create-only, idempotente por slug).
- As capas dos novos carregam em `/api/media/file/...` (bucket de produção), e o cache `posts` é bustado.
- A lista de "escondidos" é auditada com evidência: hoje (21/10) há **0 tags com `hidden = true`**, **43 posts publicados**, **10 com a tag `eleitoral`**; não há drafts. Se a intenção do humano for posts em rascunho/privado do WordPress, eles não são importáveis pela API pública — precisam ser publicados no WP antes do sync ou exportados à parte.
- Nenhum conteúdo de campanha que a S47 decidir retirar é reexposto por este item; a decisão de visibilidade editorial é da S47.
- O runbook de sync (OPS58) é reutilizado e atualizado com o estado encontrado.

## Dados (intenção)

- **Vou apresentar dados?** Sim, no runbook: contagem WP × Teqo, criados/saltados, capas, escondidos.
- **Decisões desbloqueadas:** a equipe sabe se pode desligar o WordPress sem perder artigo; o leitor não encontra 404.
- **Forma:** contagens absolutas e lista de slugs; sem percentual.

## Dados da decisão (literais)

- WP REST: `https://jorgesolla.com.br/wp-json/wp/v2/posts?per_page=100` (paginado por `x-wp-totalpages`).
- Seed: `pnpm db:seed:posts --dry-run`; execução em produção (homeserver) com `ALLOW_REMOTE_DB=true` e `SEED_MEDIA_CONFIRM=1` (S3 de prod).
- Cache: `POST /api/revalidate` com `x-revalidate-secret` (tag default `posts`).
- Controle de visibilidade: `tag.hidden` + `isPostVisible`; tag de campanha: slug `eleitoral`.
- Estado de produção em 2026-10-21 (leitura read-only): 43 posts publicados; 0 drafts; 8 tags, todas `hidden = false`; 10 posts com `eleitoral`; categorias: politica 13, desenvolvimento 9, saude 8, educacao 7, direitos-trabalhistas 3, cultura 2, seguranca 1.
- Runbook de referência: `docs/plans/ops58-sincronizar-posts-prod-impl.md` (dry-run → sync → bust → verify).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/seed-posts.mjs`, `scripts/lib/wpArticles.mjs`, `scripts/seed-loader.mjs`, `docs/plans/ops58-sincronizar-posts-prod-impl.md`, `docs/ops/teqo-1313-deploy.md` (runbook); homeserver (`~/stack/teqo-1313.env`).
- **Precedente a olhar:** OPS58 (sync create-only), OPS52-media (execução no homeserver), OPS60 (guard `SEED_MEDIA_CONFIRM`).
- **Risco de acoplamento:** o Postgres de prod não é exposto ao host; rodar no homeserver, na rede do compose, com as `S3_*` de prod. Sem isso, capas caem no disco local e quebram em produção.

## Dependências

- Nenhuma dura. OPS131 (cutover) depende deste: não desligar o WordPress antes de o acervo estar no Teqo.

## Fora de escopo

- Atualizar/sobrescrever o corpo de posts já existentes (create-only).
- Importar páginas institucionais do WP (PUB2).
- Automação agendada do sync.
- Publicar rascunhos/privados do WP sem decisão editorial.
- Corrigir a taxonomia de todos os slugs antigos; só os novos que o dry-run apontar.

## Rabbit holes de produto

- **"Fazer upsert completo do WP."** Diff de richText, mídia, datas; vira migração de conteúdo. **Corte:** create-only.
- **"Importar tudo, inclusive drafts."** Publica conteúdo não revisado. **Corte:** só `published`; drafts exigem decisão.
- **"Automatizar o sync agora."** Infra nova para uma frequência que vai acabar com o WordPress. **Corte:** execução manual com runbook.

## Questões em aberto (produto)

- **"Escondidos" = tag `hidden` do Teqo ou posts em draft/private do WordPress?** **Opções:** A) o Teqo não tem nada escondido hoje (0 tags hidden, 0 drafts), então o pedido é no-op e o foco é o sync; B) são posts do WP em draft/private, que precisam ser publicados lá antes. **Recomendação:** A + auditoria do WP; se B, listar os posts e decidir um a um. _(assumido — validar no gate)_
- **Slugs novos fora da taxonomia:** **Opções:** A) default `politica` + warning; B) bloquear até classificar. **Recomendação:** A, com revisão dos slugs no dry-run. _(assumido)_
- **Posts com tag `eleitoral`:** **Opções:** A) manter publicados como notícia histórica; B) esconder/retirar. **Recomendação:** A — são notícia, não pedido de voto; a S47 cuida das superfícies de campanha. _(assumido)_

## Referências

- GitHub Issue #1444
- `docs/plans/ops58-sincronizar-posts-prod.md` e `-impl.md`
- `AGENTS-public.md` §Posts & Tags; `scripts/seed-posts.mjs`; `scripts/lib/wpArticles.mjs`
- Produção (leitura read-only, 2026-10-21): DB `teqo_1313`, tags/posts; `~/stack/teqo-1313.env`
