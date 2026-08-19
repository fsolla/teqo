# Impl: Pixel do Meta (Facebook) na página pública de campanha

Status: rascunho
Atualizado em: 2026-08-19
Issue: #94
Intenção: docs/plans/pixel-meta-pagina-campanha.md
Appetite restante: herdado (~0,5–1 dia eng)

## Leitura da intenção

- **Outcome:** o time de campanha paga configura no admin um campo opcional "ID do Pixel do Meta" nas configurações do site; a home pública de campanha (`/`) passa a carregar o base code + `PageView` do Meta quando o ID está presente e válido; a conclusão da captura de novidades (S9) dispara exatamente um `Lead`. Sem ID configurado, nada é carregado (fail-closed, zero impacto).
- **O que NÃO negociar:** persistir **só o ID numérico** (5–20 dígitos, sem HTML/JS colado — XSS); `Lead` **somente no sucesso** da captura, nunca no page load; Pixel **só na página pública de campanha** (não vazar PageViews de notícias/etc.); sem env var obrigatória; sem CAPI/Advanced Matching, cookie banner/CMP e dedup `eventID` nesta fatia (herda gatilhos do plano da petição); cache da home revalidado pela edição do admin.
- **O que reavaliar:** a hipótese da intenção dizia "home `src/app/(frontend)/(home)/page.tsx` (injeção do `<MetaPixel />`)" — a injeção pode morar no **layout** do grupo `(home)` (que cobre exatamente a única rota do grupo) em vez da página; e "form de captura do S9" é `CampaignNewsletterForm` (cliente) — a seam do `Lead` é o callback `onSubmit()` já previsto no impl plan do S9. A leitura do global na home é compatível com o caching: `getCachedGlobal('site-settings')` é `unstable_cache` sob a tag `global_site-settings`, já revalidada pelo `afterChange` existente (a home passa a ser ISR nessa tag — mesmo padrão de `SiteHeader`/`socialLinks`).

## Abordagem recomendada

```mermaid
flowchart LR
  Admin["SiteSettings global<br/>tracking.facebookPixelId (group Rastreamento/Ads)"]
  Home["(home)/layout.tsx<br/>getCampaignHomeMetaPixelId"]
  Pixel["MetaPixel client<br/>next/script + fbq init/PageView"]
  Section["CampaignNewsletterSection<br/>getCampaignHomeMetaPixelId"]
  Form["CampaignNewsletterForm<br/>pixelId prop"]
  Action["submitCampaignNewsletter"]
  Lead["trackMetaLead<br/>content_name novidades-da-campanha"]
  Meta["Meta Events Manager"]

  Admin --> Home
  Home --> Pixel
  Pixel --> Meta
  Section --> Form
  Form --> Action
  Action -->|sucesso--> Lead
  Lead --> Meta
```

**Opções consideradas:** A (campo no global `SiteSettings` + injeção no layout do grupo `(home)`) · B (novo global de rastreamento dedicado) · C (injeção no `page.tsx` em vez do layout) · D (validate compartilhado em `facebookPixel.ts` vs. duplicado inline)
**Recomendação:** **A+D** — porque o dono existe com revalidação pronta (`afterChange` → `revalidateGlobal('site-settings')`, apontado pelo plano da petição como destino natural de um Pixel global); o layout do grupo `(home)` cobre **exatamente** a página pública de campanha (única rota do grupo), escopando o Pixel ao aceite e impedindo vazamento; e as regras de ID do Pixel passam a viver num único módulo profundo (`facebookPixel.ts` já é o dono), com o validate do `Petition` migrando para o helper compartilhado (edit owner, sem gêmeo).
**Rejeitadas:**

