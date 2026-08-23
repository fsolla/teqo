# Impl: Cutoff de transição (fase 1) — desativar o acesso ao site pela URL pt.jorgesolla.com.br (congelar a fonte)

Status: rascunho
Atualizado em: 2026-08-23
Issue: #796
Intenção: docs/plans/ops80-cutoff-desativar-url-antiga.md
Appetite restante: herdado (~1 dia eng)

## Leitura da intenção

- **Outcome:** `pt.jorgesolla.com.br` para de servir o app (nenhuma nova sessão/form/escrita via URL antiga); a fonte fica congelada sem novo write no take antigo até a migração de dados do OPS79 e o redirect do OPS81. O vertical canônico de campanha (`jorgesolla1313.com.br/campanha`) segue 100% sem regressão.
- **O que NÃO negociar:**
  - Nenhuma escrita possível via URL antiga a partir do cutoff → a "lacuna de dados entre última migração e desativação" fica estruturalmente impossível.
  - Sem redirect antigo→canônico (é OPS81, depois do OPS79).
  - `NEXT_PUBLIC_SITE_URL` permanece canônico (governa invite/calendarFeed/syncs/passwordReset/WebAuthn via `getCampaignInviteBaseURL`) — não mexer na lógica.
  - Sem regressão no `/campanha` canônico (auth WebAuthn/invite/same-origin mutação e o PWA).
- **O que reavaliar:** o deliverable de CÓDIGO é só eliminar/atualizar cada referência in-repo a `pt.jorgesolla.com.br` para que nada do repo aponte/enconde a URL antiga como verdade. Desativação de DNS/hosting é INFRA (fora do app). Não há URL antiga em runtime não-test (o app é 100% canônico via env) — o trabalho é limpar fixtures/verbosidade/operação de default e personas que ainda citam a fonte antiga.

## Abordagem recomendada

**Opções consideradas:** A | B | C

**Recomendação:** **B — troca textual pontual da URL antiga → canônica no (A) código/testes/operacional e (C) personas de agente; docs históricos (B) intocados; referências de conteúdo `jorgesolla.com.br` (sem pt/1313) intocadas; fallback `next.config.mjs`/`apoiadores` intocado.** A intenção é narrow e bem definida; o risco está em sobrescopar. Manter docs como história (37signals: build less) e não tocar em fonte de conteúdo controla o diff ao mínimo correto.

**Rejeitadas:**

- A (alterar também docs históricos de ops): as impl-plans `ops50*`, `ops51*`, `ops52-*-impl`, `c98-impl`, `c115-impl`, `push-notificacoes-impl`, `revalidate-secret-vercel-production-impl`, `ci-deploy-cooldown-15min`, `CUTOVER-MAIN-ONLY` documentam o estado passado (são "history, not locks" — a própria intenção diz). Editá-los não muda runtime e suja o diff; recomendo deixar como história. `docs/CHANGELOG-AGENTS.md` é append-only e NUNCA editado à mão — fora de qualquer hipótese.
- C (reaproveitar Vercel/preview host como canônico): o host de preview `teqo-git-b40-solla.vercel.app` no teste WebAuthn é o caso de DENIAL intencional (host distinto do configurado) — preservar.
- D (tocar `next.config.mjs` L4 / `apoiadores/[id]/page.tsx` L82): esses defaults `https://jorgesolla.com.br` (minúsculo, sem pt/1313) são a base/fallback da origem WordPress para share-metadata de conteúdo — NÃO é a URL antiga do app (`pt.jorgesolla.com.br`). Alterá-los risca alterar o comportamento de links públicos apoiadores/posts sem benefício para o cutoff. Fora de escopo. (Se um produto futuro unificar o domínio canônico no share-metadata, isso é outra issue.)
- E (`jorgesolla.com.br` como CONTEÚDO): seed/recover-media/CalendarFeed `UID:...@teqo.jorgesolla.com.br` wpArticles são refs de FONTE DE CONTEÚDO, não a URL antiga — nenhum toque.

### Componentes / mudanças

