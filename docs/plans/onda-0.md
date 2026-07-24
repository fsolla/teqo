# Onda 0 — go-live MVP (Consent + privacidade)

Status: implementado (engenharia)
Atualizado em: 2026-07-19
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Onda 0 — Caminho crítico para `/campanha` em produção)
Responsável: —

## Contexto

O MVP de Núcleos e o cadastro nominal de apoiadores (C2) estão em `main` e falham fechado sem as chaves estáveis de `Consent` e sem o Aviso de Privacidade publicado. A assessoria jurídica eleitoral ainda não entregou os textos finais; para desbloquear engenharia, QA e smoke operacional, a Onda 0 provisiona **textos provisórios** automaticamente em local e produção via migrations, com hold explícito de PII real até revisão jurídica.

## Objetivos

- Provisionar automaticamente (local + prod via `pnpm migrate` / build Vercel) as quatro chaves de `Consent` e o Global `privacy-policy` publicado.
- Expor `/privacidade` no site público e corrigir links mortos (Footer, ficha de apoiador).
- Manter fail-closed do runtime; não cadastrar lideranças/apoiadores **reais** antes da assessoria eleitoral substituir os textos.
- Oferecer `pnpm db:seed:consent` como espelho idempotente para re-aplicar textos após edição no repo.

## Decisões travadas

- **Assessoria provisória no MVP (2026-07-19).** A implementação redige textos utilizáveis em pt-BR com banner de status provisório. Não substituem parecer jurídico nem RIPD formal.
- **Provisionamento automático.** Migration de schema (`privacy-policy` global) + migration de dados (`seed_onda0_consent_and_privacy`) aplicadas no deploy; sem passo manual de colar no admin.
- **Hold de PII real.** Não importar CSV real, não convidar lideranças reais, não cadastrar apoiadores reais até substituição dos textos pela assessoria eleitoral.
- **Fonte canônica dos textos:** [`src/lib/onda0ConsentTexts.ts`](../../src/lib/onda0ConsentTexts.ts) + [`src/utilities/onda0Provision.ts`](../../src/utilities/onda0Provision.ts).
- **i18n e naming** seguem o AGENTS.md: identificadores em inglês (`privacy-policy`, `provisionOnda0ConsentAndPrivacy`); strings visíveis em pt-BR.

## Chaves de Consent

| Chave                         | Uso                                                    |
| ----------------------------- | ------------------------------------------------------ |
| `lideranca-autopreenchimento` | Convites / autopreenchimento de liderança              |
| `apoiador-cadastro`           | Cadastro nominal de apoiador                           |
| `apoiador-intencao-voto`      | Intenção de voto (dado sensível — art. 11 LGPD)        |
| `campanha-notificacoes-push`  | Opt-in push (D2; chave provisionada, UI push pendente) |

## Provisionamento

### Automático (local + produção)

1. `20260719_054706_add_privacy_policy_global` — schema do Global.
2. `20260719_054707_seed_onda0_consent_and_privacy` — upsert Consent ×4 + `privacy-policy` (`published: true`).

Aplicado por `pnpm migrate` localmente e por `payload migrate` no `pnpm build` da Vercel.

### CLI espelho (re-seed)

```bash
pnpm db:seed:consent
# Neon (somente re-seed consciente pós-revisão jurídica):
ALLOW_REMOTE_DB=true pnpm db:seed:consent
```

Refusa host não-local sem `ALLOW_REMOTE_DB=true` (mesma família de guard que `db:seed:tse`).

## Substituição pelos textos finais

1. Assessoria eleitoral aprova textos definitivos.
2. Atualizar [`src/lib/onda0ConsentTexts.ts`](../../src/lib/onda0ConsentTexts.ts).
3. Nova migration de dados **ou** `ALLOW_REMOTE_DB=true pnpm db:seed:consent` em produção.
4. Aceites com `contentHash` antigo exigem novo checkbox (comportamento existente).
5. Só então liberar coleta de titulares reais (lideranças, apoiadores, import CSV).

## Smoke (dados fictícios apenas)

**Local (PR):**

1. `pnpm migrate` (ou `db:seed:consent` se iterando textos).
2. Login `/campanha` → abrir um município e registrar dado fictício de teste.
3. Convite com Consent visível (contato fictício).
4. Apoiador de teste (+ intenção de voto opcional).
5. GET `/privacidade` com banner provisório.

**Produção (pós-deploy):**

1. Confirmar env: `NEXT_PUBLIC_SITE_URL` HTTPS, `PAYLOAD_SECRET`, `DATABASE_URL`, `BLOB_*`, `REVALIDATE_SECRET`.
2. Migrations aplicadas no build.
3. Bustar cache de `/privacidade` (migration SQL não dispara `afterChange` no runtime deployado):

```bash
curl -X POST "https://<prod-domain>/api/revalidate?tag=global_privacy-policy" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET"
```

4. Smoke com **dados fictícios**; não importar CSV real nem convidar titulares reais.

## Onboarding staff (sem PII de campo)

- Criar `campaignUser` `geral`/`coordenador` via `/admin`.
- Estruturar municípios de teste, agenda, baseline TSE.
- Treinamento de campo com titulares reais **após** revisão jurídica.

## RIPD

Ver [onda-0-ripd-nota-mvp.md](onda-0-ripd-nota-mvp.md) — nota interna; não substitui RIPD formal da assessoria.

## Não escopo

- D2 push / VAPID.
- Known Gap #2 (Consent por ID nos fluxos públicos).
- Collection `Pages`.
- RBAC em `users`.
- Seed de lideranças/apoiadores reais.

## Referências

- [`docs/roadmap.md`](../roadmap.md) § Onda 0
- [`docs/plans/escala-dry-pos-onda0.md`](escala-dry-pos-onda0.md) — débitos técnicos pós-`/simplify` (revalidate globals, chaves Consent, testes SQL)
- [`docs/plans/cadastro-nominal-apoiadores.md`](cadastro-nominal-apoiadores.md)
- [`docs/plans/notifications.md`](notifications.md)
- [`src/collections/Consent.ts`](../../src/collections/Consent.ts)
- [`src/globals/PrivacyPolicy.ts`](../../src/globals/PrivacyPolicy.ts)
- AGENTS.md — Consent por chave, fail-closed, checklist deploy

## Revisões

- **2026-07-19:** Plano criado na implementação Onda 0 — textos provisórios MVP, provisionamento automático local+prod, hold de PII real.
- **2026-07-19:** Débitos do `/simplify` registrados em [escala-dry-pos-onda0.md](escala-dry-pos-onda0.md) (O0+).
