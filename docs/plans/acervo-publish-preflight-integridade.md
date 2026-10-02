# Plano curto: C249 — archive:publish com preflight de integridade

Status: proposto (triage do C246, 2026-10-02)
Issue: C249 (a registrar; `depends: [C246]`)
Appetite: ~0,5 dia eng. Sem migration, sem UI, sem mudar contrato público.

## Contexto

O C246 rebaixa a `draft` a foto irrecuperável (objeto quebrado/ausente) e o
`pnpm archive:publish` (C242) aprova **todo** draft sem olhar o objeto — um
publish depois de um `--apply` pode devolver ao público uma foto quebrada
(500 em `/fotos/<id>/midia`). Hoje a mitigação é só o aviso do runbook
(`docs/ops/teqo-1313-deploy.md`, seção C246): "não rode o publish depois de um
reparo sem varredura limpa".

## Fases

1. **Preflight na fila do publish (~70%):** no `--apply` (e no plano, para o
   operador ver antes), cada draft elegível passa pelo `inspectPrivateMediaObject`
   do C246; objeto fora de `ok` **não é aprovado**, entra no recibo como
   `skippedBroken` (id, stage, reason) e o comando sai 1 se houver puladas. A
   query da fila passa a selecionar `filename` além de `id`. Reusa o dono da
   varredura e o `scripts/lib/archivePublishPlan.mjs` (summarize/format ganham a
   chave) — sem varredura própria na CLI do publish.
2. **Provas (~20%):** unit do summarize/format com `skippedBroken`; int: draft
   com objeto íntegro é aprovado, draft com objeto removido/corrompido fica
   `draft` e é nomeado no recibo; spawn da CLI pinando os guardas atuais.
3. **Runbook (~10%):** atualizar a seção C246/C242 do `teqo-1313-deploy.md` —
   o aviso deixa de ser a única proteção.

## Rabbit holes / Não escopo

- Não reparar objeto no publish (reparo é C246): só pular e nomear.
- Não varrer `media`, vídeos ou outras collections; não tocar `removed`.
- Não mudar as guardas/confirm do publish; sem migration nem campo novo (o
  `skippedBroken` vive no recibo, não no schema).
- Não adicionar cache/revalidação além do que o publish já manda.

## Aceite

- [ ] `archive:publish --apply` nunca aprova draft com objeto quebrado.
- [ ] Recibo nomeia cada pulada com stage/motivo; exit 1 se houver puladas.
- [ ] Int cobre aprovadas e puladas; guardas do publish intactos; runbook atualizado.
