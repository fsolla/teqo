# UX Field Desk pós-critique

Status: registrado no roadmap (fases pendentes)
Atualizado em: 2026-07-19
Item do roadmap: [docs/roadmap.md](../roadmap.md) (FD2, fill-in de design/produto pós-critique Impeccable `/campanha`)
Responsável: —

## Contexto

O re-critique de `/campanha` (2026-07-19, dual-agent) subiu o score de **28 → 32/40** após o ciclo quieter → polish. Os P1 do baseline (parede de filtros, grade de KPI cards, side-tab) estão fechados. Permanecem débitos de **design/produto** (não só DRY) que o time não implementou naquele ciclo — registrados aqui para não se perderem no chat.

Fonte: [`.impeccable/critique/2026-07-19T11-03-23Z__src-app-campaign-campanha.md`](../../.impeccable/critique/2026-07-19T11-03-23Z__src-app-campaign-campanha.md) e síntese em sessão (heurísticas 7=2 flexibilidade, 10=2 ajuda).

## Objetivos

- Alex (geral/coordenador) consegue tratar a fila **Prioridade · Sem coordenador** com multi-select + ação em lote (atribuir coordenador), sem N navegações.
- Lia e first-timers encontram definição inline de jargão recorrente (`engajado`, estimativa confirmada vs proposta, status de apoio) sem sair da tela.
- Outline do dashboard `geral` não pula de `h1` para `h3` (detector `skipped-heading`; Sam/a11y).
- Empty do coordenador sem núcleos espelha o padrão de liderança (CTA + próximo passo).
- Guardrails: sem migration obrigatória na v1 da triagem (reusa designação de coordenador existente); sem Consent novo; touch `min-h-11` preservado.

## Decisões travadas

- **Um plano FD2, fases por severidade do critique.** P2 antes de P3. Ordem: triagem em lote (impacto Alex) → glossário inline (Help) → outline a11y → empty coordenador → chrome motion (cortável).
- **Bulk só na fila de prioridade na v1.** As filas “sem atualização” e “estimativas pendentes” continuam one-by-one até haver evidência de volume — evita escopo de “saved views” genérico.
- **Glossário = affordance inline, não página de docs.** Tooltip/`Popover`/`?` em `SupportStatusBadge` e labels de estimativa; uma frase Núcleo/ZE já existe na lista.
- **P3 mobile red bar vs rail** permanece documentado em `DESIGN.md` como field-mode intencional — **fora deste plano** (escolha explícita no ciclo Impeccable).
- **i18n e naming:** identificadores em inglês (`bulkAssignCoordinators`, `CampaignGlossaryHint`), copy em pt-BR.

## Questões em aberto

- **Bulk assign: mesmo sheet de designação ou fluxo novo?** **Recomendação:** reusar o shell/lazy de `assignCoordinators` por núcleo em sequência sob uma txn ou N actions com progresso — não inventar multi-núcleo no Payload sem necessidade; UX é checklist + um coordenador aplicado a N slugs.
- **Quem pode bulk?** **Recomendação:** só `geral` (já é quem designa coordenadores em massa conceitualmente); `coordenador` não aparece na fila “Sem coordenador”.
- **Primeiro glossário: tooltip Radix ou texto expandido?** **Recomendação:** `Popover`/`HoverCard` com `min-h-11` no gatilho `?` — funciona em touch melhor que hover-only.
- **Ícone AlertTriangle no empty de liderança?** Critique minor: tom alarmista. **Recomendação:** trocar para `UsersIcon` / `InboxIcon` na mesma passagem do empty do coordenador (Fase 4).

## Abordagem proposta

```mermaid
flowchart TD
    CR["Critique 32/40"] --> F1
    F1["Fase 1 — Triagem em lote<br/>fila Sem coordenador"]
    F1 --> F2["Fase 2 — Glossário inline<br/>engajado / estimativa / apoio"]
    F2 --> F3["Fase 3 — Outline h2 Filas<br/>dashboard geral"]
    F3 --> F4["Fase 4 — Empty coordenador + CTA<br/>(+ ícone liderança)"]
    F4 --> F5["Fase 5 — Sidebar layout-transition<br/>(cortável)"]
```

### Fase 1 — Triagem em lote (P2)

- Em **`CampaignDashboard`** / `QueueSection` com `openCoordinatorAssignment`: modo multi-select (checkbox por linha) + barra “Atribuir coordenador (N)”.
- Server action (ou extensão da existente de assign) recebe `nucleusSlugs[]` + `coordinatorIds[]`; access `geral`; `overrideAccess: false`; txn se multi-write.
- Reusa padrões de `CoordinatorAssignment` / shell lazy do detalhe do núcleo — extrair só o necessário para não puxar o editor completo N vezes no client.

### Fase 2 — Glossário inline (P2)

- **`CampaignGlossaryHint`** (novo, pequeno): props `termKey`, children trigger.
- Ligar em **`SupportStatusBadge`**, cartão de estimativa (`VoteEstimateCard` / labels no dashboard de liderança), e opcionalmente chip de ZE se ainda houver dúvida após a frase da lista.
- Copy curta aprovável por produto (sem inventar doutrina eleitoral).

### Fase 3 — Outline do dashboard (P2 a11y)

- Em **`CampaignDashboard`** (`GeneralDashboard`): promover “Filas de ação” a `h2` visível (hoje só `CardTitle` em `div`); manter títulos de cada fila como `h3`.
- Verificar ordem DOM: h1 → h2 Filas → h3s → h2 Indicadores.

### Fase 4 — Empty coordenador (P3)

- Espelhar **`LeadershipDashboard` empty**: `EmptyMedia` + CTA (`Ver meu perfil` e/ou texto “peça à coordenação geral…”).
- Suavizar ícone do empty de liderança (AlertTriangle → ícone não-alarme).

### Fase 5 — Motion do Sidebar (P3, cortável)

- Em **`Sidebar.tsx`** (ou wrapper campaign): evitar `transition-[width,height,padding]` em favor de `transform`/`opacity` onde o detector marcou `layout-transition`.
- Só se profiling/UX mostrar jank; caso contrário cortar.

## Dependências

- Soft: polish Field Desk (filas, empties base) mergeado.
- Soft: FD+ (shell/heading) melhora consistência mas **não bloqueia** FD2.
- Reusa `CampaignDashboard.tsx`, access de designação de coordenador, `SupportStatusBadge`, tema campaign.
- Sem migration na v1; sem Consent.

## Não escopo

- DRY de shell/heading/datas/VoteGoals/filters bag — **FD+** ([escala-dry-pos-field-desk.md](escala-dry-pos-field-desk.md)).
- Saved views genéricas de filtros de lista (além do bulk da fila).
- Quiet da barra vermelha mobile (field-mode documentado).
- Bulk nas filas secundárias do dashboard.
- Push/offline ambient cue no shell (Casey) — candidato a D1/D2 follow-up, não este plano.

## Referências

- [`.impeccable/critique/2026-07-19T11-03-23Z__src-app-campaign-campanha.md`](../../.impeccable/critique/2026-07-19T11-03-23Z__src-app-campaign-campanha.md)
- `docs/roadmap.md` (Fill-ins FD2)
- `PRODUCT.md` / `DESIGN.md` — Field Desk, Signal Red, personas Alex/Casey/Lia
- `src/components/campaign/CampaignDashboard.tsx`, `SupportStatusBadge.tsx`, shells de assign de coordenador
- AGENTS.md — campaign auth, `overrideAccess: false`, naming
