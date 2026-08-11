# Impl: Municípios mobile: omnibox colado ao header e card mais denso (pós-B193/B184)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #607
Intenção: docs/plans/municipios-mobile-polimento-omnibox-cards.md
Appetite restante: herdado (~0,5–1 dia eng) — sem estouro: mudanças de superfície em 2 shared + 1 card + 1 avatar + 5 pages + e2e

## Leitura da intenção

- **Outcome:** em `/campanha/municipios` mobile (< md), a barra de filtro cola no header (sem vão, nada passa por cima no scroll), o campo fica ~40px no total, foco sem anel de cor, nome 18px com território colado, chips Classe/Tendência/Nível com label acima, avatares numa linha por grupo com sobreposição dinâmica — padrão do chassis vale para TODAS as listas (gate A); chip de classe ganha label "Classe" (gate B).
- **O que NÃO negociar:** desktop (`md+`) intacto; sheets/edit-where-you-see intactos; labels/dados dos chips intactos; nenhum limite de avatares com "…"; área de toque dos controles do card não encolhe.
- **O que reavaliar:** a hipótese da intenção ("encurtar o vão no contexto da barra — não o padding global do scrollport") é correta e foi confirmada: o sticky não pode subir acima do containing block (o shell), que começa 16px abaixo do scrollport por causa do `p-4` do `CampaignContentScroll`. Qualquer fix no form isolado falha (clamp do containing block).

## Abordagem recomendada

