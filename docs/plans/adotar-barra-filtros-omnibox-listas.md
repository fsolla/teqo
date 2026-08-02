# B128 — Adotar barra omnibox nas demais listas `/campanha`

Status: registrado
Atualizado em: 2026-08-02
Issue: #265
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe do padrão B127 nas barras já existentes
Appetite: ~1–1,5 dia eng (N listas com o mapa de variantes já fechado em B127)
Responsável: —

## Intenção

Depois do piloto em Municípios (B127), o staff ainda encontra a pilha antiga nas outras listas. Querem o **mesmo** padrão omnibox (chips no input + sugestões ao digitar) em toda lista de `/campanha` que hoje tem busca e/ou filtros, respeitando o mapa de variantes do plano-pai.

## Persona e fluxo

- **Persona / contexto:** Mesmo staff do B127, mudando de Municípios para Lideranças / Territórios / etc.
- **Job principal:** filtrar qualquer lista com o mesmo gesto mental.
- **Fluxo desejado:** igual ao B127; só mudam as dimensões sugeridas (mapa no plano B127).
- **Anti-goals:** reinventar o chassis; mudar semântica de filtros; inventar dimensões novas; forçar omnibox rica onde só existe `q`.

### Esboço de fluxo (B)

```text
[abre lista ≠ municípios] → mesma barra → digita → sugere dimensões daquela lista → chips → limpa
```

## Objetivo e aceite

- Listas com filtro/busca hoje adotam a omnibox: territórios, lideranças, dobradinhas, apoiadores, atividades (filtros; abas permanecem), demandas (status), organizações e assessores (degeneração busca-only ok).
- Semântica = mapa B127; URL contract preservado.
- Remoção da pilha antiga (selects/collapsible/chips duplicados) na mesma entrega por lista tocada.
- Atividades: abas continuam fora da omnibox.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** mesma do B127 em outras superfícies.
- **Forma:** _adiada_.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `*Filters.tsx` por domínio + shells em `shared/`; parsers URL existentes.
- **Precedente:** B127 (chassis + Municípios).
- **Risco:** não importar serializador de Municípios no layout; não quebrar deep-links (`activity` em demandas).

## Dependências

- **B127** (duro).

## Fora de escopo

- Bookmarks salvos fora de Municípios.
- Busca nova em Atividades/Demandas sem pedido.
- Mapa do Início.

## Rabbit holes de produto

- **Paridade pixel-perfect lista a lista além do mapa.** **Corte:** mesmo chassis; dimensões só as do mapa.

## Questões em aberto (produto)

- **Demandas: status vira omnibox ou chips compactos no mesmo input?** **Opções:** A) omnibox completa · B) chips de status dentro do input sem digitar. **Recomendação:** A com sugestões de status ao focar/digitar — um padrão só. _(assumido — validar)_

## Referências

- `docs/plans/barra-filtros-omnibox-listas.md` (B127 / #264)
- GitHub Issue [#265](https://github.com/fsolla/teqo/issues/265)
