# Escala e DRY pós-C150 (shell responsivo dos diálogos da agenda)

Status: rascunho
Atualizado em: 2026-09-12
Item do roadmap: fill-in de engenharia (Trilha C, pós-C150) — sem linha nova no roadmap
Issue: C156 (registrada por `agent:register`)
Priority: P3
Impeccable: B — encaixe estrutural sem pixel novo; paridade de DOM/`data-slot` é o aceite (sem critique visual)
Appetite: ~0,5–1 dia eng (fill-in)
Responsável: —

## Contexto

O C150 (#935) entregou o `GoogleCalendarPickerDialog` — a **3ª cópia** do chrome responsivo
Dialog/Drawer da agenda. O C148 (#933, entregue 2026-09-12) considerou e **rejeitou** a extração
(Opção C) para 3 call sites, com gatilho explícito: _"4º modal da agenda com o mesmo corpo
rolável, ou adoção do padrão por outro domínio"_ ([c148-modais-agenda-desktop-impl.md](c148-modais-agenda-desktop-impl.md),
Decisão C). Com o picker, há **4** modais com `data-slot="dialog-scroll-body"` (ActivityOverlay,
Sync, Feed, Picker) — **o gatilho disparou** (mesmo precedente do E10+: _"o gatilho disparou, e é por
isso que este lote existe em vez de mais uma linha adiada"_).

Três deles — `GoogleCalendarSyncDialog`, `CalendarFeedDialog` e `GoogleCalendarPickerDialog` — têm
chrome **idêntico** exceto `max-w` e conteúdo do rodapé: desktop
`DialogContent flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl sm:p-0`

- header `shrink-0 border-b px-6 py-4 pr-12 text-left` + corpo
  `min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4` + rodapé `shrink-0 border-t px-6 py-4`;
  mobile `DrawerContent max-h-[85vh]` + corpo rolável com as ações dentro + `DrawerFooter` com Fechar.

Evidência (linhas atuais, pós-simplify): picker `src/components/campaign/activity/GoogleCalendarPickerDialog.tsx`,
sync `GoogleCalendarSyncDialog.tsx`, feed `CalendarFeedDialog.tsx:214-260`; ActivityOverlay `:448`.

**Já resolvido no simplify (não reabrir):** picker com guarda de sessão (`sessionRef`/`reloadCount`),
catch de promise rejeitada e status de erro, `CalendarOption` extraído, retry com `useCallback`,
seleção desabilitada durante a escolha e copy da descrição corrigida; chrome com o envelope
`applyState` compartilhado pelos 4 handlers; sync dialog com `runAction` e `addLink` derivado
localmente; `buildGoogleCalendarWebcalUrl` morto removido; `resolveGoogleCalendarPickerClient`
dobrado em `loadWritableGoogleCalendars` e flag `changed` removida.

## Objetivos

- Um `CampaignResponsiveDialog` em `src/components/campaign/shared/`, dono do contrato responsivo
  (Dialog desktop com header/body/footer; Drawer mobile com ações no corpo + Fechar no
  `DrawerFooter`) — a divergência mobile/desktop deixa de estar triplicada.
- Sync/Feed/Picker compõem o shell com DOM e classes **idênticos** aos de hoje (paridade pinada
  pelos units/e2e existentes).
- F3 (cortável): fonte única da copy do one-click em `src` (chrome + dialog); testes seguem com literais.
- Guardrails: sem migration/schema/access/Consent; `ui/dialog.tsx` e os demais consumidores
  intocados; ActivityOverlay fora; comportamento e estado inalterados.

## Decisões travadas

- **Escopo: só os 3 homogêneos; ActivityOverlay fora.** O overlay usa `p-0` + cards com `<form>`
  envolvendo header/body/footer, `sm:max-w-3xl` e mobile como sheet (não Drawer); incluí-lo exigiria
  modos/wrappers que transformariam o shell num config pass-through — exatamente o que o C148
  rejeitou. **Rejeitadas:** shell paramétrico para os 4 (YAGNI/config); manter a 4ª cópia.
- **Props de forma, não `variant` genérico:** `{ title, description, children, actions?, size: 'lg' | 'xl', footerClassName? }`;
  ações no corpo no mobile e no rodapé fixo no desktop (a regra que o C148 conquistou). Picker = `lg`;
  sync/feed = `xl`. **Rejeitadas:** cada dialog montar os dois ramos (mantém a cópia);
  `asChild`/render-prop (cerimônia sem volatilidade).
- **Paridade como aceite, não redesign:** classes e `data-slot` preservados; se um unit exigir edição
  de asserção estrutural, parar e reavaliar.
- **F3 só se F1/F2 não estourarem** (cortável sem perda do objetivo principal).

## Fases

1. **F1 — shell + picker (tracer, ~50%).** Criar `CampaignResponsiveDialog`; migrar o
   `GoogleCalendarPickerDialog` (call site mais novo, com unit próprio). Gate: unit do picker verde +
   inspeção visual mobile/desktop.
2. **F2 — sync + feed (~35%).** Mesmo diff mecânico. Gate: units `googleCalendarSyncDialog`/
   `calendarFeedDialog` verdes sem edição das asserções estruturais.
3. **F3 — copy única do one-click (cortável, ~5%).** Exportar a label consumida por
   `AgendaGoogleSyncChrome` e `GoogleCalendarSyncDialog`; literais permanecem nos testes/e2e.
4. **F4 — gates (~10%, não cortável).** `pnpm gate:fast`; e2e afetados (`campaignAgendaGoogleSync`,
   `campaignAgendaFeed`, `campaignActivity`); changelog.

## Rabbit holes / Não escopo

- Não tocar `ui/dialog.tsx` nem os outros consumidores (C148).
- Não incluir `ActivityOverlay` (form/cards/mobile sheet) — gatilho: 2º overlay de form com o mesmo formato.
- Não unificar os breakpoints (`useNarrowMeasured(640)` do overlay vs `useIsMobile()` 768) — C148.
- Não unificar as máquinas de estado picker/sync (S3) — domínios distintos (lista+escolha × ciclo de sync).
- Não mudar copy (fora F3), lógica, estado, nem o `DrawerFooter`/nested sheet.
- Não redesenhar: zero pixel novo; classes idênticas.

## Riscos e mitigação

- **Regressão mobile por recomposição:** paridade de DOM; units/e2e mobile (C103/C94/C114) verdes;
  diff por dialog.
- **twMerge/variantes `sm:`** (lição C148): o shell espelha as variantes e preserva `p-0`; asserções
  são de `data-slot`/estrutura, não de classe.
- **Rodapé condicional** (sync não renderiza quando vazio; feed sempre; picker condicional): `actions?`
  — footer só com `actions`; sync passa `errorNotice` junto das ações.
- **Testes acoplados ao shell:** asserções existentes são estruturais; edição delas = sinal de mudança
  de comportamento → parar.

## Explicitamente fora

- **S3 — máquinas de estado picker/sync:** deferido — não é duplicação exata (ciclos de domínio
  distintos; D5 do C150 escolheu diálogos separados). Gatilho: 3º diálogo com a mesma máquina busy/erro/ação.
- **S2 standalone:** absorvido como F3 (cortável); se cortada, gatilho: 3ª superfície consumindo a label.
- **ActivityOverlay na extração:** fora (heterogêneo) — gatilho acima.
- **`ui/dialog.tsx` / unificação de breakpoint:** decisões do C148, não reabrir.
- Achados cosméticos dos revisores aplicados no simplify — não reabrir.

## Aceite de engenharia

- [ ] Os 3 diálogos compõem `CampaignResponsiveDialog`; nenhuma cópia do chrome trio resta
      (`grep` por `sm:max-w-xl` + `dialog-scroll-body` só no shell).
- [ ] DOM mobile idêntico (ações no corpo + `DrawerFooter` Fechar) e desktop com rodapé fixo;
      units/e2e atuais verdes sem edição de asserção estrutural.
- [ ] `pnpm gate:fast` verde; e2e afetados rodados; changelog.
- [ ] Sem migration/access/Consent; `ui/dialog.tsx` intacto.

## Self-score (decision-quality)

| Critério                           | Nota | Justificativa                                                                                                                  |
| ---------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| Decisões caras têm rejeitadas?     | 4/5  | Escopo (trio vs 4) e forma do shell com rejeitadas explícitas; demais decisões são baratas.                                    |
| Cabe no appetite?                  | 5/5  | 1 componente + 3 migrações mecânicas + testes; sem schema.                                                                     |
| Rabbit holes nomeados?             | 5/5  | Overlay, breakpoints, máquinas de estado, base global, copy fora de F3.                                                        |
| Depth check: reusa shells/helpers? | 4/5  | O shell encapsula o contrato responsivo conquistado no C148; não é pass-through para o trio (é para o overlay, que fica fora). |
| Intenção permanece satisfeita?     | 5/5  | Refactor sem pixel/comportamento novo; paridade pinada por testes.                                                             |

**Total: 4,6/5 (gate ≥4).**
