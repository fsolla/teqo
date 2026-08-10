# Impl: Quick-edit sheet mobile da lista de municípios quebra ao abrir (DialogClose fora do contexto Drawer)

Status: registrado
Atualizado em: 2026-08-10
Issue: (a registrar — C109)
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — defect de render, sem superfície nova
Appetite: ~2–4 h eng; um outcome verificável — no celular, tocar em "Registrar atualização" (ou qualquer quick-edit sheet) no card de município abre o sheet e registra sem console error.

## Intenção (defect)

No mobile, os quick-edits em sheet dos cards de `/campanha/municipios` (B42: `MunicipalityListUpdateControl` variant `sheet`, E14 "Registrar movimento", etc.) **não abrem**: o clique dispara o erro `TypeError: Cannot destructure property 'store' of useDialogRootContext() as it is undefined` em `DialogClose` (base-ui), capturado pelo error boundary — o sheet nunca renderiza.

**Evidência:** reproduz em `main` puro (commit 8896dcb9, stash testado em 2026-08-10); console do browser no dev server; `[data-slot="drawer-popup"]` ausente após o clique; `role="dialog"` ausente.

## Root cause (teorizado)

O footer custom do `CampaignCellEditOverlay` variant `sheet` com `CampaignListSheetProvider` é renderizado na árvore da **célula** (`MunicipalityListUpdateControl` — sem `Drawer.Root` ancestral) e enviado via `createPortal(footer, footerTarget)` para o `DrawerFooter` do shared-sheet. `createPortal` **preserva o contexto React da origem** (a célula), não o do alvo — então o `DrawerCloseButton` (`DrawerClose` → base-ui `DialogClose`) dentro do footer custom resolve `useDialogRootContext()` como `undefined` → crash.

O fallback sem provider (um `Drawer` por célula) renderiza o footer **dentro** do `DrawerContent` — contexto OK; é por isso que o unit test B32+ F5 (`campaignCellEditOverlay.unit.spec.ts`) passa e o shared path quebra.

## Abordagem recomendada

**Opções:** A) renderizar o footer custom no host (não portalado da célula) — o `CampaignListSheetHost` ganha um slot de footer por estado (ex.: contexto com `footer: ReactNode` setado via `openSheet`, como já faz com `chrome.title/description`), e a célula para de portalar o footer | B) envolver o footer portalado num `Drawer`-provider wrapper (hack) | C) mover `DrawerCloseButton` para fora do footer custom (degradar o affordance de fechar).

**Recomendação:** A — o footer vira parte do `chrome` do shared-sheet (mesmo mecanismo do título/descrição); a célula envia o footer como valor no `openSheet` e o host renderiza dentro do `DrawerFooter` (contexto correto). O fallback sem provider continua como está. Alinha com o design existente (`hasCustomFooter` já existe no chrome) e remove o portal do footer por completo.

**Rejeitadas:** B porque mascara o problema e adiciona contexto duplicado; C porque remove o botão "Cancelar" do rodapé (regressão de affordance — B32 decidiu footer custom com submit).

### Componentes / mudanças

- **`CampaignListSheetHost.tsx`**: `CampaignListSheetChrome` ganha `footer?: ReactNode`; `openSheet` aceita o footer; `DrawerFooter` renderiza `chrome.footer` (além do `DrawerCloseButton` default quando `!hasCustomFooter`); o ref do portal de footer pode ser removido ou mantido vazio (verificar call sites).
- **`CampaignCellEditOverlay.tsx`**: para de portalar o footer no shared path — passa `footer` no `openSheet({ ... footer })`; mantém o portal/path de fallback.
- **Call sites com footer custom**: `MunicipalityListUpdateControl` (B42) e `MunicipalityListLevelControl` (E14 "Registrar movimento") — sem mudança de props (o footer continua sendo passado como prop do overlay).
- **Sem migration / access / Consent.**

## Fases verificáveis

1. **Root cause confirmado no browser** — reproduzir com o fix mínimo; verificar que `DialogClose` resolve o contexto.
2. **Fix no host/overlay** — mover o footer para o chrome; remover portal.
3. **Gates** — `pnpm gate:fast`; verificação manual no browser mobile (abrir quick-edit sheet de município, registrar, fechar); e2e do `campaignMunicipalities` (popover intocado) + unit `campaignCellEditOverlay`.
4. **Cobertura nova (opcional mas recomendada)**: um unit test do shared path (renderizar `CampaignListSheetHost` + célula) para o footer custom — hoje o bug não é coberto por nenhum teste.

## Rabbit holes / Não escopo

- Redesenhar o sheet/footer dos quick-edits (o fix restaura o comportamento existente, sem redesenho).
- Outros drawers/shared-sheets (agenda, convites) — fora.
- O crash afeta TODOS os footers custom no shared path — verificar os call sites antes de fechar.

## Riscos e mitigação

- **E14 "Registrar movimento"** usa o mesmo shared path com footer custom — o fix cobre os dois; verificar ambos no browser.
- **Remover o portal pode quebrar o `portalRevision`/timing** do host — manter o `portalRevision` para o body; testar reabertura.
- **`chrome.footer` como ReactNode** pode carregar contexto da célula (ex.: `useActionState` do submit) — o footer continua sendo CRIADO na célula (só renderizado no host), então o contexto de estado do form é preservado; o que muda é apenas o `Drawer`-provider, que passa a estar presente.

## Aceite de engenharia

- [ ] Quick-edit sheet abre no mobile sem console error e registra (verificado no browser)
- [ ] Unit test do shared path cobre o footer custom (novo) ou fallback documentado
- [ ] Popover desktop e fallback sem provider intactos; e2e/unit verdes

## Já resolvido no simplify/critique (não reabrir)

- N/A (defect detectado na verificação manual do C107, fora do escopo daquela entrega).

## Explicitamente fora (deste triage)

- Swipe handle no topo quando o sheet atinge `dvh` (C107, defer com gatilho: item PWA/fullscreen).
- Estilo `accent` do ToggleGroup vs precedentes (C107, defer com gatilho: 3º uso).
- Wizard `/acoes/registrar-atualizacao` com select vs toggle (C107, defer com gatilho: consistência pedida pela mesa).
