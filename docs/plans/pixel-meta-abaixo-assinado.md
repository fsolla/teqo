# Pixel do Meta (Facebook) nos abaixo-assinados

Status: rascunho
Atualizado em: 2026-07-21
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Site público)
Impeccable: B — encaixe no admin `Petition` + script na página `/abaixo-assinado/[id]` e no sucesso do `PetitionForm`
Appetite: ~0,5–1 dia eng; migration + 1 campo admin + componente de script + disparo `Lead` no sucesso
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` (register `brand` no site público; tema `data-theme='petition'` na página). Admin Payload usa labels pt-BR do grupo `Abaixo-assinados` — sem redesign de paleta.

Na implementação (`implement-roadmap-item`): craft compacto → critique → polish (superfície mínima; sem shape longo).

Brief compacto:

- **Persona / contexto:** marketing digital monta campanha de ads no Meta e precisa ver assinaturas como conversões; editor no `/admin` cola o ID do Pixel no abaixo-assinado.
- **Job principal:** atribuir assinaturas reais a um Pixel por petição, sem o editor colar JavaScript arbitrário.
- **Estratégia de cor:** Restrained (tokens `petition` / admin Payload existentes).
- **Anti-goals:** textarea de snippet HTML; GTM/multi-vendor; cookie banner completo; CAPI/Advanced Matching nesta fatia.

## Contexto

A página pública `/abaixo-assinado/[id]` (`src/app/(frontend)/abaixo-assinado/[id]/page.tsx`) renderiza o documento `petition` e o formulário cliente `PetitionForm` (`src/components/PetitionForm.tsx`). Assinatura bem-sucedida chama `submitPetitionSignature` e abre `PetitionSuccessDialog` — hoje **sem** telemetria de ads.

A collection `Petition` (`src/collections/Petition.ts`, grupo admin `Abaixo-assinados`) tem `title`/`subtitle`/`body`/`enabled` e o grupo `form` (título, subtítulo, `consent`). Não há campo de tracking.

O time de marketing digital pediu (2026-07-21) um campo no formulário do abaixo-assinado no Payload para “adicionar o snippet do Pixel do Facebook” e acompanhar assinaturas no Events Manager / otimizar campanhas.

### O que o Meta Pixel exige (pesquisa)

Fontes: [Meta Pixel Get Started](https://developers.facebook.com/docs/meta-pixel/get-started) (atualizado 2026-06-30), [Conversion tracking](https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking), [Deduplicate Pixel + CAPI](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/).

1. **Base code** no `<head>` (ou via `next/script`): carrega `fbevents.js`, chama `fbq('init', PIXEL_ID)` e `fbq('track', 'PageView')`. O único dado que o editor precisa fornecer é o **Pixel ID** (número do Dataset no Events Manager) — o restante do “snippet” é boilerplate fixo.
2. **Evento de conversão para lead-gen:** `fbq('track', 'Lead', {…})` **somente após** a assinatura bem-sucedida — nunca no carregamento da página do formulário (erro clássico que infla leads 5–10× e corrompe o otimizador).
3. **Parâmetros úteis no `Lead`:** `content_name` (título/id da petição). `eventID` opcional agora; obrigatório se/quando houver Conversions API (CAPI) para deduplicação.
4. **CAPI + Advanced Matching** (e-mail/telefone hasheados no servidor) melhoram Event Match Quality (~6.0+), mas exigem secret de access token, hashing LGPD-consciente e dedup — fora do appetite desta fatia.
5. **LGPD:** o Pixel define cookies Meta (`_fbp` etc.) e envia sinais de navegação/conversão. Transparência em `/privacidade` (e, se o jurídico pedir, no texto de Consent da petição) é requisito de produto; cookie banner site-wide fica adiado.

## Objetivos

- Campo opcional no admin de `petition` para o marketing configurar o Pixel **por abaixo-assinado**.
- Na página pública: carregar base code + `PageView` quando o ID estiver presente.
- No sucesso da assinatura: disparar exatamente um `Lead` (não no page load).
- Guardrails: **nunca** persistir nem executar HTML/JS colado pelo editor; validar ID numérico; sem env var obrigatória (config por documento); migration com `push: false`; cache já revalidado por `revalidateDocumentById` no `afterChange` existente.
- Sem novo `Consent` key nesta fatia (petição já exige Consent de assinatura); sem CAPI.

## Decisões travadas

- **Persistir só `facebookPixelId` (texto, dígitos), não o snippet HTML.** O “snippet” que o Meta mostra no Events Manager é boilerplate + ID; colar HTML no admin é XSS / injection e quebra CSP. O app injeta o base code controlado em código. **Rejeitado:** `textarea`/`code` com snippet livre; campo `html`/`richText` de tracking; GTM container ID como substituto nesta fatia.
- **Pixel por petição (campo no documento `petition`), não global do site.** Campanhas de ads costumam ser por abaixo-assinado/URL; evita Pixel único vazar PageViews de notícias/home. **Rejeitado:** só env `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` site-wide; Global `SiteSettings` único (pode ser fill-in futuro se marketing unificar Dataset).
- **v1 = browser Pixel only, com os dois eventos:** `PageView` no load da página da petição **e** `Lead` no sucesso do form (confirmado com produto 2026-07-21). Padrão Meta: retargeting de visitantes + conversão de assinatura. Transparência de cookies/Meta fica no polish de `/privacidade` (dependência suave). **Rejeitado nesta fatia:** só `Lead` sem `PageView`; Conversions API; Advanced Matching com e-mail/telefone no browser/servidor; eventos `CompleteRegistration`/`Contact` além de `Lead`; cookie banner / CMP.
- **`Lead` só após `submitPetitionSignature` ok** (mesmo caminho que abre o diálogo de sucesso). **Rejeitado:** `Lead` no `onSubmit` antes da resposta; `Lead` no page load; thank-you page dedicada (não existe hoje — o sucesso é modal same-page).
- **i18n e naming** seguem o AGENTS.md: identificadores em inglês (`facebookPixelId`, `MetaPixel`, `trackMetaLead`); labels admin e copy em pt-BR (“ID do Pixel do Meta (Facebook)”).

## Questões em aberto

- **Um Pixel por petição vs. mesmo Dataset em várias petições?** **Opções:** A) permitir o mesmo ID em N petições (só conteúdo do `Lead` diferencia) | B) forçar uniqueness. **Recomendação:** A — Dataset único da campanha é o caso comum; `content_name` carrega `petition.id` / título.

## Abordagem proposta

```mermaid
flowchart LR
  Admin["Payload admin<br/>petition.facebookPixelId"]
  Page["abaixo-assinado/[id]<br/>Server Component"]
  Pixel["MetaPixel client<br/>next/script + fbq init/PageView"]
  Form["PetitionForm"]
  Action["submitPetitionSignature"]
  Lead["trackMetaLead<br/>fbq track Lead"]
  Meta["Meta Events Manager"]

  Admin --> Page
  Page --> Pixel
  Pixel --> Meta
  Form --> Action
  Action -->|sucesso--> Lead
  Lead --> Meta
