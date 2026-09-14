# Relatório — sobreposição Solla × Ceuci em Salvador (2022)

Status: rascunho
Atualizado em: 2026-09-14
Issue: #979
Priority: P1
Impeccable: N/A — documento impresso, não UI
Rascunho UI: N/A — sem UI
Appetite: 1 sessão (dados + mapas + PDF)
Responsável: —

## Intenção

Produzir um relatório em PDF, para os assessores da campanha, comparando a votação de 2022 de **Jorge Solla** (deputado federal, PT 1313) e **Ceuci Nunes** (deputada estadual, PT 13192) nas 19 zonas eleitorais de Salvador e nos bairros, com mapas, tabelas e análise política de como a rede e a história de Ceuci — apoiadora do mandato — podem potencializar a campanha de 2026.

O uso é imediato: o coordenador e os assessores precisam decidir onde acionar Ceuci (eventos, agenda de saúde, mobilização de rede) por zona/bairro, com número na mão — não por sensação.

## Persona e fluxo

- **Quem usa:** coordenador-geral (persona Nivaldo Cerqueira — prioriza por % do NOSSO voto e decide agenda/material por fila de prioridade) e assessores territoriais (dossiê pré-agenda por território).
- **Fluxo:** reunião de planejamento → escolha das zonas/bairros onde a sobreposição Solla×Ceuci é maior → encaixe da agenda de Ceuci e do material.
- **Lente analítica:** persona Prof. Helena Rocha (cientista política) — conta do quociente, dominância×concentração, LQ, nunca % estadual absoluto; mapa que normaliza e mapa que não normaliza juntos.

## Objetivo e aceite

- PDF A4 em `docs/research/` com: sumário executivo; tabela por ZE (votos, % dos válidos, % do próprio voto, LQ, posição, sobreposição); tabela por bairro (bairros agrupados por ZE, fonte TRE-BA RA 02/2017); mapas de Salvador por ZE (votos de cada candidato + classes de sobreposição) e por bairro (malha IBGE Censo 2022); gráficos (barras por ZE, dispersão Solla×Ceuci); leitura da ciência política e plano do coordenador.
- Companion `.md` com os números e a proveniência (PDF binário não é revisável no diff).
- Gerador commitado (`scripts/*.mjs`) + JSON de entrada com proveniência; reproduzível sem banco e sem rede (JSON e cache já no repo/homeserver local).

## Dados (intenção)

- Solla: 2022 federal T1 nominal, por ZE de Salvador (19) — conferido contra o artefato commitado `bahia-federal-baseline.json`.
- Ceuci: 2022 estadual T1 nominal, por ZE de Salvador (19) — TSE.
- Tallies por ZE (válidos federal e estadual) para normalizar.
- Bairros: lista oficial TRE-BA RA 02/2017 (commitada em `municipalityZoneNeighborhoods.ts`); malha IBGE Censo 2022 (download no build do relatório, cache gitignored).
- **Limite duro:** o Teqo só tem município×zona — **não existe voto por seção/bairro**. O mapa de bairros pinta cada bairro com os números da sua ZE; o relatório diz isso na cara.

## Dados da decisão (literais)

- Ceuci 2022: 36.992 votos no estado, **19.776 em Salvador** (mais votada do PT na capital), não eleita; presidente da Bahiafarma desde 2023; descartou candidatura em 2026.
- Solla 2022: 128.968 votos no estado; **27.264 em Salvador** (soma das 19 ZE no artefato).
- Uso: Ceuci entra como **apoiadora do mandato**, sem candidatura própria — o relatório não a trata como candidata.

## Direção no codebase (hipótese)

- Script novo `scripts/build-solla-ceuci-salvador-report.mjs` (HTML→PDF via Chromium do Playwright já instalado; sem dependência nova), lendo o artefato de Solla e um JSON pequeno com Ceuci/tallies/posições.
- Geometrias: `src/lib/geometries/bahia-municipality-zones.topo.json` (commitado) para o mapa de ZE; malha de bairros IBGE baixada pelo mesmo script (mesma fonte do `build-municipality-zone-geometries`), simplificada com `scripts/lib/topology.mjs`.
- Cores: `src/lib/choroplethColorScale.ts` (dono da paleta) e projeção própria (equiretangular local; sem d3).
- Destino: `docs/research/` (CI barato; `docs` fora da imagem Docker) + entrada em `docs/changelog/`.

## Dependências

- Issue #979. Sem dependência de código em andamento.

## Fora de escopo

- Voto por seção/bairro (exigiria `votacao_secao` + DE-PARA — E5, não implementado).
- UI nova em `/campanha`; alteração de collections/migrations.
- Publicação em `public/` (imagem de produção) — o PDF é entregue por anexo/PR.

## Rabbit holes de produto

- Tentar inferir voto por bairro por proporcionalidade: proibido (falsa precisão).
- Inferir sobreposição de eleitor individual: não existe (voto não é observável por pessoa); só geografia.
- Quociente estadual detalhado: tangencial ao uso (a decisão é territorial).

## Questões em aberto

- Nenhuma bloqueante; a validação é com os assessores depois da entrega.

## Referências

- Personas: `docs/research/persona-cientista-politico-campanha-ba.md`, `docs/research/persona-emendas-coordenador-campanha.md`.
- Dados: `src/lib/electionAggregates/bahia-federal-baseline.json`, `src/lib/bahiaTseZones.ts`, `src/lib/municipalityZoneNeighborhoods.ts`.
- Precedente de relatório: `docs/research/piloto-fonte-videos-camara.md` (C152).
