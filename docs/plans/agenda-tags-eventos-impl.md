# Impl: Agenda — tags para agrupar compromissos + filtro por tag na omnibox

Status: aprovado
Atualizado em: 2026-08-09
Issue: #506
Intenção: docs/plans/agenda-tags-eventos.md
Appetite restante: herdado (~1 dia eng)

## Leitura da intenção

- **Outcome:** cada equipe agrupa os compromissos do jeito dela: tags livres no sheet de criação (chips, texto livre, sugestões das já usadas), rótulo leve no evento do calendário, e a agenda filtra por tag dentro da filter omnibox existente (C94), combinando com os demais filtros e persistindo no estado/URL como eles.
- **O que NÃO negociar:** tag não é `Contact` nem a coleção `Tag` dos posts; texto livre (sugestões são autocomplete, não lista obrigatória); filtro é **dimensão da omnibox existente** (não barra/chips separados); liderança não acessa a agenda (inalterado); sem regressão em criação com horário, remanejo por arrasto (C15), filtros C94 e "Mais detalhes" (C91).
- **O que reavaliar:** a hipótese de direção diz "a tag entra como opção da omnibox" — **isso já foi entregue pelo C94** (2026-08-09): `ActivityAgendaState.tag`, sugestões de `knownTags` (vazias visíveis), chips removíveis, `buildActivityAgendaWhere` com `tags: { contains }`, `restrictActivityAgendaState` por tags acessíveis, `loadAccessibleActivityTags` na página. O gap real do C105 está em: **(1)** campo de tags no sheet inline (`ActivityInlineCreate`), **(2)** rótulo de tag no evento do calendário, **(3)** tags via prefill do "Mais detalhes" (`buildActivityCreateHref`/`parseActivityCreatePrefill`), **(4)** threading de `knownTags` da página da agenda até o sheet.

## Abordagem recomendada

```mermaid
flowchart LR
  Page[agenda/page.tsx] -- knownTags --> Agenda[ActivityAgenda]
  Agenda -- knownTags --> Sheet[ActivityInlineCreate]
  Sheet --> TagInput[ActivityTagInput (extraído do ActivityForm)]
  Sheet -- tagsJson --> Action[createActivityInline]
  Sheet -- tags no href --> Prefill[buildActivityCreateHref]
  Prefill --> Nova[/atividades/nova/]
  Nova --> Form[ActivityForm → TagInput initialTags]
  Agenda -- extendedProps.tags --> Event[renderEventContent → rótulo leve]
```

**Opções consideradas:**

- **A)** Reusar o `TagInput` já existente em `ActivityForm.tsx` (hoje privado), extraindo-o para um componente compartilhado `src/components/campaign/activity/ActivityTagInput.tsx`, usado pelo sheet e pelo form.
- **B)** Escrever um segundo campo de tags no sheet (duplicar).
- **C)** Levar tags ao evento só via `title` (concatenar no texto) e pular prefill/mais detalhes.

**Recomendação: A (+ C para o rótulo? não — rótulo dedicado).** A: 2 call sites com comportamento idêntico (chips, dedup, limite, datalist de sugestões) → extrair é DRY de conhecimento; a extração é refactor preservador de comportamento (mesmo hidden input `tagsJson`, mesmo limite `MAX_ACTIVITY_TAGS`/`MAX_ACTIVITY_TAG_LENGTH`), com adições retrocompatíveis: `name` prop (default `tagsJson`), `useId()` no datalist (2 instâncias simultâneas nunca acontecem, mas id fixo é risco barato de eliminar) e `onChange` opcional para o href do "Mais detalhes" (o sheet constrói o href em render a partir de estado React, não de FormData).

**Rejeitadas:** B porque duplicaria dedup/limites/datalist e os dois campos divergiriam; C para o rótulo porque o aceite pede "rótulo leve de tag" no evento e misturar no título degrada busca/leitura (o `title` é usado em busca da lista e notificações).

**Divergência da hipótese de direção da intenção:** a intenção (rascunho 2026-08-09) foi escrita antes do C94 entregar a dimensão Tag da omnibox; o impl plan assume isso e não reimplementa nada do filtro.

### Componentes / mudanças

- **`ActivityTagInput`** (`src/components/campaign/activity/ActivityTagInput.tsx`, NOVO): `TagInput` extraído de `ActivityForm.tsx` com as adições acima. Mesma UI (chips `bg-secondary`, botão ×, input com datalist, Enter/vírgula/Backspace, blur commit), hidden input `tagsJson`, `FieldDescription` ("Classificação livre do compromisso…").
- **`ActivityInlineCreate`** (`src/components/campaign/activity/ActivityInlineCreate.tsx`): nova prop `knownTags?: string[]`; campo "Tags" (TagInput) após Local; submit envia `tags` parseados de `tagsJson` (parser inline espelhando `parseInlineResponsibles`, fail-closed); "Mais detalhes" inclui `tags` no prefill; estado espelho via `onChange` para o href.
- **`ActivityAgenda`** (`src/components/campaign/activity/ActivityAgenda.tsx`): nova prop `knownTags?: string[]` repassada ao sheet; `toEventInput` ganha `tags` em `extendedProps`; `renderEventContent` renderiza linha de tags (≤2 + "+N") apenas em views timeGrid (week/day) e list, escondida no mês (denso) e no mobile (mesma media query da location).
- **`ActivityAgenda.css`**: `.activity-agenda-event-tags` (muted, ellipsis, oculto em ≤767px junto com a location).
- **`agenda/page.tsx`**: passa `knownTags` ao `ActivityAgenda` (já carrega `loadAccessibleActivityTags`).
- **`activityUi.ts`**: `ActivityCreatePrefill.tags?: string[]`; `buildActivityCreateHref` serializa `tags` como **params repetidos** (`tags=a&tags=b` — tag livre pode conter vírgula, então nada de join por vírgula; JSON no URL é feio); `parseActivityCreatePrefill` lê `getAll('tags')` com fail-closed (trims, drop > `MAX_ACTIVITY_TAG_LENGTH`, cap `MAX_ACTIVITY_TAGS` — mesmo padrão do `title` bounded).
- **`ActivityForm.tsx`**: usa o componente extraído; `initialTags={initialValues?.tags ?? activity?.tags ?? []}`.
- **Migration:** NÃO — o campo `tags` (hasMany text) já existe na collection desde C14; o filtro já filtra; sem schema/access/Consent novos.

