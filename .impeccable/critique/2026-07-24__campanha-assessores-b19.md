# Critique — /campanha/assessores (B19)

Date: 2026-07-24
Target: `src/app/(campaign)/campanha/(app)/assessores/` + `src/components/campaign/Advisor*`

## Scores (compact)

- Clarity under pressure: 4/5 — lista densa; badge "Planilha" sinaliza placeholder
- Edit where you see / auto-save: 4/5 — perfil por blur; carteira por chip (sem Salvar)
- Feel the action: 4/5 — pending na carteira + live region; toast no save
- Access / empty / error: 5/5 — gate unrestricted; empty search vs empty list; reset bloqueado em placeholder

## P0 / P1

Nenhum P0.

P1 resolvido na sessão: copy "Praças" no controle B9 tocado ao alinhar a mensagem de designação.

## Harden

- Form create: fieldErrors + safeMessages
- Empty states: sem assessores / busca vazia
- Reset desabilitado com razão quando e-mail é placeholder
- optimize: out

## Polish applied

- Import order na lista
- Bottom nav exclui Assessores explicitamente
- Unit tests para placeholder email + reloadUnrestrictedActor
