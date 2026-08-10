# Impl: B184 — Omnibox mobile sem moldura (padrão de todas as listas) + cards edge-to-edge e salvar no header (municípios)

Status: entregue em código (2026-08-09)
Atualizado em: 2026-08-10
Issue: #514
Intenção: docs/plans/municipios-mobile-sem-moldura.md
Appetite restante: ~0,5–1 dia eng (herdado; abordagem dentro do envelope)

## Leitura da intenção

- **Outcome:** no celular, o chrome do filtro de listas some: label oculta, omnibox sem moldura e sticky sob a barra superior com linha separadora, limpar vira X circular dentro do input (com chips **ou** busca digitada). **Escopo ampliado por decisão do humano (2026-08-09):** o look bare/sticky é o **padrão mobile do chassis `CampaignListOmnibox` — todas as listas `/campanha`**, não só municípios. Em municípios, adicionalmente: "Salvar filtro" vira icon button no header (mobile) e os cards ficam sem borda, edge-to-edge, separados por linha.
- **O que NÃO negociar:** desktop de todas as listas inalterado (label visível, box com borda, botão texto "Limpar", sem X); comportamento de filtragem (URL/navegação) intacto em todas as listas; chips continuam dentro da omnibox; fluxo do popover de salvar (nomear/renomear) intacto; cards edge-to-edge e salvar no header são municípios-only (outras listas não têm essa superfície/saved filters); sem dados/KPI novos.
- **O que reavaliar:** a hipótese da intenção escopava a municípios; a decisão do humano tornou o chassis o dono do padrão — prop opt-in morre, o look bare vira o default < `md` do chassis, e os 11 call sites mudam juntos. Cards e header continuam nos arquivos de municípios.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph Chassis["CampaignListOmnibox (padrão < md, todos os 11 call sites)"]
    L[Label: hidden md:block<br/>input ganha aria-label={label} sempre]
    B[Box: border-0 shadow-none md:border md:border-input md:shadow-xs]
    S[Coluna do input: sticky top-0 z-20 -mx-4 border-b bg-background px-4 py-2<br/>md:static md:mx-0 md:border-b-0 md:bg-transparent]
    X["X circular no input: onClearAll && (chips || query)<br/>aria-label='Limpar', md:hidden"]
    C["'Limpar' texto: hidden md:inline-flex"]
  end
  subgraph Municipio["Municípios (adicional)"]
    M2[SaveMunicipalityFilterControl no trailing: hidden md:inline-flex]
    H1["page.tsx → SetCampaignHeaderAction → SaveMunicipalityFilterControl presentation='icon' + md:hidden"]
    K1["Cards: gap-0 -mx-4 md:gap-4 md:mx-0; article border-b last:border-b-0 md:border md:rounded-xl"]
  end
  Chassis --> Municipio
