# Débito — runner Playwright bare regenera importMap sem envs S3

Intenção: o processo do runner Playwright (workers) carrega o
`payload.config.ts` via `getPayload` sem as envs `S3_*` (o `loadEnv` do
`playwright.config.ts` só vale para o main process) e o Payload regenera
`src/app/(payload)/admin/importMap.js` SEM o handler
`@payloadcms/storage-s3/client#S3ClientUploadHandler` (classe OPS69 —
admin em branco; guard #87 cobre no CI, mas o diff local fica sujo e o
risco de o guard não pegar existe). Fix: definir envs `S3_*` dummy (valores
de teste, all-or-nothing) no env do `webServer` e no bloco bare do
`playwright.config.ts` (main process + workers) — ou, alternativa,
documentar + aceitar o diff sujo com restauração manual (status quo).
Aceite: `playwright test --list` e um run real não sujam o `importMap.js`.
