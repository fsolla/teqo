# Totais do recorte na lista de municípios (votos 2022 + expectativas 2026)

Status: rascunho
Atualizado em: 2026-09-14
Issue: #1005
Priority: P2
Impeccable: B — encaixe no rodapé compartilhado da lista de /campanha/municipios (linha compacta, sem mexer na tabela)
Rascunho UI: docs/plans/totais-recorte-lista-municipios-ui-draft.html
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Na lista de municípios, quem filtra já vê os números linha a linha, mas ninguém soma o conjunto. O Coordenador precisa saber a magnitude do recorte que está olhando — os votos de Solla em 2022 e as expectativas de 2026 nos três cenários — sem exportar nem somar de cabeça. O total é do **recorte inteiro** (todas as páginas do filtro), não da página visível, e precisa respeitar o mesmo escopo de acesso das linhas (assessor soma só a carteira dele). Este item é sucessor legítimo do B129: ele **não** ressuscita o painel acima da lista que aquele item removeu — o total mora no rodapé da lista, numa linha compacta junto da contagem, sem empurrar as linhas para baixo.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral (também candidato e assessor, cada um no seu escopo) na mesa, com um recorte ativo — por território, prioridade, assessoria ou busca — querendo calibrar o tamanho do conjunto antes de agir linha a linha.
- **Job principal:** Saber, em um olhar, o total de votos 2022 e das expectativas 2026 do recorte filtrado, por cenário, sem perder de vista que é um agregado e não uma linha.
- **Fluxo desejado:** Entra em Municípios → filtra/busca → lê as linhas na tabela (ou cards, no mobile) → vê uma linha compacta de totais do recorte no rodapé da lista, junto de "N municípios encontrados".
- **Anti-goals de produto:** Não recriar o bloco de overview acima da lista (anti-goal do B129); não criar linha de totais dentro da tabela nem bloco dedicado nos cards (decisão do gate: rodapé compartilhado); não empurrar a lista para baixo; não introduzir médias, percentuais, cobertura ou seletor novo; não misturar pledges nesta v1; não expor nada a Liderança (lockdown intacto); o assessor nunca vê total maior que a carteira dele.

### Esboço de fluxo (B)

```text
[Municípios] → filtros/busca → lista mostra linhas → rodapé compartilhado mostra "N municípios encontrados" + a linha compacta de totais do recorte (2022 + 3 cenários)
```

### Rascunho UI (B)

- Rascunho UI (gate): `docs/plans/totais-recorte-lista-municipios-ui-draft.html`

## Objetivo e aceite

- Com qualquer recorte ativo, o rodapé da lista mostra **quatro somas**: votos Solla 2022 e expectativa 2026 nos três cenários (Pessimista / Média / Otimista), junto da contagem de municípios do recorte (ex.: "312 municípios encontrados · 2022 1.234.567 · Pess. 812.400 · Média 1.034.500 · Otim. 1.290.100").
- As somas cobrem **todas as páginas do recorte**, nunca apenas a página visível; o rótulo diz "recorte" (nunca "página").
- Os números batem com a soma das linhas do mesmo recorte (mesma fonte por linha, sem fórmula paralela).
- **Salvador conta uma vez:** quando a linha virtual da cidade aparece, ela representa as 19 ZE na soma de 2022 — nunca cidade + zonas; em recortes só de zonas, as zonas somam normalmente. As expectativas incluem todas as ZE de Salvador (a cidade não tem expectativa).
- Linha secundária honesta: quantos municípios do recorte têm expectativa preenchida (ex.: "189 dos 312 com expectativa").
- **Escopo de acesso:** assessor vê os totais apenas da carteira; coordenador/candidato, do recorte completo. Liderança não acessa a superfície.
- Guardrail B129: nenhum bloco agregado acima da lista; o total ocupa **uma linha compacta no rodapé compartilhado** (o mesmo nos dois viewports, abaixo da tabela/cards), sem empurrar as linhas e sem linha dentro da tabela.
- Recorte vazio não inventa totais; recorte sem nenhuma expectativa não mostra "0" enganoso.

## Dados (intenção)

- **Vou apresentar dados?** Sim — somas do recorte, na própria lista, junto das colunas que já existem.
- **Decisões desbloqueadas:** Coordenador/assessor/candidato dimensiona o recorte filtrado e compara cenários de relance para priorizar onde agir; leitura relativa/local preservada (somas do conjunto que se está olhando, nunca % estadual).
- **Forma:** _adiada ao plano de implementação_ — restrições: recorte inteiro (não página), rótulo honesto, sem médias/percentuais/cobertura, sem pledges na v1, sem seletor novo, sem consulta nova se os dados do recorte já estiverem carregados.

## Dados da decisão (literais)

