# Impl: E2E-ADMIN-LOGIN-LOCK — Serializar o login de UI do beforeEach do admin e2e

Status: aprovado (pendente gate humano)
Atualizado em: 2026-08-23
Issue: #805
Intenção: body da Issue #805 (dívida capturada no #760)
Appetite restante: ~0,25 dia

## Leitura da intenção

- **Outcome:** O `beforeEach` (UI form login) de `tests/e2e/admin.e2e.spec.ts` deve serializar com o mesmo advisory lock `727001` que `adminHeaders` (REST) já usa, para eliminar a janela de colisão worker(admin UI) × worker(adminHeaders lock) que pode perder sessão → 403 no e2e full.
- **O que NÃO negociar:** não trocar o login UI por API login (o spec testa genuinamente o formulário); não serializar o projeto inteiro/workers; não tocar o retry `campaignHomePixel` 403→relogin.
- **O que reavaliar:** além do `beforeEach`, o spec tem dois logins REST inline não-lockados (linhas 50 e 152) — mesma classe de corrida; rotear por `adminHeaders` fecha o spec inteiro.

## Abordagem recomendada

**Extrair um helper `withAdvisoryLock` + chave compartilhada `727001`; serializar o `login()` UI; e rotear os logins REST inline do spec por `adminHeaders`.**

```mermaid
flowchart LR
  subgraph helpers
    advisoryLock.ts[advisoryLock.ts<br/>ADMIN_LOGIN_LOCK_KEY=727001<br/>withAdvisoryLock()]
    login.ts[login.ts<br/>UI form + withAdvisoryLock]
    adminApi.ts[adminApi.ts<br/>adminHeaders usa withAdvisoryLock]
  end
  subgraph spec
    admin.e2e.spec.ts[beforeEach login() UI<br/>+:50,:152 REST via adminHeaders]
  end
  advisoryLock.ts --> login.ts
  advisoryLock.ts --> adminApi.ts
  login.ts --> admin.e2e.spec.ts
  adminApi.ts --> admin.e2e.spec.ts
```

**Opções consideradas:** A (helper + chave única + owner `login()` + rotear inline do spec) | B (duplicar bloco pg dentro de `login()`) | C (envolver `login()` no `beforeEach`) | D (não serializar inline REST do spec)

**Recomendação:** A — porque a chave precisa ser a mesma nos dois caminhos (UI × API fecham a corrida entre si); o helper evita twin do boilerplate pg; o lock dentro de `login()` deixa o owner do concern coberto para futuros chamadores; e os dois logins REST inline do spec são a mesma classe de corrida.

**Rejeitadas:** B (cria twin; o padrão já vive em `adminHeaders`); C (empurra responsabilidade para o spec, owner descobreto); D (mantém janela aberta dentro do próprio spec).

### Componentes / mudanças

- **`tests/helpers/advisoryLock.ts`** (novo): `ADMIN_LOGIN_LOCK_KEY = 727_001` + `withAdvisoryLock<T>(key, fn)` — abre `Client({ connectionString: process.env.DATABASE_URL })`, `pg_advisory_lock($1)` antes, unlock+end no `finally` (`.catch` no unlock, espelhando `adminApi.ts:37-40`).
- **`tests/helpers/adminApi.ts`**: refatorar `adminHeaders` para usar `withAdvisoryLock(ADMIN_LOGIN_LOCK_KEY, ...)`; remover const local `:8` e o client inline.
- **`tests/helpers/login.ts`**: envolver a submissão do formulário com `withAdvisoryLock(ADMIN_LOGIN_LOCK_KEY, ...)` em `try/finally` (lock antes do submit, release após dashboard renderizado, garantido mesmo se asserção falhar).
- **`tests/e2e/admin.e2e.spec.ts`**: substituir os dois `request.post(.../api/users/login)` inline (linhas 50-55, 152-157) por `adminHeaders(request, baseURL)`; importar de `../helpers/adminApi`.
- **Migration:** sem migration.
- **Access / Consent:** n/a (teste).
- **UI:** n/a (teste).

## Fases verificáveis

1. **Fase 1 — Helper:** criar `advisoryLock.ts`; refatorar `adminApi.ts`. → `pnpm typecheck`, `pnpm lint`.
2. **Fase 2 — Serializar UI login:** envolver `login.ts` com `withAdvisoryLock`. → `pnpm typecheck`, `pnpm lint`.
3. **Fase 3 — Inline REST do spec:** rotear por `adminHeaders`; remover bloco inline órfão. → `pnpm lint`.
4. **Fase 4 — Verificação (OPS72):** rodar admin e2e isolado e o full com 4 workers; confirmar ausência de 403 por sessão perdida.

## Rabbit holes / Não escopo (engenharia)

- NÃO trocar UI login por API login; NÃO serializar projeto/workers; NÃO tocar `campaignHomePixel` retry.
- **Fora:** `frontend.e2e.spec.ts:613` (shadow local não-lockado de `adminHeaders`) — próprio plano, não agravado por este fix.
- Sem migration/schema/UI; só `tests/helpers/*` e `tests/e2e/admin.e2e.spec.ts`.

## Riscos e mitigação

- **Release do lock:** lock fica preso até o dashboard renderizar; `finally` garante release em falha de asserção (evita travar o próximo worker).
- **Timing novo:** `login()` abre conexão pg por login; impacto mínimo (dezenas por run).
- **`withAdvisoryLock` é só p/ serialização de teste `_test`** — nunca promover a lock de produção.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (UI login serializado na mesma chave)
- [x] Invariantes AGENTS/engineering-standards (reusa padrão existente; sem twin)
- [x] Testes de domínio: verificação via e2e admin isolado + full-4-workers
