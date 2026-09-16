# Corte do acervo: resolver o trecho com a Câmara instável e falhar dizendo o porquê

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1045
Priority: P1
Impeccable: A — N/A (sem UI nova: só o texto de uma falha existente muda)
Rascunho UI: N/A — sem UI nova
Appetite: ~1 dia eng; um outcome verificável — o "Cortar vídeo" não morre mais na primeira etapa quando o arquivo é recuperável, e quando não há arquivo a falha explica o que aconteceu e deixa tentar de novo
Responsável: —

## Intenção

Em produção (acervo de falas, id 997), a assessoria clica em "Cortar vídeo" e o corte morre na PRIMEIRA etapa — "Localizando o trecho na Câmara" — com um aviso de que a API da Câmara não está entregando o vídeo; mas o trecho está lá, baixável pelo link VOD, e a Câmara costuma gerar/entregar em dezenas de segundos. A janela de espera atual é curta demais para o comportamento real da API, o link já gravado na fala é ignorado como candidato e a causa real fica só numa coluna interna — a pessoa vê um texto genérico e um beco. Este item torna a primeira etapa resiliente (API lenta/instável ou hash morto não é o fim, enquanto existir arquivo verificável) e a falha honesta (diz o que houve e permite tentar de novo sem duplicar o corte).

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`, `coordinator`, `candidate`) na mesa, prazo curto, já com a seleção [início,fim] feita no detalhe da fala (C166) e o diálogo de corte aberto.
- **Job principal:** cortar o trecho exato sem saber — nem precisar saber — o que é CDN, hash ou timeout; se não der, entender o motivo e poder tentar de novo.
- **Fluxo desejado:** "Cortar e publicar" → "Localizando o trecho na Câmara" com espera suficiente para a API real → se vier hash morto, o link VOD já gravado da fala é tentado e verificado → arquivo encontrado: corta → se realmente não houver arquivo recuperável: falha que nomeia a causa ("ainda gerando", "não existe mais", "não foi possível cortar", "não deu para guardar") + "Tentar novamente" (mesma fala, mesmo trecho, sem corte duplicado) + "Voltar ao acervo".
- **Anti-goals de produto:** espelhar/re-hospedar MP4 (S3), baixar do YouTube, regenerar o acervo em lote, segundo fluxo/editor de corte, novo `Consent`/collection, upload externo, expor o acervo fora de `/campanha`.

## Objetivo e aceite

- **API lenta/instável:** a primeira etapa espera de acordo com o comportamento medido da Câmara (~30 s no primeiro request; depois consultas curtas) dentro de um limite declarado — não morre no primeiro timeout com "a Câmara não está entregando".
- **Hash morto com link ainda vivo:** se a resolução sob demanda falhar mas o link VOD gravado na fala responder arquivo real, o corte conclui com esse arquivo; link morto/falso (403, timeout, `text/html`) nunca é usado.
- **Sem arquivo recuperável:** a falha é honesta — a causa real chega à pessoa em linguagem clara (e o operador segue vendo o detalhe interno); nada é publicado e o fluxo não fica preso: "Tentar novamente" reusa a mesma row, sem duplicar.
- **Fala inelegível:** quando a fala nunca teve vídeo para cortar, a mensagem diz isso de forma direta (não culpa a API da Câmara).
- **Guardrails:** `excerptTMs` verbatim (nunca arredondar/deslocar o trecho); crédito `Fonte: Câmara dos Deputados · CC BY 4.0`; gate do acervo (`canReadSpeechCatalog`; `advisor`/`leader` negados fail-closed); sem espelhar MP4, sem upload externo, sem novo `Consent`/collection/migration; URLs públicas do acervo intocadas.

## Dados (intenção)

- **Vou apresentar dados?** Não — progresso e erro são feedback de ação, não dado de acervo.
- **Decisões desbloqueadas:** a assessoria decide tentar de novo ou buscar outra fonte sabendo a causa; a coordenação decide se um link morto recorrente justifica reprocessar a fala.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: nada de dashboard/métrica de falhas; a causa é uma mensagem, não um relatório.

## Dados da decisão (literais)

- **API (resolução sob demanda):** `GET https://www.camara.leg.br/evento-legislativo/{eventId}/video-sob-demanda?idAudio={audioId}&trecho={excerptTMs}` → `{ estado: 'GERANDO' | 'PRONTO' | 'INDISPONIVEL', video: { linkParaReproducao, linkParaDownload, duracao, titulo } }`.
- **Trecho:** `trecho` = `excerptTMs` do banco (epoch ms), verbatim; valor vizinho cai em outro orador — nunca alterar.
- **Cadência medida (2026-09-12/14):** o primeiro request de um trecho novo pode levar ~30 s e devolver `GERANDO`; consultas seguintes (~5 s) devolvem `PRONTO` em 1–2 polls; o importador usa 40 polls × 5 s com timeout de 60 s. O resolver do player/corte hoje faz 2 tentativas × 15 s **sem poll** — janela insuficiente para o primeiro request.
- **Links gravados na fala (`vodPlaybackUrl`/`vodDownloadUrl`):** cache — candidatos a tentar quando a API falhar, **sempre verificados** (resposta real, não `text/html`) antes de virar arquivo; nunca requisito para tentar a Câmara.
- **Mensagens da 1ª etapa hoje (todas → `failed`):** fala ausente — "A fala deste corte não está mais disponível."; sem coordenadas — "Esta fala não tem trecho de vídeo para resolver na Câmara."; `GERANDO` — "A Câmara ainda está gerando o vídeo deste trecho."; não `PRONTO`/hash morto — "A Câmara não entregou o arquivo deste trecho."; `PRONTO` sem URL jogável — "A Câmara não entregou um arquivo jogável deste trecho."; transporte no catch — mensagem crua (`HTTP 403 em <url>`, `fetch failed`, timeout).
- **Fallback visível hoje (diálogo):** `SPEECH_CUT_GENERIC_ERROR_MESSAGE` = 'Não foi possível preparar o corte. Verifique seu acesso e tente novamente.' — o aceite substitui/complementa por um vocabulário de causas.
- **Discriminador interno:** a coluna `error` da row `speechCut` (admin) registra a causa exata; `toSpeechCutViewModel` hoje **não** a expõe.
- **Evidência dos quadrantes (C162, 2026-09-14, 997 falas):** 773 ambos · 151 só VOD · 29 só YouTube · 44 nenhum; o CDN apagou os 924 MP4s entre 04:35 e 08:05; `PRONTO` velho pode devolver hash morto (403/timeout) e não aceita forçar regeneração (id 996) → tratar como indisponível.
- **Crédito:** `Fonte: Câmara dos Deputados · CC BY 4.0`.
- **Acesso/guardrails:** corta quem lê o acervo (`canReadSpeechCatalog`); `advisor` e `leader` negados fail-closed; leader lockdown intacto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/speech/speechVodResolver.ts` (janela, poll e verificação dos links), `src/utilities/speech/speechCutJob.ts` (1ª etapa, candidatos e mensagens), `src/lib/speechVod.ts` (contrato de coordenadas/cache), `src/components/campaign/speech/SpeechCutDialog.tsx` (texto da cena de falha), `src/lib/schemas/speechCut.ts` (literais de erro) e a ação/rota do corte (`src/app/(campaign)/campanha/actions/speech.ts`, `.../acervo/cortar/`).
- **Precedente a olhar:** `scripts/lib/camaraFetch.mjs` (`resolveVod`: 40×5 s, timeout 60 s; `probeLink` decide por content-type) — referência de política, **não importável** de `src/`; `docs/plans/acervo-vod-sob-demanda.md` (C162, janela curta deliberada para o clique do player) e `docs/plans/c167-cortar-trecho-publicar-impl.md` (D2/D3: background, retry por row, reaper). O resolver é compartilhado com o player C162 — ampliar a janela afeta também o clique "assistir/baixar".
- **Testes/risco:** `tests/int/speechCut.int.spec.ts` hoje só cobre o caminho feliz stubado (nada pina a janela real, o poll ou o fallback de link); `tests/e2e/campaignSpeechCut.e2e.spec.ts` e o manifest de e2e mapeiam `src/utilities/speech`/`src/components/campaign/speech`/comunicacao. Não criar caminho de resolução paralelo ao C162 (editar o dono).

## Dependências

- Entregues (duras, satisfeitas): C162 (#999, resolução sob demanda), C167 (#1014, corte [início,fim] + retry sem duplicar); C168 (#1015, biblioteca de cortes) é superfície irmã.
- Irmão sem dependência dura: C170 (teto de duração da seleção) — não muda resolução nem tratamento de falha.

## Fora de escopo

- Espelhar/re-hospedar MP4 (S3/Garage), transcodificar, baixar do YouTube.
- Fila assíncrona/worker/cron, regenerar os 924 em lote, botão "gerar novamente".
- Redesenhar a cena de falha (o texto muda; o layout não), tela de pendências ou dashboard de falhas.
- Migration/collection/`Consent` novos; tornar o link do banco requisito; escrever o link novo resolvido de volta na fala (cache pode ser atualizado depois, fora desta fatia).

## Rabbit holes de produto

- **Re-hospedar o MP4 para "nunca mais falhar".** Se alguém "só completar": storage, custo, retenção e direitos. **Corte neste item:** resolver sob demanda com o que existir (API ou link gravado verificado).
- **Sincronizar todo link novo no banco (cron/reconciliation).** Se alguém "só completar": novas escritas e dono de permissão. **Corte neste item:** o banco segue cache; sem escrita nova obrigatória.
- **Mudar o trecho por vizinhança quando o exato falha.** Se alguém "só completar": muda o orador (fato medido). **Corte neste item:** `excerptTMs` verbatim; falha honesta.
- **Virar fila de suporte ("caso o erro persista, fale com…").** Se alguém "só completar": tickets, SLA, tela de acompanhamento. **Corte neste item:** causa + tentar de novo + voltar ao acervo.

## Questões em aberto (produto)

- **Quanto esperar na 1ª etapa?** **Opções:** A) alinhar ao comportamento medido (primeiro request ~30 s, depois consultas curtas) com limite declarado | B) manter curto e falhar rápido. **Recomendação:** A — esperar menos do que o medido é a causa provável do defeito; o limite continua bounded para não travar o job. _(assumido — validar no gate)_
- **Usar o link VOD gravado?** **Opções:** A) só como candidato verificado depois de a API não servir | B) não usar (só API). **Recomendação:** A — foi pedido explícito ("o trecho é baixável pelo link VOD"); verificar antes de cortar e nunca entregar arquivo morto. _(assumido)_
- **Até onde vai a mensagem honesta?** **Opções:** A) só a 1ª etapa (fatia mínima) | B) toda falha do corte, incluindo cortar/guardar (débito deferido no C167). **Recomendação:** B mínima — a causa já é gravada na row; expor um vocabulário curto de causas cobre a 1ª etapa e o débito sem virar tela nova. _(assumido)_
- **Persistir o link recém-resolvido na fala?** **Opções:** A) não agora | B) sim. **Recomendação:** A — escrita nova exigiria permissão ampliada; fica como dívida registrada se o link morto se repetir. _(assumido)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): N/A — sem UI nova
- Planos irmãos: [`acervo-vod-sob-demanda.md`](acervo-vod-sob-demanda.md) (C162/#999), [`c167-cortar-trecho-publicar.md`](c167-cortar-trecho-publicar.md) (C167/#1014) + [`c167-cortar-trecho-publicar-impl.md`](c167-cortar-trecho-publicar-impl.md), [`c168-biblioteca-cortes.md`](c168-biblioteca-cortes.md) (C168/#1015)
- Pesquisa (cadência medida do VOD): `docs/research/piloto-fonte-videos-camara.md:39-42`
- Arquivos-chave (pista, não contrato): `src/utilities/speech/speechVodResolver.ts`, `src/utilities/speech/speechCutJob.ts`, `src/lib/speechVod.ts`, `src/lib/schemas/speechCut.ts`, `src/components/campaign/speech/SpeechCutDialog.tsx`, `src/app/(campaign)/campanha/actions/speech.ts`, `scripts/lib/camaraFetch.mjs`, `tests/int/speechCut.int.spec.ts`, `tests/e2e/campaignSpeechCut.e2e.spec.ts`
- `AGENTS.md` — vertical Comunicação, gate do acervo e crédito CC BY.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (a 1ª etapa resolve com a Câmara instável/link morto verificado; sem arquivo, a falha é honesta e retomável); (2) appetite de ~1 dia comporta janela/poll, candidato verificado, vocabulário de causas e testes, sem schema; (3) persona, job e aceite legíveis sem jargão de stack; (4) direção no codebase é hipótese (áreas, precedente não importável e o alerta de que o resolver é compartilhado com o player); (5) zero decisão dura de engenharia (rota, signatures, persistência e extração de helper ficam para o plano de implementação).
