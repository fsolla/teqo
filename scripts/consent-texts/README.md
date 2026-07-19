# Consent texts (Onda 0)

Canonical source: [`src/lib/onda0ConsentTexts.ts`](../../src/lib/onda0ConsentTexts.ts).

Provisioning runs via:

- Migration `20260719_054707_seed_onda0_consent_and_privacy` (local + produção no deploy)
- CLI `pnpm db:seed:consent` (re-aplicar após editar os textos)

Keys: `lideranca-autopreenchimento`, `apoiador-cadastro`, `apoiador-intencao-voto`, `campanha-notificacoes-push`, plus Global `privacy-policy`.

These are **provisional MVP** texts. Real leadership/supporter PII stays on hold until electoral counsel approves final copy — see [`docs/plans/onda-0.md`](../../docs/plans/onda-0.md) and [`docs/roadmap.md`](../../docs/roadmap.md) § Onda 0.