### Dados → forma (se aplicável)

- Forma escolhida: rótulo textual leve (linha muted, `#tag`), não badge colorido — tag não tem identidade visual (corte da intenção); o filtro ativo já é o destaque. Rejeitadas: chips/badges por tag no evento (poluição visual em slots de 30 min), ocultar completamente (o aceite pede o rótulo).

## Fases verificáveis

1. **Utilities/prefill** — `ActivityCreatePrefill.tags` + `buildActivityCreateHref` + `parseActivityCreatePrefill`; testes unit em `activityUi.unit.spec.ts` (round-trip, limites, fail-closed). `pnpm test tests/unit/activityUi.unit.spec.ts`.
2. **Extração + sheet + threading** — `ActivityTagInput.tsx`, `ActivityForm` usando o extraído, `ActivityInlineCreate` com campo/knownTags/submit/href, `ActivityAgenda` + página repassando `knownTags`; testes em `activityInlineCreate.unit.spec.tsx` (chip por Enter, save com tags, href com tags, sugestões do datalist). `pnpm test tests/unit/activityInlineCreate.unit.spec.tsx`.
3. **Rótulo no evento** — `extendedProps.tags` + render condicional por view + CSS; teste de render no `activityAgendaInteractions.unit.spec.tsx` se o harness permitir (senão teste do view model já cobre `tags`).
4. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Não tocar no chassis da omnibox compartilhada (a dimensão Tag já está lá; nada das demais listas muda).
- Não mudar `MAX_ACTIVITY_TAGS`/`MAX_ACTIVITY_TAG_LENGTH` (ver Riscos — divergência da recomendação da intenção).
- Não levar tags ao feed iCal (C92–C96 já usam `filterTag`/descrição; fora de escopo da intenção).
- Não criar cores/taxonomia por tag; sem admin.

### Adiado com gatilho (triage /simplify, 2026-08-09)

- **Normalização de tags unificada.** O cleanup da sessão removeu a 3ª cópia (`parseInlineTags` — o sheet agora lê do estado espelho), mas restam dois parsers com política levemente diferente: `parseTagsFormData` (`src/utilities/activityFormData.ts`, server, slice, sem dedup) e `parseActivityPrefillTags` (`src/utilities/activityUi.ts`, URL, drop, dedup). **Gatilho:** um 3º ponto de parse de tags OU qualquer edição em `parseTagsFormData` → extrair `normalizeActivityTags` puro em `src/lib/schemas/activity.ts` com política por fronteira.
- **Footer sticky do sheet** (scrola junto em viewports baixos): **Gatilho:** C103 (in-progress) remodela o sheet de criação — avaliar lá, não aqui.

## Riscos e mitigação

- **Limites 3 tags / ~24 chars da intenção vs 20/80 existentes (C14).** A intenção marca a recomendação como "(assumido — validar)" e "ajustável depois"; o código shipped usa 20/80 compartilhados com o composer de giro (C14), o parse de URL (`activityTag`) e o schema. Apertar agora seria regressão em comportamento shipped e quebraria tags existentes > 24 chars (o filtro as descartaria do URL). **Decisão proposta: manter 20/80**; "poucas tags" é satisfeito pela affordance da UI. Ajuste futuro é barato (constante única) — registrado como decisão do gate.
- **Rótulo poluindo visões densas (mês).** Mitigação: render só em timeGrid/list + oculto no mobile (padrão da location); truncado com ellipsis e "+N".
- **Conflito de merge com C103/C104** (in-progress em outros worktrees, mesma superfície — sheet). C105 toca `ActivityInlineCreate` de forma aditiva (campo novo + props); resolução de conflito no merge sequencial de main. Sem dependência de código deles.
- **Extração do TagInput mudar o form cheio.** Refactor preservador: mesmos props nomeados, mesmo hidden input, mesmo datalist; `pnpm test` + gates pegam drift; o form cheio não tem teste unit próprio hoje (coberto por e2e/regressão).

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (filtro já entregue por C94; sheet/rótulo/prefill entregues aqui)
- [x] Invariantes AGENTS/engineering-standards (sem migration, sem access/Consent, ids em inglês, copy pt-BR)
- [x] Testes de domínio previstos (unit: prefill tags, inline create com tags, rótulo)
