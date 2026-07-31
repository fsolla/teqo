# Busca global no bottom drawer (mobile)

Status: rascunho
Atualizado em: 2026-07-31
Issue: #76 (B91)
Priority: P1
Model: composer-2.5
Impeccable: C — chrome do drawer (B79); reuso da busca do Início dentro do snap expandido
Appetite: ~0,75–1 dia eng; extrair acoplamento HomeSearch do Início; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · tema `data-theme='campaign'` · shell do drawer em [chassis-bottom-drawer-acoes-rapidas.md](chassis-bottom-drawer-acoes-rapidas.md) (B79).

Na implementação (`work-issue`): craft compacto → critique → polish (superfície já moldada pelo chassis).

Brief compacto:

- **Persona / contexto:** staff no celular, drawer expandido em rota ≠ Início.
- **Job principal:** a mesma busca global do Início (`POST /campanha/home-search`, providers B48–B55) sem sair da página.
- **Estratégia de cor:** Restrained — chrome do drawer.
- **Edit where you see:** não — busca/navegação.
- **Anti-goals:** segunda API de busca; command palette desktop; reinventar debounce/contrato; drawer no Início.

### Wireframe (texto)

```text
┌─ CampaignQuickActionsDrawer (expanded) ─────────────┐
│ ═ handle ═                                          │
│ [ações B80+ …]                                      │
│ ┌─ Buscar na campanha ────────────────────────────┐ │
│ │  input + results (HomeSearch* reusado)          │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
  Fora: página opaca/interativa (B79); Início sem este item.
```

## Dados → decisão → apresentação

Dados: N/A — hits = providers B48+ já existentes; este item só monta a UI no drawer.

## Contexto

Fatia de **B79** (2026-07-31): o chassis (drawer não-modal + snap + registry + padding) desbloqueia **B80–B90**; a busca embutida era a metade que inchava o guarda-chuva. B79 permanece o dependente duro dos catálogos; este item (B91) depende de B79 e não bloqueia B80–B90.

## Objetivos

- Extrair o mínimo de `CampaignHomeSearch` / `HomeSearchProvider` / results shell para montar fora de `CampaignHomeStaffChrome`.
- No drawer expandido: mesma API, debounce e modo focado do Início.
- Guardrails: sem migration, sem collection, sem Consent, sem server action de escrita.

## Decisões travadas

- **Busca = contrato do Início** (`home-search`). **Rejeitado:** segunda API; omnibox desktop neste item.
- **Depende de B79 (chassis).** Sem drawer montado, não há onde embutir. **Rejeitado:** busca flutuante fora do drawer.
- **Não bloqueia B80–B90.** Catálogos usam o slot de ações do chassis; busca é independente.

## Abordagem proposta

- Depth check: reusar `HomeSearch*` — extrair provider montável no drawer; não duplicar debounce.
- Wire no `CampaignQuickActionsDrawer` (região expandida).
- Pins: unit/int existentes da home-search; smoke mobile do drawer com query.

## Dependências

- Dura: **B79** (chassis + mount). Soft: B47 ✓ / B48–B55 (providers).

## Não escopo

- Catálogos por vertical → B80–B90.
- Chassis / snap / padding → B79.
- Desktop omnibox.

## Rabbit holes

- **Teclado virtual cobrindo a busca no snap.** Mitigação: v1 = padding fixo; Adiado com gatilho iOS.
- **Levantar strip do Início sem medir bundle.** Mitigação: só a busca neste item.

## Referências

- [chassis-bottom-drawer-acoes-rapidas.md](chassis-bottom-drawer-acoes-rapidas.md) (B79)
- `src/components/campaign/dashboard/HomeSearchResultsContext.tsx`
- `src/lib/campaignHomeActions.ts` + `CampaignHomeSearch`
