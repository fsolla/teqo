# Acervo: pré-visualizar no player o trecho selecionado

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1083
Priority: P2
Impeccable: B — encaixe no player do detalhe do acervo (controle de seleção)
Design UI: docs/plans/acervo-player-preview-do-trecho-ui-design.html
Appetite: ~1 dia eng; um outcome verificável — antes de cortar, a assessoria aperta play e vê exatamente o que entra no corte.
Responsável: —

## Intenção

A assessoria já marca [início, fim] no acervo (C166/C170), compartilha o link (C166) e corta o arquivo (C167). Mas entre marcar e cortar falta o gesto mais óbvio: **ver o trecho**. Hoje o play do player toca a fala inteira; para conferir se o intervalo escolhido começa e termina onde ela quer, ela precisa caçar os segundos no dedo. O pedido é direto: com um trecho selecionado, apertar play e ver só o intervalo — tocar de início e parar no fim — para decidir com os olhos antes de criar o corte. Não é editar nem pré-renderizar: é o mesmo player, com a janela selecionada.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (communicator, coordenação e candidatura) em `/campanha/comunicacao`, montando peça com prazo curto, na mesa ou no celular.
- **Job principal:** conferir no player que o trecho selecionado é exatamente o que entra no corte, antes de compartilhar ou cortar.
- **Fluxo desejado:** abre a fala → "Selecionar trecho" → ajusta [início, fim] (frases/alças) → aperta **"Pré-visualizar trecho"** → o player toca do início e para no fim → ajusta se algo entrou/saiu do ponto → segue para "Compartilhar" (C166) ou "Cortar vídeo" (C167) com confiança de que o intervalo é o certo.
- **Anti-goals de produto:** não é editor de vídeo (trim/export/render), não é segundo player, não promete controle que o embed do YouTube não dá; seleção/compartilhamento/corte intactos; sem `Consent`/collection/migration.

### Esboço de fluxo (B)

```text
[seleção ativa: início→fim] → "Pré-visualizar trecho" → player toca [início, fim] e para no fim
→ "certo, era isso" → [Compartilhar (C166) | Cortar vídeo (C167)]
→ "quase" → ajusta alças/frases → pré-visualiza de novo
[superfície sem controle do fim (YouTube)] → honesto: reposiciona no início; sem prometer parada automática
```

### Design UI (B)

- Design UI (gate): `docs/plans/acervo-player-preview-do-trecho-ui-design.html` — cenas: barra de seleção com o controle "Pré-visualizar trecho" (parado / tocando), estado chegou-ao-fim, aviso honesto no player do YouTube, fala sem superfície tocável, mobile (~390px) e desktop (~1280px).

## Objetivo e aceite

- Com trecho selecionado em superfície que o app controla (vídeo da Câmara), "Pré-visualizar trecho" toca somente [início, fim]: posiciona no início, reproduz e **para no fim**.
- Se a seleção mudar durante/após a pré-visualização, o player reflete o novo intervalo (não continua tocando o antigo); a pré-visualização nunca vaza para fora do trecho selecionado.
- No embed do YouTube, a postura é honesta: o app não promete parada automática no fim; a pré-visualização reposiciona no início do trecho (ou a UI oferece o vídeo da Câmara quando houver trecho gerado), com aviso claro e sem inventar controle que o embed não dá.
- Seleção/compartilhamento/corte intactos; clique na transcrição continua posicionando fora do modo de seleção e estendendo o trecho dentro dele (C166).
- **Guardrails:** gate do acervo (communicator/coordinator/candidate; advisor/leader negados fail-closed); crédito "Fonte: Câmara dos Deputados · CC BY 4.0"; `excerptTMs`/seleção exata verbatim; sem segundo player; sem render/export; sem `Consent`/collection/migration; URLs públicas intocadas.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é o player e o controle de seleção; tocar/parar é feedback de ação, não dado do acervo.
- **Decisões desbloqueadas:** a assessoria decide ajustar (ou não) o intervalo **antes** de criar o corte; a coordenação herda cortes já conferidos (menos retrabalho na biblioteca do C168).
- **Forma:** _adiada ao plano de implementação_ — restrição: sem KPI/telemetria de pré-visualização nesta fatia.

## Dados da decisão (literais)

- Controle (pt-BR), na barra/bloco de seleção: rótulo **"Pré-visualizar trecho"** (ícone play); enquanto toca, vira **"Parar pré-visualização"**.
- Comportamento no vídeo da Câmara: `currentTime = início` → play → ao alcançar `fim`, pausa e deixa o fim visível (play pronto).
- Aviso honesto do YouTube (pt-BR): **"No YouTube, a pré-visualização começa no início do trecho — parar no fim exige o vídeo da Câmara."** Quando a fala tem trecho gerado, oferecer o caminho da Câmara (reuso do C171) em vez de só avisar.
- Sem superfície tocável (sem VOD e sem offset do YouTube): a pré-visualização não é oferecida; a seleção permanece para compartilhar/cortar.
- Não alterar rótulos/limites vigentes da seleção: mínimo 5 s, sem teto (até o fim da fala), fileira de ações atual.
- Sem novas chaves de `Consent`, collections ou migrations; nada persistido no servidor.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/speech/SpeechDetailPlayer.tsx` (dono do playback: `videoRef`, `seekTo`, estados de seleção) e o bloco de seleção em `src/components/campaign/speech/SpeechExcerptControls.tsx`.
- **Precedente a olhar:** C166/C170 (`SpeechExcerptControls` só traduz ponteiro/tecla em geometria pura — não é lugar de lógica de player), C171 (troca de superfície e saídas do YouTube), seek já existente (`seekTo`) e o `onTimeUpdate` do `<video>`.
- **Risco de acoplamento:** C162/C166/C167/C170/C171 andam no mesmo arquivo — encaixe cirúrgico, sem reescrever quadrantes; C172 está na fila do mesmo `SpeechDetailPlayer.tsx` (serializar). Pins prováveis: `tests/unit/speechDetailPlayer.unit.spec.tsx`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`.