- **B (global de rastreamento dedicado):** twin do `SiteSettings` — o dono já existe, o plano da petição já o apontava, e um segundo global seria cerimônia sem volatilidade.
- **C (injeção no `page.tsx`):** funcionaria (única rota do grupo), mas o layout é o lugar que declara a superfície "página pública de campanha" (`data-theme="campaign-site"`) — se o grupo ganhar outra rota pública de campanha, o Pixel a cobre por contrato; e `CampaignNewsletterSection` continuaria precisando do pixelId de qualquer forma (2 call sites da mesma leitura).
- **D-duplicado (validate inline copiado do `Petition`):** a repetição do bloco validação/label/description é exatamente o tipo de drift que o precedente da petição adiou com gatilho ("revisitar quando o mesmo ID for colado em ≥3 petições") — o gatilho foi puxado por produto; agora as regras devem ter dono único.

### Componentes / mudanças

- **`src/lib/facebookPixel.ts`** (edit owner): adicionar `validateFacebookPixelId(value: string | null | undefined): true | string` — envolve `normalizeFacebookPixelId` devolvendo a mensagem pt-BR do admin ("Informe somente o ID numérico do Pixel (5 a 20 dígitos), sem HTML ou script.") quando inválido; `true` quando vazio ou válido (campo opcional). Módulo já importado por client — helper puro, sem `server-only`.
- **`src/collections/Petition.ts`** (edit owner): o `validate` inline do campo `tracking.facebookPixelId` passa a chamar `validateFacebookPixelId` (remove a duplicação; comportamento idêntico). `beforeChange` e campo inalterados.
- **`src/globals/SiteSettings.ts`** (edit owner): novo group `tracking` (label "Rastreamento / Ads", mesmo do `Petition`) com o campo `facebookPixelId` — `type: 'text'`, opcional, label "ID do Pixel do Meta (Facebook)", `admin.description` idêntica ao precedente, `validate: validateFacebookPixelId`; novo hook `beforeChange` normalizando `data.tracking.facebookPixelId` (mesmo padrão do `Petition`). `afterChange`/access inalterados (`update: payloadAdminOnly` já cobre).
- **`src/utilities/campaignHomeTracking.ts`** (novo, `server-only`): `getCampaignHomeMetaPixelId(): Promise<string | null>` — `getCachedGlobal('site-settings')()` → `normalizeFacebookPixelId(settings.tracking?.facebookPixelId)`. Esconde a forma do global + normalização; 2 call sites (layout + section); não é pass-through — é a fronteira do tracking da home.
- **`src/app/(frontend)/(home)/layout.tsx`** (edit owner): `const pixelId = await getCampaignHomeMetaPixelId()`; `{pixelId ? <MetaPixel pixelId={pixelId} /> : null}` dentro do container do grupo. Leitura cacheada sob `global_site-settings` — a edição do admin revalida a home (ISR), guardrail da intenção.
- **`src/app/(frontend)/(home)/CampaignNewsletterSection.tsx`** (edit owner): lê `getCampaignHomeMetaPixelId()` e passa `pixelId={pixelId ?? undefined}` ao `CampaignNewsletterCapture`.
- **`src/components/CampaignNewsletterForm.tsx`** (edit owner): `CampaignNewsletterForm` ganha prop opcional `pixelId?: string`; no sucesso de `submitCampaignNewsletter` (após `await`, antes do swap `onSubmit()`), `if (pixelId) trackMetaLead(pixelId, NEWSLETTER_LEAD_CONTENT_NAME, crypto.randomUUID())` — padrão exato do `PetitionForm` (linha 61-63). Constante de módulo `NEWSLETTER_LEAD_CONTENT_NAME = 'novidades-da-campanha'` (valor estável visível no Events Manager, mesmo padrão de `content_name` da petição). `CampaignNewsletterCapture` repassa a prop.
- **Migration:** `pnpm migrate:create add_site_settings_facebook_pixel_id` — colunas `tracking_facebook_pixel_id` (tabela `site_settings`) + `version_tracking_facebook_pixel_id` (tabela `site_settings_versions`); sem backfill, sem dado novo. Inspcionar SQL gerado antes de aplicar.
- **Access / Consent:** nenhum — campo herdado do access do global (`update: payloadAdminOnly`), sem PII nova, sem chave de Consent (mesmo precedente da petição: transparência de cookies fica no `/privacidade`, dependência suave herdada).
- **UI:** Impeccable A — N/A (campo único no admin replicando o precedente aceito + script invisível ao visitante; zero superfície pública nova).

