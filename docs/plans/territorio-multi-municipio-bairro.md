# Território multi-município e multi-bairro

Status: **implementado** (2026-07-18)
Atualizado em: 2026-07-18
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha A → A1)
Responsável: —

## Referência visual (UX Pilot)

Design: [`Formulario-Territorio.png`](../design-refs/latest/Formulario-Territorio.png) · [`Formulario-Territorio.html`](../design-refs/latest/Formulario-Territorio.html) — **compartilhado com [zonas-por-municipio.md](zonas-por-municipio.md)** (a mesma tela cobre os dois planos).

![Formulário de território do núcleo](../design-refs/latest/Formulario-Territorio.png)

Como usar (parte deste plano — bloco Território):

- **Adotar a estrutura:** "Municípios" como combobox multi-seleção com chips removíveis + contagem "2 municípios selecionados"; "Territórios de Identidade" como chips derivados somente leitura com cadeado e legenda "Derivados dos municípios selecionados · não é possível editar" (materializa a regra 3 — `regions` rederivado no servidor); "Bairros" desabilitado com placeholder "Selecione municípios primeiro" e o aviso "Bairros exigem um único município selecionado" (regra 5).
- **Divergência a resolver na implementação:** no design o campo de bairros aparece desabilitado com 2 municípios e o aviso âmbar simultaneamente; a regra é: habilitar bairros somente com exatamente 1 município e limpar bairros ao passar para >1 (mostrar o aviso como helper text, não como erro).
- **Fora deste plano:** a seção "Zonas Eleitorais (TSE)" com chips "sugerida" pertence a [zonas-por-municipio.md](zonas-por-municipio.md).
- **Ajustar cores:** paleta antiga no HTML/PNG. Implementar com `StrictCombobox`/`NucleusTerritoryFields` existentes e os tokens do tema `campaign` (chips neutros claros; chips de município selecionado não precisam ser navy).

## Contexto

O MVP modelava o território do Núcleo com campos single-valued (`region` / `city` / `neighborhood`). Isso não cobria núcleos multi-município (incluindo cross-territory) nem multi-bairro. Decisão de produto (2026-07-17): Modelo A — arrays planos — com `regions` derivado no servidor a partir de `cities` quando houver municípios.

## Decisão de modelagem (Modelo A + cross-territory)

- `region` → **`regions`** (`text` + `hasMany`, max 27): Territórios de Identidade. **Derivado no servidor** a partir dos municípios quando `cities` não vazio; editável manualmente só quando `cities` vazio.
- `city` → **`cities`** (`text` + `hasMany`, max 27): múltiplos municípios, podem cruzar TIs.
- `neighborhood` → **`neighborhoods`** (`text` + `hasMany`, max 30): múltiplos bairros; exige exatamente 1 município.
- `locality` e `territoryNotes`: inalterados.

### Regras de validação

1. Pelo menos um de: `regions`, `cities`, `locality`.
2. Cada city/region deve ser válido na Bahia.
3. Se `cities` não vazio → `regions = territoriesForCities(cities)` (servidor ignora o valor enviado).
4. Se `cities` vazio → `regions` é a escolha manual (1+ TIs).
5. Se `neighborhoods` não vazio → `cities.length === 1`.
6. Trim + dedup + tetos `maxRows`.

## Implementação (como ficou)

### Storage (correção vs rascunho)

Não usamos Postgres `text[]` + GIN. O Payload 3.82 modela `text` + `hasMany` na tabela compartilhada `electoral_nucleus_texts` (`parent_id` / `path` / `order` / `text`). Isso preserva admin, types e Local API sem schema paralelo. `select` hasMany para `regions` foi rejeitado: criaria enum Postgres com nomes acentuados dos 27 TIs (dados vivos em `bahiaTerritories.ts`).

### Filtro (correção vs rascunho)

O rascunho dizia `contains`, mas em Payload `contains` é substring. A associação “array contém este valor” usa `{ regions: { equals } }` / `{ cities: { equals } }`. A URL da lista continua single-select (`region` / `city`).

### Arquivos tocados

- Collection + hook: `src/collections/ElectoralNucleus.ts`
- Helper: `territoriesForCities` em `src/lib/bahiaTerritories.ts`
- Zod: `src/lib/schemas/nucleus.ts`
- FormData: `src/utilities/nucleusFormData.ts` + `repeatedFormTexts` em `src/lib/formData.ts`
- Query/VM/UI: `nucleusUi`, `nucleusViewModels`, `nucleusPageData`, dashboard, `NucleusTerritoryFields`, list/detail
- Liderança: `Contact.city` = `cities[0]` só quando `cities.length === 1`, senão `locality ?? null`
- Migration: `src/migrations/20260718_190559_territorio_multi_municipio_bairro.ts` (backfill + down com `RAISE EXCEPTION` se `count > 1`)

## Questões em aberto — resolvidas na implementação

| Questão                | Resolução                                               |
| ---------------------- | ------------------------------------------------------- |
| Tipo do campo Payload  | `text` + `hasMany` para os três campos                  |
| Admin Payload UI       | inputs nativos hasMany; combobox rico só em `/campanha` |
| Limite máximo          | 27 municípios/TIs, 30 bairros                           |
| Filtro cross-territory | aparece ao filtrar por qualquer TI tocado (`equals`)    |

## Dependências

- A2 ([zonas-por-municipio.md](zonas-por-municipio.md)) nasce contra `cities[]` (união das zonas).
- C3/C4 (eventos/demandas) devem copiar o bloco multi de território.

## Não escopo

Array estruturado por município; mapa/PostGIS; sugestões cruzadas A2 (`bahiaTseZones` + chips opt-in); mudar `Contact.city` além da regra de derivação na criação de liderança.