## Dependências

- **Serializa com C172** — mesmo arquivo `SpeechDetailPlayer.tsx`; encaixar depois (ou antes, combinado) para não misturar diffs.
- Suave: C169 (resolver do corte) — só afeta o caminho "pré-visualizar pelo vídeo da Câmara" ser mais confiável; sem bloqueio.
- Entregues (satisfeitas): C162 (player), C166 (seleção/share), C167 (corte), C170 (sem teto), C171 (superfícies/saídas).

## Fora de escopo

- Editor de vídeo, timeline com zoom, precisão de frame, trim/export/render; preview renderizado do arquivo final.
- Loop contínuo do trecho, controle de velocidade, waveform, atalhos de teclado de scrub, "pular para o fim".
- Segundo player/segunda superfície de vídeo; baixar o trecho só para pré-visualizar.
- Alterar mínimo/máximo, ímã de frase, compartilhamento (C166), corte/publicação (C167/C168) e a biblioteca.
- `Consent`/collection/migration novas; ampliar papéis com acesso ao acervo; telemetria.

## Rabbit holes de produto

- **"Já que tem preview, faz loop e A/B do trecho."** Se alguém "só completar": loop, marcadores, comparação lado a lado. **Corte neste item:** um play que toca [início,fim] uma vez.
- **"Faz o preview ser um render do corte final."** Se alguém "só completar": fila, ffmpeg, storage, segundo artefato. **Corte neste item:** toca o próprio vídeo no navegador; nada é gerado.
- **"Usa a IFrame API do YouTube pra controlar o fim."** Se alguém "só completar": `enablejsapi`, postMessage, polling, estados condicionais. **Corte neste item:** no YouTube vale a postura honesta; o controle pleno fica no vídeo da Câmara.
- **"Aproveita e redesenha a barra de seleção."** Se alguém "só completar": re-layout, novos tokens, mexer no ímã. **Corte neste item:** encaixe cirúrgico do controle; seleção intocada.

## Questões em aberto (produto)

- **Como a pré-visualização se comporta no YouTube?** **Opções:** A) reposiciona no início e deixa parar manualmente, com aviso honesto | B) esconde o controle no YouTube e oferece "Assistir na Câmara" quando houver trecho | C) tenta o parâmetro `end` do embed e cai para A se não segurar. **Recomendação:** A como base, com o caminho da Câmara (C171) oferecido quando existir — nunca prometer parada que o embed não garante. _(assumido — validar com produto)_
- **Onde mora o controle?** **Opções:** A) no bloco de seleção, junto do intervalo | B) na fileira de ações do player. **Recomendação:** A — o controle pertence ao intervalo e some quando não há seleção; manter a lógica de playback no `SpeechDetailPlayer`, não na geometria pura. _(assumido)_
- **No fim do trecho, parar ou voltar ao início?** **Opções:** A) pausa no fim e mantém o play pronto | B) pausa e rebobina para o início da seleção. **Recomendação:** A — deixa o fim visível para conferência; rebobinar é gesto de replay, não pedido. _(assumido)_
- **Pré-visualizar exige o trecho já resolvido no vídeo da Câmara?** **Opções:** A) se o VOD ainda não foi resolvido, o play resolve e toca em seguida | B) pede "Assistir o trecho" primeiro. **Recomendação:** A — o gesto é único ("veja o trecho") e o resolver já é idempotente/verificado (C162/C171). _(assumido)_

## Referências

- GitHub Issue: #1083
- Design UI (gate): `docs/plans/acervo-player-preview-do-trecho-ui-design.html` (+ assets em `docs/plans/acervo-player-preview-do-trecho-ui-design-assets/` se houver)
- Planos irmãos: [`c166-compartilhar-trecho-link.md`](c166-compartilhar-trecho-link.md), [`c167-cortar-trecho-publicar.md`](c167-cortar-trecho-publicar.md), [`c170-corte-sem-limite.md`](c170-corte-sem-limite.md), [`c171-player-youtube-sem-signin.md`](c171-player-youtube-sem-signin.md)
- Arquivos-chave (pista, não contrato): `src/components/campaign/speech/SpeechDetailPlayer.tsx`, `src/components/campaign/speech/SpeechExcerptControls.tsx`, `src/lib/speechExcerptSelection.ts`, `src/components/campaign/speech/SpeechExcerptShare.tsx`, `src/components/campaign/speech/SpeechCutDialog.tsx`
- Testes a olhar: `tests/unit/speechDetailPlayer.unit.spec.tsx`, `tests/unit/speechExcerptSelection.unit.spec.ts`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`
- `AGENTS.md` — vertical Comunicação, gate do acervo e crédito CC BY.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (play toca [início,fim] e para no fim) sem superfície nova; (2) appetite de ~1 dia comporta o controle + a postura honesta do YouTube; (3) persona, job e aceite em linguagem de produto, com a copy literal separada; (4) direção no codebase é hipótese; (5) zero decisão dura de engenharia.
