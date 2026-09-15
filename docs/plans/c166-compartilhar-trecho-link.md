# Acervo: selecionar trecho e compartilhar por link (YouTube no ponto + WhatsApp)

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1013
Priority: P1
Impeccable: B — encaixe no detalhe do acervo (player + compartilhar)
Rascunho UI: docs/plans/c166-compartilhar-trecho-link-ui-draft.html
Appetite: ~1–1,5 dia eng; um outcome verificável — quem recebe o link abre o YouTube já no ponto do trecho, e o intervalo vai na mensagem
Responsável: —

## Intenção

O acervo já deixa achar a fala e assistir no ponto (C154/C162), mas transformar um intervalo exato em algo que circula ainda dá trabalho manual: baixar o MP4, cortar fora da ferramenta, subir em algum lugar. Na comunicação da campanha, o que circula de verdade é link no WhatsApp. Esta fatia fecha o gesto: marcar [início, fim] no player (ímã nas frases, limites de 5 s a 180 s, duração visível) e compartilhar o link do YouTube já abrindo no ponto escolhido — copiando ou mandando no WhatsApp com o intervalo escrito na mensagem. Sem cortar arquivo e sem publicar página: isso é C167/C168.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (communicator; coordenação e candidatura também), no escritório ou em campo, com peça no prazo curto, muitas vezes no celular.
- **Job principal:** transformar um trecho exato da fala num link que abre no ponto e mandá-lo no WhatsApp em segundos, sem baixar nem editar vídeo.
- **Fluxo desejado:** abre a fala → ativa "Selecionar trecho" → marca início/fim clicando nas frases (ímã) e ajusta fino nas alças (5 s–180 s; a duração aparece enquanto seleciona) → "Compartilhar" → escolhe "Copiar link" (feedback "Link copiado") ou "Enviar no WhatsApp" (abre o WhatsApp do remetente com o texto pronto) → quem recebe abre o YouTube já no trecho e lê o intervalo na mensagem.
- **Anti-goals de produto:** não é editor de vídeo nem corte/export (C167); não é página pública do trecho (C167) nem biblioteca de cortes (C168); não é segundo player; sem telemetria de compartilhamento; nunca expor o acervo autenticado para fora; sem escrita no servidor, sem `Consent`/collection novos.

### Esboço de fluxo (B/C/D)

```text
[fala com YouTube] → "Selecionar trecho" → clique nas frases (ímã) + alças (5s…3min, duração visível)
→ "Compartilhar" → [Copiar link | Enviar no WhatsApp] → [recebe abre o YouTube no ponto; mensagem traz o intervalo]
[fala sem YouTube] → seleção continua disponível (porta do corte no C167); sem opção de link + aviso honesto; MP4/fonte seguem
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/c166-compartilhar-trecho-link-ui-draft.html` — cenas: detalhe com barra de seleção (alças/duração/mm:ss) + Compartilhar; popover com "Copiar link" (estado "Copiado") e "Enviar no WhatsApp"; fala sem YouTube (link indisponível + aviso honesto, seleção preservada); mobile com seleção + sheet.

## Objetivo e aceite

- Com YouTube: marcar [início, fim] no player com ímã nos limites dos segmentos e ajuste fino; mínimo 5 s, máximo 180 s; duração e `mm:ss` visíveis durante a seleção.
- "Compartilhar" oferece exatamente duas opções: "Copiar link" (com feedback "Link copiado") e "Enviar no WhatsApp" (`wa.me` do remetente, sem destinatário).
- O link é `https://www.youtube.com/watch?v=<id>&t=<segundos>`, com `t` = offset da sessão + início do trecho; abre já no ponto. O fim não cabe no link — o intervalo vai na mensagem.
- Sem YouTube (só VOD ou sem vídeo): a opção de link não é oferecida — aviso honesto de que compartilhar por link exige YouTube; a seleção continua disponível (é a porta do corte de arquivo no C167) e MP4/fonte continuam.
- Guardrails: nada de link autenticado do acervo para fora; sem escrita no servidor/`Consent`/collection; `advisor` e `leader` seguem negados; crédito "Fonte: Câmara dos Deputados · CC BY 4.0" e o clique-para-posicionar do C162 ficam intactos.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é seleção + compartilhamento; duração/`mm:ss` é feedback de ação, não dado do acervo.
- **Decisões desbloqueadas:** a assessoria decide qual intervalo circula e por qual canal (link no ponto ou WhatsApp); quem recebe decide assistir no ponto.
- **Forma:** _adiada ao plano de implementação_ — restrição: sem KPI/telemetria de compartilhamento nesta fatia.

## Dados da decisão (literais)

