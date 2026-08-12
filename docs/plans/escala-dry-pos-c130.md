# Escala e DRY pós-C130 (registro de facets da omnibox)

Status: rascunho
Atualizado em: 2026-08-11
Item do roadmap: fill-in **C130+** pós-[#697](https://github.com/fsolla/teqo/issues/697)
Impeccable: A — sem superfície UI nova (DRY/estrutura)
Appetite: ~0,5–1 dia eng
Responsável: —

## Contexto

O C130 adicionou o **5º facet** da lista de pessoas (`party`), cada um com o mesmo
bloco em `peopleOmnibox.ts` (seeds com `createOmniboxSuggestionSeed`, chips,
branches de prefixo em `applyPeopleOmniboxSuggestion`/`removePeopleOmniboxChip`)
mais o toggle correspondente em `peopleListFilters.ts` e o param no
`peopleListUrl.ts`. O padrão já era repetido para capacity/municipality/status/
ausência — e a mesma forma existe nas outras listas (lideranças, municípios,
apoiadores). A cada facet novo, o custo de adição é ~5 edições em 3 módulos, com
risco de esquecer um branch (facet que aparece nas sugestões mas não filtra).

## Objetivos

- **Registro declarativo de facet** (um lugar por facet: prefixo do id, grupo,
  label, keywords, toggle/parse): `peopleOmnibox.ts` e `peopleListFilters.ts`
  derivam seeds/chips/branches do registro; a adição de um facet novo vira uma
  entrada, não cinco edições.
- Sem mudança de URL/contrato (params, chaves e labels pt-BR iguais).
- Escopo mínimo: **pessoas** (os 5 facets). Generalizar para as outras listas
  só quando a segunda lista adotar (2º consumidor) — mesmo corte do C130.
- **Hazard documentado no registro:** valores de facet de texto livre (partido)
  não podem conter `:` (separador do id de sugestão) — validação no registro.

## Já resolvido no simplify/critique (não reabrir)

- Parse do `party` simplificado para `allParamValues(...).filter(≤32)` (o
  helper já trima/deduplica) — redundância removida.
- Comentários de sort key (`peopleListUrl`/`peopleData`) reconciliados com a
  exceção C130 (base/party invisíveis vs `email` oculta-por-toggle).
- Comentários "Aliada em" → "Dobra em" (3 pontos).
- Orfandade `field: 'city'` removida (type/schema/record/formAction).
- Tooltip span-wrappers documentados por site (disabled vs ref-forwarding).

## Explicitamente fora

- **Flake `googleCalendarSync.int.spec.ts`** (falha intermitente, reproduz no
  main limpo) — classe de teste instável pré-existente, fora deste lote.
- **Flakes e2e sob carga da máquina** (setup prewarm socket hang-up; picker
  "2022"/B34 em runs combinados com load ~60+; passam isolados e no main) —
  classe já documentada no changelog B197+; reavaliar com harness dev
  estabilizado.
- **Tooltip `openOnTouch` nas ações da tabela de pessoas** — a tabela é
  desktop-only (`md:block`); touch não a alcança. Gatilho: se a tabela ganhar
  cobertura coarse, seguir o precedente B23 (`openOnTouch={false}` em
  triggers que abrem Popover/Dialog).
- **Label mobile "Base:" vs 2ª linha desktop sem label** — decisão de gate
  (mobile muda só o nome da coluna; C130 anti-goal). Gatilho: redesign dos
  cards mobile.
- **Janela do save já-despachado no Escape** (draft descartado localmente mas
  o save em voo persiste) — mitigada com `requestId` bump; janela
  completada-save irrecuperável client-side, documentada no código. Gatilho:
  se o autosave da célula virar transacional.

## Fases

1. **Registro de facets de pessoas** — declarar os 5 facets existentes; derivar
   seeds/chips/apply/remove/toggles do registro; unit tests do
   `peopleOmnibox`/`peopleListFilters` inalterados em comportamento.
2. **Gates** — `pnpm gate:fast`, e2e `campaignPeople`.

## Guardrails

- Identificadores em inglês; labels pt-BR intactos (grupos "Capacidade",
  "Município", "Apoio", "Ausência", "Partido", "Ordenação").
- Sem migration/access/Consent/URL nova.
- Precedentes: `escala-dry-pos-c6.md` (F3 — DRY de filtros/forms),
  `escala-dry-pos-c8.md` (facet de município de apoiadores).
