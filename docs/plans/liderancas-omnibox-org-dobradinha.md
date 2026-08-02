# Lideranças — filtrar por organização e dobradinha na omnibox

Status: registrado
Atualizado em: 2026-08-02
Issue: #311
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na lista `/campanha/liderancas`
Appetite: ~0,5–1 dia eng
Responsável: —

## Intenção

A ficha/lista de lideranças já carrega vínculos com **organizações** e **dobradinhas**, mas a omnibox só oferece status, município, acesso ao app e ordenação. O staff que monta recorte “lideranças do sindicato X” ou “quem está na dobradinha Y” não consegue pela barra.

Queremos dimensões **Organização** e **Dobradinha** na omnibox desta lista.

## Persona e fluxo

- **Persona / contexto:** Staff preparando articulação ou varrendo rede.
- **Job principal:** ver lideranças ligadas a uma organização e/ou a um deputado estadual (dobradinha).
- **Fluxo desejado:** digita nome da org / do deputado → sugere nos grupos → chip(s) → lista; remove → amplia; demais filtros (status, município, acesso) permanecem.
- **Anti-goals de produto:** criar organização/dobradinha a partir da barra; spreadsheet; filtro por estimativa de votos (assimetría).

## Objetivo e aceite

- Omnibox sugere e aplica **Organização** e **Dobradinha** com rótulos legíveis (nome).
- Semântica: **inclusivo OR** dentro de cada dimensão (alinhado a Município/Status nesta lista), salvo evidência de que a URL atual force exclusivo.
- Ausência de chip na dimensão = sem restrição.
- Leader lockdown: esta lista continua staff; liderança não ganha superfície nova.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** staff — “quem está ligado a esta org / dobradinha?”
- **Forma:** _adiada_ — sem % estadual / sem expor estimativas.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `LeadershipFilters`, `leadershipOmnibox`, `leadershipListUrl` / `leadershipData`, relações já usadas em detalhe/células.
- **Precedente:** filtros Município/Status nesta lista; lista de dobradinhas; portfolio cells.
- **Risco:** facets grandes — busca tipada como em município; não puxar estimatedVotes para o filtro.

## Dependências

- Nenhuma. Soft: existência das entidades organização/stateDeputy ✓.

## Fora de escopo

- Filtro por gênero / contagem de pledges / “sem organização”.
- Saved filters nesta lista.
- Mudanças na lista de dobradinhas ou organizações (Issues irmãs cobrem as omniboxes delas).

## Rabbit holes de produto

- **“Sem organização” / “sem dobradinha” como valores.** Útil, mas **corte** neste item salvo se couber no mesmo appetite sem nova UX de sentinela — preferir só valores positivos primeiro.

## Questões em aberto (produto)

- **As duas dimensões neste item ou só uma?** **Opções:** A) ambas · B) só organização · C) só dobradinha. **Recomendação:** A (pedido “todos” do lote). _(assumido A)_

## Referências

- Inventário plan-issue 2026-08-02 — gap 7
- `src/utilities/leadership/leadershipOmnibox.ts`
- `src/components/campaign/leadership/LeadershipFilters.tsx`
- `docs/plans/barra-filtros-omnibox-listas.md`

- GitHub Issue #311