- Link compartilhado (fala com YouTube): `https://www.youtube.com/watch?v=<id>&t=<segundos>`; `t=` = offset da sessão + início do trecho em segundos (inteiro), a mesma conta do posicionamento do player; o fim NÃO é codificável no link do YouTube.
- Deep link WhatsApp sem destinatário: `https://wa.me/?text=<texto>` (padrão do repo de `wa.me/?text` + copiar com feedback "copiado").
- Texto da mensagem: `Trecho de <tipo do discurso> (<data>): de <mm:ss> a <mm:ss>` + URL; ex.: `Trecho de BREVES COMUNICAÇÕES (11/08/2026): de 00:43 a 02:10 https://www.youtube.com/watch?v=<id>&t=2634`.
- Limites do trecho: mínimo 5 s, máximo 180 s; duração visível durante a seleção; alças com ímã nos limites dos segmentos e ajuste fino permitido.
- Rótulos das ações: "Compartilhar" (opções "Copiar link" e "Enviar no WhatsApp"); feedback "Link copiado".
- Fala sem YouTube: nenhuma opção de link; aviso honesto de que o compartilhamento por link exige YouTube; a seleção permanece (porta do corte do C167); nunca compartilhar link autenticado do acervo.
- Sem escrita no servidor; sem `Consent`; sem segunda superfície de player; `advisor`/`leader` permanecem negados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/speech/` (controle de seleção + compartilhar no detalhe), `src/utilities/speech/` (rótulos/segmentos já no view model) e `src/lib/` (montagem pura de link/mensagem).
- **Precedente a olhar:** `src/lib/contentShare.ts` + `src/components/ContentShareButton.tsx` (popover + copiar com feedback), `src/lib/phone.ts` (`buildWhatsAppTextShareUrl` = `wa.me/?text=`), `docs/plans/compartilhar-pagina.md` ("compartilhar não concede acesso", sem server action), C162 em `speechViewModels.ts` (`youtubeVideoId`/`youtubeOffsetSeconds`, segmentos com início/fim).
- **Risco de acoplamento:** o clique na transcrição hoje posiciona o vídeo (contrato C162 pinado em unit/e2e) — a seleção precisa de modo explícito para não regredir; o e2e `campaignSpeechAcervo` e o manifesto de áreas tocadas cobrem `src/components/campaign/speech`/`src/utilities/speech`/`src/lib/speech*`.

## Dependências

- Entregues (duras, satisfeitas): C154/C155 (acervo em produção) e C162 (player com YouTube default + offset). Nenhuma dependência aberta.

## Fora de escopo

- Cortar/gerar arquivo do trecho (clip/export) e download do clip — C167.
- Página pública do trecho com preview/OG e biblioteca de cortes — C167/C168.
- Compartilhar a partir da lista (só o detalhe nesta fatia).
- Telemetria/UTM, contagem de compartilhamentos e analytics de clique.
- Legendas, marca d'água, thumbnail e encurtador/tracker de link.
- Outros canais (X, Telegram, e-mail) — só WhatsApp + copiar link.
- Escrita no servidor, `Consent`, collection/migration novas; ampliar papéis com acesso.

## Rabbit holes de produto

- **Virar editor de vídeo.** Se alguém "só completar": trim, preview renderizado, export, fila de render. **Corte neste item:** só [início,fim] + link; nenhum arquivo novo.
- **Página pública do trecho "para o link abrir bonito".** Se alguém "só completar": rota pública, OG, hospedagem, moderação. **Corte neste item:** o link é do YouTube; C167 é outro item.
- **Encurtador/tracker para medir circulação.** Se alguém "só completar": serviço externo, redirect, privacidade. **Corte neste item:** URL canônica do YouTube; medição é item futuro explícito.
- **Precisão de frame / timeline com zoom.** Se alguém "só completar": snapping complexo e segundo quebrado. **Corte neste item:** segundos inteiros, ímã de frase, alças simples.
- **Segundo player para pré-visualizar o corte.** Se alguém "só completar": duas superfícies de vídeo. **Corte neste item:** a seleção vive no player existente.

## Questões em aberto (produto)

- **Fala sem YouTube?** **Opções:** A) esconder a opção de link com aviso honesto, mantendo a seleção para o corte | B) copiar link autenticado do acervo. **Recomendação:** A — B nunca funciona para quem recebe (rota autenticada) e vaza uma URL interna. _(assumido — validar no gate)_
- **Padrão da seleção?** **Opções:** A) marcar por clique em segmentos inteiros e ajustar com alças | B) só alças livres. **Recomendação:** A com ímã — a frase é a unidade de sentido do discurso; alças livres erram por segundos. _(decidido — A, com ajuste fino permitido)_
- **Botão?** **Opções:** A) um "Compartilhar" com as duas opções | B) dois botões separados. **Recomendação:** A (pedido do dono: botão com opções); B duplica CTA numa barra já densa. _(decidido — A)_
- **Clique na transcrição durante a seleção?** **Opções:** A) modo explícito "Selecionar trecho" (fora dele o clique segue posicionando) | B) clicar-e-arrastar sempre. **Recomendação:** A — preserva o contrato C162 e não surpreende quem só quer ouvir. _(assumido)_
- **YouTube com offset desconhecido?** **Opções:** A) oferecer link sem `t=` com aviso de que abre no início da sessão | B) não oferecer link. **Recomendação:** A — o link é utilizável; nunca inventar `t=` errado. _(assumido)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c166-compartilhar-trecho-link-ui-draft.html`
- Planos irmãos: [`acervo-vod-sob-demanda.md`](acervo-vod-sob-demanda.md) (C162), [`compartilhar-conteudos-home-whatsapp.md`](compartilhar-conteudos-home-whatsapp.md), [`compartilhar-pagina.md`](compartilhar-pagina.md)
- Arquivos-chave (pista, não contrato): `src/components/campaign/speech/SpeechDetailPlayer.tsx`, `src/utilities/speech/speechViewModels.ts`, `src/lib/contentShare.ts`, `src/lib/phone.ts`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`
- `AGENTS.md` — vertical Comunicação, lockdown de papéis e crédito CC BY.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (quem recebe abre o YouTube no ponto; o intervalo vai na mensagem) sem cortar arquivo nem publicar página; (2) appetite de ~1–1,5 dia para seleção + compartilhamento sem schema; (3) persona, job e aceite legíveis sem jargão, com as decisões literais separadas; (4) direção no codebase é hipótese com precedentes abertos e o alerta do contrato C162; (5) zero decisão dura de engenharia — nomes, rotas e schema ficam para a implementação.
