# Demandas — tipo e busca na omnibox

Status: registrado
Atualizado em: 2026-08-02
Issue: #308
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na lista `/campanha/demandas`
Appetite: ~0,5–1 dia eng
Responsável: —

## Intenção

A omnibox de demandas só expõe **Status**. Tipo já existe na URL (`kind`) e na coluna da tabela, mas sem superfície na barra; também não há busca por texto para achar uma demanda pelo que está escrito. Deep-links de atividade continuam sendo atalho, não o job diário da lista.

Queremos **Tipo** + **Busca** na omnibox, junto do Status já existente.

## Persona e fluxo

- **Persona / contexto:** Staff triando ou revisando demandas.
- **Job principal:** filtrar por tipo e/ou achar por texto sem caçar na tabela.
- **Fluxo desejado:** digita tipo ou trecho do pedido → chip → lista filtrada; Status continua como hoje; limpar zera o recorte da barra (deep-link `activity` pode permanecer se já for política atual).
- **Anti-goals de produto:** inventar UI nova para deep-link de atividade neste item; segunda toolbar de chips.

## Objetivo e aceite

- Omnibox sugere e aplica **Tipo** (valores de produto já usados na vertical).
- Texto livre → chip **Busca: …** restringindo a lista (campos visíveis da linha: pelo menos o texto/assunto que o staff já lê na lista).
- Status permanece; chips coexistentes e removíveis.
- Ausência de tipo/busca = sem restrição naquela dimensão.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** staff — “quais demandas deste tipo / com este texto?”
- **Forma:** _adiada_.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `DemandFilters`, `demandOmnibox`, `demandListUrl` / loaders de lista.
- **Precedente:** B127 “não inventar superfície de kind” → **agora pedido explícito**; Status já na omnibox (B128).
- **Risco:** URL com `kind`/`activity`/`status`; não quebrar deep-links de atividade.

## Dependências

- Nenhuma.

## Fora de escopo

- Filtro por município / solicitante / liderança (salvo se já for trivial e o aceite expandir — **não** neste appetite).
- Filtro omnibox pelo deep-link `activity` (continua URL-only).
- Saved filters.

## Rabbit holes de produto

- **Busca full-text em anexos / histórico.** **Corte:** só campos já mostrados na lista.

## Questões em aberto (produto)

- **O que a busca cobre?** **Opções:** A) título/resumo visível · B) também solicitante. **Recomendação:** A no mínimo; B se o nome já está na linha. _(assumido A+B se trivial)_

## Referências

- Inventário plan-issue 2026-08-02 — gaps 4 e 8
- `src/utilities/demand/demandOmnibox.ts`
- `src/utilities/demand/demandListUrl.ts`
- `src/components/campaign/demand/DemandFilters.tsx`

- GitHub Issue #308
