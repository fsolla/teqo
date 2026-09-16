# Acervo: o player e o link abrem no ponto certo da fala

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1082
Priority: P1
Impeccable: A — N/A sem nova superfície (o defeito é de comportamento do seek, não de layout)
Design UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável — abrir uma fala (ou o link "Abrir no YouTube") posiciona o vídeo no mesmo ponto que o compartilhamento do próprio YouTube.
Responsável: —

## Intenção

A assessoria abre uma fala do Acervo no `/campanha/comunicacao/acervo/…` e o vídeo começa **fora do ponto** — sistematicamente alguns segundos à frente do começo real da fala. O mesmo acontece quando a pessoa clica em "Abrir no YouTube": o `t=` gerado não bate com o ponto que o próprio YouTube entrega ao compartilhar aquele trecho. Quem compartilha um trecho com a rede passa a mandar o público para alguns segundos depois do começo, e quem confere a fala na tela perde o início. A causa provável é que o `t=` do Acervo é calculado só pela distância `excerptTMs − eventStartAt`, sem descontar o atraso entre o relógio do `eventStartAt` e o início efetivo da sessão no vídeo — atraso que a vertical de relatório de cidade (C163) já mediu e desconta, mas o player/share do Acervo nunca aplicou. É um defeito de confiança: o número que a assessoria compartilha precisa conferir com o vídeo, não quase conferir.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação na mesa, montando o recorte do dia e compartilhando trechos de fala por WhatsApp/YouTube; e qualquer pessoa que recebe o link e vai assistir.
- **Job principal:** abrir (na tela ou pelo link) exatamente o instante em que a fala começa, sem precisar adivinhar quantos segundos voltar.
- **Fluxo desejado:** entra na fala → o vídeo já começa no ponto certo → clica em "Abrir no YouTube"/compartilha → o `t=` do link leva ao mesmo ponto que o YouTube daria. Ninguém ajusta nada na mão.
- **Anti-goals de produto:** não virar "editor de offset por fala"; não expor um controle/configuração de lag para o usuário; não prometer precisão ao segundo quando a evidência não existir (melhor omitir `t=` do que inventar).

## Objetivo e aceite

- Abrir uma fala do Acervo posiciona o player no mesmo ponto de início da fala que a referência do YouTube entrega (o desvio deixa de ser sistemático).
- O link de "Abrir no YouTube"/compartilhamento carrega um `t=` que cai no mesmo ponto que o player — player e link não divergem.
- O desvio residual observável é pequeno e explicável por evidência (não "quase certo por sorte"); sem evidência, o comportamento é o de hoje/omitir, nunca um palpite.
- **Guardrails:** sem schema/Consent/migration; contratos de URL pública intactos; não mexer nos contratos de C162 (posição de clique no transcrito), C166 (seleção/trecho) e C167 (corte/publicação); quando o offset for desconhecido, **não** inventar `t=` (omitir); calibração **baseada em evidência**, não em chute.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Por quê:** o item corrige comportamento de seek/compartilhamento; não produz, agrega nem exibe métrica, série, ranking ou mapa. Nenhuma superfície de números novos — o "dado" aqui é o literal do `t=` de um único link, tratado em Dados da decisão.

## Dados da decisão (literais)

