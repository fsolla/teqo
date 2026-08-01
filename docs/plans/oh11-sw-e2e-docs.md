# OH11 — SW `/_next/static` cache-first + e2e offline + docs

Status: rascunho
Atualizado em: 2026-08-01
Issue: #173
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (SW + testes + docs; sem UI nova)
Appetite: ~1,5 dias eng
Depends: OH9, OH10
Responsável: —

## Premissas

1. SW artesanal mantido ([`src/utilities/campaignPwa.ts`](src/utilities/campaignPwa.ts)); Serwist adiado.
2. RSC/Flight continua **network-only**; convites nunca cacheados; ícones cache-first (actual).
3. Compressão do snapshot (gzip) só entra se o benchmark OH3 recomendar — caso contrário fora.

→ Corrija agora ou sigo com estas.

## Objetivos

- SW: cache-first para `/_next/static/` same-origin (chunks hashed) com limpeza por build (prefixo `campanha-<buildId>` actual).
- E2E offline completo: open → sync → airplane → detalhe Local + listas Local (se OH12 já mergeada; senão só detalhe) → write → reload → online → sync.
- Logout limpa persistence `campaignOps` + caches (ordem OH1).
- Docs: entrada em `docs/CHANGELOG-AGENTS.md` + nota no plano-mãe.

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

- **`buildCampaignServiceWorkerScript`** (alterado): novo branch `isNextStaticPath(pathname)` → `cacheFirst(request)` (reusa helper existente dos ícones); **antes** do guard RSC; nunca escreve RSC no Cache Storage (regra mantida).
- **`clearCampaignPwaCaches`** (estendido): wipe também do storage `campaignOps` (persistence + outbox) — ordem: abort sync → outbox → persistence → caches.
- **E2E:** `tests/e2e/campaign-ops-offline.e2e.spec.ts` — cenário completo com `OPS_HYBRID=1` no config do Playwright para esta spec.
- **Unit:** `tests/unit/campaignPwa.unit.spec.ts` — static cache-first, RSC nunca, convite nunca.

## Fases verificáveis

### Fase 1 — SW static + logout

- **Quota:** ~0,5
- **Aceite:**
  - [ ] chunks `/_next/static/` servidos do cache na 2ª visita offline
  - [ ] RSC/Flight nunca cacheado (pin existente mantido)
  - [ ] logout limpa persistence + outbox + caches (ordem documentada no código)
- **Verify:** `pnpm gate:fast` + `campaignPwa.unit.spec.ts`
- **Files:** `campaignPwa.ts`, `campaignPwaClient.ts`, spec unit
- **Tamanho:** M

### Fase 2 — E2E offline + docs

- **Quota:** ~0,5
- **Aceite:**
  - [ ] cenário write→reload→online→sync verde
  - [ ] CHANGELOG + plano-mãe actualizados
- **Verify:** `pnpm gate:fast` + e2e offline
- **Files:** spec e2e, docs
- **Tamanho:** M

## Dependências

- OH9 (detalhe Local), OH10 (writes). Se OH12 estiver mergeada, e2e cobre listas também.

## Não escopo

- Serwist; push/notifications (D2 próprio); compressão do snapshot (condicional ao benchmark).

## Rabbit holes

- **Cachear HTML de rotas staff “para abrir offline”.** Payload autenticado no Cache Storage = risco. **Mitigação:** só shell actual + static.
- **Background Sync API do browser para o outbox.** Cobertura/semântica fraca vs offline-transactions. **Mitigação:** fora.

## Referências

- [`src/utilities/campaignPwa.ts`](src/utilities/campaignPwa.ts)
- [`src/utilities/campaignPwaClient.ts`](src/utilities/campaignPwaClient.ts)
- [`docs/CHANGELOG-AGENTS.md`](docs/CHANGELOG-AGENTS.md)
