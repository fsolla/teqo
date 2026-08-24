# O88+ — Guard de banco único: `parseDatabaseUrl()` compartilhado + spec do wiring do `db:reset`

Status: rascunho
Atualizado em: 2026-08-24
Issue: (registrada pelo agent:register — O88+)
Intenção: follow-up de engenharia da entrega OPS88 (#834) — não tem plano de intenção próprio
Priority: P3
Impeccable: A — N/A sem UI
Rascunho UI: N/A
Appetite: ~0,5 dia eng (fill-in)
Responsável: —

## Origem

Achado S1 (e S2 dobrado) do `/simplify` da entrega OPS88, triage `capture-review-debts` (2026-08-24): o shape do guard de DATABASE_URL (unset → parse → protocolo → host → decode do nome) existe **3×** — `scripts/db-reset.mjs`, `tests/helpers/assertTestDatabase.ts`, `scripts/assert-local-database.mjs` — e já derivou: `new URL('postgresql://[::1]:5432/…').hostname` retorna `'[::1]'` (com colchetes); a suíte aceita, o `db:reset` recusa. Fail-closed, mas conhecimento duplicado derivando. `decodeURIComponent` sem try/catch em `assertTestDatabase.ts` (URIError não rotulado) morre junto.

## Intenção

Um helper `parseDatabaseUrl()` em `scripts/lib/cli.mjs` — fonte única do parse com erros rotulados e normalização de colchetes IPv6 — consumido pelos 3 guards; e o wiring do guard do `db:reset` extraído como função exportável unit-testável (hoje só o regex é pinado em `localHosts.unit.spec.ts`).

## Fases

1. **`parseDatabaseUrl(databaseUrl, label)` em `cli.mjs`** — parse+protocolo+host+decode com mensagens rotuladas e normalização `[::1]`→`::1` (unifica o aceite dos 3 guards); unit spec: protocolo não-postgresql, URL inválida, percent-encoding inválido (S2), hostname IPv6 com colchetes, decode de nome. Mata a cópia em `assertTestDatabase.ts` (Set inline local morre) e o host-check de `db-reset.mjs`.
2. **Rewire dos 3 call sites** — `db-reset.mjs` (host+nome), `assertTestDatabase.ts` (o Set local sai; hosts ficam os mesmos do contrato), `assert-local-database.mjs` (host-only, sem mudança de comportamento) + spec do wiring do reset (guard exportado, casos: recusa host remoto, recusa `teqo`, aceita `teqo_wt<n>_test`).
3. **Gates** — `pnpm gate:fast`; int full (o pin `tests/int/assertTestDatabase.int.spec.ts` deve continuar verde sem edição — comportamento idêntico exceto o fix deliberado de paridade `[::1]`); changelog.

## Decisões

- **Opções:** A) extrair `parseDatabaseUrl` agora (este item) | B) duplicar a 4ª vez quando vier o próximo guard | C) só normalizar `[::1]` no `LOCAL_HOSTS`.
- **Recomendação:** A — 3 cópias de um guard de segurança já derivaram 1×; a extração dá alvo unit-testável para o wiring do reset (hoje sem spec). B foi a regra de DRY <3 call sites, superada pelo 3º call site + drift real; C trataria o sintoma e deixaria o shape triplicado.
- **Rejeitadas:** B (defer sem gatilho de correção do drift); C (remendo local, não mata a cópia de conhecimento).

## Já resolvido no simplify (não reabrir)

- Condição do reset no `gate-ci` (forma positiva + preflight estendido) — aplicado na sessão.
- Erros rotulados no `db-reset` (`die('reset failed: …')` + decode protegido) — aplicado.
- Docs canônicos (`TESTING.md`, `AGENT-OPS.md`) para o setup único — aplicado.
- Comentários de allowlist legado (`postgres-build` dormant) — aplicado.

## Explicitamente fora

- **S3 — prune de `'postgres-build'` das allowlists:** descartado — churn de allowlist fail-closed sem ganho funcional; re-descrito como legado na sessão.
- **S4 — `parsedUrl.protocol || '(unknown)'` defensivo-morto:** descartado — mantido por consistência de shape com o irmão; morre por consequência na Fase 1.

## Rabbit holes

- Não mexer na semântica de nenhum guard (hosts admitidos idênticos; só o `[::1]` ganha paridade documentada no unit).
- Não tocar `assertTestDatabase.int.spec.ts` — se a Fase 1 exigir edição, é sinal de mudança de comportamento; parar e reavaliar.
- Não unificar os 3 guards num único (o contrato de `assertLocalDatabase` — override `ALLOW_REMOTE_DB` — é deliberadamente ausente do `db:reset`).