- `scripts/check-push-chain.mjs`:
  - L13 (usage comment) `[--site https://pt.jorgesolla.com.br]` → `https://jorgesolla1313.com.br`.
  - L47 default `'https://pt.jorgesolla.com.br'` → `'https://jorgesolla1313.com.br'` (operational default real da ferramenta — é a única mudança que afeta runtime/verdicto por omissão).
  - L49 erro de exemplo `https://pt.jorgesolla.com.br` → canônico.
  - L15-16 e L85: prosa operacional stale (Neon unpooled / `vercel env pull`) → semântica homeserver (`~/stack/teqo-1313.env`, `DATABASE_URL` do `teqo_1313`). Nota-chave: a mensagem de erro já texto falls no homeserver (L49-50 do bloco `die`); alinhar o texto prosa restante à mesma semântica.
- `tests/unit/campaignWebAuthnConfig.unit.spec.ts`: `configuredURL`/`forwardedHost`/`rpID`/`origin` nos casos prod (L17,18,21,32) e descrições/nomes de teste ("canonical HTTPS origin in production", "canonical origin here", "a production build is served there") → `jorgesolla1313.com.br`. **Preservar** o caso preview (L33 `teqo-git-b40-solla.vercel.app`) — é o DENIAL por host distinto (semântica intacta: canônico configurado vs host servido `*.vercel.app` → `toBeNull()`).
- `tests/unit/campaignJsonMutationRoute.unit.spec.ts`: L27 (`new Request('https://pt.jorgesolla.com.br/...')`) e L54 (`Origin: 'https://pt.jorgesolla.com.br'`) → canônico. O teste de aceite de Origin (mesmo host) e o de cross-origin (evil.example) mantêm semântica.
- `tests/unit/aiMarkdownLinks.unit.spec.ts` L66: `'https://pt.jorgesolla.com.br/campanha'` → `'https://jorgesolla1313.com.br/campanha'` (assert `isCampaignInternalLink === false` preservada — external URL continua false).
- `tests/int/campaignMultiPhones.int.spec.ts` L336: `inviteUrl: 'https://pt.jorgesolla.com.br/campanha/convite/abc'` → canônico. É string plana concatenada no link WhatsApp (url de teste) — semântica irrelevante, troca segura.
- `.opencode/agent/designer-campanha-solla.md`: L9 ("hoje em `pt.jorgesolla.com.br`") → canônico; L21 (lista de fontes de notícia) → canônico; L54 ("deploy na Vercel ... fonctions em gru1 ... x-vercel-id") — duplamente stale → operação no homeserver (sem Vercel).
- `.opencode/agent/solla-comunicacao.md`: L19 (fonte oficial de notícias) → canônico.
- `.opencode/skills/solla-comunicacao/SKILL.md`: L15 (e perfil L28 se presente) → canônico.
- Novos docs do PR (não são "alteração"): `docs/plans/ops80-cutoff-desativar-url-antiga.md` (intenção), este impl, + entrada curta de changelog em `docs/changelog/<data>-ops80.md` (rodar `pnpm changelog:build` — agregado insert-only, mantendo append-only do CHANGELOG-AGENTS intacto).

### Dados → forma (se aplicável)

- Sem migração, sem schema, sem acesso/Consent/UI. Nenhuma coleção/global/field alterada.

## Fases verificáveis

1. **Blindagem/estado-base**: `git status` limpo no worktree; confirmar ausência de `vercel.json`/`.vercel`; `rg -n "pt.jorgesolla.com.br" --hidden` para inventário completo da superfície antes de editar (garantir que nada fora da lista do explorer precisa de olhar).
2. **Operação (A)**: editar `scripts/check-push-chain.mjs` (default `--site`, usage, erro, prosa homeserver).
3. **Testes unit (A)**: editar fixtures/assertions de `campaignWebAuthnConfig`, `campaignJsonMutationRoute`, `aiMarkdownLinks`.
4. **Teste int (A)**: editar fixture `inviteUrl` de `campaignMultiPhones`.
5. **Personas (C)**: editar `designer-campanha-solla.md`, `solla-comunicacao.md`, `solla-comunicacao/SKILL.md`.
6. **Doc delivrables**: criar `docs/plans/ops80-cutoff-desativar-url-antiga.md` + impl deste plano + entrada de changelog; rodar `pnpm changelog:build`.
7. **Gate completo**: `pnpm exec tsc --noEmit`; `pnpm lint`; `pnpm format:check`; `pnpm exec knip`; `pnpm check:cycles`; testes afetados pinados por arquivo (`vitest run tests/unit/campaignWebAuthnConfig.unit.spec.ts tests/unit/campaignJsonMutationRoute.unit.spec.ts tests/unit/aiMarkdownLinks.unit.spec.ts`; int: `tests/int/campaignMultiPhones.int.spec.ts`); `pnpm build`. Revarredura final `rg -n "pt.jorgesolla.com.br"` deve retornar zero (excepto, se decidido, docs históricos — ver aceite).

