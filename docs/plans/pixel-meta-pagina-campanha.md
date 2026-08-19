# Pixel do Meta (Facebook) na página pública de campanha

Status: registrado
Atualizado em: 2026-08-19
Issue: #94
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (campo único no admin replicando precedente aceito + script invisível ao visitante; zero superfície pública nova)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; campo admin + injeção do base code na home + `Lead` no sucesso do form de captura
Responsável: —

## Intenção

O time de campanha paga roda tráfego no Meta direcionado à home pública de campanha, mas hoje não vê nada: sem Pixel, o Events Manager não registra visitas nem conversões dessa página, e as campanhas otimizam às cegas (sem retargeting, sem evento de conversão). Nos abaixo-assinados o time já configura o ID do Pixel por documento (`petition.tracking.facebookPixelId`, entregue 2026-07-21); a home de campanha precisa do mesmo instrumento em nível de site — um campo no admin para o ID numérico do Dataset, injetado na página pública de campanha, e o evento `Lead` quando a captura de novidades (S9) for concluída. Em janela eleitoral (1º turno 04/10), cada semana sem atribuição é verba paga sem feedback.

Este item revisita a decisão adiada do plano `pixel-meta-abaixo-assinado` ("Pixel / Dataset global em SiteSettings — revisitar quando o mesmo ID for colado em ≥3 petições e o admin reclamar de repetição"): produto agora pede explicitamente um Pixel de site para a página de campanha — o gatilho foi puxado, o precedente segue intacto para os abaixo-assinados.

## Persona e fluxo

- **Persona / contexto:** marketing digital / analista de campanha paga no Meta, no admin; quer ver visitas e conversões da home de campanha no Events Manager do Dataset.
- **Job principal:** configurar um Pixel no admin (colar só o ID numérico) e ver a home de campanha alimentar o Dataset sem colar JavaScript.
- **Fluxo desejado:**
  1. Editor no `/admin` cola o ID numérico do Pixel no campo de rastreamento das configurações do site.
  2. A home pública de campanha carrega o base code do Meta (`PageView`) quando o ID está presente e válido.
  3. Quando o visitante conclui a captura de novidades (S9), exatamente um `Lead` é disparado.
  4. O Events Manager mostra PageViews e Leads da página de campanha para otimização/retargeting.
- **Anti-goals de produto:** colar snippet HTML no admin (XSS); Pixel vazando PageViews do resto do site (notícias, etc.); CAPI/Advanced Matching nesta fatia; cookie banner/CMP nesta fatia.

## Objetivo e aceite

- Campo opcional "ID do Pixel do Meta" nas configurações do site (admin), com a mesma validação dos abaixo-assinados (somente ID numérico, 5–20 dígitos, sem HTML) e a mesma normalização no save.
- Quando o ID está configurado e válido, a home pública de campanha carrega o base code + `PageView`; sem ID, nada é carregado (fail-closed, zero impacto).
- Quando a captura de novidades (S9) é concluída com Pixel ativo, dispara exatamente um `Lead` (nunca no page load) — mesmo padrão da petição.
- Guardrails: nunca persistir nem executar HTML/JS do editor; sem env var obrigatória; cache da home revalidado pela edição do admin (o hook de revalidação do global já existe).

## Dados (intenção)

- **Vou apresentar dados?** Não — o dado (PageView/Lead) vive no Meta Events Manager; o app só emite o evento.

## Direção no codebase (hipótese)

- **Áreas prováveis:** global `src/globals/SiteSettings.ts` (campo único, provável dono — o plano anterior já apontava `SiteSettings` para um Pixel global; a revalidação `revalidateGlobal('site-settings')` já existe), home `src/app/(frontend)/(home)/page.tsx` (injeção do `<MetaPixel />`), `src/components/MetaPixel.tsx` + `src/lib/facebookPixel.ts` (reuso direto do precedente), form de captura do S9 (disparo do `Lead` no sucesso, no padrão `PetitionForm`).
- **Precedente a olhar:** `docs/plans/pixel-meta-abaixo-assinado.md` (decisões travadas: persistir só o ID, nunca snippet; `Lead` só no sucesso; validação e normalização reutilizadas), `src/collections/Petition.ts` (grupo `tracking` + `validate` + `beforeChange`), `src/app/(frontend)/abaixo-assinado/[id]/page.tsx` (injeção condicional).
- **Risco de acoplamento:** toca a home (mesmo arquivo do S9) e o `SiteSettings` (global lido por outras superfícies do site) — serializado por dependência; a leitura do global na home deve ser compatível com o caching da página (decisão de implementação, não de produto).

## Dependências

- **S9** (captura de novidades) — necessária só para o `Lead` no sucesso do form; o `PageView` na home é independente. Registrada como dependência para o `Lead` sair junto.

## Fora de escopo

- Pixel nas demais páginas do site (notícias, artigos, privacidade) — o pedido é a página pública de campanha; se marketing quiser site-wide, item futuro.
- Conversions API (CAPI) / Advanced Matching / dedup `eventID` — herda os gatilhos do plano da petição.
- Cookie banner/CMP, GTM, TikTok/Google pixels.
- Uniqueness de Dataset — mesmo ID pode aparecer na petição e na home.

## Rabbit holes de produto

- **Colar snippet HTML "como o Meta manda".** XSS + HTML no CMS. **Corte:** campo só ID + description + validação server-side, idêntico ao precedente aceito.
- **Pixel em tudo.** "Já que o campo existe, coloca em todas as páginas". **Corte:** só a home de campanha; site-wide é decisão separada de produto.
- **CAPI "já que estamos no servidor".** Secrets, hashing PII, dedup, retries. **Corte:** fora, herda os gatilhos do plano da petição.

## Questões em aberto (produto)

- **Evento `Lead` no sucesso do form de captura?** Confirmado com produto em 2026-08-19: **sim** — PageView no load + `Lead` no sucesso da captura (S9), réplica do precedente da petição.
- **Onde o campo mora?** **Opções:** (a) global `SiteSettings` (Configurações do site) | (b) novo global dedicado de rastreamento. **Recomendação:** (a) — dono existente com revalidação pronta; o plano da petição já o apontava como destino natural de um Pixel global. _(assumido — validar com produto)_

## Referências

- `docs/plans/pixel-meta-abaixo-assinado.md` — precedente integral (decisões, gatilhos, rejeitados)
- `src/collections/Petition.ts` — campo `tracking.facebookPixelId` + validação/normalização
- `src/components/MetaPixel.tsx` + `src/lib/facebookPixel.ts` — base code e `trackMetaLead` (reuso)
- `src/globals/SiteSettings.ts` — global provável dono do campo
- `src/app/(frontend)/(home)/page.tsx` — home pública de campanha
- S9 — form de captura de novidades (dependência do `Lead`)
