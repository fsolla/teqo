# Aproximar o Mapa das Praças à região filtrada

Status: rascunho
Atualizado em: 2026-07-21
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B12)
Impeccable: B — encaixe em `PlazaMapPanel` / `BahiaMap` (sem rota nova)
Appetite: ~0,5 dia eng; `fitToKeys` no Leaflet + chaves estáveis do bundle + teste/checklist
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` (register product — Field Desk) · tema `data-theme='campaign'` · shells existentes (`PlazaMapPanel`, `BahiaMap`).

Na implementação (`implement-roadmap-item`): craft compacto → critique → polish (comportamento de viewport; sem shape longo).

Brief compacto:

- **Persona / contexto:** Alex (coordenador) ou Assessor filtra por TI / tipo / cobertura e olha o mapa — hoje a Bahia inteira continua no frame e a região filtrada fica pequena demais para ler.
- **Job principal:** ao mudar o conjunto filtrado (URL ou escopo de access), o mapa **aproxima** o footprint geográfico desse conjunto.
- **Estratégia de cor:** Restrained — coroplético inalterado; só muda o viewport.
- **Anti-goals:** não redesenhar o painel; não esconder polígonos fora do filtro (já é contrato B7); não re-zoom a cada troca de ano/escala; não segunda interação “resetar zoom” neste item se o fit automático bastar.

## Contexto

**B7** ([mapa-pracas-filtrado.md](mapa-pracas-filtrado.md)) alinhou os dados do mapa ao `buildPlazaListWhere` da lista — o coroplético só pinta o conjunto filtrado. O viewport, porém, continua em `BAHIA_BOUNDS` (`src/components/campaign/BahiaMap.tsx`): `PlazaMapPanel` não passa `highlightKeys`, e o `else` do render faz `map.fitBounds(BAHIA_BOUNDS)`.

O próprio `BahiaMap` **já sabe** aproximar: quando `highlightKeys` tem itens, monta `L.geoJSON(highlightedFeatures).getBounds()` e chama `fitBounds` com `padding: [24, 24]` e `maxZoom: 10`. B7 adiara exatamente esse uso:

> `fitBounds` ao footprint filtrado — revisit when coordenação filtrar TI/região e reportar que a Bahia inteira no viewport atrapalha.

Pedido de produto (2026-07-21): o gatilho disparou — ao filtrar, aproximar a região.

## Objetivos

- Com filtro URL (ou escopo de assessor) que reduz o conjunto de Praças, o mapa abre/ajusta o viewport ao bounding box dos municípios (`codarea`) presentes no bundle.
- Sem filtro (coordenador com Bahia quase completa), o viewport permanece equivalente à Bahia inteira (fit nas chaves ≈ `BAHIA_BOUNDS`).
- Trocar **Ano** / **Escala** / **Comparar** **não** deve re-disparar zoom (só o footprint geográfico).
- Guardrails: sem migration, sem collection, sem Consent, sem server action; sem mudar o contrato de dados do B7.

## Decisões travadas

- **Item próprio B12 (não reabrir B7 nem absorver em R6/B6).** Gatilho explícito do B7; é UX de viewport, não filtro de dados, polish genérico nem `setStyle`. (2026-07-21, roadmap-item.) **Rejeitado:** fill-in sem plano (edge cases de re-zoom e highlight merecem decisão); fase “entregue” do B7 (histórico as-built fica; trabalho novo ganha ID).
- **Prop dedicada `fitToKeys` (não reusar `highlightKeys`).** `highlightKeys` hoje acopla **destaque visual** (borda/weight vermelhos) + fitBounds. Passar todos os `codarea` filtrados como highlight pintaria a TI inteira com stroke grosso. **Rejeitado:** `highlightKeys={Object.keys(...)}` (ruído visual); esconder GeoJSON fora do filtro (muda o contrato B7 / rabbit hole).
- **Chaves = `Object.keys(bundle.plazasByIbgeCode)`** — footprint estável do conjunto já escopado (access + B7), independente de `year` / `scaleMode` / `displayValues`. **Rejeitado:** chaves de `displayValues` (troca de ano re-zooma); só quando a URL tem filtro explícito (assessor com poucas Praças sem `?region=` também precisa aproximar).
- **`fitBounds` só quando a identidade de `fitToKeys` muda** (string canônica sorted join), não a cada rebuild de layer por `values`. Separar do efeito que reaplica estilo/dados, ou early-return se o footprint não mudou. **Rejeitado:** deixar o fit dentro do efeito atual ligado a `values` (B11/ano resetam o pan do usuário).
- **i18n e naming** (AGENTS.md): `fitToKeys`, `fitKey` / `fitBoundsKey`; strings visíveis inalteradas neste item.

## Questões em aberto

- **Botão “Ver Bahia toda” / reset de viewport?** **Opções:** A) não neste item (pan/zoom Leaflet + limpar filtro bastam) | B) controle explícito. **Recomendação:** A — appetite; revisitar se a coordenação pedir após usar o fit automático. _(assumido — validar no craft)_
- **Limiar para não “aproximar” (ex. >N municípios ≈ Bahia)?** **Opções:** A) sempre `fitBounds` nas chaves (N grande ≈ Bahia) | B) se `keys.length > threshold`, forçar `BAHIA_BOUNDS`. **Recomendação:** A no v1 — menos knobs; B só se profiling/UX mostrar jitter no fit de ~400 features.
- **`maxZoom` / padding?** **Opções:** A) manter `maxZoom: 10`, `padding: [24, 24]` do caminho highlight | B) tunar. **Recomendação:** A; polish só se um município único ficar apertado demais no craft.

## Abordagem proposta

```mermaid
flowchart LR
  bundle["PlazaMapBundle.plazasByIbgeCode"] --> panel["PlazaMapPanel"]
  panel -->|"fitToKeys = Object.keys(...)"| map["BahiaMap"]
  map -->|"fitKey mudou"| fit["map.fitBounds(features)"]
  map -->|"só values/ano/escala"| style["rebuild layer / setStyle — sem re-fit"]
