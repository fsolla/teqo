# Acervo: "Abrir fonte" só quando existe a fonte oficial (fim do atalho duplicado)

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1087
Priority: P3
Impeccable: A — N/A sem nova superfície (remoção/ajuste de um botão)
Design UI: N/A — sem UI
Appetite: ~0,25–0,5 dia eng; um outcome verificável — nenhum botão do acervo leva a um vídeo sem marcar o ponto
Responsável: —

## Intenção

O acervo de falas mostra o botão "Abrir fonte" desde antes do C160. Depois que "Abrir no YouTube" chegou (com o timestamp da fala), o usuário relatou: _"O botão 'abrir fonte' se tornou inutil, já que agora temos o 'Abrir no Youtube', podemos remove-lo. Inclusive o link atual do 'Abrir fonte' vai para o video sem marcar o inicio, o que pode confundir o usuario."_

O defeito concreto: quando a fala tem o PDF oficial do Diário (`officialTextUrl`), o botão está certo e aponta para a fonte oficial. Quando o import **não** resolveu o Diário, o código cai num fallback (`view.officialTextUrl ?? view.youtubeUrl`) e o botão abre o **vídeo cru no YouTube, sem timestamp** — exatamente o que "Abrir no YouTube" já faz melhor. Ou seja, hoje o mesmo botão às vezes é proveniência oficial e às vezes é um atalho pior e duplicado. Este item faz "Abrir fonte" significar uma coisa só: a fonte oficial. Sem fonte oficial, o botão não aparece.

## Persona e fluxo

- **Persona / contexto:** assessoria/comunicação e staff conferindo proveniência de uma fala no acervo; na mesa, com o detalhe ou a lista abertos, querem checar/citar a publicação oficial.
- **Job principal:** abrir a fonte oficial de uma fala quando ela existe, sem que um botão prometa "fonte" e entregue um vídeo sem o ponto.
- **Fluxo desejado:** abre a fala → se há Diário oficial, vê "Abrir Diário Oficial" e cai no PDF; se não há, o botão simplesmente não existe e "Abrir no YouTube" (no ponto da fala) é o caminho de vídeo.
- **Anti-goals de produto:** transformar "Abrir fonte" num segundo link de vídeo; esconder que a fonte oficial faltou com um link pior; mexer no "Abrir no YouTube" timestampado; redesenhar a tela; reimportar dados.

## Objetivo e aceite

- Nenhum botão rotulado como fonte aponta para uma URL de vídeo sem marcação de ponto.
- "Abrir fonte" (ou o rótulo substituto) só é renderizado quando `officialTextUrl` existe; sem ele, some — não cai no `youtubeUrl`.
- "Abrir no YouTube" permanece intocado, abrindo no ponto da fala.
- Acesso ao PDF oficial não é perdido silenciosamente onde ele existe (C160 preservado).
- Lista e detalhe se comportam igual: o mesmo critério de existência nos dois.
- **Guardrails:** sem schema/Consent/migration; sem tocar no VOD/MP4 nem no crédito "Fonte: Câmara dos Deputados · CC BY 4.0"; URL pública do acervo intocada; sem mudança de import.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é um botão existente; nenhum número, série ou agregado é apresentado ou derivado.
- **Decisões desbloqueadas:** _N/A — sem métrica; a decisão do usuário (checar a fonte oficial) já existe e é servida ou não pelo botão._
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: o critério é "existe fonte oficial?", nunca "existe algum link?".

## Dados da decisão (literais)

