# Impl: Atualizações mobile — sheet de criação usável (altura auto até o topo, form sem labels com divisórias, placeholders, polaridade em toggle, checks à direita)

Status: aprovado
Atualizado em: 2026-08-09
Issue: #519
Intenção: docs/plans/atualizacoes-mobile-sheet-criacao-usavel.md
Appetite restante: herdado (~0,5–1 dia eng)

## Leitura da intenção

- **Outcome:** no celular, o sheet de criação do feed abre com altura = conteúdo (teto no topo da tela; rola por dentro só quando estoura), sem título visível, form estilo lista sem labels/bordas com divisórias full-bleed, placeholders descritivos, polaridade em toggle Ruim|Neutra|Boa e checks à direita com linha inteira tocável — registrar sem lutar com o sheet.
- **O que NÃO negociar:** dados gravados inalterados (`body`, `polarity boa|neutra|ruim` default `neutra`, `urgent`, `adversarySignal`); anti-goal "não virar overlay de tela cheia nem segunda página"; desktop do feed mantém título/labels/descrições salvo o decidido no gate sobre campos compartilhados; acessibilidade mantida (labels acessíveis, erros anunciados, obrigatórios marcados).
- **O que reavaliar:** a hipótese apontava possível mudança na primitiva `Drawer` — verificado: a primitiva já é auto-height (`--drawer-content-height:auto` + teto `--drawer-content-max-height`), o uso atual só impõe `max-h-[90dvh]`; a mudança cabe 100% no uso, sem tocar a primitiva. C103 não tem implementação em `main` (branch local = só o plano) — este item estabelece o padrão, C103 reutilizará.

## Abordagem recomendada

