# Migrar o banco de produção do Neon para o Postgres do homeserver

Status: concluído
Atualizado em: 2026-08-17
Issue: #2
Priority: P1
Model: cursor-grok-4.5-high
Impeccable: A — N/A
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável
Responsável: —

## Intenção

O banco de produção (pt.jorgesolla.com.br) vive no Neon. O homeserver já roda
Postgres 17 com o banco `teqo_1313` (cadeia completa de migrations aplicada, mas
**sem** conteúdo/PII de produção) e o container `teqo-1313` saudável. Falta a parte
cara: mover os dados reais — contatos, assinaturas, apoiadores, campanha — para
casa, com LGPD fail-closed e rollback documentado (o Neon continua vivo até o
cutover de hospedagem, que é outro lote).

## Persona e fluxo

- **Persona / contexto:** o dev (humano) conduzindo a migração; a equipe de campanha usando `/campanha` sem perceber a troca.
- **Job principal:** o banco de prod viver no homeserver, com os mesmos dados e sem queda perceptível.
- **Fluxo desejado:** dump seguro do Neon feito no homeserver (nunca em máquina de trabalho) → restore num banco de destino dedicado → deploy apontando para ele → smoke completo (login, WebAuthn, convites, revalidate) → Neon congelado como rollback.
- **Anti-goals de produto:** despejar PII em disco de máquina de trabalho; misturar o conteúdo de produção com o banco do site 1313 (que tem vida própria); cortar o Neon antes de provar o rollback.

## Objetivo e aceite

- Dump completo do Neon restaurado no homeserver, com PII íntegra e sem cópias intermediárias fora do homeserver.
- O deploy (container no homeserver) lê o banco local; `/campanha` funciona de ponta a ponta (login, WebAuthn, convites, revalidate).
- Rollback documentado e testável: o Neon permanece operacional e o caminho de volta é re-apontar o `DATABASE_URL`.
- Guardrails de produto: nenhum dado de produção toca bancos de dev/test (`teqo`, `teqo_test`, worktrees); o processo é fail-closed — qualquer passo que falhe deixa o Neon como fonte viva.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** nenhuma de produto — migração de infra.
- **Forma:** N/A

## Direção no codebase (hipótese)

- **Áreas prováveis:** env do deploy (DATABASE_URL no compose do homeserver, `~/stack/`); migração em si é operação (pg_dump/restore), não código; `pnpm migrate` + `pnpm db:seed:minimal` já provados no `teqo_1313`.
- **Precedente a olhar:** infra-solla `plano-implementacao.md` §7.3 (backup Neon → `teqo_prod_pre_migracao` no homeserver); `local-database` skill (guards que provam a higiene local); nota de "Mandatory production blocker" no AGENTS.md (LGPD/PII).
- **Risco de acoplamento:** a media (Vercel Blob) continua sendo servida de fora até o OPS52 — os posts restaurados devem continuar renderizando capas; o container teqo-1313 (site 1313) é outro banco e não deve ser tocado.

## Dependências

- OPS50 (suave — o pipeline Forgejo→homeserver precisa existir para o deploy do novo apontamento)

## Fora de escopo

- Cutover de DNS/hospedagem de pt.jorgesolla.com.br (infra §7.5–7.6, manual).
- Migração da media (Vercel Blob → Garage) — OPS52.
- Excluir/cancelar a conta Neon — só depois do cutover estável.
- Replicação contínua Neon→casa — dump + janela basta para este appetite.

## Rabbit holes de produto

- **Sincronização contínua / zero-downtime.** Para este appetite, janela de manutenção com dump é suficiente; replicação em tempo real triplica o risco sem pedido. **Corte neste item:** dump + smoke + rollback.
- **Unificar com o banco do 1313.** Sites diferentes, conteúdos diferentes, rollbacks diferentes. **Corte neste item:** banco de destino dedicado para a produção.

## Questões em aberto (produto)

- **Banco de destino: novo (`teqo_prod`) ou reusar `teqo_1313`?** **Opções:** A) novo banco dedicado | B) reusar o existente. **Recomendação:** A — o `teqo_1313` serve o site da campanha 1313 (vida própria); misturar complica rollback e privacidade. _(assumido — validar)_
- **Janela de manutenção?** **Opções:** A) congelar escrita durante o dump | B) dump com leitura consistente em produção aberta. **Recomendação:** A para simplicidade (apetite pequeno; campanha interna tolera minutos de leitura na janela). _(assumido — validar)_

## Desfecho (2026-08-17)

**Resolvido como B — restore no `teqo_1313` preparado**, divergência deliberada da hipótese A,
validada na execução: o `teqo_1313` foi criado em 16/08 exatamente para esta migração (role
própria, cadeia completa de 56 migrations, **zero conteúdo** verificado) e o `teqo-1313.env`
do homeserver **já aponta para ele** — restaurar = a produção "aparece" no container sem
nenhuma mudança de config; o argumento "o banco do 1313 tem vida própria" não se sustenta
(o site 1313 É a produção deste repo). Impl: [`ops51-db-neon-para-homeserver-impl.md`](ops51-db-neon-para-homeserver-impl.md).

Execução: dump `pg_dump -Fc` do Neon feito **no homeserver** (`/srv/hdd/backups/teqo-neon-pre-migracao/teqo-neon-full-20260817-204800.dump`, sha256 `f12196f2…`, Neon PG 17.10) → restore como role `teqo_1313` (`--no-owner --no-privileges`) → contagens por tabela idênticas ao Neon (1919 contatos, 39 posts, 1487 assinaturas, 1484 subscrições, 35 campaign_users, 392 lideranças, 2 pledges, 435 municípios, 6 atividades), sequences restauradas no topo, objetos com dono `teqo_1313`, `payload migrate` no-op (56 = 56). Smoke: `/`, artigo, `/campanha/login`, `/admin`, revalidate (`posts` + `global_privacy-policy`), WebAuthn `login-options`, barreira 307 sem sessão — verdes; smoke de browser (login, biometria, convites) validado manualmente pelo dev em `jorgesolla1313.com.br`.

**Rollback (Neon intacto — nunca escrito, só lido):** re-apontar `DATABASE_URL` do
`~/stack/teqo-1313.env` para a URL do Neon (mesmo valor de `NEON_DATABASE_URL` em
`~/stack/.env`) + `docker compose up -d teqo-1313` no homeserver; snapshot de segurança do
estado pré-restore em `/srv/hdd/backups/teqo-neon-pre-migracao/teqo_1313-pre-restore-*.dump`.

**Achado registrado (débito → OPS52):** as 40 rows de `media` têm URLs relativas
(`/api/media/file/…`) e os arquivos não existem em lugar nenhum (workstation, homeserver,
imagem — `.dockerignore` exclui `media/`) — capas dos posts dão **500 no homeserver e 404 no
próprio Vercel/produção atual**: estado pré-existente, a migração manteve paridade (sem
regressão). Recuperação dos arquivos + storage real é escopo do OPS52.

## Referências

- infra-solla: `STATE.md` (homeserver: postgres 17, DBs `forgejo`/`teqo_1313`), `plano-implementacao.md` §7.3
- `AGENTS.md` — regras de banco local/PII e guardas (`db:start`, `guard-dev-db`)
- Container `teqo-1313` (imagem `teqo-1313:21b3c00d`) já no homeserver