```mermaid
flowchart LR
  A[CampaignContentScroll<br/>max-md:has-[marcador]:pt-0] --> B[form sticky ancora em y=0<br/>colado ao header]
  B --> C[omnibox denso: min-h-8 py-1<br/>X size-8 · ring só md]
  C --> D[card: nome 18px tight · chips label-acima<br/>avatares overlap row]
  D --> E[e2e B196 + gates]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — resolver o vão via `:has()` no scrollport (o scrollport "sabe" quando hospeda a barra sticky; o form carrega um marcador de classe estável). É a única correção que move o containing block do sticky para y=0 sem tocar o padding global nem as 11 páginas de lista.
**Rejeitadas:**

- **B — `-mt-4` no form:** o sticky não sobe acima do containing block; com a borda do shell a 16px, o clamp continua em 16 (e o natural position vira 0 ≠ posição colada no scroll → barra "pula"). Medido na exploração: `formY=72` = header 56 + 16.
- **C — `pt-0` global no scrollport / remover `p-4`:** rabbit hole nomeado na intenção; destrói a folga do topo de todas as telas (dashboard, wizard…). O `:has()` escopa o `pt-0` só para páginas com o form de lista.

### Componentes / mudanças

- **`campaignListOmniboxFormClassName`** (`src/components/campaign/shared/CampaignListOmnibox.tsx`): adiciona o marcador `campaign-list-omnibox-form` ao bloco de classes existente (contrato do `:has()`). Barra: `py-2` → `py-1` no mobile (`md:py-0` preservado). Nada mais muda aqui — sticky/`-mx-4`/border-b ficam.
- **Campo do omnibox** (mesmo arquivo): `min-h-11` → `min-h-8`, `py-1.5` → `py-1` no mobile (`md:min-h-11 md:py-1.5` restauram o desktop); botão "Limpar" X `size-11` → `size-8` (span interno `size-7` → `size-6`, ícone `size-4` → `size-3.5`; `md:hidden` já é mobile-only); anel de foco `focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50` → escopado a `md:` (mobile sem anel/contorno de cor — caret é o indicador; contrato B184 borderless preservado). `text-sm` do input INTOCADO (contrato B183: 16px touch).
  - Total da barra mobile: 32 (min-h-8) + 8 (py-1×2) + 1 (border-b) = **41px ≈ 40** ✓. Área de toque do X = 32px — aceitável porque o alvo real é o campo (o X vive dentro dele).
- **`CampaignContentScroll`** (`src/components/campaign/shell/CampaignQuickActionsHost.tsx`): `p-4` → adiciona `max-md:has-[.campaign-list-omnibox-form]:pt-0` (desktop `md:p-6` intocado). Efeito: só páginas com o form de lista perdem o padding-top no mobile; o shell (containing block do sticky) passa a começar em y=0 → barra cola no header e cards nunca passam por cima. Fallback se o arbitrary variant do Tailwind v4 não compilar: regra CSS pura em `styles.css` sob `@media (width < 48rem)` com o mesmo seletor.
- **Compensação das 6 listas com linha de ações antes do form** (`atividades`, `liderancas`, `apoiadores`, `demandas`, `dobradinhas`, `organizacoes` — verificadas na exploração): `pt-4 md:pt-0` no `div.flex.justify-end` que precede o form (respiro no topo que o `pt-0` removeu; desktop inalterado). `municipios`, `territorios`, `atualizacoes`, `pessoas`, `assessores` têm o form como primeiro filho visível — sem compensação.
- **`MunicipalityMobileCard`** (`src/components/campaign/municipality/MunicipalityMobileCard.tsx`):
  - Nome: `<h3>` ganha `text-lg leading-tight` (18px/22.5px vs 24px/32px atuais do `h3` global em `styles.css:371`); `gap-0.5` existente → território a ~2–4px do texto (linha-box enxuta é o que fecha o vão medido de ~13px). Badge "Cidade" e link stretch intactos.
  - Chips: bloco `flex flex-col gap-0.5` por chip com `ChipLabel` acima do valor (gate B), substituindo o `inline-flex items-center` atual; linha de chips `items-start gap-x-3 gap-y-2` (1–2 linhas aceitas pelo gate); valores com `whitespace-nowrap` (nenhum chip quebra no meio). `chipTriggerClassName` vira o estilo de bloco (sem pílula de hover: `hover:bg-transparent`; `min-h-11` mantido para a área de toque; label+valor são o alvo do tap). A label "Classe" é renderizada no CALL SITE do card (`<ChipBlock label="Classe">`), não dentro de `TerritorialClassCardReadout` — o readout continua compartilhado com a tabela desktop intocado. Caso cidade: Tendência/Nível/Classe como blocos com os mesmos valores ("Não registrada", dash). `MissingAdvisorBadge` ganha wrap (`whitespace-normal h-auto`) para o pill não clipar na célula de ~110px do grupo (desktop segue uma linha).
  - Densidade: article `gap-3` → `gap-2.5` e `p-4` → `px-4 py-3` (vertical denso; horizontal mantém o edge-to-edge B184; toques `min-h-11` dos controles intactos).
- **`MunicipalityRelationAvatarStack`** (`src/components/campaign/shared/MunicipalityRelationAvatarStack.tsx`): o modo `wrap` (B193) vira **overlap row dinâmica** — células `flex-1` com avatar fixo centralizado: poucos avatares → sem sobreposição (célula > 28px), muitos → sobreposição proporcional à contagem, sem wrap, sem cap, sem "…", todos visíveis (a linha ocupa exatamente a largura do grupo; casos patológicos de dezenas de avatares degradam para pilha — sr-only continua com todos os nomes). Renomear a prop `wrap` → `overlapRow` (honestidade da semântica; 2 call sites no card + 1 em `MunicipalityAdvisorAvatarStack`). Adicionar `data-view="relation-avatars"` na linha (hook de teste, precedente `data-view="mobile-cards"`). Desktop (`-space-x-2`, cap 3, tooltip) intocado.
- **`MunicipalityAdvisorAvatarStack`** (mesmo arquivo): passa `wrap` → `overlapRow` no modo denso (call site do card não-coordenador).
- **Migration:** sem migration (nenhuma mudança de schema/collection/global).
- **Access / Consent:** nenhum (zero paths de escrita tocados).
- **UI:** Impeccable B — encaixe na tela existente; shape (classes acima) → craft (browser, 390px) → critique (contrastes/vão/overlap) → polish.

### Dados → forma

N/A — nenhuma métrica nova; é densidade e alinhamento de superfície existente (intenção: "Vou apresentar dados? Não").

## Fases verificáveis

1. **Tracer — chassis da barra** (maioria do appetite): marcador de classe + `:has()` no scrollport + densidade do campo/X/anel + compensação das 5 páginas. Verificar: `pnpm exec tsc --noEmit` + e2e B184/B183 existentes + novos e2e B196 (barra colada, altura ≤44, sem anel no foco).
2. **UI — card denso**: nome/território, chips label-acima, overlap row de avatares, densidade vertical. Verificar: e2e B193 existentes + novos e2e B196 (nome 18px, território colado, label acima do badge, avatares numa linha com overlap e sem overlap quando poucos).
3. **Gates**: `pnpm gate:fast` completo (tsc, lint, format, knip, cycles, unit+int, e2e do conjunto afetado) e `pnpm build`.

## Rabbit holes / Não escopo (engenharia)

- Não tocar `p-4`/`pb-*` do scrollport fora do `:has()` — o `pt-0` é escopado e é O fix do containing block.
- Não mudar `text-sm` do input (contrato B183), nem o desktop do omnibox (`md:*` restaura tudo).
- Não criar sistema de avatares novo — só o modo denso do componente existente.
- **Alinhamento dos avatares no grupo (adiado):** com poucos avatares a pilha fica centralizada no grupo (label à esquerda) — ancorar à esquerda mudaria o perfil de overflow para o grupo vizinho com 4+ avatares; revisitável se o product pedir (gatilho: review Impeccable do /simplify).
- Não polir o rodapé de atualização nem outras arestas do card (item separado na intenção).
- Não mexer em sheets, tooltips de desktop, busca/sugestões do omnibox.

## Riscos e mitigação

- **Tailwind v4 não compilar `max-md:has-[.campaign-list-omnibox-form]:pt-0`:** verificar no build da Fase 1; fallback = regra CSS pura em `styles.css` (`@media (width < 48rem)` + `.campaign-content-scroll:has(.campaign-list-omnibox-form)`).
- **e2e B193 regressar:** `card.getByText('Nível', { exact: true }).click()` — a label continua DENTRO do trigger (bloco label-acima), então o clique continua abrindo o sheet; `[data-view="mobile-cards"]` e classes de borda intactas.
- **Janela estreita-desktop (container < 48rem) vê o card densificado:** aceito — é o MESMO componente mobile (B193 já o estiliza com variantes `md:` no article); o desktop de verdade (tabela) não é tocado.
- **Listas com linha de ações antes do form** perdem o respiro no topo com o `pt-0`: mitigado pelo `pt-4 md:pt-0` nas 5 páginas; e2e de regressão no `/campanha/atividades` (barra colada após scroll).
- **`has-` casar páginas além das listas:** o marcador só existe em `campaignListOmniboxFormClassName`, usado exclusivamente pelos 11 `*Filters` (verificado por grep); wizard usa forms sem `role="search"`/marcador.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (vão zero, barra ~40px, sem anel, nome 18px+território colado, chips label-acima, avatares 1 linha sem cap/wrap/"…"; desktop intacto)
- [x] Invariantes AGENTS/engineering-standards (sem schema, sem access, sem Consent; nomes de props em inglês; copy pt-BR preservada)
- [x] Testes previstos: e2e B196 (barra colada + altura + anel + nome/território + labels + overlap de avatares) + regressão B184/B183/B193 existentes; sem unit/int novos (mudança puramente de superfície)

Self-score decision-quality: 5/5 (decisões caras com rejeitadas; cabe no appetite; rabbit holes nomeados; reusa chassis existente — zero módulos novos; intenção preservada)