- **Condição de exibição:** renderizar o botão **somente** quando `officialTextUrl` for não-nulo; remover o fallback `?? youtubeUrl` nos dois pontos: `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx` e `src/utilities/speech/speechViewModels.ts`.
- **Rótulo proposto (pt-BR):** `Abrir Diário Oficial` (alternativas no gate: `Ver Diário Oficial`, `Abrir PDF oficial`) — deixa claro que é o registro oficial e não um vídeo.
- **Não mexer:** o botão/atalho "Abrir no YouTube" (`SpeechDetailPlayer.tsx`) e "Assistir na Câmara" seguem como estão, com timestamp.
- **Fallback proibido:** `youtubeUrl` nunca é destino do botão de fonte; `sourceUrl` deixa de representar "fonte ou vídeo".
- **Onde mais aparece:** card da lista `SpeechResultCard.tsx` — mesmo critério.
- **Comportamento do C160 preservado:** quando `officialTextUrl` existe, o destino continua sendo o PDF direto do Diário.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/speech/SpeechDetailPlayer.tsx` (render do botão, props), `src/components/campaign/speech/SpeechResultCard.tsx` (card da lista), `src/utilities/speech/speechViewModels.ts` (derivação de `sourceUrl`), `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx` (passa a prop).
- **Precedente a olhar:** C160 `docs/plans/acervo-abrir-fonte-pdf-oficial.md` (dono do destino do link); `docs/plans/acervo-videos-comunicacao.md` (C154, atalho YouTube timestampado).
- **Risco de acoplamento:** `sourceUrl` pode ser lido por testes/e2e (`tests/e2e/campaignSpeechAcervo.e2e.spec.ts`) — a mudança de nome/semântica precisa acompanhar; não deixar a lista e o detalhe divergirem.

## Dependências

- Entregues (duras, satisfeitas): C160/#988 (PDF oficial como destino de "Abrir fonte"); C154 (acervo + "Abrir no YouTube" timestampado).
- Nenhuma dependência bloqueante.

## Fora de escopo

- Remoção total do botão (decisão de gate — ver Questões em aberto; ficaria como follow-up se escolhida).
- Backfill/resolução de Diários ausentes (é do C160; aqui não se cria fonte onde não há).
- Qualquer mudança no VOD/MP4, trechos, transcrições, import ou crédito CC BY.
- Redesenho da tela do acervo ou introdução de novo campo de fonte.

## Rabbit holes de produto

- **"Preencher o `officialTextUrl` que falta para todo mundo ter botão."** Se alguém "só completar": puxa a resolução offline do C160 de novo e um backfill — escopo de outro item. **Corte neste item:** sem fonte oficial, o botão não aparece.
- **"Manter o fallback mas com timestamp."** Se alguém "só completar": o botão de fonte vira clone do "Abrir no YouTube" — a duplicação que o usuário reclamou. **Corte neste item:** fonte é fonte; vídeo é vídeo.
- **"Aproveitar e remover o botão de vez."** Se alguém "só completar": some o acesso de um clique ao PDF oficial e o C160 perde sentido. **Corte neste item:** decisão consciente no gate, não efeito colateral.

## Questões em aberto (produto)

- **Remover o botão de vez (pedido literal) ou só endurecer a condição?** **Opções:** A) remoção total — perde o atalho ao PDF oficial onde ele existe; B) manter só quando há `officialTextUrl`, com rótulo explícito, sem fallback YouTube; C) manter os dois (fonte + YouTube) como hoje. **Recomendação:** B — resolve a confusão relatada (fim do vídeo sem ponto) sem jogar fora o acesso ao Diário oficial. _(decidido — produto 2026-09-16: manter apenas quando existe a fonte oficial; sem fallback de vídeo)_
- **Qual rótulo?** **Opções:** A) `Abrir Diário Oficial` | B) `Ver Diário Oficial` | C) `Abrir PDF oficial`. **Recomendação:** A — nomeia o registro oficial e mantém o verbo do botão atual. _(assumido)_
- **Lista e detalhe com o mesmo texto?** **Opções:** A) sim, mesmo rótulo | B) lista mais curto. **Recomendação:** A — uma regra só, menos surpresa. _(assumido)_

## Referências

- GitHub Issue #1087
- Design UI (gate): N/A — sem UI
- `src/components/campaign/speech/SpeechDetailPlayer.tsx` (botão "Abrir fonte"; "Abrir no YouTube")
- `src/components/campaign/speech/SpeechResultCard.tsx` · `src/utilities/speech/speechViewModels.ts` · `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx`
- `docs/plans/acervo-abrir-fonte-pdf-oficial.md` (C160/#988) · `docs/plans/acervo-videos-comunicacao.md` (C154)
- `AGENTS.md` — convenções de i18n (rótulo pt-BR) e rotas `/campanha`

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (nenhum botão de fonte leva a vídeo sem ponto); (2) appetite ~0,25–0,5 dia, dois sítios de render; (3) persona + job + aceite claros; (4) direção no codebase é hipótese; (5) zero decisão dura de engenharia.