```

Componentes:

- **`BahiaMap`** (`src/components/campaign/BahiaMap.tsx`): nova prop opcional `fitToKeys?: string[]` (default `[]`). Efeito (ou ramo) que, quando a chave canônica de `fitToKeys` muda: resolve features via `getMunicipalityFeature` / `getTerritoryFeature` (mesmo path de `highlightKeys`), `fitBounds` com padding/`maxZoom` atuais; se vazio → `BAHIA_BOUNDS`. **Não** alterar o estilo das layers. Depth check: não criar `BahiaMapViewport.ts` pass-through; reusar o bloco já existente de highlight bounds.
- **`PlazaMapPanel`** (`src/components/campaign/PlazaMapPanel.tsx`): `fitToKeys={Object.keys(bundle.plazasByIbgeCode)}` (memo estável se útil). Não passar as mesmas chaves em `highlightKeys`.
- **Teste:** unit do helper de chave canônica / “quando fitKey muda”; checklist manual: filtrar TI → aproxima; limpar filtros → Bahia; trocar Ano/Escala → viewport estável; assessor com poucas Praças → aproxima sem filtro URL.
- **Migration:** Sem migration, sem collection, sem server action.

## Dependências

- **Dura:** R2 (mapa) + **B7** (conjunto filtrado no bundle) — ambos entregues.
- **Suave:** nenhuma. B6 (`setStyle`) e B8 (polígonos-zona) são independentes; B8 pode no futuro refinar fit em SSA/CMS, fora deste item.
- Reusa: `BahiaMap` fitBounds existente, `plazasByIbgeCode` do B10/B7, geometrias `bahiaGeometries`.

## Não escopo

- Filtrar / omitir dados do mapa → **B7** (já entregue).
- `setStyle` incremental / perf de rebuild → **B6** ([escala-dry-pos-b3.md](escala-dry-pos-b3.md)).
- Polígonos Praças-zona SSA/CMS (fit por zona) → **B8** ([poligonos-pracas-zona.md](poligonos-pracas-zona.md)).
- Mover filtros acima do mapa / polish visual → **R6**.
- Esconder polígonos cinza fora do filtro; animação `flyTo` obrigatória.

## Rabbit holes

- **Acoplar zoom a `highlightKeys`.** Se alguém “só passar as chaves”: stroke vermelho em dezenas de municípios. **Mitigação:** prop `fitToKeys` só para viewport.
- **Re-fit a cada `values`.** Troca de ano/escala (B11) ou hover rebuild reseta o pan. **Mitigação:** dependência só da identidade de `fitToKeys`.
- **Dissolver polígonos / PostGIS / clip do layer.** **Mitigação:** só `fitBounds`; geometria continua Bahia inteira.
- **Fit por Praça-zona em Salvador/Camaçari.** Sem polígono de zona o bbox é o município. **Mitigação:** aceitar agregado municipal até **B8**.

## Adiado com gatilho

- **Controle “Ver Bahia toda”.** Revisitar se, após B12, usuários pedirem reset sem limpar filtros.
- **Threshold N→`BAHIA_BOUNDS`.** Revisitar se fit em ~400 `codarea` causar jank perceptível.
- **`flyTo` / `animate: true`.** Revisitar se critique pedir transição; default Leaflet `fitBounds` basta no v1.

## Referências

- `docs/roadmap.md` (Trilha B, item B12; gatilho de B7)
- `docs/plans/mapa-pracas-filtrado.md` — Adiado `fitBounds` (gatilho disparado 2026-07-21)
- `src/components/campaign/BahiaMap.tsx` — `BAHIA_BOUNDS`, fit em `highlightKeys` (linhas ~310–333)
- `src/components/campaign/PlazaMapPanel.tsx` — `<BahiaMap>` sem viewport keys hoje
- `src/utilities/plazaMapData.ts` — `PlazaMapBundle.plazasByIbgeCode`
- `src/lib/bahiaGeometries.ts` — `getMunicipalityFeature`
- AGENTS.md — Campaign map / naming
- `PRODUCT.md` / `DESIGN.md` — Field Desk; mapa como instrumento de coordenação
