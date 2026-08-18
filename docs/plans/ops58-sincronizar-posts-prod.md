# OPS58 — Atualizar artigos de produção com os novos posts do jorgesolla.com.br

Status: planejado
Atualizado em: 2026-08-18
Issue: #43
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (sem mudança de UI; conteúdo/operação)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia (execução no homeserver + runbook)
Responsável: —

## Intenção

O site em produção (jorgesolla1313.com.br, homeserver) não reflete os artigos novos publicados no site original jorgesolla.com.br (WordPress). O seed `pnpm db:seed:posts` já existe e é idempotente por slug, mas só foi executado contra bancos locais — o DB de produção nunca recebeu uma rodada. Resultado visível: a home "Últimas notícias", `/artigos`, as páginas de artigo e a seção "Acompanhe de perto" da home de campanha (S1) ficam congelados no lote antigo, em plena janela eleitoral.

O item roda o sync de posts em produção (uma vez, com runbook documentado) — não constrói ferramenta nova: a ferramenta existe, a execução em prod é que nunca foi feita nem registrada.

## Persona e fluxo

- **Persona / contexto:** equipe do mandato/campanha que publica no WordPress original e espera o mesmo conteúdo no site da campanha, sem recadastro manual artigo a artigo.
- **Job principal:** ver os artigos novos do jorgesolla.com.br aparecerem em jorgesolla1313.com.br com capas carregando.
- **Fluxo desejado:** artigo publicado no WP → alguém roda o sync (runbook) → posts novos criados (idempotente por slug, sem duplicar) → capas servidas do bucket → cache `posts` bustado → home/artigos/seção de campanha atualizados.
- **Anti-goals de produto:** não virar sync bidirecional nem replicador de edits; não tocar PII; não alterar contrato público de URL (`/[type]/[category]/[slug]`, `/api/media/file/...`); não sobrescrever posts existentes.

## Objetivo e aceite

- Todos os artigos do jorgesolla.com.br ainda ausentes em produção são criados como notícias publicadas; os já existentes permanecem intocados (sem duplicata).
- As capas dos artigos novos carregam (200 em `/api/media/file/...` — objeto no bucket de prod, não disco local).
- Após o bust de cache, as páginas públicas (home, `/artigos`, artigo, seção de campanha) exibem os artigos novos.
- O procedimento fica documentado como runbook (pre-flight → execução → verificação), no padrão do OPS52-media, para a próxima execução ser cópia-e-cola.
- Guardrails de produto: execução no homeserver com o env do stack (`S3_*` de prod → capas caem no bucket certo); `ALLOW_REMOTE_DB=true` explícito (fail-closed mantido); seed create-only — nunca edita/sobrescreve conteúdo existente.

## Dados (intenção)

- **Vou apresentar dados?** Não — o item sincroniza conteúdo editorial; não há métrica ou KPI novo na superfície.
- Contagem de artigos criados/ignorados é relatório operacional do runbook (verificação de execução), não dado de produto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/seed-posts.mjs` (existe — fetch ao vivo do WP, taxonomy hardcoded, idempotente por slug, guard local com `ALLOW_REMOTE_DB=true`, upload de capa pelo storage configurado) e `scripts/lib/wpArticles.mjs`; endpoint `POST /api/revalidate?tag=posts` (`REVALIDATE_SECRET`) para o bust de cache; homeserver (`~/stack/teqo-1313.env`, rede do compose).
- **Precedente a olhar:** `docs/plans/ops52-media-recuperar-arquivos-impl.md` — mesmo padrão de execução no homeserver (env do stack, `ALLOW_REMOTE_DB=true`, pre-flight → exec → verify; firewall/extra_hosts já resolvidos na OPS52-media).
- **Risco de acoplamento:** o Postgres de prod não é exposto ao host (E4 da OPS52-media) — o seed roda **no homeserver**, dentro da rede do compose, não da workstation. Rodar contra o DB de prod sem as `S3_*` de prod criaria capas no disco local e quebraria 500 em produção: o ambiente do stack é obrigatório, não opcional.

## Dependências

- Nenhuma dura. Precedente suave: OPS52-media (executada em 2026-08-18 — capas e conectividade container→Garage resolvidas).

## Fora de escopo

- **Automação agendada do sync** (cron/Action) — decisão futura quando a frequência de publicação justificar.
- **Propagar edits do WordPress** para posts já seedados — o seed é create-only; atualização de conteúdo é item separado.
- **Expandir a taxonomy hardcoded** (`CLASSIFICATION` no seed) — manutenção contínua; slugs novos caem em `politica` com warning registrado no runbook.
- **Imagens inline do corpo** — por contrato do seed, só a capa vira media; corpo é texto/links.

## Rabbit holes de produto

- **"Sync completo (upsert)".** Se alguém "só completar" o seed para refletir edits do WP, explode em diff de richText + migração de conteúdo. **Corte neste item:** manter create-only; edits são outro item.
- **"Automatizar já".** Infra nova (agendador no homeserver, log, alerta) para uma frequência que ainda não dói. **Corte neste item:** runbook manual; automação quando a cadência justificar.

## Questões em aberto (produto)

- **Execução one-off manual ou automação agendada?** **Opções:** A) runbook manual no homeserver (padrão OPS52-media); B) cron no homeserver; C) Action de CI. **Recomendação:** A — a cadência de publicação ainda cabe em execução manual com runbook; automação vira item quando doer. _(assumido — validar)_
- **Slugs novos fora da taxonomy: aceitar default `politica` ou bloquear o sync?** **Opções:** A) aceitar default + warning e registrar os slugs no runbook para classificação posterior; B) abortar até classificar. **Recomendação:** A — mantém o sync desbloqueado; a classificação é manutenção do seed, não gate de conteúdo.
- **Edits pós-publicação no WP devem refletir em prod?** **Opções:** A) não — create-only (contrato atual); B) upsert completo em item separado. **Recomendação:** A neste item; B vira follow-up se a equipe editar artigos já publicados com frequência. _(assumido — validar)_

## Referências

- `AGENTS.md` — "Seeding news content (`pnpm db:seed:posts`)" e "Revalidating after a manual/direct DB change"
- `docs/plans/ops52-media-recuperar-arquivos-impl.md` — runbook do homeserver (precedente de execução)
- `scripts/seed-posts.mjs`, `scripts/lib/wpArticles.mjs`, `scripts/assert-local-database.mjs`
- `src/app/(frontend)/api/revalidate/route.ts` — bust de cache (`posts`)
