# Assessores — filtrar por município da carteira na omnibox

Status: registrado
Atualizado em: 2026-08-02
Issue: #310
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na lista `/campanha/assessores`
Appetite: ~0,5–1 dia eng
Responsável: —

## Intenção

A lista de assessores mostra a carteira (chips de municípios), mas a omnibox é só busca por nome/e-mail. O coordenador não consegue perguntar “quem cobre Feira?” pela barra — tem de varrer linhas.

Queremos filtrar assessores **pelo município que administram** via omnibox.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral / Candidato (rota já restrita) montando cobertura.
- **Job principal:** achar quem tem um município na carteira.
- **Fluxo desejado:** digita nome do município → sugere sob grupo tipo “Município (carteira)” → chip → só assessores que administram aquele município; busca por nome continua; remove chip → lista ampla.
- **Anti-goals de produto:** filtro “sem carteira” / “cobertura completa” neste item salvo se for trivial; edição de carteira (já existe noutro sítio).

## Objetivo e aceite

- Omnibox permite restringir a lista a assessores cuja carteira inclui o(s) município(s) escolhido(s).
- Semântica: **inclusivo OR** se multi-município for natural (assessor entra se cobre **qualquer** selecionado); se a 1ª fatia for um município só, exclusivo também serve — **recomendação: inclusivo OR** alinhado a Município em lideranças.
- Busca por nome/e-mail permanece.
- Rota continua inacessível a quem já não a vê hoje.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** CG — “quem cobre este município?”
- **Forma:** _adiada_.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `AdvisorFilters`, `advisorListUrl` / `advisorData`, sair do `searchOnlyListOmnibox` com dimensão de município; relação `municipality.advisors` / carteira já usada na lista.
- **Precedente:** filtro Município em lideranças; chips de carteira na linha.
- **Risco:** performance se facets forem ingênuos — executor mede; produto não exige facet de 435 se houver busca tipada.

## Dependências

- Nenhuma.

## Fora de escopo

- Filtro “sem nenhum município” / gaps de cobertura estadual (territórios já cobrem outro job).
- Saved filters.
- Mudança de RBAC.

## Rabbit holes de produto

- **Virar mapa de cobertura nesta lista.** **Corte:** só filtro de linhas da tabela de assessores.

## Questões em aberto (produto)

- **Um ou vários municípios no recorte?** **Opções:** A) um (exclusivo) · B) vários (OR). **Recomendação:** B. _(assumido)_

## Referências

- Inventário plan-issue 2026-08-02 — gap 6
- `src/components/campaign/advisor/AdvisorFilters.tsx`
- `src/utilities/advisor/advisorListUrl.ts`
- `src/lib/searchOnlyListOmnibox.ts`

- GitHub Issue #310