```mermaid
flowchart LR
  A[MunicipalityUpdateFields] -->|prop layout: 'labeled'\|'list'| B[Campos compartilhados]
  B --> C[feed create modal]
  B --> D[quick-edit lista B42]
  C --> E[mobile: sheet auto até topo + form lista]
  C --> F[desktop: dialog com labels]
  D --> G[sheet: herda lista]
  D --> H[popover: labels]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — variante de apresentação dentro do componente de campos compartilhados (`layout`), controle de polaridade vira `ToggleGroup` nas duas resoluções, altura do sheet ajustada por override scoped no uso (`max-h-dvh`), primitiva `Drawer` intocada.
**Rejeitadas:** B) primitiva do Drawer ganha modo "topo" — blast radius em `CalendarFeedDialog` e demais superfícies sem volatilidade que justifique; C) componentes duplicados (fields do feed e fields da lista) — viola "edit the owner, don't twin".

### Componentes / mudanças

- **`MunicipalityUpdateFields`** (`src/components/campaign/municipality/MunicipalityUpdateFields.tsx`): ganha `layout?: 'labeled' | 'list'` (default `labeled` = hoje).
  - Ambas os layouts: `NativeSelect` → `ToggleGroup` (`ToggleGroupItem` Ruim|Neutra|Boa, ordem pedida; `variant="outline"` + `spacing={0}` com `data-[state=on]:bg-primary data-[state=on]:text-primary-foreground` = destacado; precedente `VoteIntentionControl`); valor submetido via `<input type="hidden" name="polarity" value={polarity} />` (mesmo nome/valores; select não submete button). Grupo com `aria-labelledby` apontando para o `FieldLabel` (visível no labeled, `sr-only` no list) → `getByLabel('Polaridade')` continua funcionando.
  - `layout="list"`: container `flex flex-col divide-y divide-border` (full-bleed — sem padding horizontal no container; cada linha `px-4`); rows: texto (label sr-only; `Textarea` sem borda `border-0 bg-transparent rounded-none px-0`, placeholder `"Descrever o que aconteceu..."`, `required` mantido, `FieldError` mantido), polaridade (toggle w-full), Urgente e Sinalizar adversário (linhas `<label htmlFor>` — button é labelable — `flex min-h-11 items-center justify-between gap-3 px-4` com `<Checkbox>` à direita; descrições removidas; hidden `false` preservado; linha inteira tocável por label activation nativo).
- **`StrictCombobox`** (`src/components/campaign/shared/StrictCombobox.tsx`): `placeholder?: string` pass-through ao `ComboboxInput` (backward-compatible).
- **`CampaignUpdatesCreateModal`** (`src/components/campaign/municipality/CampaignUpdatesCreateModal.tsx`):
  - Mobile: `DrawerContent` `max-h-[90dvh]` → `max-h-dvh` (teto no topo; auto-height já é o comportamento da primitiva); `DrawerTitle` → `sr-only` (nome acessível preservado); container de scroll sem `px-4` (linhas com `px-4` para divisórias full-bleed); form em layout lista: linha do município (label `sr-only`, `StrictCombobox` `placeholder="Adicionar município"` + `border-0 bg-transparent rounded-none w-full`, erro mantido), divisória explícita `border-t border-border`, `MunicipalityUpdateFields layout="list"`, divisória, linha de botões (`px-4 pt-4`, mesmos botões).
  - Desktop: inalterado (título, labels), só o toggle vindo dos campos compartilhados.
- **`MunicipalityListUpdateControl`** (`src/components/campaign/municipality/MunicipalityListUpdateControl.tsx`): `layout={isSheet ? 'list' : 'labeled'}` — o quick-edit herda o visual no sheet mobile (decisão do gate: compartilhar), popover desktop mantém labels. Chrome do overlay (título "Registrar atualização" + nome do município) intocado.
- **Migration:** sem migration (apresentação pura; nenhum campo/schema muda).
- **Access / Consent:** nenhuma mudança (mesmo form action, mesmos names).
- **UI:** Impeccable B — encaixe na superfície existente; shape → craft → critique → polish conforme canvas plan-c107-ui-draft (linha do município ~44px, toggle pill com célula selecionada em acento, rows de check com texto à esquerda / quadrado à direita, botões sob a última divisória).

### Dados → forma (se aplicável)

- N/A — `Dados: N/A` herdado da intenção (affordance de escrita, nenhum dado/KPI/mapa).

## Decisões de engenharia

| Decisão                                         | Opções                                                                                               | Recomendação                                                                                                                                 | Rejeitadas                                                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escopo do visual "sem labels/bordas/divisórias" | A) mobile-only (feed sheet + quick-edit sheet)                                                       | **A** — desktop mantém labels/descrições (descoberta; precedente C103); o componente compartilhado recebe `layout` e cada superfície escolhe | B) as duas resoluções sem labels — desktop perde descoberta sem ganho de espaço                                                                                  |
| Toggle de polaridade                            | A) só mobile                                                                                         | **B — nas duas resoluções** (intenção, questão aberta B) — um controle só para o campo; padrão segmentado já existe (`VoteIntentionControl`) | A) mobile-only — duas superfícies divergentes para o mesmo campo; C) manter select — controle pesado para 3 valores                                              |
| Quick-edit (B42) herda?                         | A) herda via componente compartilhado                                                                | **A** — mesmo componente, mesma pessoa/job "registrar o que aconteceu"; zero duplicação                                                      | B) escopar ao feed — segunda apresentação do mesmo form                                                                                                          |
| Altura/posição do sheet                         | A) override no uso (`max-h-dvh` + auto-height existente)                                             | **A** — primitiva intocada, backward-compatible                                                                                              | B) novo modo na primitiva `Drawer` — blast radius desnecessário (CalendarFeedDialog etc.)                                                                        |
| Linha de check tocável                          | A) `<label htmlFor>` envolvendo o `Checkbox` (button é labelable; label activation dispara o clique) | **A** — sem estado extra, sem elemento duplicado; o bubble input do Radix mantém o submit (`name`/`value` inalterados)                       | B) checkbox oculto + div custom — perde semântica de checkbox e o `getByLabel` do e2e; C) onClick manual com estado — dois controles de estado para o mesmo dado |
| Ordem do toggle                                 | A) Ruim \| Neutra \| Boa                                                                             | **A** — pedido explícito; neutra central como default                                                                                        | B) Boa \| Neutra \| Ruim — ordem do select de hoje, contraria o pedido                                                                                           |
| Acessibilidade do grupo                         | `aria-labelledby` → FieldLabel (sr-only no list)                                                     | `getByLabel('Polaridade')` continua casando; label visível só no labeled                                                                     | `aria-label` hardcoded — duplica fonte do nome                                                                                                                   |

## Fases verificáveis

1. **Tracer / campos compartilhados** — `MunicipalityUpdateFields` (`layout` + ToggleGroup + hidden polarity + rows de check à direita), `StrictCombobox` placeholder, `MunicipalityListUpdateControl` wiring; atualizar e2e do popover (`campaignMunicipalities.e2e.spec.ts` ~L598: `selectOption('ruim')` → clique no toggle `Ruim` do grupo `getByLabel('Polaridade')`).
2. **Sheet do feed (mobile)** — `CampaignUpdatesCreateModal`: `max-h-dvh`, título sr-only, form lista com divisórias full-bleed, placeholders; desktop intacto.
3. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push` (não `git push` nu); PR `--base main` + `Closes #519` + auto-merge; `gh pr checks --watch --required`.

## Rabbit holes / Não escopo (engenharia)

