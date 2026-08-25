# 2026-08-25 — react-audit run: primeira varredura das 9 famílias, 6 fixes

Primeira run da skill `react-audit` (âncora de delta = repo inteiro; sem entrada anterior em
`docs/changelog/`). Sweep read-only por Tasks ad-hoc sobre as 9 famílias do catálogo fixo
(`.agents/skills/react-audit/anti-patterns.md`): 46 candidatos → triage com os três selos
(file:line conferido + família + fonte oficial) e dedup contra `docs/TECH-DEBT.md` (P4-G,
P5-D, P5-E, P6-K, P6-T, P6-V, row 25 etc. pulados). Cap de 6 fixes respeitado.

Branch `agent/react-audit-2026-08-25`, um commit por fix, gate completo bare verde por fix
(tsc/lint/format/knip/cycles/test/build), PR único ready SEM auto-merge (relatório
consolidado no body):

1. **F4 (C140 leftover)** — dispatch manual preserva texto digitado em erro de validação:
   `ActivityUpdateForm.tsx`, `ActivityResultForm.tsx`, `DemandWorkflowCard.tsx` (transição +
   custo), `MunicipalityUpdateDeliberation.tsx` (CommentThread). C140 (#740) fechou
   2026-08-23; estes 4 escaparam. Receita do precedente C139 (`ContactCreateRow.tsx:63-69`).
2. **F2** — `PetitionForm` recebe view model mínimo (`id/title/form.title/form.subtitle`) em
   vez do doc `Petition` inteiro (richText/consent/tracking ficam no server);
   `import type` no lugar do valor de `payload-types`.
3. **F5** — `Media.ts` ganha `afterChange`+`afterDelete` → `revalidateDocumentById('media')`;
   o cache cross-request de `getCachedDocumentById('media')` (5 leituras públicas) nunca era
   invalidado. Sem migração (hooks não são schema).
4. **F7** — `GoogleCalendarSyncDialog.tsx` anuncia falha assíncrona (`role="alert"` nos erros
   de "Sincronizar agora"/"Reativar").
5. **F1+F6 (B14)** — 4 sortable heads puros deixam de ser client e param de levar os
   serializadores `*ListUrl` ao bundle (contatos/pessoas/lideranças/dobradinhas).
6. **F3** — `CampaignNotificationBell`: sync de prop no render com guarda de `open`
   (prev-prop pattern) substitui o effect que podia ressuscitar o badge zerado.

Rejeitado com verificação: `priority` nas 4 imagens do hero (`CampaignHero.tsx`) — priority é
só para o LCP real, que já tem. Follow-ups registrados como Issues #915/#916/#917.
Nota honesta: 3 flakes calendar (#906) numa run de `pnpm test`, verdes isoladas.
