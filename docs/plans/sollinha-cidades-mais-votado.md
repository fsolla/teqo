# B177 — Sollinha: responder “em quais cidades X foi o deputado mais votado” (rank competitivo reverso, flexível)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #460
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (resposta em texto no chat existente; sem superfície nova)
Canvas UI: N/A — sem UI
Appetite: ~1 dia eng; uma tool de leitura flexível + orientação no prompt; sem migration / Consent / collection
Responsável: —

## Intenção

O candidato testou a plataforma e perguntou ao Sollinha (chat IA em `/campanha`) **“em quais cidades eu fui o deputado mais votado em 2022”** — e o Sollinha não conseguiu responder porque não tem uma ferramenta para isso. A pergunta é a **leitura reversa** da “posição no município” que já existe no mapa: em vez de “o que se passa neste município”, perguntar “em quais municípios o candidato ficou na frente”. Decisão de produto no gate: a tool deve ser **flexível** — além do candidato da campanha, deve responder para **qualquer deputado federal** (por número ou nome), mantendo o nosso candidato como default. Hoje nada disso existe como resposta conversacional.

## Persona e fluxo

- **Persona / contexto:** candidato (e depois coordenador/assessor) conversando com a Sollinha; quer saber onde um deputado é forte — normalmente o da campanha (“de onde vem meu voto”, “onde eu ganho”), mas também comparação com outro candidato.
- **Job principal:** perguntar em linguagem natural e receber a lista de cidades onde um deputado federal foi o **mais votado** (ou ficou entre os top-N) em um ano da série — com contagem e contexto relativo.
- **Fluxo desejado:**
  1. Pergunta do tipo “em quais cidades {ele, o candidato, o deputado X} foi o deputado mais votado?” (2022 default, ou ano explícito; defeito = candidato da campanha).
  2. Sollinha chama a tool (faz a leitura do rank reverso do candidato pedido).
  3. Resposta: lista das cidades onde ficou em 1º (ou top-N) + contagem + contexto relativo (ex.: “de N cidades com voto” / “Xº lugar em Salvador entre Y candidatos”).
  4. Quando útil, link para a leitura visual (mapa/posição, página da cidade) — padrão das tools de navegação.
- **Anti-goals de produto:**
  - Não virar “leaderboard de vitórias” gamificado (cidades são dados, não medalhas).
  - Cargo: fica **deputado federal** (Câmara); não estende para deputado estadual/senador neste item (a fonte e a chance do mapa são federais).
  - Não misturar malhas: a resposta é **por cidade** (417); as 19 ZEs de Salvador **compartilham a colocação da cidade** e não podem aparecer como 19 linhas.

## Objetivo e aceite

- Existe uma tool de leitura (nome livre) que responde, para um **deputado federal** (identificado por número ou nome; default = candidato da campanha): “em quais municípios ficou em 1º entre os deputados federais” em um ano (2014/2018/2022; 2022 default) — com contagem.
- A mesma tool aceita “até a posição X” (ex.: “top 5 em” / “entre os 3 mais votados”) — é extensão da mesma pergunta, não pedido separado.
- “Mais votado” = colocação 1 (empates no topo dividem a colocação — mesma semântica do mapa), e o texto deixa isso claro se houver empate.
- Salvador entra como **uma** cidade (nunca 19), com sua colocação por cidade.
- A resposta usa nomes canônicos e contagem; nunca inventa número (fail-safe: “sem dados para o ano/candidato” quando não houver).
- Leader lockdown: liderança não tem essa conversa sobre municípios (mesmo padrão das outras tools staff).
- Sem migration, sem collection, sem Consent, sem persistência de histórico.

## Dados (intenção)