- **Wizard `/campanha/acoes/registrar-atualizacao` e aba updates do detalhe** (`MunicipalityUpdateForm` — cópia própria com select e labels): fora de escopo, intocado. Divergência conhecida (select lá, toggle aqui) → defer com gatilho: se a mesa pedir consistência total de "Registrar atualização", unificar os campos do wizard no componente compartilhado.
- **Trigger de criar** (omnibox hoje, header no mobile) → C106 (#517): este item não toca o trigger.
- **C103 (agenda)** — padrão irmão em paralelo; sem componente compartilhado com este domínio (fields de atividade ≠ fields de atualização); nenhuma coordenação de código necessária. C103 reutiliza o padrão de `max-h-dvh` + rows full-bleed quando executar.
- **Redesenho geral do `Drawer` / outras listas / paleta** — fora.
- **e2e novo para o sheet mobile** — não adicionar: a mudança é apresentação pura (mesmo form action), e altura de sheet auto é frágil de afirmar em e2e; o fluxo de dados já é coberto pelo e2e do popover atualizado.

## Riscos e mitigação

- **`getByLabel('Polaridade')` no e2e do popover** (L598) quebra com o toggle → mitigação: atualizar o spec para clique no toggle no mesmo teste (já planejado, fase 1). ✓ verificado: `getByLabel` casa o grupo via `aria-labelledby` (unit + e2e + browser real).
- **`aria-labelledby` do ToggleGroup** não formar nome acessível em algum browser → fallback `aria-label="Polaridade"` no grupo, mantendo o label visual. ✓ verificado no browser real (getByLabel → grupo; radios nomeados).
- **Label envolvendo o Checkbox** (Radix button) — se label activation não disparar em algum browser, substituir por `<button type="button">` com `onClick` no estado controlado (fallback). ✓ verificado no browser real (clique no texto "Urgente" alterna o check).
- **Deseleção do ToggleGroup** (Radix `type="single"` emite `''` ao re-clicar o item ativo) → no-op no `onValueChange` (`if (value)`), comportamento de radio; sem estado fora do domínio.
- **Mensagem stale ao reabrir** (`useActionState` persiste) → guard `state.status !== 'success' && state.message` nos dois forms (unificados); sucesso fecha via toast.
- **Conflito de branch/worktree com C106/C103** (mesma família de superfície) — mudanças scoped por arquivo; C106 não toca o modal; C103 não toca atualizações.
- **`max-h-dvh` com teclado aberto** — dvh = viewport dinâmico (teclado excluído): teto continua no topo da área visível; rolagem interna é o aceite ("rola por dentro"). ✓ verificado: conteúdo curto = sheet auto (420px ancorado); conteúdo longo = topo 0 + scroll interno.

## Notas pós-/simplify (2026-08-10)

- Form do modal unificado (um `<form>` com chrome condicional por `isMobile`) — removeu a duplicação e a divergência de guard de mensagem.
- `CheckRow` extraído em `MunicipalityUpdateFields` (4 spellings do par hidden-false + Checkbox → 1).
- `sheetBodyClassName="px-0 pt-0"` no quick-edit sheet (divisórias full-bleed também lá).
- `htmlFor` de polaridade removido (alvo não-labelable; nome acessível via `aria-labelledby`).
- `focus-visible:ring-0` removido do textarea list (anel de foco mantido — WCAG 2.4.7).
- Bug pré-existente registrado: quick-edit sheet dos cards mobile de `/campanha/municipios` quebra ao abrir (`DialogClose` fora do contexto Drawer, shared-sheet footer) — reproduz em `main` puro, fora do escopo C107. **→ Issue C109 (#540, defect P1, plano curto).**
- Defer com gatilho (triage capture-review-debts): (a) estilo `accent` do ToggleGroup centralizado em `Toggle.tsx` quando houver 3º uso com destaque em acento (hoje: VoteIntentionControl/SupporterForm `bg-muted` + C107 `bg-primary`); (b) swipe handle no topo quando o sheet atinge `dvh` — item PWA/fullscreen ou queixa real (env safe-area top é position-dependent).

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (altura auto até o topo, sem título no mobile, form sem labels com divisórias full-bleed, placeholders, toggle Ruim|Neutra|Boa com default Neutra, checks à direita linha tocável, dados inalterados, desktop preservado exceto toggle)
- [ ] Invariantes AGENTS/engineering-standards (identificadores em inglês, copy pt-BR, sem migration, sem acesso/Consent)
- [ ] Testes de domínio: e2e do quick-edit popover atualizado para o toggle (interação de polarity); demais e2e de campos (wizard, detalhe) intocados e verdes
