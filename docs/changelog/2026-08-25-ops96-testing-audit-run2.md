# 2026-08-25 — testing-audit run 2: 4 movimentos int→unit + fix do metrics, recidiva #906 com resíduo

Segunda execução da skill `/testing-audit` na mesma data (relatório `docs/testing-audits/2026-08-25-run2.md`; a run 1 vive em `2026-08-25.md`). Inventário por 3 leitores read-only → rubrica validada contra o fonte → 5 melhorias com prova verde antes/depois e commits separados, PR único ready SEM auto-merge (desarme via `testing-audit-disarm.mjs`, rearm pós-push):

1. **M1** — `payloadTransaction` int→unit (10 testes; stub puro, zero Payload/DB).
2. **M2** — `contactPhoneNormalization` int→unit (4; hook do Contact via stub).
3. **M3** — pins zod de `municipalityUpdateCreateSchema` extraídos do spec int que boota Payload → unit (2; Local API permanece int).
4. **M4** — helpers puros de identidade do `campaignAuth.int.spec` (telefone/schema/whatsapp/guarda de migração) → unit (13; RBAC do arquivo intacto).
5. **F1** — `parseVitestStdout` no core do metrics: suite vermelha voltou a imprimir o retrato (sufixo `ELIFECYCLE` do pnpm quebrava o parse; +5 testes unit no spec do core).

Conservação exata em todos os movimentos (unit+int = 3361). Nenhum teste removido; intocáveis (LGPD/RBAC/lockdown/e2e/estruturais) sem diff.

**Flake #906 recidivou com nova assinatura**: 7 runs full verdes → 8 runs com falhas só na família Google Calendar (1 falha com `VITEST_MAX_WORKERS=1`); `google_calendar_sync` acumula 38 linhas de resíduo por run full e o teste "no-op…not-configured" (`googleCalendarSyncAction.int.spec.ts:145`) lê doc residual; `db:reset` não curou. Fixes pertencem à Issue #906; nada editado na família à noite.
