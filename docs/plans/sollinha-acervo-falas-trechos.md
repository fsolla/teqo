# Sollinha: sugerir trechos de falas do acervo para vídeos

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-09-14
Issue: #982
Priority: P1
Impeccable: A — N/A (resposta em texto/markdown no chat existente; sem superfície nova)
Rascunho UI: N/A — sem UI
Appetite: ~1 dia eng; uma tool read-only nova + orientação no prompt + testes; sem migration/collection/Consent
Responsável: —

## Intenção

O acervo de falas do deputado já está em produção (C153/C154/C155), mas achar o trecho certo para uma peça continua sendo garimpo manual: buscar, abrir o vídeo e caçar a minutagem. Quem produz conteúdo já conversa com o Sollinha para outras tarefas — e agora quer perguntar em linguagem natural ("qual uma boa fala para um reels sobre o hospital do subúrbio?") e receber trechos candidatos prontos para levar à edição. Falta a ponte entre a pergunta e o acervo.

## Persona e fluxo

- **Persona / contexto:** quem produz conteúdo da campanha (coordenação/candidatura hoje; assessoria de comunicação via C159, item irmão), sob prazo curto de peça, com o chat do Sollinha aberto no sheet/drawer.
- **Job principal:** converter um tema em 1–3 trechos de fala do deputado, com citação aproximada e minutagem, para montar o vídeo sem garimpar o acervo na mão.
- **Fluxo desejado:** pergunta o tema ("hospital do subúrbio") → o Sollinha busca no acervo → devolve as sugestões com trecho citado e minutagem de começo/fim → o usuário abre o acervo no ponto do trecho, assiste e baixa.
- **Anti-goals de produto:** não é editor de vídeo nem entrega arquivo; não lê a fala inteira no chat; não inventa fala nem minutagem; não vira busca semântica; não expõe o acervo fora de `/campanha`.

## Objetivo e aceite

- A pergunta de exemplo ("Qual seria uma boa fala do deputado para criarmos um reels sobre o hospital do subúrbio?") devolve 1–3 sugestões, cada uma com citação aproximada do trecho e minutagem de começo e fim.
- Cada sugestão leva ao acervo no ponto do trecho (onde já há assistir/baixar/abrir a fonte); o chat não entrega arquivo nem edita.
- **Guardrails:** sem trecho encontrado, o Sollinha diz que não achou — nunca inventa fala ou minutagem; cada sugestão é um trecho contínuo, curto o bastante para virar peça; quem não lê o acervo recebe negativa clara (fail-closed), nunca dado parcial nem erro técnico; a citação vem do ASR e pode ter ruído — vale como localizador, a referência é o vídeo; sem migration/collection/Consent.
- **Decisão do gate (2026-09-14):** o Sollinha **reflete** sobre qual trecho serve melhor à intenção declarada (tema, uso, tom, duração) e de que ponto a que ponto: a tool devolve candidatos com corte proposto e uma etapa de **reranking por LLM dentro da tool** escolhe/ordena os melhores com uma justificativa curta, apresentada na resposta. Sem embeddings/índice vetorial (a busca continua textual).

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o consumidor é o usuário no chat; a resposta é a superfície.
- **Decisões desbloqueadas:** quem edita escolhe qual fala vira peça e já sabe o ponto de corte, em vez de procurar o trecho no acervo.
- **Forma:** _adiada ao plano de implementação_ — restrições de produto: trecho contínuo com começo e fim; citação aproximada + minutagem; poucas sugestões por resposta; nada de transcrição inteira nem métrica de acervo.

## Dados da decisão (literais)