- **Vou apresentar dados?** Sim — superfície no chat (lista + contagem + contexto relativo).
- **Decisões desbloqueadas:** staff/candidato decidem **onde a base de um deputado está concentrada** (roteiro de investimento, comparação capital vs interior, leitura do adversário) — leitura da “concentração da própria votação” (compêndio §8.1), nunca % estadual absoluto como âncora.
- **Forma:** adiada ao plano de implementação; restrições de produto: leitura relativa/local, densa de contexto (“de N candidatos votados”), um lugar para cada cidade; sem KPI estadual absoluto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/ai/tools/` (nova tool de leitura + registro em `index.ts`); `src/utilities/ai/systemPrompt.ts` (quando usar); fonte de dados: para o **candidato da campanha**, o rank por cidade já é commitado e imutável (leitura instantânea); para **qualquer outro candidato**, derivar das coleções de votos (mesma semântica de empate/por cidade do mapa) — **sem** segunda fonte paralela desalinhada.
- **Precedente:** [`ranking-votos-municipio.md`](ranking-votos-municipio.md) (A11 — posição por município); [`sollinha-tool-urls-navegacao.md`](sollinha-tool-urls-navegacao.md) (B162 — padrão das tools do chat); o mapa usa a mesma “posição no município”.
- **Risco de acoplamento:** manter a semântica de rank exatamente como a do mapa (uma leitura, duas superfícies); para terceiros candidatos, não sobrescrever o artefato do nosso candidato; leader lockdown.

## Dependências

- Soft: **B162** (Issue #383, ready) — link de navegação quando ajudar; ferramentas do chat vivem no mesmo lar.
- Soft: **B178** — se a página da cidade nascer, o link “ver Salvador” pode apontar para ela quando o contexto é a capital.
- Nenhuma dependência dura de Issue aberta.

## Fora de escopo

- Tela nova / UI no `/campanha` para “cidades mais votadas” (chat basta; superfície → item separado).
- Cargos além de deputado federal (estadual, senador) — extensão futura.
- Embelezamento de ranking / medalhas / série em chart.
- Web search / grounding externo.

## Rabbit holes de produto

- **“Vira análise completa de vitórias.”** A tool responde uma família de perguntas curtas; tudo além (mapa de vitória, tabelão) é outro item. **Corte:** escopo = “onde ficou em 1º / top-N” para um deputado federal.
- **“Consistência com o mapa de um terceiro candidato.”** O mapa só conhece a posição do nosso candidato; para terceiros a tool é a única leitura — não obrigar o mapa. **Corte:** tool autônoma, sem espelhar superfície nova.
- **“Responder por ZE de Salvador.”** Malha errada — a colocação é por cidade. **Corte:** 1 linha por cidade, com nota quando o ranking for da capital.

## Questões em aberto (produto)

Resolvidas no gate (2026-08-09):

- **Escopo da resposta:** só 1º lugar + “até a posição X” (top-N) como parâmetro. **Decisão:** 1º default, `top-N` aceito.
- **Flexibilidade de candidato:** só o nosso vs **qualquer deputado federal**. **Decisão:** qualquer deputado federal (número/nome), default = candidato da campanha.
- **Links na resposta:** híbrido (proativo em entidade singular + sempre sob pedido), seguindo o padrão B162. **Decisão:** híbrido.
- **Menção de Salvador:** citar a colocação da capital como cidade quando a pergunta for comparativa/sobre ela; caso contrário só aparece se estiver na lista. **Decisão:** menção contextual, como cidade única.

## Referências

- Canvas UI (gate): N/A
- `src/lib/bahiaElectionAggregates.ts` (rank competitivo por cidade, do candidato) e `src/lib/bahiaMunicipalityCodes.ts` (IBGE↔nome)
- [`ranking-votos-municipio.md`](ranking-votos-municipio.md) · [`sollinha-tool-urls-navegacao.md`](sollinha-tool-urls-navegacao.md) · [`ai-chat-sollinha.md`](ai-chat-sollinha.md)
- `src/utilities/ai/tools/`, `src/utilities/ai/systemPrompt.ts`
- AGENTS.md — leader lockdown, leitura relativa/local (docs/research kernel)
