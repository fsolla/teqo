# Acervo: o player do YouTube deixa de ser uma parede de signin

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1081
Priority: P1
Impeccable: B — encaixe na superfície do player do detalhe do acervo
Design UI: docs/plans/acervo-player-youtube-sem-parede-de-signin-ui-design.html
Appetite: ~0,5–1 dia eng; um outcome verificável — abrir uma fala com vídeo nunca termina numa parede de login do YouTube.
Responsável: —

## Intenção

O dono testou o ambiente depois da entrega anterior (C171/#1047) e o defeito **continua**: a fala com vídeo abre no player e pede "faça signin para exibir o vídeo"; clicar em signin abre outra janela (onde a pessoa já está logada) e nada muda na página — o beco de login persiste. A tentativa anterior apostou em trocar o host do embed (`youtube-nocookie` → `youtube.com`) e em oferecer um bloco de saída, mas a superfície embutida continua sendo a parede de login quem recebe o usuário primeiro. Este item assume que o embed anônimo do YouTube não é confiável para as lives da Câmara e resolve de verdade: a superfície que o app controla (o vídeo do trecho da Câmara, quando existe) passa a ser o caminho padrão, e o YouTube deixa de ser a porta de entrada embutida — vira a saída externa em um clique, no ponto exato. O resultado é simples: quem abre uma fala do acervo assiste ou vê, na hora, como assistir — nunca fica preso.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`, coordenação e candidatura) em `/campanha/comunicacao`, produzindo peça com prazo curto, na mesa ou em campo.
- **Job principal:** assistir a fala na própria página, sem depender de login no YouTube e sem ficar presa num aviso de signin.
- **Fluxo desejado:** abre a fala → se há trecho da Câmara, o vídeo **toca ali** (superfície padrão) → se não há, vê uma capa clara com a ação "Abrir no YouTube" (que abre no ponto, na conta de quem já está logado) → transcrição/clique para posicionar seguem funcionando.
- **Anti-goals de produto:** autenticar no YouTube; hospedar/proxy de cookie de sessão; segundo player/editor; detectar/inferir a causa do bloqueio do iframe; novo `Consent`/collection/migration; expor o acervo fora de `/campanha`.

### Esboço de fluxo (B)

```text
[abre fala com vídeo] → há trecho da Câmara? ─ sim → [toca na página] → saídas ("Abrir no YouTube") visíveis
                                              └ não → [capa + "Abrir no YouTube"] (1 clique, no ponto)
→ nunca um iframe que exige signin como porta de entrada
```

### Design UI (B)

- Design UI (gate): `docs/plans/acervo-player-youtube-sem-parede-de-signin-ui-design.html` — cenas desktop (~1280px) e mobile (~390px): (a) superfície padrão tocando o trecho da Câmara com a saída "Abrir no YouTube"; (b) sem trecho da Câmara: capa clicável + "Abrir no YouTube"; (c) o estado de carregamento honesto. **Nenhuma cena com a parede de signin do YouTube.**

## Objetivo e aceite

- Abrir uma fala com vídeo **nunca** apresenta a parede de signin do YouTube: o usuário vê uma superfície que toca na página, ou uma capa com a saída em um clique.
- Quando a fala tem trecho da Câmara (`vodResolvable`), essa é a superfície padrão e toca neste item (reuso do resolver verificado C162/C169/C171).
- O caminho externo "Abrir no YouTube" abre no ponto exato da fala (depende do C172 para o ponto).
- Verificado com evidência **no ambiente que o dono testa** (staging): a fala do relato (997) deixa de terminar em signin.
- **Guardrails:** gate do acervo (communicator/coordinator/candidate; advisor/leader negados fail-closed); crédito "Fonte: Câmara dos Deputados · CC BY 4.0"; sem `Consent`/collection/migration; URLs públicas intocadas; transcrição/posicionamento (C162) e seleção/corte (C166/C167) intactos; sem baixar/espelhar/transcodificar.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é player + saídas; nenhum KPI/gráfico novo.
- **Decisões desbloqueadas:** a assessoria decide assistir na página sem depender do login do YouTube; a coordenação decide, pelo uso, se manter o YouTube como link externo (não embutido).
- **Forma:** _adiada ao plano de implementação_ — o estado do player é feedback de ação, não dado de acervo.

## Dados da decisão (literais)

- **Superfície atual:** `surface` em `src/components/campaign/speech/SpeechDetailPlayer.tsx` nasce `'youtube'` quando há `youtubeVideoId`, senão `'vod'`; o embed é `https://www.youtube.com/embed/<id>?playsinline=1&rel=0&start=<segundos>`.
- **Evidência do beco:** o app não vê o erro interno do iframe (sem `onError`, sem `enablejsapi`) — a saída não pode depender de detectar o bloqueio; por isso a superfície segura é a que o app controla.
- **Precedentes reusáveis:** resolver do trecho da Câmara (`acervo/resolver-vod` + `speechVodResolver.ts`, C162/C169) e as saídas do C171 ("Abrir no YouTube" no ponto via `buildSpeechExcerptYoutubeUrl`).
- **Copy pt-BR das saídas (manter):** "Se o vídeo não abrir aqui, assista por outro caminho:" / "Abrir no YouTube" / "Assistir na Câmara"; capa: "Assistir o trecho" quando houver VOD.
- **Fala sem VOD e sem YouTube:** estado honesto "Vídeo indisponível neste momento." (mantém).
- Sem `Consent`/collection/migration; nada persistido no servidor.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/speech/SpeechDetailPlayer.tsx` (escolha da superfície padrão, `renderMedia`, bloco de saídas), `src/utilities/speech/speechVodResolver.ts` + rota `acervo/resolver-vod` (reuso), `src/lib/speechShare.ts` (link externo no ponto).
- **Precedente a olhar:** C171 (`acervo-vod-sob-demanda`/`c171-player-youtube-sem-signin`), `src/components/CampaignStorySection.tsx` (embed do site público — referência de postura, não de solução).
- **Risco de acoplamento:** C172 está na fila do mesmo `SpeechDetailPlayer.tsx` (o ponto do `t=`) — serializar; pins `tests/unit/speechDetailPlayer.unit.spec.tsx`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts` (o e2e aborta `youtube*` globalmente — não carrega o embed real).

## Dependências

- **C172** — o link externo precisa abrir no ponto certo; sem ele o item fica pela metade.
- **Serializa com C172 e C173** — mesmo arquivo `SpeechDetailPlayer.tsx`.
- Tentativas anteriores que **não** resolveram para o dono: C171/#1047, C162/#999 (validar no ambiente antes de assumir que a superfície atual existe e funciona).

## Fora de escopo

- Fazer o YouTube tocar quando ele bloqueia o embed (login/idade/região); OAuth/SSO no YouTube.
- Detectar/classificar o motivo do bloqueio no iframe.
- Baixar/espelhar/transcodificar; re-hospedar no S3 redesenhar lista/detalhe além do encaixe do player.
- Exposição pública do acervo; segundo player; novo `Consent`/collection/migration.

## Rabbit holes de produto

- **"Fazer o YouTube sempre tocar".** Se alguém "só completar": OAuth, player próprio, proxy de mídia. **Corte neste item:** a superfície padrão é a que controlamos; o YouTube vira saída externa.
- **Detectar o bloqueio no iframe.** Se alguém "só completar": IFrame API + eventos + polling + estados condicionais. **Corte neste item:** a solução não depende de detectar — o embed deixa de ser a porta de entrada.
- **"Login resolve".** Se alguém "só completar": round-trip de sessão para dentro do iframe (impossível com cookies de terceiros). **Corte:** o embed é anônimo; o login é problema do YouTube.
- **Reescrever o player inteiro.** **Corte:** encaixe cirúrgico; comportamento existente (transcrição, seleção, download, corte) intacto.

## Questões em aberto (produto)

- **Como eliminar a parede de signin?** **Opções:** A) superfície padrão = trecho da Câmara quando existir, com "Abrir no YouTube" como saída externa; B) manter o iframe, mas como capa clicável (click-to-load) que só carrega o YouTube se o usuário pedir; C) remover o embed e mostrar capa + "Abrir no YouTube" sempre. **Recomendação:** A + B (Câmara default quando há VOD; para o resto, capa clicável em vez de embed automático) — nenhuma superfície mostra a parede de login de cara. _(assumido — validar com produto)_
- **Onde fica "Abrir no YouTube"?** **Opções:** A) junto das ações, sempre visível | B) dentro da capa. **Recomendação:** A — saída em um clique, sem depender de detecção.
- **Fala sem trecho da Câmara e sem YouTube?** **Opções:** A) estado honesto "Vídeo indisponível neste momento." | B) esconder o bloco. **Recomendação:** A (mantém o comportamento atual).

## Referências

- GitHub Issue #1081
- Design UI (gate): `docs/plans/acervo-player-youtube-sem-parede-de-signin-ui-design.html`
- Planos irmãos: `docs/plans/c171-player-youtube-sem-signin.md` (tentativa anterior), `docs/plans/acervo-vod-sob-demanda.md` (C162), `docs/plans/c169-corte-vod-confiabilidade.md`
- Arquivos-chave (pista, não contrato): `src/components/campaign/speech/SpeechDetailPlayer.tsx`, `src/utilities/speech/speechVodResolver.ts`, `src/lib/speechShare.ts`, `tests/unit/speechDetailPlayer.unit.spec.tsx`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`
- `AGENTS.md` / `AGENTS-campaign.md` — vertical Comunicação, gate do acervo e crédito CC BY

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (nunca uma parede de signin); (2) appetite ~0,5–1 dia comporta a troca de superfície e a capa, sem schema; (3) persona/job/aceite em linguagem de produto; (4) direção no codebase é hipótese com precedentes nomeados; (5) zero decisão dura de engenharia.
