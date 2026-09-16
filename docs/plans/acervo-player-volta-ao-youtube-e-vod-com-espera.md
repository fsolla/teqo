# Acervo: o player sempre deixa voltar ao YouTube e espera a Câmara gerar o trecho

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1103
Priority: P2
Impeccable: A — N/A sem nova superfície (acréscimo de um controle simétrico no bloco de saída já desenhado + correção de comportamento do resolver)
Design UI: N/A — sem UI nova
Appetite: ~0,5–1 dia eng; um outcome verificável: numa fala, quem troca para a Câmara sempre consegue voltar ao YouTube na própria página, e a Câmara gerando o trecho não vira um "falhou" de primeira.
Responsável: —

## Intenção

O aviso do dono é um defeito de duas cabeças na mesma fala. Primeira: ao clicar em "Assistir na Câmara", o player troca a superfície para o trecho da Câmara — mas **não existe caminho de volta** para o embed do YouTube na própria página; a única saída passa a ser um link externo, e quem preferia o YouTube fica ilhado. Segunda: quando a Câmara responde "GERANDO", o player trata isso como fracasso na primeira resposta e manda o usuário tentar de novo, quando na verdade a Câmara está apenas transcodificando o trecho e ele fica pronto segundos depois — o retry então "funciona", o que confirma que a espera é curta e o problema é o app desistir cedo. Para a assessoria, no meio da montagem de uma peça, isso custa a fala: ou ela perde a fonte que estava usando, ou acha que o arquivo não existe. A correção é pequena e simétrica — dar o mesmo controle nos dois sentidos e deixar o clique do player esperar um orçamento curto antes de anunciar "gerando/falhou".

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`, coordenação e candidatura) em `/campanha/comunicacao/acervo/[id]`, na mesa ou no celular, com prazo curto.
- **Job principal:** alternar entre a superfície da Câmara e a do YouTube na mesma página, e assistir ao trecho sem ser mandado "tentar de novo" por algo que só estava sendo gerado.
- **Fluxo desejado:** abre a fala → assiste na superfície preferida (C178) → clica em "Assistir no YouTube" e volta ao embed no ponto da fala → se pedir o trecho da Câmara e ele ainda estiver sendo gerado, o clique espera alguns segundos e o vídeo toca sozinho; se o orçamento estourar, aí sim vê o estado honesto com "Tentar novamente".
- **Anti-goals de produto:** autenticar no YouTube ou trocar por embed novo; inventar estado ("sucesso" sem verificação de mídia); novo player/editor; baixar/espelhar/transcodificar; novo `Consent`/collection/migration; expor o acervo fora de `/campanha`.

## Objetivo e aceite

- Trocar de superfície **nos dois sentidos** na própria página (Câmara ↔ embed do YouTube), com o ponto da fala preservado ao voltar.
- Esperar a geração da Câmara **dentro do clique do player** (bounded), em vez de devolver "gerando" na primeira resposta; se estourar o orçamento, o "Tentar novamente" continua existindo e o estado honesto permanece.
- Nenhuma regressão nas saídas, na transcrição/posicionamento e na seleção/corte (C162/C166/C167/C172).
- **Guardrails:** nada de autenticar no YouTube nem embed novo; não inventar estado; a superfície que o app controla segue preferida (C178); transcrição/posicionamento e seleção/corte intactos; sem `Consent`/collection/migration; URLs públicas do acervo intocadas; crédito "Fonte: Câmara dos Deputados · CC BY 4.0" mantido.

## Dados (intenção)

- **Vou apresentar dados?** Não — é feedback de ação no player, não dado de acervo; nenhum KPI/gráfico novo.
- **Decisões desbloqueadas:** a assessoria decide seguir com a peça sem trocar de ferramenta; a coordenação decide, pelo uso, se o YouTube volta a ser superfície padrão algum dia.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: o estado do player é feedback de ação, nunca dado persistido.

## Dados da decisão (literais)

- **Duas políticas hoje (a raiz do defeito):** a do player `SPEECH_VOD_PLAYER_POLICY = { statusTimeoutMs: 15000, statusRetries: 1, retryDelayMs: 1000, pollAttempts: 0, pollDelayMs: 1000 }` — com `pollAttempts: 0`, o primeiro `GERANDO` já retorna `{state:'gerando'}`; a do corte `SPEECH_VOD_CUT_POLICY = { statusTimeoutMs: 45000, statusRetries: 1, retryDelayMs: 1000, pollAttempts: 2, pollDelayMs: 5000 }` — essa espera e por isso "funciona".
- **Copy pt-BR existente (manter):** bloco de saída "Se o vídeo não abrir aqui, assista por outro caminho:", botões "Abrir no YouTube" (link externo, no ponto) e "Assistir na Câmara"; estado de geração já nomeado "A Câmara está gerando o trecho"; retry "Tentar novamente".
- **Copy nova (proposta):** botão "Assistir no YouTube" no mesmo bloco de saída, no ponto da fala.
- **Embed do YouTube (contrato a preservar):** `https://www.youtube.com/embed/<id>?playsinline=1&rel=0&start=<segundos>`.
- Sem `Consent`/collection/migration; nada persistido no servidor.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/speech/SpeechDetailPlayer.tsx` (setter simétrico de `surface` + botão no bloco de saída, `renderYoutubeExit`), `src/utilities/speech/speechVodResolver.ts` + a rota/action `.../comunicacao/acervo/resolver-vod` (`resolveSpeechVodForActor` hoje usa a política do player), `src/lib/speechShare.ts`.
- **Precedente a olhar:** C178 (`docs/plans/acervo-player-youtube-sem-parede-de-signin.md`, #1081) — redesenha a superfície padrão; `docs/plans/acervo-vod-sob-demanda.md` (C162/C169, a política do corte e a verificação de mídia).
- **Risco de acoplamento:** mesmo arquivo de C178/C172/C173 — serializar; pins em `tests/unit/speechDetailPlayer.unit.spec.tsx`, `tests/unit/speechVodResolver.unit.spec.ts` (fixa a política do player) e `tests/e2e/campaignSpeechAcervo.e2e.spec.ts` precisam ser renegociados no item.

## Dependências

- **Dura:** C178 — mesmo arquivo `SpeechDetailPlayer.tsx`; a superfície padrão precisa existir antes de dar a volta.
- **Suave:** C172/C173 — serializam no mesmo arquivo.
- Nenhum bloqueio de dados.

## Fora de escopo

- Fazer o YouTube tocar quando ele bloqueia; detectar/classificar a causa do bloqueio.
- Baixar/espelhar/transcodificar; tocar a superfície do VOD com um player novo.
- Tornar o YouTube a superfície padrão de novo (isso é C178).
- Segundo player/editor; exposição pública do acervo; `Consent`/collection/migration.

## Rabbit holes de produto

- **"Consertar o iframe do YouTube".** Se alguém "só completar": IFrame API, eventos, OAuth, player próprio. **Corte neste item:** a volta é um botão na nossa própria página; o YouTube continua embed anônimo.
- **Espera infinita / fila de render.** Se alguém "só completar": estado assíncrono persistido, cron, "avise quando ficar pronto". **Corte neste item:** orçamento curto dentro do clique; estourou → estado honesto + retry.
- **"Retry resolve, então é só mandar tentar".** **Corte:** isso é o defeito, não a solução — o app espera antes de acusar falha.
- **Redesenhar o player inteiro.** **Corte:** encaixe cirúrgico; transcrição, seleção e corte intactos.

## Questões em aberto (produto)

- **Quanto esperar dentro do clique do player?** **Opções:** A) reusar a política do corte (45s/2 polls de 5s) | B) política própria do player (ex.: alguns polls curtos) | C) manter `pollAttempts:0` e só melhorar a copy. **Recomendação:** B — um orçamento curto e próprio do clique, entre o imediato de hoje e o do corte, preservando o "bounded" e a verificação de mídia. _(assumido — validar com produto)_
- **O botão "Assistir no YouTube" aparece também no estado "gerando"?** **Opções:** A) sim, sempre que houver embed | B) só quando a superfície for `vod` e a mídia estiver resolvida. **Recomendação:** A — a saída é justamente o que falta hoje; nunca deixar o usuário sem caminho. _(assumido)_
- **Onde fica o botão?** **Opções:** A) no bloco de saída já existente | B) junto das ações do player. **Recomendação:** A — simétrico a "Assistir na Câmara", mesmo bloco, mesmo desenho.

## Referências

- GitHub Issue: —
- Planos irmãos: `docs/plans/acervo-player-youtube-sem-parede-de-signin.md` (C178), `docs/plans/acervo-vod-sob-demanda.md` (C162), `docs/plans/c171-player-youtube-sem-signin.md`
- Arquivos-chave (pista, não contrato): `src/components/campaign/speech/SpeechDetailPlayer.tsx`, `src/utilities/speech/speechVodResolver.ts`, `src/lib/speechShare.ts`, `src/app/(campaign)/campanha/actions/speech.ts`, `tests/unit/speechDetailPlayer.unit.spec.tsx`, `tests/unit/speechVodResolver.unit.spec.ts`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`
- `AGENTS.md` / `AGENTS-campaign.md` — vertical Comunicação, gate do acervo e crédito CC BY

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (volta simétrica ao YouTube + espera bounded na geração); (2) appetite ~0,5–1 dia comporta o controle simétrico e o ajuste de política, sem schema; (3) persona/job/aceite em linguagem de produto; (4) direção no codebase é hipótese com precedentes e arquivos nomeados; (5) zero decisão dura de engenharia (política, rota e shape do estado ficam para o plano de implementação).
