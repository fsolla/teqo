# Impl: S11-POLISH — rota de sync: 200 ok:false em não-configurado e tipo de persist duplicado

Status: aprovado
Atualizado em: 2026-08-24
Issue: #761
Intenção: body da Issue #761 (débito P3 do /simplify da S11, sem plano externo)
Appetite restante: ~0.5 dia (polish P3, sem migration)

## Leitura da intenção

- **Outcome:** alinhar o contrato da rota `POST /api/social-feed/sync` com o impl doc da S11 e eliminar a duplicação de tipo `InstagramPersistDatabase` ↔ `PostgresTransactionDatabase` sem mudar comportamento observável da home, da global ou do painel.
- **O que NÃO negociar:** home permanece fail-closed (YouTube+artigos quando IG falha); token nunca fora do admin; sem wizard OAuth; painel só mostra estado persistido (5 estados do rascunho); sem histórico/alertas. Achados 3 (`jsonb` last-writer-wins) e 4 (`admin.e2e` guard `· 5 posts`) ficam registrados e fora deste escopo — o issue body já os marca como débito absorvido/defer.
- **O que reavaliar:** hipótese do débito 1 de que o desacoplamento via tipo duplicado evita dependência do módulo de locks — na prática `instagramSync.ts` já importa `getPostgresTransactionDatabase`; tipo é `type-only`, sem custo de runtime. Hipótese do débito 2 de que `200 { ok:false, status:{} }` é defensivo porque o botão não renderiza quando `!configured` — verdade para UI, mas o contrato HTTP deve ser 400 para caller direto (curl/test) como o impl doc previa.

## Abordagem recomendada

```mermaid
flowchart LR
  A[POST /api/social-feed/sync] --> B{isInstagramFeedConfigured?}
  B -->|não| C[400 { ok:false, error }]
  B -->|sim| D[syncInstagramFeed]
  D --> E[200 { ok, status }]
  F[instagramFeed.ts<br/>InstagramPersistDatabase] -.-> G[postgresTransactionLocks.ts<br/>PostgresTransactionDatabase<br/>owner]
  G --> F
```

**Opções consideradas:** A | B | C
**Recomendação:** A — rota devolve 400 com `error` quando IG não configurado; tipo de persist deduplicado via alias `InstagramPersistDatabase = PostgresTransactionDatabase` cujo owner é `postgresTransactionLocks.ts`.
**Rejeitadas:** B) manter `200` e atualizar impl doc para documentar `200` (esconde erro de cliente como sucesso; quebra semântica REST e diverge de todo outro guard da rota que usa 4xx) | C) extrair interface genérica `DatabaseWithExecute` em `utilities/db.ts` (1 nível a mais para 2 call sites; viola depth check — o owner já existe e é `postgresTransactionLocks.ts`).

### Decisões de engenharia

1. **Status HTTP para não-configurado: 400 em vez de 200.**
   Opções: A) rota retorna `400 { ok:false, error:'Instagram não configurado' }` quando `syncInstagramFeed` indica não-configurado | B) manter `200 { ok:false, status:{} }` e corrigir impl doc | C) rota chama `isInstagramFeedConfigured` antes do sync e retorna 400 sem chamar `syncInstagramFeed`.
   Recomendação: A com variante leve de C — a rota checa `isInstagramFeedConfigured` via `syncInstagramFeed` já fazer o check: o mais barato é fazer a rota inspecionar o outcome: se `!ok && status vazio` → 400. Alternativa ainda mais explícita: a rota re-lê a global e checa `isInstagramFeedConfigured` antes de chamar `sync` (1 read extra mas sem custo de API) e retorna 400. Escolher a variante sem read extra (outcome vazio → 400) para não adicionar query.
   Rejeitadas: B porque 200 mente sobre sucesso e o painel já trata `!response.ok` como erro (linha 101 do `InstagramSyncStatusPanel.tsx`: `if (!response.ok || body.error) throw`) — 400 cai no caminho de erro existente sem mudar UI; C adiciona round-trip desnecessário quando o sync já sabe que não está configurado.
   → Contrato: `POST /api/social-feed/sync` → não-configurado: `400 { ok:false, error:'Instagram não configurado — informe token e ID da conta.' }`; configurado: `200 { ok, status }` (sucesso ou falha da Graph API). `revalidateTag` só roda no caminho 200.

2. **Deduplicação de tipo `InstagramPersistDatabase`.**
   Opções: A) `instagramFeed.ts` importa `PostgresTransactionDatabase` e re-exporta `export type InstagramPersistDatabase = PostgresTransactionDatabase` (alias compatível) | B) remover `InstagramPersistDatabase` e migrar todos os consumidores para `PostgresTransactionDatabase` | C) manter duplicação.
   Recomendação: A — owner único (`postgresTransactionLocks.ts`), `instagramFeed.ts` vira alias type-only (sem duplicar shape `{ execute }`), `instagramSync.ts` passa a importar `PostgresTransactionDatabase` diretamente para `resolvePersistDatabase`. Mantém compatibilidade de import path para quem ainda importa `InstagramPersistDatabase` de `instagramFeed.ts` (nenhum teste externo hoje, mas sem churn).
   Rejeitadas: B exige mudar assinatura pública de `persistInstagramSnapshot`/`persistInstagramSyncStatus`/`persistInstagramAccessToken` em 3 lugares só por rename — churn sem ganho; C mantém débito técnico exatamente como reportado (2 definições estruturais idênticas).
   → Futura remoção do alias pode ser feita quando todos os call sites migrarem, sem pressa.