### Dados → forma (não se aplica)

O dado (PageView/Lead) vive no Meta Events Manager; o app só emite o evento. Nenhuma forma de apresentação nova.

## Fases verificáveis

1. **Tracer / schema+server** — migration + `SiteSettings` (group/campo/beforeChange) + `validateFacebookPixelId` em `facebookPixel.ts` + refactor `Petition`; `pnpm migrate` local (teqo e teqo_test) + `pnpm generate:types`; unit do `validateFacebookPixelId` em `tests/unit/facebookPixel.unit.spec.ts`; `pnpm exec tsc --noEmit`.
2. **UI/leitura** — `campaignHomeTracking.ts` + layout com `<MetaPixel>` + section/form com a seam do `Lead`; e2e novo `tests/e2e/campaignHomePixel.e2e.spec.ts` (configura o global via REST admin com ID válido fixo, carrega a home com `?e2e=`, assere o script `#meta-pixel-<id>`, restaura o global para null no cleanup — idempotente, chave própria, paralelo-safe no DB de teste); spec do S9 inalterado (sem pixel configurado, nada renderiza).
3. **Gates** — `pnpm gate:fast`; `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm check:cycles`, `pnpm test`, `pnpm build` (com `S3_*` dummy e `generate:importmap` por via das dúvidas); changelog `docs/changelog/2026-08-19-s10.md` + `pnpm changelog:build`; push e PR via `pnpm push` (base `main` no Forgejo, `Closes #94`).

## Rabbit holes / Não escopo (engenharia)

- Não mexer em `submitCampaignNewsletter` (action intacta — o `Lead` é puramente client-side, mesmo padrão da petição).
- Não adicionar fila/retry de `Lead` quando `window.fbq` não carregou (race submit rápido vs. `afterInteractive`) — **herda o gatilho** do plano da petição (revisitar quando smoke com Meta Pixel Helper mostrar `Lead` ausente em produção).
- Não usar o ID do Pixel em outras páginas/superfícies do site.
- Não tocar CSP, env vars, `@types` de terceiros para `fbq` (tipagem local já existe).
- Não indexar/unicidade do campo (mesmo ID pode aparecer em petição e home — aceite da intenção).

## Riscos e mitigação

- **Home ISR sob `global_site-settings`:** a primeira render pós-save usa o valor novo (tag busta a cache); o e2e usa o truque do query param (`?e2e=`) para bypass de fetch cache — precedente do spec S9. Nenhuma página fora do grupo `(home)` lê o pixel.
- **Pins de geometria do e2e `frontend`:** `MetaPixel` só renderiza com ID configurado; o spec existente roda sem pixel → DOM inalterado (script + `noscript` `display:none` não deslocam layout). Sem re-pin esperado.
- **Global compartilhado no e2e:** o cleanup restaura `tracking.facebookPixelId` para `null` (update via REST); idempotente por run, DB de teste dedicado por worktree.
- **Concorrência de migration:** rebase em `forgejo/main` já feito; criar a migration após; cadeia validada por `pnpm migrate` + `test:int` no PR.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (campo admin com mesma validação; PageView na home com fail-closed; exatamente um `Lead` no sucesso; cache revalidado)
- [x] Invariantes AGENTS/engineering-standards (sem HTML colado; edit owner sem gêmeos; copy pt-BR/identifiers EN; `unstable_cache`/tag existentes)
- [ ] Testes de domínio previstos: unit `validateFacebookPixelId` (novo helper) + e2e de injeção do base code condicional