- N/A — nenhum valor fixo de dados a preservar: a faixa de sugestões e o formato do link são comportamento de resposta, detalhados no plano de implementação (sem tabela, ID, env ou string exata de produto).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/ai/tools/` (tool nova + registro em `index.ts`) e `src/utilities/ai/systemPrompt.ts`; reuso da busca existente do acervo em `src/utilities/speech/` (`speechListFilters.ts`, `speechViewModels.ts`, `speechPageData.ts`) e do normalizador `src/lib/speechSearch.ts`.
- **Precedente a olhar:** tools de leitura atuais (factory por contexto que consulta com o usuário da sessão); gate de negação por papel de B180; retorno com critério/escopoRestrito/truncado de B185; links do chat de B162/B187/B188/B198; testes de lockdown por tool e int do acervo (`tests/unit/electionToolsLockdown.unit.spec.ts`, `tests/int/speechAcervo.int.spec.ts`).
- **Risco de acoplamento:** leader lockdown intocado e advisor segue negado no acervo; o gate da tool deve espelhar quem tem leitura do acervo (o communicator incluído) — o gate de staff não cobre esse recorte. Os segmentos ASR são frasais e o acervo hoje destaca UM segmento; juntar trechos contíguos com começo/fim é justamente o trabalho novo deste item.

## Dependências

- Entregues (duras, satisfeitas): C153 (catálogo `speech`/`speechSegment`), C154 (vertical Comunicação + busca no acervo), C155 (backfill; 997 discursos em produção).
- C159 (chat para a assessoria de comunicação — #983) depende deste item, não o contrário: a tool nasce com o gate do acervo para que C159 a herde.
- Nenhuma dependência dura bloqueante.

## Fora de escopo

- Ler a fala inteira / transcrição completa no chat — a íntegra fica no detalhe do acervo.
- Cortar, editar ou gerar vídeo, e baixar arquivo pelo chat — o acervo já oferece assistir/baixar/abrir a fonte.
- Busca semântica/embeddings — a busca textual do acervo é a base (item futuro se houver demanda).
- TTS, narração, legendas e curadoria de trechos/favoritos/listas editoriais.
- Exposição pública do acervo e mudanças de UI no acervo (C154) além do reuso.

## Rabbit holes de produto

- **Busca semântica/embeddings.** Se alguém "só completar": índice vetorial, sinônimos, infra nova. **Corte neste item:** busca textual existente; sem resultado, o Sollinha diz que não achou. **Revisado no gate (2026-09-14):** o reranking por LLM **sobre os candidatos recuperados pela busca textual** foi incorporado a pedido do produto (ver decisão do gate no aceite); índice vetorial/embeddings seguem fora.
- **Ler a fala inteira no chat.** Se alguém "só completar": transcrição longa na resposta, contexto estourado, citação sem foco. **Corte neste item:** só trechos contínuos curtos com começo/fim; a íntegra fica no acervo.
- **Cortar/editar/gerar vídeo.** Se alguém "só completar": editor, fila de render, storage. **Corte neste item:** o chat sugere e aponta; edição é ferramenta externa.
- **Publicar o acervo fora de `/campanha`.** Se alguém "só completar": página pública, compartilhamento externo, direitos. **Corte neste item:** acervo segue interno.

## Questões em aberto (produto)

- **Quem usa nesta entrega?** **Opções:** A) só quem já tem o chat (coordenação/candidatura) | B) a assessoria de comunicação também, via C159. **Decisão do gate (2026-09-14): B** — a assessoria de comunicação também usa, via C159 (item irmão, dependente desta tool), sem bloquear esta entrega.
- **O link na resposta aponta para onde?** **Opções:** A) acervo interno no trecho (`?t=`), que já dá assistir/baixar | B) também URL direta do VOD/YouTube. **Decisão do gate (2026-09-14): A** — o trecho sugerido aponta para o acervo interno no ponto do trecho; a fonte direta só quando o detalhe do acervo não bastar.
- **Quantos trechos e quão longos?** **Opções:** A) sempre 1 | B) 1–3 conforme o pedido | C) até N com janela fixa. **Decisão do gate (2026-09-14): B** — 1–3 trechos conforme o pedido, trecho contínuo curto o bastante para peça; a política fina de janela fica no plano de implementação.

## Referências

- GitHub Issue: #982
- Rascunho UI (gate): N/A — sem UI
- Planos irmãos: [`sollinha-tool-urls-navegacao.md`](sollinha-tool-urls-navegacao.md) (B162 — links no chat), [`sollinha-tools-eleitorais-leader-lockdown.md`](sollinha-tools-eleitorais-leader-lockdown.md) (B180 — gate fail-closed), [`sollinha-liderancas-pendentes-abordagem.md`](sollinha-liderancas-pendentes-abordagem.md) (B185 — retorno com critério), [`acervo-videos-comunicacao.md`](acervo-videos-comunicacao.md) (C154 — acervo e RBAC), [`catalogo-falas-solla.md`](catalogo-falas-solla.md) (C153), [`backfill-acervo-falas.md`](backfill-acervo-falas.md) (C155).
- Arquivos-chave: `src/app/(campaign)/campanha/api/ai-chat/route.ts`, `src/utilities/ai/`, `src/utilities/speech/`, `src/lib/campaignRoles.ts`.
- `AGENTS.md` — rotas `/campanha`, leader lockdown e RBAC.