- Exemplo do usuário (fala 997, staging): página `https://staging.jorgesolla1313.com.br/campanha/comunicacao/acervo/997`.
- Link que o app gera hoje: `https://www.youtube.com/watch?v=DC_i9Kp1LVk&t=11962s`.
- Link correto (compartilhamento do YouTube): `https://www.youtube.com/live/DC_i9Kp1LVk?si=WcQakSdJVE2CvW54&t=11949`.
- Desvio observado: ~13s (app **depois** do ponto real).
- Evidência da C163 (precedente, **não** copiar cegamente): sessão de 13/03/2018 começa ~**37s** depois do `eventStartAt`; `YOUTUBE_VIDEO_OFFSET_SECONDS = 37` em `scripts/lib/cityReportBlocks.mjs`; a fala 641 fechou `youtube.com/watch?v=2cX_gKkJH7Q&t=608s`.
- Nota de forma de URL (não é o outcome): o canônico de arquivo ao vivo é `/live/<id>?t=`; `watch?v=<id>&t=` também funciona — este item **não** troca a forma, só o ponto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/speechVod.ts` (dono do cálculo de offset), `src/lib/speechShare.ts:29-44` (builder do link), `src/utilities/speech/speechViewModels.ts:260` (onde `youtubeOffsetSeconds` nasce) e `src/components/campaign/speech/SpeechDetailPlayer.tsx:142-146,231-243` (start do embed e seek do transcrito).
- **Precedente a olhar:** `scripts/lib/cityReportBlocks.mjs` (C163 — como o relatório de cidade desconta o lag) e os changelogs `docs/changelog/2026-09-15-c163-falas-*.md`.
- **Risco de acoplamento:** o offset é calculado uma vez e consumido por player e share; se cada superfície aplicar sua própria correção, elas divergem. Respeitar C162/C166/C167 (posições de clique/seleção/corte seguem relativas ao clipe da Câmara, não ao relógio do YouTube).

## Dependências

- Evidência da C163 (`YOUTUBE_VIDEO_OFFSET_SECONDS = 37`) como precedente de método, não como valor a copiar.
- Contratos C162/C166/C167 a preservar.

## Fora de escopo

- Trocar a forma da URL para `/live/<id>?t=` (fica como nota; sem mudança de contrato de URL).
- Recuperar o `enablejsapi`/YouTube IFrame API para seek programático.
- Remapear os `startSeconds` do ASR do clipe da Câmara para o relógio da sessão.
- Calibração por fala/sessão com UI, tabela ou job de manutenção.

## Rabbit holes de produto

- **"É só somar uma constante fixa".** Se alguém só fixar um valor global: o desvio varia por sessão e o número "corrige" uma fala e erra outra. **Corte neste item:** validar contra mais de uma fala/sessão antes de travar qualquer valor.
- **"Vamos reconstruir o modelo de offsets".** Reescrever a matemática de relógio de parede/tempo de sessão puxa ASR, importação e C163. **Corte:** ajustar o ponto de consumo no dono atual, sem novo modelo.
- **"Oferece um controle de ajuste fino".** Dar slider de offset por fala transforma defeito em configuração e joga o erro no usuário. **Corte:** correção automática e, na dúvida, omitir `t=`.

## Questões em aberto (produto)

- **Como corrigir o ponto?** **Opções:** A) descontar o lag de início de sessão como a C163 (mesmo método, valor revalidado); B) fixar uma constante nova global; C) calibrar por sessão. **Recomendação:** A — usar o método da C163 no dono do Acervo, confirmando o valor com evidência datada da fala 997 (e da 641) antes de travar. _(assumido — validar com produto)_
- **Amostra mínima para considerar a evidência suficiente?** **Opções:** A) só a fala 997 do relato; B) 997 + 641 (a que a C163 já mediu). **Recomendação:** B — dois pontos com o mesmo comportamento dão confiança de que não é coincidência de uma sessão.
- **Corrigir player e link juntos?** **Opções:** A) só o link do YouTube; B) só o start do player; C) os dois pela mesma fonte de offset. **Recomendação:** C — divergir player e link reintroduz o defeito pela outra porta.

## Referências

- GitHub Issue #1082
- Design UI (gate): N/A — sem UI
- `docs/changelog/2026-09-15-c163-falas-calibracao-video.md`, `.../c163-falas-inicio-da-fala.md`, `.../c163-falas-ancora-trecho.md` — histórico de calibração (pista, não contrato)
- `src/lib/speechVod.ts`, `src/lib/speechShare.ts:29-44`, `src/utilities/speech/speechViewModels.ts:260`, `src/components/campaign/speech/SpeechDetailPlayer.tsx:142-146,231-243`, `scripts/lib/cityReportBlocks.mjs`
- `AGENTS.md` — contratos de URL pública e C162/C166/C167

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (abrir fala/link cai no mesmo ponto do YouTube); (2) appetite ~0,5–1 dia, ajuste no dono; (3) persona/job/aceite em linguagem de produto; (4) direção no codebase é hipótese (arquivos como pista); (5) zero decisão dura de engenharia (sem schema/migration/signatures).