```

Componentes:

- **Campo `facebookPixelId`** em `src/collections/Petition.ts` (irmão do grupo `form` ou dentro de um group `tracking` com label “Rastreamento / Ads”): `type: 'text'`, opcional, `admin.description` explicando “cole só o ID numérico do Events Manager (ex.: 123456789012345), não o snippet HTML completo”. `validate` rejeita não-dígitos / comprimento fora de ~5–20. Sem `required`.
- **`isValidFacebookPixelId` / `normalizeFacebookPixelId`** (em `src/lib/facebookPixel.ts` ou `src/utilities/facebookPixel.ts`): helper puro testável (unit) — depth check: um módulo pequeno que esconde a regex e a montagem do init; não inventar “AnalyticsService”.
- **`MetaPixel`** (client, `src/components/MetaPixel.tsx`): se `pixelId` válido, renderiza `next/script` (`strategy="afterInteractive"`) que carrega o padrão Meta (`fbevents.js` + `fbq('init', id)` + `fbq('track', 'PageView')`) e noscript img opcional. Tipar `window.fbq` localmente (sem `@types` de terceiros se não existir no repo).
- **`trackMetaLead`** (mesmo módulo lib/utilities ou export do componente): `fbq('track', 'Lead', { content_name }, { eventID? })` se `window.fbq` existir; no-op seguro se Pixel não carregou / adblock.
- **`PetitionForm`**: após sucesso de `submitPetitionSignature`, chamar `trackMetaLead` com `content_name` = título ou id da petição (e `eventID` = UUID gerado no cliente **só se** quisermos preparar CAPI depois — nesta fatia opcional; preferir gerar UUID e passar já, custo zero, facilita fatia futura).
- **Página** `abaixo-assinado/[id]/page.tsx`: passar `petition.facebookPixelId` para `<MetaPixel />` quando presente; incluir o campo no `select`/cache se a leitura de documento filtrar campos (hoje `getCachedDocumentById` carrega o doc — confirmar após `generate:types`).
- **Migration**: `pnpm migrate:create add_petition_facebook_pixel_id` — coluna nullable em `petition` (+ drafts/versions se Payload espelhar). Sem backfill.
- **Testes:** unit no validador de ID; int opcional na collection validate se o repo já testa Petition; E2E não obrigatório (terceiro externo) — smoke manual com [Meta Pixel Helper](https://developers.facebook.com/docs/meta-pixel/support/pixel-helper).

## Dependências

- Nenhuma de outro plano de trilha A/B/C/D.
- **Suave:** polish do Aviso de Privacidade (Site público / Onda 0 textos finais) deve mencionar cookies/ferramentas de ads (Meta) quando Pixel estiver em uso — não bloqueia a engenharia do campo.
- Reusa: `revalidateDocumentById` já no `afterChange` de `Petition`; `PetitionForm` success path; `next/script`.

## Não escopo

- Conversions API (CAPI) / access token / Event Match Quality server-side → fatia futura com gatilho abaixo.
- Google Tag Manager, TikTok Pixel, Google Ads gtag — outro item se marketing pedir.
- Cookie consent banner site-wide / CMP.
- Pixel no layout global do site (home, notícias, `/campanha`).
- Thank-you page dedicada / redirect pós-assinatura.
- Alterar schema de `signature`/`contact` para guardar `event_id` Meta.

## Rabbit holes

- **Colar snippet HTML “como o Meta manda”.** Se alguém “só completar” o pedido literal do marketing: XSS + HTML no CMS. **Mitigação:** campo só ID + description no admin + validação server-side.
- **CAPI “já que estamos no servidor”.** Explode em secrets, hashing PII, dedup, retries. **Mitigação:** defer com gatilho.
- **Cookie banner completo por causa deste campo.** Projeto de CMP. **Mitigação:** transparência em `/privacidade` + decisão jurídica sobre PageView; não construir banner aqui.
- **Advanced Matching no browser com e-mail/telefone em claro.** Vazamento + LGPD. **Mitigação:** fora; CAPI hasheado só em fatia futura.

## Adiado com gatilho

- **Conversions API + dedup com `event_id` compartilhado.** Revisitar quando: marketing reportar perda material de atribuição (iOS/adblock) **ou** Event Match Quality &lt; 6 no Dataset em uso com volume real de ads.
- **Pixel / Dataset global em `SiteSettings`.** Revisitar quando: o mesmo ID for colado em ≥3 petições e o admin reclamar de repetição.
- **Cookie banner / CMP.** Revisitar quando: jurídico exigir bloqueio pré-consent de cookies de ads (não só transparência).

## Referências

- `docs/roadmap.md` (Site público)
- `src/collections/Petition.ts` — schema admin do abaixo-assinado
- `src/app/(frontend)/abaixo-assinado/[id]/page.tsx` — página pública
- `src/components/PetitionForm.tsx` — sucesso da assinatura
- `src/app/(frontend)/actions/submitPetitionSignature.ts` — escrita transacional (inalterada no fluxo de tracking cliente)
- Meta: [Get Started](https://developers.facebook.com/docs/meta-pixel/get-started) · [Conversion tracking](https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking) · [Deduplication](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/)
- Next.js: `next/script` + `strategy="afterInteractive"` (App Router)
- AGENTS.md — naming, migrations `push: false`, Consent por chave (não inventar paralelo aqui), revalidate de documentos
- `PRODUCT.md` / `DESIGN.md` — canal público / tema `petition`