```

**Opções consideradas:**

- **A — Look bare como padrão do chassis (`CampaignListOmnibox`), sem prop.** Todos os 11 call sites herdam; desktop via variantes `md:`; nada muda nos adapters/URLs.
- **B — Prop opt-in `mobileBare` (plano anterior), só municípios.**
- **C — Cópia local do chassis para municípios.**

**Recomendação:** A — a decisão do humano fez do look o padrão; prop opt-in viraria fricção para toda lista futura. O chassis é o dono do concern (B127) e não há divergência entre listas: todas passam `onClearAll`, todas limpam busca + filtros no `kind: 'clear'` (verificado em todos os 11 runActions), nenhuma tem trailing que precise ficar na região sticky (picker e ações ficam abaixo, fora da sticky, e as ações desktop-only já são `hidden md:flex`). Desktop continua 100% no comportamento atual via variantes `md:`.

**Rejeitadas:** B porque o pedido agora é o padrão — cada lista futura teria que lembrar da prop; C porque duplica o contrato ARIA/combobox do chassis (o próprio plano da intenção proíbe "twin" do dono existente).

### Componentes / mudanças

- **`CampaignListOmnibox`** (`src/components/campaign/shared/CampaignListOmnibox.tsx`) — sem prop nova; abaixo de `md`:
  - `label` → `hidden md:block` (o `<label>` some só visualmente); `input` ganha `aria-label={label}` **sempre** (nome acessível idêntico ao do label — desktop inalterado na prática; mobile sem label continua nomeado).
  - Box (PopoverAnchor div) → base `border-0 shadow-none` + `md:border md:border-input md:shadow-xs`; `rounded-lg`, `px-2 py-1.5`, `min-h-11` e o ring de foco (`focus-within:ring-3`) permanecem (a11y).
  - **A barra sticky mora no `<form role="search">` do caller** via constante compartilhada `campaignListOmniboxFormClassName` (exportada do chassis; precedente `campaignCellEditTriggerClassName`): `sticky top-0 z-20 -mx-4 border-b border-border bg-background px-4 py-2 md:static md:z-auto md:mx-0 md:border-b-0 md:bg-transparent md:px-0 md:py-0`. **Por quê no form e não na coluna do input:** um elemento `sticky` nunca escapa do seu containing block (o pai) — a coluna do input vive dentro do wrapper curto do omnibox (73px), então ela "grudaria" só pela própria altura e rolaria junto (medido no browser: posição computada `sticky`, comportamento de scroll mostrou a barra saindo da tela). O form é o único wrapper cujo pai é o `CampaignPageShell` (altura da página inteira) — aí o sticky vale o scroll todo. O trailing (picker de colunas) é `hidden md:flex` (B137) — no mobile o trailing é vazio, então nada fora da barra "gruda" por engano (verificado: `CampaignColumnPickerTrailing` é desktop-only). Os 11 call sites aplicam a constante no próprio `<form>`; o `ActivityAgendaFilters` não tinha form e ganhou o wrapper no mesmo padrão.
  - X circular de limpar dentro do box (após o input): `onClearAll && (hasChips || query.length > 0)` → `<button type="button" aria-label="Limpar" className="…rounded-full bg-muted… md:hidden" onClick={onClearAll + setActiveChipId(null) + refocus}>`. **`aria-label="Limpar"`** = paridade de nome com o botão desktop que substitui (consistência de voz/leitor de tela entre viewports) e mantém o e2e mobile do `campaignActivity` (que clica `Limpar` em 390px) verde sem edição.
  - Botão texto "Limpar" (trailing) → `hidden md:inline-flex`.
  - **Ajustes do `/simplify` (2026-08-09):** o X é renderizado sempre que `onClearAll` existe, alternando `invisible pointer-events-none` quando não há o que limpar (a largura do input não pula na fronteira vazio↔digitado — revisor de performance); hit target `size-11` com círculo visual de 28px interno (convenção `min-h-11` de toque do repo) + `focus-visible:ring-2`; live region própria com `key` (remount re-anuncia "Busca e filtros limpos." — limpar só busca não navega e o pending region ficaria mudo para AT, P1 do revisor de a11y).
- **`MunicipalityFilters`** (`src/components/campaign/municipality/MunicipalityFilters.tsx`): só o gating do Save no trailing: `className="hidden md:inline-flex"`. (Nenhuma mudança nos demais 10 `*Filters` — herdam do chassis.)
- **`SaveMunicipalityFilterControl`** (`src/components/campaign/municipality/SaveMunicipalityFilterControl.tsx`): props novos `presentation?: 'panel' | 'icon'` (default `panel` = atual) e `className?` no Button trigger. `icon`: `variant="ghost" size="icon"` + `aria-label` sempre (`Renomear o filtro salvo ${name}` / `Salvar filtro`). Popover/conteúdo idêntico.
- **`page.tsx`** (`src/app/(campaign)/campanha/(app)/municipios/page.tsx`): `SetCampaignHeaderAction id="municipality-save-filter"` com `SaveMunicipalityFilterControl presentation="icon" state={state} className="md:hidden text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"` (padrão visual do sino, `CampaignNotificationBell`).
- **`MunicipalityListMobileCards`** (`src/components/campaign/municipality/MunicipalityListMobileCards.tsx`): container `gap-4` → `gap-0 md:gap-4` + `-mx-4 md:mx-0`; `<article>` `rounded-xl border` → `border-b last:border-b-0 md:border md:rounded-xl md:last:border-b`; overlay do Link `after:rounded-none md:after:rounded-xl`. Gate por viewport `md` (não container query) — casado com o omnibox; janela desktop estreita (md+ viewport, cards visíveis < 48rem de container) mantém o look atual nos dois.
- **`CampaignUpdatesFilters`** (`src/components/campaign/municipality/CampaignUpdatesFilters.tsx`): o único trailing visível no mobile entre os 11 call sites era o botão "Nova atualização" — com o sticky no form ele viraria parte da barra, contradizendo o padrão "trailing fora da sticky". **`/simplify` decidiu:** trailing vira `hidden md:inline-flex` e o CTA registra um icon button no header mobile via `SetCampaignHeaderAction` (mesmo padrão C94/C95 desta entrega; o estado do modal vive no próprio componente).
- **`campaignMobileHeaderIconClassName`** (`src/components/campaign/shell/CampaignMobileTopBar.tsx`): constante compartilhada do look de icon do header (branco sobre primary) — 3º consumidor (sino, wizard, icons de B184), seguindo o precedente de constantes de classe do repo.
- **Migration:** nenhuma. **Access/Consent:** nenhum toque.

### Dados → forma (se aplicável)

N/A — item de acabamento visual; nenhum dado/KPI muda (confirmado na intenção).

## Fases verificáveis

1. **Chassis + call sites** — `CampaignListOmnibox` (label/box/sticky/X/Limpar), `MunicipalityFilters` (gating Save), `SaveMunicipalityFilterControl`, `page.tsx`, cards. UI pura. Gate `pnpm gate:fast` no meio.
2. **E2E** — novo describe 390×844 em `campaignMunicipalities.e2e.spec.ts`: label invisível; box sem borda (`toHaveCSS('border-top-width','0px')`); form sticky (`toHaveCSS('position','sticky')`) + linha separadora (`border-bottom-width 1px`); X com chips e com busca, some sem eles, clicar limpa (URL + busca) **e pina o contrato foco→input + `aria-expanded=false`** (o popover não reabre — regressão real pega no `campaignActivity`); icon "Salvar filtro" no header **salva de verdade e vira "Renomear o filtro salvo X"** (contrato 2.5.3 da apresentação icon); cards `border-top-width 0px`/`border-bottom-width 1px`; **pin desktop invertido** (resize 1280 → label visível, borda 1px, "Limpar" texto de volta). Validar que `campaignSavedFilters` mobile e `campaignActivity:160` (clica "Limpar" em 390px → agora o X) seguem verdes **sem edição**.
3. **Gates + push** — `pnpm gate:fast`; `pnpm push`; PR `--base main` com `Closes #514`; auto-merge; `gh pr checks --watch --required`.

