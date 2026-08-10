# Impl: Quick-edit sheet mobile da lista de municípios quebra ao abrir (DialogClose fora do contexto Drawer)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #540 (C109)
Intenção: docs/plans/quick-edit-sheet-mobile-quebrado.md
Appetite restante: herdado (~2–4 h eng)

## Leitura da intenção

- **Outcome:** no celular, tocar em "Registrar atualização" (ou qualquer quick-edit sheet com footer custom) no card de município abre o sheet e registra, sem console error.
- **O que NÃO negociar:** popover desktop e fallback sem provider intactos; sem mudança de access/Consent/URL; affordance "Cancelar" no rodapé preservado (decisão B32).
- **O que reavaliar:** a hipótese da intenção (portal preserva contexto da origem). **Confirmada no código**: `CampaignCellEditOverlay` portaliza `footer` (`createPortal(footer, footerTarget)` em `CampaignCellEditOverlay.tsx:207`) para o `DrawerFooter` do host (`CampaignListSheetHost.tsx:155`); `createPortal` resolve contexto React da árvore de ORIGEM (a célula, sem `Drawer.Root`), então `DrawerCloseButton` (base-ui `DialogClose`) explode em `useDialogRootContext()`. O fallback sem provider renderiza o footer inline (contexto OK) — por isso o unit test atual passa.

## Abordagem recomendada

```mermaid
flowchart LR
  Cell["Célula (MunicipalityListUpdateControl / LevelControl)"] -->|openSheet chrome {title, description, footer}| Host["CampaignListSheetHost (Drawer.Root)"]
  Cell -->|footer JSX criado aqui, estado do form vive aqui| Host
  Host -->|renderiza chrome.footer inline no DrawerFooter| Footer["submit + Cancelar<br/>(DrawerClose resolve contexto do Drawer.Root)"]
  Cell -->|body portalado (mantido)| Body["body no DrawerContent"]
```

**Opções consideradas:** A) footer vira parte do `chrome` do shared-sheet (mesmo mecanismo de title/description); a célula passa o footer no `openSheet`, o host renderiza dentro do `DrawerFooter` — portal do footer removido | B) envolver o footer portalado num wrapper de provider do Drawer (hack) | C) mover `DrawerCloseButton` para fora do footer custom (perder "Cancelar").
**Recomendação:** A — o ReactNode do footer é um elemento criado na célula (estado do form, `useActionState`, `isPending` continuam vivendo lá; a associação `form` attribute é DOM-level e não precisa de contexto), mas é **renderizado** na árvore do host, onde o `Drawer.Root` existe — contexto correto por construção, alinhado ao design existente do chrome, e remove o portal do footer por completo (sem timing de `portalRevision` para o footer).
**Rejeitadas:** B porque mascara o defeito com contexto duplicado e o primeiro crash só muda de endereço; C porque regride o affordance decidido em B32 (submit + Cancelar no rodapé de sheet com body rolável).

### Componentes / mudanças

- **`CampaignListSheetChrome`** (`src/components/campaign/shared/CampaignListSheetHost.tsx`): troca `hasCustomFooter: boolean` por `footer?: ReactNode` (derivado: `Boolean(chrome.footer)`). `DrawerFooter` passa a renderizar `{chrome.footer ?? <DrawerCloseButton>Fechar</DrawerCloseButton>}` — o div de portal (`ref={attachFooterPortal}`) sai; `footerPortalRef` e `attachFooterPortal` saem do contexto e do provider (`portalRevision` permanece, servindo o body). `openSheet` inclui `current.footer === next.footer` na comparação de memo (na prática a célula sempre cria JSX fresco — comportamento equivalente ao de hoje, onde `handleOpenChange` da LevelControl já quebra o memo).
- **`CampaignCellEditOverlay.tsx`** (path shared, `variant === 'sheet' && sharedSheet`): para de portalar o footer — `openSheet({ ..., footer, ... })`; render retorna só trigger + liveRegion + body portalado. Path fallback (sem provider) e popover intactos.
- **Call sites** (`MunicipalityListUpdateControl.tsx:83`, `MunicipalityListLevelControl.tsx:231`): **zero mudança de props** — o footer continua sendo prop do overlay; os dois são os únicos call sites com footer custom no repo (verificado por grep), e os outros consumidores do provider (AdvisorsTable, dobradinhas, lideranças, trend/expected/leaderships/assessores) usam o `Fechar` default que o host já renderiza inline — não afetados.
- **Migration:** sem migration (UI only).
- **Access / Consent:** nenhum.
- **UI:** Impeccable A — defect de render, restaura comportamento existente, sem redesenho.

## Fases verificáveis

1. **Root cause em teste** — unit test do shared path (provider + célula) que falha em `main` (crash do `DialogClose`) e passa com o fix: `tests/unit/campaignCellEditOverlay.unit.spec.ts` ganha describe do shared path cobrindo `MunicipalityListUpdateControl` e `MunicipalityListLevelControl` (abre → footer com submit + "Cancelar" → fecha via "Cancelar" sem crash).
2. **Fix no host/overlay** — chrome com footer; overlay sem portal; remoção de `footerPortalRef`/`hasCustomFooter`.
3. **Gates** — `pnpm gate:fast`; e2e mobile: novo teste no describe B42 (`tests/e2e/campaignMunicipalities.e2e.spec.ts`) abre o sheet "Registrar atualização" no card (dialog visível, footer com "Registrar atualização" + "Cancelar", fecha) — regressão que vermelha em main; e2e existente do popover intacto.
4. **Verificação manual no browser** — abrir/registrar/fechar os dois sheets custom no viewport mobile.

## Rabbit holes / Não escopo (engenharia)

- Redesenhar sheet/footer dos quick-edits.
- Outros drawers/shared-sheets (agenda, convites, notificações) — mecanismo próprio, fora.
- Refatorar a comparação de memo do `openSheet` (comportamento já não-detectável hoje).

## Riscos e mitigação

- **E14 e B42 compartilham o path** — o fix cobre ambos; unit + e2e cobrem os dois call sites.
- **Reabertura do sheet** — `dismissSheet` zera o chrome e o próximo `openSheet` recria o footer fresco; unit test cobre abrir→fechar→reabrir.
- **Footer stale no host** — o efeito do overlay re-envia o chrome a cada re-render da célula (dep `footer` já existe), então `isPending`/spinner chegam ao host; `useLayoutEffect` roda antes do paint.
- **Contexto do form** — o submit do footer continua associado pelo `form` attribute (DOM), como hoje; unit F5 existente garante a associação no path fallback.

## Aceite de engenharia

- [ ] Quick-edit sheet com footer custom abre no shared path sem console error, e "Cancelar" fecha (unit + e2e mobile novos)
- [ ] Popover desktop e fallback sem provider intactos (unit existente + e2e existentes verdes)
- [ ] Invariantes: sem migration, sem access/Consent, sem mudança de props nos call sites