### Componentes / mudanças

- **`src/utilities/socialFeed/instagramFeed.ts`** (editar): importar `PostgresTransactionDatabase` de `@/utilities/postgresTransactionLocks`; substituir definição estrutural de `InstagramPersistDatabase` por `export type InstagramPersistDatabase = PostgresTransactionDatabase` (alias + comentário apontando owner); assinaturas de `persistInstagramSyncStatus`/`persistInstagramSnapshot`/`persistInstagramAccessToken` passam a usar `PostgresTransactionDatabase | null` (via alias mantém compat).
- **`src/utilities/socialFeed/instagramSync.ts`** (editar): importar `PostgresTransactionDatabase` (ou manter alias via `instagramFeed.ts`); `resolvePersistDatabase` retorna `Promise<PostgresTransactionDatabase | null>`; sem mudança de lógica.
- **`src/app/(frontend)/api/social-feed/sync/route.ts`** (editar): após `syncInstagramFeed`, se `!outcome.ok && Object.keys(outcome.status).length === 0` → `400 { ok:false, error:'Instagram não configurado — informe token e ID da conta.' }` (sem `revalidateTag`); senão `200 { ok, status }` + `revalidateTag`. Mantém 401/403/500 existentes.
- **`tests/unit/instagramSync.unit.spec.ts`** (editar/estender): novo caso "rota retorna 400 quando não configurado" não cabe em unit sync — cobrir em teste de rota leve ou em unit da rota se existir; no sync unit, garantir que `outcome` vazio ainda é `{}` para o gate da rota funcionar. Opcional: teste de tipo (tsc) confirma alias.
- **`docs/plans/feed-instagram-nao-aparece-home-impl.md`** (sem alteração necessária): já previa `400 { ok:false, error }` — após fix o código alinha, doc fica correto.
- **Migration:** sem migration (sem coluna nova).
- **Access / Consent:** sem mudança (rota já exige `users` + `isSameOriginRequest`; sem PII novo).
- **UI:** sem mudança visual no painel; `InstagramSyncStatusPanel.tsx` já trata `!response.ok` como erro — 400 cai no `throw` → `requestError` genérico, mas botão nem renderiza quando `!configured` (early return), então 400 só é observável via curl/test direto, como pretendido.

### Dados → forma (se aplicável)

Não aplicável — sem KPI/métrica nova. Status continua shape `{ lastSyncAt?, postCount?, error?, errorAt? }` jsonb.

## Fases verificáveis

1. **Tipo + rota (tracer)** — editar `instagramFeed.ts` alias + `instagramSync.ts` import + `route.ts` branch 400; `pnpm tsc --noEmit`; `pnpm test` (unit `instagramSync`); curl manual: `POST /api/social-feed/sync` sem credenciais → 400 com `error`, com credenciais stub ok → 200.
2. **Gates** — `pnpm gate:fast` (lint+type+unit); `pnpm test` full local; `pnpm build` local (importmap); sem e2e novo obrigatório — e2e existente de sync deve continuar verde (retry quando configured).

## Rabbit holes / Não escopo (engenharia)

- Não versionar `instagramSyncStatus` com seq/timestamp para mitigar last-writer-wins (achado 3) — defer com gatilho: se regressão for observada em item futuro, versionar.
- Não mudar `admin.e2e.spec.ts` assert `· 5 posts` (achado 4) — guard intencional.
- Não extrair módulo genérico de DB nem mover `resolvePersistDatabase` para lib compartilhada.
- Não paginar feed nem tocar no refresh-token flow.
- Não adicionar histórico de sync nem dashboard.

## Riscos e mitigação

- **Rota 400 quebra painel que espera 200:** mitigado — painel já confere `!response.ok` (linha 101) e mostra `requestError`; e o botão não existe quando `!configured`, então o 400 nunca é exercitado pela UI normal. Teste manual do painel em 3 estados (não configurado/desativado/falha) confirma.
- **Alias type quebra build:** `PostgresTransactionDatabase` é `server-only` mas type-only import é eliminado em build; confirmar `pnpm build` e `payload generate:types` sem erro.
- **Outcome vazio colide com falha real da Graph API que também retorna status vazio:** não colide — falha real sempre escreve `failedInstagramSyncStatus` com `error`+`errorAt`, nunca `{}`; só o caminho não-configurado retorna `{}`.

## Aceite de engenharia

- [ ] Aceite de produto ainda coberto: botão só quando configured; rota 400 para não-configurado alinha impl doc ↔ código; tipo deduplicado sem mudar semântica de persist; painel inalterado visualmente
- [ ] Invariantes AGENTS/engineering-standards: sem nova collection; sem Consent novo; `overrideAccess:false` preservado; rota mantém `isSameOriginRequest` + `payload.auth` users-only; alias type-only sem runtime coupling
- [ ] Testes de domínio previstos: unit do sync (status vazio) + verificação manual da rota 400 vs 200; tsc gate

Self-score decision-quality: 5/5 (opções + rejeitadas em 2 decisões caras, appetite respeitado, rabbit holes nomeados, reusa owner existente, outcome preservado).