## Rabbit holes / Não escopo (engenharia)

- **Redesenhar o trailing / picker de colunas.** Segue onde está (fora da região sticky) — o padrão não move trailing de nenhuma lista; ações desktop-only seguem `hidden md:flex`.
- **Cards/edge-to-edge e salvar no header nas outras listas.** Não existem outras árvores de cards B42 nem saved filters — fora de escopo por superfície, não por escolha.
- **Tornar o header sticky.** Não é o pedido — a top bar já fica fixa fora do scrollport.
- **`useIsMobile` / JS de viewport.** Branch 100% CSS responsivo (`md:`), como o par `md:hidden`/`hidden md:block` de B42.
- **Mudar o comportamento do X além do `onClearAll` existente** — reusa a action que o "Limpar" já dispara em cada lista (todas limpam query + filtros; verificado).
- **A11y do combobox:** teclado (arrows/Escape/Backspace), chips e popover de sugestões intactos — o X é botão extra no box.

## Riscos e mitigação

- **Duas famílias de breakpoint (viewport `md` vs container query 48rem).** Janela desktop estreita mostra cards (container < 48rem) com estilo desktop (md+ viewport) — divergência pré-existente de B42, agora consistente porque omnibox e cards usam o mesmo gate `md`. E2E cobre 390px (celular real, onde os sistemas concordam).
- **Sticky não escapa do containing block.** O `sticky` da coluna do input falhava porque o pai (wrapper do omnibox) tem só a altura da própria linha — a barra "grudava" ~12px e rolava junto (reproduzido e medido no browser). Solução: sticky no `<form>` (pai = `CampaignPageShell`, altura total). O shell tem ancestrais com `overflow: hidden`/`contain` (`SidebarInset`, `CampaignAISidebarShell`, RRP) — não afetam porque o form é filho direto do pageShell dentro do scrollport real (`CampaignContentScroll`); validação por scroll no browser em cada página tocada.
- **Perda do nome acessível do input no mobile.** Mitigado pelo `aria-label` no input.
- **E2E existente:** `campaignSavedFilters` mobile clica `Salvar filtro` em 390px → casa com o icon do header (`md:hidden` no painel desktop e `md:hidden` no header invertido); desktop (`:46`) idem. `campaignActivity:160` clica `Limpar` em 390px → casa com o X (mesmo nome). Validar na fase 2; editar só se algum detalhe escapar.
- **`toHaveClass`/`not.toHaveClass` com classes responsivas é inútil** (variantes `md:` ficam no attribute em qualquer viewport) → e2e usa `toHaveCSS`.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (omnibox sem moldura + sticky + linha + X + label oculta no mobile de **todas** as listas; cards edge-to-edge e salvar no header em municípios; desktop inalterado)
- [x] Invariantes AGENTS/engineering-standards (sem migration/access/Consent; copy pt-BR; identificadores em inglês; chassis é o dono do padrão — nenhum twin)
- [x] Testes de domínio previstos: e2e mobile novo (390×844) em `campaignMunicipalities.e2e.spec.ts`; suites desktop existentes seguem verdes sem edição