- Votos Solla 2022 (baseline eleitoral imutável, por município/ZE).
- Cenários de expectativa: `pessimistic | central | optimistic`; rótulos UI "Pessimista / Média / Otimista".
- `salvador` / linha `isCity`: conta uma vez em 2022 (cidade **ou** zonas, nunca ambas); sem expectativa própria — as 19 ZE entram na soma dos cenários.
- Nada de pledges ("Nas lideranças") nesta v1; nada de média, percentual ou cobertura.

## Direção no codebase (hipótese)

- **Áreas prováveis:** lista de municípios (`/campanha/municipios`) e o rodapé compartilhado onde já vivem a contagem "N municípios encontrados" e a paginação (o mesmo nos viewports desktop e mobile); a linha compacta de totais entra ali, e só a lista de municípios passa esses números — as outras listas que usam o mesmo rodapé ficam idênticas. O cenário ativo de expectativa hoje é estado local do cliente.
- **Precedente a olhar:** B129 (`docs/plans/remover-overview-lista-municipios.md`, #266) — a tensão a respeitar; B178/Salvador (`docs/plans/salvador-pagina-detalhe-cidade.md`) — a regra de contar uma vez; KPIs do recorte em `/campanha/apoiadores` (`supporterListOverviewAggregate`); rollup staff já existente para as colunas de voto/expectativa; células e ordenação da trilha B15/E8/A11.
- **Risco de acoplamento:** anti-goal do B129 ("não substituir o bloco por outro resumo agregado"); linha virtual de Salvador e não dupla contagem; a linha compacta mostra os três cenários de uma vez, então não depende do estado local do cliente; paginação de 25/página; cards mobile e tabela desktop compartilham o mesmo rodapé.

## Dependências

- Nenhuma (dura).
- Suave: B129 já entregue (respeitar o anti-goal); B178/Salvador como invariante a preservar.

## Fora de escopo

- Qualquer painel/overview acima da lista (o B129 fez a remoção; não reabrir).
- Médias, percentuais, cobertura de assessoria, "conta da cadeira" e projeções.
- Pledges ("Nas lideranças") na soma — pode virar item sucessor se a mesa pedir.
- Novos filtros, seletor de cenário na URL, exportação ou alteração do que cada coluna mostra.
- Linha de totais dentro da tabela (tfoot) e bloco específico dos cards mobile — decisão do gate: rodapé compartilhado.
- Soma em outras listas (lideranças, apoiadores, demandas).

## Rabbit holes de produto

- **"Já que soma, mostra também média/%/cobertura."** Vira dashboard e reabre o B129. **Corte neste item:** só as 4 somas + contagem + a linha secundária de quantos têm expectativa.
- **"Somar pledges junto para ver o total real."** Muda o significado da coluna e cria expectativa sobre número que a coluna não mostra. **Corte:** v1 espelha a coluna; defer registrado.
- **Salvador: "somar cidade + zonas para o total bater com o estado."** É a dupla contagem proibida pela trilha da capital. **Corte:** uma vez só — cidade **ou** zonas.

## Questões em aberto (produto)

- **Rótulos:** A) UI (Pessimista/Média/Otimista) — **Decidido no gate (2026-09-14): A**; B) planilha (Mínimo/Regular/Otimista). Manter o vocabulário que a coluna já usa evita tradução mental.
- **Onde:** A) linha de totais no rodapé da tabela desktop, alinhada sob as colunas de votos/expectativa + bloco compacto equivalente no rodapé dos cards mobile; B) só uma linha compacta no rodapé compartilhado. **Decidido no gate (2026-09-14): B** — a linha compacta fica no rodapé compartilhado (o mesmo nos dois viewports, junto da contagem), sem linha dentro da tabela e sem bloco dedicado nos cards.
- **Incluir pledges ("Nas lideranças") na soma?** **Decidido no gate (2026-09-14): A — não incluir** (espelha a coluna; defer registrado se a mesa pedir). **Rejeitado:** B) sim, usando `expectativa ?? pledges` como valor efetivo.

## Referências

- GitHub Issue [#1005](https://github.com/fsolla/teqo/issues/1005)
- Rascunho UI (gate): `docs/plans/totais-recorte-lista-municipios-ui-draft.html`
- `docs/plans/remover-overview-lista-municipios.md` (B129, #266) — anti-goal a respeitar
- `docs/plans/salvador-pagina-detalhe-cidade.md` — Salvador conta uma vez (cidade ou 19 ZE)
- Rota `/campanha/municipios`, tabela `MunicipalityList`, cards `MunicipalityMobileCard` e rodapé `CampaignListFooter`
- Precedente de agregado do recorte: `/campanha/apoiadores` (`supporterListOverviewAggregate`)
