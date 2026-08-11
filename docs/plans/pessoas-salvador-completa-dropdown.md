# Pessoas: "Salvador" como opção no dropdown de municípios (agregado das 19 zonas)

Status: rascunho
Atualizado em: 2026-08-11
Issue: #698
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe no dropdown/combobox de adição de municípios das células de capacidade
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-pessoas-ajustes-ui-draft.canvas.tsx (seção "Dropdown de municípios")
Appetite: ~0,25–0,5 dia eng; uma opção agregada no mecanismo de busca existente
Responsável: —

## Intenção

Adicionar cidades a uma pessoa (Assessora/Lidera/Dobra em) exige hoje adicionar as 19 zonas de Salvador uma a uma quando o vínculo é com a capital inteira. A mesa quer uma opção única **"Salvador"** no dropdown, que liga o agregado das 19 zonas de uma vez — o mesmo conceito do chip "Salvador (19)" que já existe na exibição.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor editando municípios de uma pessoa na tabela de `/campanha/pessoas` (e demais superfícies que usam o mesmo dropdown).
- **Job principal:** vincular a pessoa a Salvador inteiro num gesto só, sem digitar/eleger 19 zonas.
- **Fluxo desejado:** abro o dropdown de adição de municípios → digito "salvador" → vejo "Salvador — Todas as zonas" como opção → seleciono → as 19 zonas entram de uma vez (chip "Salvador (19)"). Remover funciona igual ao chip agregado de hoje (remove as 19).
- **Anti-goals de produto:** não é uma cidade virtual nova (não entra no catálogo, não vira linha na lista de municípios, não pode ser filtrada como município único); não muda o modelo — é atalho de seleção.

## Objetivo e aceite

- O dropdown de adição de municípios oferece **"Salvador"** (descrição **"Todas as zonas"**) como opção buscável por "salvador", junto das opções individuais (Salvador — ZE 1…).
- Selecionar o agregado adiciona as 19 zonas de uma vez na capacidade em edição; a exibição colapsa no chip "Salvador (19)" como hoje.
- A opção soma com o que já está selecionado: se 5 zonas já estão ligadas, o agregado liga as outras 14 (e o chip aparece quando as 19 estiverem completas).
- Funciona nas três células de capacidade da tabela de pessoas; demais superfícies que usam o mesmo dropdown herdam o atalho sem trabalho extra (sem mudança de comportamento nelas).
- Respeita o escopo de acesso: para assessor, a opção só aparece/age dentro da carteira (nunca adiciona zona fora do que ele administra).

## Dados (intenção)

- **Vou apresentar dados?** Não — seleção de território, sem métrica.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/municipalityPortfolio.ts` (busca `searchMunicipalityPortfolio` — hoje não há hit agregado de cidade-zona, só município/território/ZE), `src/components/campaign/shared/MunicipalityPortfolioCell.tsx` e `RelationChipCell` (consumidor do hit).
- **Precedente a olhar:** B178 (Salvador agregado: chip "Salvador (19)" e colapso `kind: 'city'` em `buildMunicipalityPortfolioChips`), B159 (chips de relação).
- **Risco de acoplamento:** a busca de municípios é compartilhada por várias listas (lideranças, dobradinhas, municípios, atividades…) — qualquer opção nova no dropdown vale para todas; o executor deve preservar o contrato de "um toque = um lote de municípios na mesma transação".

## Dependências

- Nenhuma. Encosta na mesma superfície de C128/C130 sem depender deles.

## Fora de escopo

- Salvador como entidade única em filtros/ordenação (facet de município continua pelas 19 zonas).
- Agregado "Camaçari" (já é um município único no catálogo) ou outros agregados de cidade-zona.

## Rabbit holes de produto

- **Mais cidades-zona no futuro**: o catálogo só tem Salvador com 19 zonas. **Corte:** a opção agregada é derivada do catálogo (lista `ZONE_MUNICIPALITY_CITIES`) — se um dia outra cidade-zona existir, o mecanismo cobre sem trabalho novo.

## Questões em aberto (produto)

_Decididas no gate 2026-08-11 (não reabrir sem evidência nova):_

- **Label da opção:** **Decidido:** "Salvador" como linha principal e "Todas as zonas" como segunda linha (descrição do hit) — mesma estrutura dos demais hits ("Município", "Território · N municípios").
- **Opção aparece só na busca ou sempre visível?** **Decidido:** só quando a busca casa (padrão atual — sem lista de sugestões com query vazia).

## Referências

- Canvas UI (gate): plan-pessoas-ajustes-ui-draft.canvas.tsx
- Planos: [pessoas-lista-unificada.md](pessoas-lista-unificada.md) (C100 — células de município), B178 (`docs/plans/` — Salvador agregado), [generalizar-colunas-relacao-municipios.md](generalizar-colunas-relacao-municipios.md) (máquina compartilhada de relação)
- `AGENTS.md` — catálogo de municípios, ZE de Salvador