## Rabbit holes / Não escopo (engenharia)

- `jorgesolla.com.br` (sem `pt`/`1313`) em seed/recover-media/wpArticles/`UID:...@teo.jorgesolla.com.br` e no share-metadata: FONTE DE CONTEÚDO/gênero, não a URL antiga — proibido tocar.
- Fallback `next.config.mjs` L4 / `apoiadores/[id]/page.tsx` L82: base WordPress-doc, não o app antigo — fora de escopo (recomendado).
- Hosts `*.vercel.app` em teste WebAuthn: caso intencional de denial por preview — preservar.
- Migração de dados (OPS79) e redirect (OPS81): entregas futuras, não neste item.
- Procurar "pt.jorgesolla.com.br" em binários/build/`pnpm-lock`: não deve existir; não caçar em `node_modules`/`.next` (gerados, fora).
- Docs históricos e `CHANGELOG-AGENTS.md` append-only: não editar.

## Riscos e mitigação

- **Risco**: troca acidental do caso WebAuthn de denial (mexer no fixture preview `teqo-git-b40-solla.vercel.app` / na comparação de host) quebraria a proteção `toBeNull()`. → Mitigação: editar APENAS `configuredURL`/RP canônico; o host preview permanece `*.vercel.app`; rodar o spec pinado e confirmar que o teste "refuses a Vercel preview" continua 0.
- **Risco**: default `--site` do `check-push-chain` muda o alvo da única verificação operacional; se debugger rodar com omissão, passa a testar o canônico real. → Desejado (é o objetivo: canônico é a verdade). Nada a mitigar além de rodar o script `--site` explícito pós-mudança contra o canônico para validar o GET.
- **Risco**: sobrescopar (mexer em docs/fallback/fonte-de-conteúdo) inflando o diff. → Mitigação: fases 1 e 7 com `rg` full darão inventário exato e confirmarão zero menções remanescentes fora do que se decidiu preservar.
- **Risco**: `format:check`/`lint` falharem em arquivos .md de persona (formater/line-length). → Mitigação: editar preservando a formatação existente das linhas; rodar `pnpm format:check`/`pnpm lint` nos gates.
- **Risco**: changelog inserir entrada duplicada/incompleta. → `changelog:build` é insert-only agregado; seguir o formato de um histórico recente e validar a saída do build.

## Aceite de engenharia

- [ ] `rg -n "pt.jorgesolla.com.br"` (fora de `node_modules`, `.next`, docs históricos decididos-preservados) = 0; nenhuma nova referência à URL antiga introduzida.
- [ ] `scripts/check-push-chain.mjs` default `--site`, usage e erro apontam para `jorgesolla1313.com.br`; prosa `vercel env pull`/Neon substituída por semântica homeserver (`~/stack/teqo-1313.env`).
- [ ] WebAuthn spec: `configuredURL`/`rpID`/`origin` prod = canônico; caso preview `teqo-git-b40-solla.vercel.app` → `toBeNull()` preservado (teste "refuses a Vercel preview" verde).
- [ ] `campaignJsonMutationRoute` (Request + Origin controlado), `aiMarkdownLinks` (external URL → false), `campaignMultiPhones` (`inviteUrl`) = canônico, semânticas preservadas.
- [ ] Personas `.opencode/agent/designer-campanha-solla.md`, `.opencode/agent/solla-comunicacao.md`, `.opencode/skills/solla-comunicacao/SKILL.md` = canônico + homeserver; prosa "deploy na Vercel/functions gru1/x-vercel-id" removida/atualizada.
- [ ] Docs novos do PR presentes (`ops80-cutoff-desativar-url-antiga.md`, este impl, entrada de changelog) + `pnpm changelog:build` ok; `docs/CHANGELOG-AGENTS.md` intocado.
- [ ] Gates verdes: `tsc --noEmit`, `lint`, `format:check`, `knip`, `check:cycles`, specs unit/int pinados por arquivo, `build`.
- [ ] Nenhuma migração, nenhuma mudança de acesso/Consent/schema/UI; fallback `next.config.mjs`/`apoiadores` e refs de conteúdo `jorgesolla.com.br` intocados.
