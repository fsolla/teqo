# Organizações — tipo na omnibox

Status: registrado
Atualizado em: 2026-08-02
Issue: #307
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na lista `/campanha/organizacoes`
Appetite: ~0,5 dia eng
Responsável: —

## Intenção

A lista de organizações já tem coluna/badge de **Tipo** e o parâmetro `kind` na URL, mas a omnibox é só busca. O staff não consegue montar “só sindicatos” (etc.) pela barra — tem de varrer ou conhecer o deep-link.

Queremos expor **Tipo** como dimensão na omnibox (sugestões + chip), no mesmo espírito das outras listas pós-B128.

## Persona e fluxo

- **Persona / contexto:** Staff filtrando organizações de apoio por tipo.
- **Job principal:** restringir a lista a um tipo sem sair da barra.
- **Fluxo desejado:** digita “sindicato” / “tipo” → escolhe → chip **Tipo: …** → lista filtrada; remove o chip → volta a todas; busca por nome continua.
- **Anti-goals de produto:** inventar tipos novos; segunda toolbar; saved filters nesta lista.

## Objetivo e aceite

- Omnibox sugere e aplica **Tipo** com os valores de produto já existentes (rótulos pt-BR da lista).
- Ausência de chip de tipo = todas as organizações do escopo (comportamento atual da URL sem `kind`).
- Busca por nome permanece; chips de busca e tipo coexistentes e removíveis.
- Sem seletor paralelo fora da omnibox.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** staff — “quais organizações deste tipo estou vendo?”
- **Forma:** _adiada_.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `OrganizationFilters`, `organizationListUrl` (já parseia `kind`), sair do degenerado `searchOnlyListOmnibox` ou estendê-lo com dimensão de tipo.
- **Precedente:** B128 omnibox degenerada; mapa B127 “não inventar” → **agora pedido explícito**.
- **Risco:** contrato URL; não quebrar `q` + `kind` existentes.

## Dependências

- Nenhuma.

## Fora de escopo

- Filtro por município de atuação / contagem de lideranças.
- Ordenação na omnibox se ainda não existir nesta lista.
- Demais listas (Issues irmãs).

## Rabbit holes de produto

- **Multi-tipo OR sem pedido.** **Corte:** manter exclusividade atual da URL (`kind` único) salvo evidência em contrário.

## Questões em aberto (produto)

- Nenhuma bloqueante — tipo único (exclusivo) como hoje na URL. _(assumido)_

## Referências

- Inventário plan-issue 2026-08-02 — gap 3
- `docs/plans/barra-filtros-omnibox-listas.md`
- `src/utilities/organization/organizationListUrl.ts`
- `src/components/campaign/organization/OrganizationFilters.tsx`

- GitHub Issue #307
