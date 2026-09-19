# Card "Time de você": ajuste lateral da foto sem limite artificial

Status: rascunho
Atualizado em: 2026-09-19
Issue: #1216
Priority: P2
Impeccable: C — ajuste de comportamento num funil público existente (sem controle novo)
Design UI: docs/plans/cards-time-de-voce-ajuste-lateral-ui-design.html
Appetite: ~0,5–1 dia eng — o visitante reposiciona a foto até onde a arte permite, sem limite fantasma
Responsável: —

## Intenção

O visitante escolheu a foto no card "Time de você", gostou do enquadramento automático e tentou empurrar o próprio rosto para a direita para se encaixar melhor entre os candidatos — e a foto parou no meio do caminho. Relato: "queria deixar minha foto mais para a direita e não conseguia; parece que tem um limite". Tem: existe um limite artificial, e ele é medido. Numa foto 3:4 típica o ajuste lateral anda 248px de card no total (≈±124px do centro) e trava; na foto de teste, +1818px de arrasto pararam exatamente no mesmo ponto — quem barra é o limite, não o gesto. Parte do curso ainda é consumida pelo espaço vazio que a remoção de fundo deixa em volta da pessoa.

O enquadramento automático da S18 está certo e fica: a proporção da cabeça não muda. O que falta é o ajuste fino alcançar a área que a arte já oferece — e é agora, depois de um teste humano no funil público, que esse atrito apareceu como reclamação concreta. Item sucessor da S18 (entregue, em produção); o plano antigo não é reaberto.

## Persona e fluxo

- **Persona / contexto:** visitante no celular, no funil público do card "Time de você", logo depois de escolher a foto; quer se ver "na turma" e sai frustrado se o rosto não encaixa onde ele quer.
- **Job principal:** reposicionar a própria foto — principalmente na horizontal — até ela ficar boa na composição do card.
- **Fluxo desejado:** escolhe a foto; vê o recorte; recebe o enquadramento automático proporcional; na prévia arrasta (ou usa setas/teclado) e a foto anda até onde a arte admite; aprova, baixa o PNG.
- **Anti-goals de produto:** não vira editor de imagem; não ganha controle novo; não cobre rostos dos candidatos; não muda o enquadramento automático nem os outros cards.

### Esboço de fluxo (C)

```text
[foto escolhida] → [recorte] → [enquadramento automático proporcional] → [prévia: arrastar/setas/teclado — novo alcance] → [card pronto] → [baixar PNG]
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-time-de-voce-ajuste-lateral-ui-design.html` (+ assets em `docs/plans/cards-time-de-voce-ajuste-lateral-ui-design-assets/`)

## Objetivo e aceite

- O rosto alcança qualquer ponto da área livre da arte (a janela da foto), sem depender do espaço vazio do recorte nem da largura do que está desenhado.
- Baseline medida a superar: hoje o curso lateral total é de 248px de card (≈±124px do centro) numa foto 3:4 típica; com a regra nova o centro do rosto alcança as bordas da janela — ±~244px do centro, por construção.
- Sem rosto medido (fallback de hoje), a âncora é a silhueta visível e o alcance **nunca é pior que o de hoje**, sem erro visível novo.
- Nenhum controle novo: arrastar, setas e teclado seguem iguais — muda só até onde vão.
- O resto do card fica intocado: enquadramento automático proporcional (S18), banners, harmonização, os 3 modelos anteriores e o download do PNG.
- Tudo no aparelho: a foto e a posição não saem do dispositivo.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhuma métrica de produto entra nesta tela.
- **Decisões desbloqueadas:** nenhuma — a medida de posição é geometria efêmera no aparelho, não vira dado de campanha.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: nada de telemetria de foto/posição; a privacidade do funil fica como está.

## Dados da decisão (literais)

- ID `S20`; slug `cards-time-de-voce-ajuste-lateral`; tipo `feature`; Priority `P2`; Impeccable `C`.
- Design UI (gate): `docs/plans/cards-time-de-voce-ajuste-lateral-ui-design.html`.
- Janela da foto na arte-mestre: `{x:286, y:439, w:592, h:577}`.
- Regra literal do ajuste: o rosto (caixa do detector) pode ser posicionado em qualquer ponto da área livre (a janela da foto); sem rosto medido → âncora pela silhueta visível; nunca pior que o limite atual.
- Baseline medida: curso lateral atual de 248px de card (≈±124px do centro) em foto 3:4 (1200×1600, zoom inicial 0,6); alvo por construção ≈±244px do centro.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/cardPhotoTransform.ts` (limite e ajuste fino), `src/components/cards/CardComposer.tsx` (estado pronto + controles), `src/lib/cardRender.ts` (re-limite na renderização do time).
- **Precedente a olhar:** `docs/plans/cards-time-de-voce-escala-cabeca-impl.md` (S18) e os testes que pinam o comportamento atual (`tests/unit/cardPhotoTransform.unit.spec.ts`).
- **Risco de acoplamento:** o comportamento dos 3 modelos anteriores (S13/S14) e o enquadramento automático S18 não podem mudar; o alcance novo vale só para o time, e sem rosto vale o de hoje.

## Dependências

- Nenhuma (S18 entregue — Issue #1197).

## Fora de escopo

- Mudar o enquadramento automático proporcional (S18) — a proporção fica como está.
- Redesenhar a arte ou a janela da foto.
- Controles novos (slider lateral, botão "centralizar").
- Destravar o zoom — o limite de zoom continua o de hoje.
- Mexer nos 3 modelos anteriores.

## Rabbit holes de produto

- **"Liberdade total até as bordas do card".** Se alguém "só completar": o visitante cobre rostos dos candidatos e a arte quebra. **Corte neste item:** o rosto anda na área livre; o corpo pode avançar para fora dela, sobre os ombros dos vizinhos de leve, como na arte de referência.
- **"Mover a janela na arte".** Se alguém "só completar": vira redesenho da arte e da geometria do card. **Corte neste item:** a geometria literal fica intocada.
- **"Re-detectar/rastrear o rosto durante o arrasto".** Se alguém "só completar": custo por quadro e comportamento instável. **Corte neste item:** a caixa do rosto é a do momento do recorte, como hoje.

## Questões em aberto (produto)

- **Até onde liberar o ajuste?** **Opções:** A) rosto dentro da área livre (recomendado) | B) só a silhueta dentro da janela (conservador) | C) até as bordas do card (cobre rostos dos candidatos). **Recomendação:** A — mantém a composição da arte e resolve o relato. _(assumido — validar com produto no gate)_
- **Manter o enquadramento inicial centrado na janela mesmo com o alcance maior?** **Opções:** sim | não. **Recomendação:** sim — não reabre a S18; o alcance maior é só do ajuste do visitante. _(assumido — validar com produto no gate)_

## Referências

- GitHub Issue #1197 (S18 — cabeça proporcional; item sucessor).
- `docs/plans/cards-time-de-voce-escala-cabeca-impl.md` — decisão da S18 e o risco "ajuste percebido como errado" já registrado.
- `src/lib/cardPhotoTransform.ts` (limite atual) e `src/components/cards/CardComposer.tsx` (arrasto/setas/teclado).
- `public/cards/team-card-example.jpg` — a cabeça da pessoa fica à direita do centro e os ombros já se sobrepõem de leve aos vizinhos.
- Design UI (gate): `docs/plans/cards-time-de-voce-ajuste-lateral-ui-design.html` (+ assets em `docs/plans/cards-time-de-voce-ajuste-lateral-ui-design-assets/`).
