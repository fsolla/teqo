# C92 — Link de import da agenda: corrigir criação do feed (erro ao gerar)

Status: rascunho
Atualizado em: 2026-08-08
Issue: #436
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A sem UI (mesmo diálogo; comportamento corrigido)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável — staff gera o link de import nomeando o feed
Responsável: —

## Dependência rápida

- **Sucessor de C16 (#392, _done/in-prod_):** o fluxo de "link de import" foi entregue mas a criação quebra no ar. Plano de C16 imutável; este é um item novo.

## Intenção

A sincronização com Google Calendar (C16) foi entregue, mas **ninguém consegue gerar o link**: ao digitar um nome e confirmar, o app responde "Não foi possível criar o feed de calendário." A funcionalidade fica inútil exatamente onde deveria destravar o valor (assinar o recorte da agenda no GCal da equipe). Queremos que gerar o link funcione para todo o staff, com o fluxo real (nomear → link → copiar/revogar) intacto.

**Causa raiz verificada localmente (repro):** a collection `calendarFeed` marca `secretSlug`/`createdBy` como campos de sistema com acesso de escrita restrito a admin do Payload (`canSetCalendarFeedSystemField`). A server action cria o feed com `overrideAccess: false` e actor `campaignUser` — o create falha (campos "obrigatórios" não graváveis) e o `catch` engole o erro numa mensagem genérica. Repro: create OK com `overrideAccess: true`; falha com `overrideAccess: false` + `user` `campaignUser`. O executor reconfirma e decide o ajuste (acesso do campo vs forma do create) — aqui fica só o sintoma e o conjunto afetado.

## Persona e fluxo

- **Persona / contexto:** coordenador ou assessor (staff) na agenda, montando um recorte ("só deputado presente", "só meu município") para a equipe acompanhar no Google Calendar.
- **Job principal:** obter o link de import do filtro atual para colar no GCal.
- **Fluxo desejado:** aplica filtro → "Link de import" → nomeia o feed → recebe URL → copia/revoga. **Hoje morre no passo "nomeia".**
- **Anti-goals de produto:** nenhum novo — manter C16: sem sync bidirecional; Teqo SoT; fail-closed do acesso no read do feed.

## Objetivo e aceite

- Coordenador, assessor e candidato conseguem **gerar o link de import** após nomear o feed (sem erro).
- O link gerado abre o feed correto do recorte (endpoint `/campanha/agenda/ical/[secret]` responde).
- Listar feeds ativos e **revogar** continuam funcionando.
- O erro real não é mais engolido numa mensagem genérica sem rastro — o fallback segue amigável, mas sem mascarar quebra de acesso/configuração.
- Não vaza municípios fora do escopo do criador (invariante de C16 preservado).

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** "posso assinar o recorte da agenda no Google?" — desbloqueada ao funcionar.
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/access/calendarFeeds.ts` (acesso de escrita dos campos de sistema `secretSlug`/`createdBy`), `src/app/(campaign)/campanha/actions/calendarFeed.ts` (`createCalendarFeedLinkRecord`, `overrideAccess`/`user`), `src/collections/CalendarFeed.ts` (definição dos campos de sistema), com repro provável em `src/utilities/calendarFeed.ts`.
- **Precedente a olhar:** como outras server actions da campanha gravam campos `systemStampedActorField` com actor `campaignUser` (ex. `supporter`/`activity`) — o padrão que já funciona no repo.
- **Risco de acoplamento:** acesso é área "nunca economizar" (AGENTS.md) — mudança mínima e com teste de acesso (staff cria; leader/especulador não; read do feed segue fail-closed).

## Dependências

- Nenhuma dura. Sequencia antes de C93 (sem criação funcionando, falar de "sem filtros" é prematuro).

## Fora de escopo

- Permitir gerar sem filtros → **C93**.
- Layout do botão/diálogo → **C94**.

## Rabbit holes de produto

- **"Completar" o fix virando refactor de access.** Se alguém "só arrumar": mexer em todos os campos de sistema e padrões de access do repo. **Corte neste item:** ajuste local no `calendarFeed` (campo/action), validado por repro e teste de acesso.

## Questões em aberto (produto)

- Nenhuma — bug com causa raiz reproduzida; decisão é de execução.

## Referências

- GitHub Issue #392 (C16, intenção imutável)
- `docs/plans/sync-teqo-google-calendar.md` / `-impl.md`
- Repro local: create OK com `overrideAccess:true`; falha com `overrideAccess:false` + `user: campaignUser` (`calendarFeed` → campos `secretSlug`/`createdBy` com `setAccess` só admin)
