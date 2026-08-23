# Âncora #novidades quebra no mobile — deep link não leva ao formulário

Status: registrado
Atualizado em: 2026-08-23
Issue: #780
Priority: P1
Impeccable: A — N/A (correção funcional de scroll; sem mudança visual)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável (deep link + CTA levam ao formulário no mobile e no desktop)
Responsável: —

## Intenção

O link `jorgesolla1313.com.br/#novidades` deveria levar o visitante direto ao formulário de captura de novidades da home de campanha. No desktop ele funciona; no celular não — a página abre no topo e o usuário não é levado ao formulário. Esse link será usado para direcionar tráfego (orgânico/pago/WhatsApp) direto para a captura, na janela eleitoral (1º turno 04/10). Cada visita que não chega ao formulário é audiência perdida. Precisamos garantir que o mesmo link leve ao formulário nos dois: desktop e mobile.

## Persona e fluxo

- **Persona / contexto:** visitante da home de campanha que chega pelo link `/#novidades` (vindo de WhatsApp, anúncio, material de campanha) ou clicando no CTA "Receba novidades" do hero — no celular ou no desktop.
- **Job principal:** ao abrir o link (ou clicar no CTA), ser levado direto à seção do formulário de captura, sem rolar manualmente.
- **Fluxo desejado:**
  1. Abre `jorgesolla1313.com.br/#novidades` (ou clica no CTA do hero).
  2. A página rola até a seção "Receba as novidades da campanha" com o formulário visível.
  3. Preenche nome + WhatsApp e envia (fluxo S9 já existente).
- **Anti-goals de produto:** mudar o layout/visual da home; mexer no modelo de scroll de outras rotas; criar mecanismo paralelo de navegação; alterar o fluxo do formulário S9.

### Esboço de fluxo (A — sem UI)

<!-- Omitido: classe A, sem mudança visual. O fluxo é o mesmo do S9; só a chegada ao formulário passa a funcionar no mobile. -->

## Objetivo e aceite

- Abrir `jorgesolla1313.com.br/#novidades` no celular leva à seção do formulário (não fica no topo).
- Clicar no CTA "Receba novidades" do hero no mobile rola até a seção do formulário.
- O comportamento no desktop continua funcionando (sem regressão).
- Respeita `prefers-reduced-motion` (sem scroll suave forçado quando o usuário prefere menos movimento).

## Dados (intenção)

- **Vou apresentar dados?** Não — N/A. Correção de navegação/scroll, sem métrica ou dado novo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(frontend)/(home)/layout.tsx` (container de scroll interno), `src/components/CampaignHero.tsx` (CTA `#novidades`), `src/app/(frontend)/(home)/CampaignNewsletterSection.tsx` (`id="novidades"`), um novo componente cliente de scroll por hash na home.
- **Precedente a olhar:** `captura-novidades-home-campanha.md` (S9, Issue #93 — entrega-pai); `CampaignStorySection.tsx` usa `scrollIntoView` (padrão de scroll programático já existente).
- **Risco de acoplamento:** a home é dona do container de scroll interno (`h-dvh overflow-y-auto`) porque o `body` está `overflow-hidden` — a correção deve atuar nesse modelo sem quebrar o scroll de outras rotas públicas.

## Dependências

- Nenhuma dura. Soft: S9 (formulário e seção já entregues).

## Fora de escopo

- Corrigir o mesmo padrão de âncora em outras rotas públicas (`[type]`, `artigos`) — mesmo modelo de container, mas sem pedido; registrar gatilho se reaparecer.
- Mudar o modelo de scroll global (tirar `overflow-hidden` do body) — decisão de arquitetura maior, fora do appetite.

## Rabbit holes de produto

- **"Aproveita e arruma as âncoras de todas as rotas públicas."** Escopo explode para o modelo de scroll inteiro do site. **Corte neste item:** só a home de campanha e o `#novidades`.
- **"E se o formulário tiver um id próprio?"** O `#novidades` já aponta para a seção que contém o formulário; criar id extra no formulário é mudança de contrato de URL sem pedido. **Corte:** manter `#novidades`.

## Questões em aberto (produto)

- **Garantir que o deep link caia exatamente no formulário, não só no topo da seção?** **Opções:** A) rolar até a seção `#novidades` (o formulário fica logo abaixo do título — suficiente) | B) rolar até o próprio formulário. **Recomendação:** A — a seção é o contrato de URL já publicado; o formulário fica visível na mesma tela. _(assumido — validar com produto)_

## Referências

- GitHub Issue #780
- Rascunho UI (gate): N/A
- `src/app/(frontend)/(home)/layout.tsx` — container de scroll interno
- `src/components/CampaignHero.tsx` — CTA `href="#novidades"`
- `src/app/(frontend)/(home)/CampaignNewsletterSection.tsx` — `id="novidades"`
- `tests/e2e/campaignNewsletter.e2e.spec.ts` — cobre o CTA no viewport desktop; falta cobertura mobile
- `docs/plans/captura-novidades-home-campanha.md` (S9, Issue #93)
- `AGENTS-public.md` — convenções do site público
