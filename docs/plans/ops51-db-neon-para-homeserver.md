# Migrar o banco de produção do Neon para o Postgres do homeserver

Status: registrado
Atualizado em: 2026-08-16
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

## Referências

- infra-solla: `STATE.md` (homeserver: postgres 17, DBs `forgejo`/`teqo_1313`), `plano-implementacao.md` §7.3
- `AGENTS.md` — regras de banco local/PII e guardas (`db:start`, `guard-dev-db`)
- Container `teqo-1313` (imagem `teqo-1313:21b3c00d`) já no homeserver
