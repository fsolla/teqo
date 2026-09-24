# S33 — Card do time (você e estadual): ajuste da foto livre, sem limite

Status: rascunho
Atualizado em: 2026-09-24
Issue: #1297
Priority: P1
Impeccable: C — ajuste de comportamento num funil público existente (sem controle novo)
Design UI: docs/plans/cards-time-ajuste-sem-limite-ui-design.html
Appetite: ~0,5 dia eng; um comportamento verificável no funil de cards
Responsável: —

## Intenção

No teste do card com estadual, o humano reencontrou o mesmo atrito: «No teste da criação do card "time de você" com estadual, encontrei novamente a limitação no ajuste, não consigo ajustar corretamente porque tem limite da movimentação pros lados.» A S20 já tinha corrigido exatamente isso no "Time de você" (Issue #1216), mas a correção foi revertida por uma razão de engenharia que continua válida: o detector de rosto saiu e o enquadramento automático voltou ao S15 (commit 48e08bf7, 2026-09-20). O limite que sobrou não vem da pessoa — vem do espaço transparente que o recorte deixa em volta dela, e é o mesmo nos dois modelos do time.

Numa foto realista (1200×1600), um busto que preenche a moldura anda ~66px no total (±33); um busto menor, ~423px (±211); um busto fora do centro anda bem mais para um lado (+1036) que para o outro (−148). Quem trava é sempre a borda do arquivo da foto, nunca a borda visível da pessoa — que costuma estar bem dentro da janela quando o gesto para.

A decisão do humano no gate (2026-09-24) é **liberar totalmente, sem limite**: o ajuste não é mais restringido em nenhum eixo — o que resolve o atrito pela raiz e dispensa âncora de silhueta, caixa medida ou união de alcances. O enquadramento automático S15 continua sendo só o ponto de partida.

## Persona e fluxo

- **Persona / contexto:** visitante no celular, no funil público dos cards de time (você e estadual), logo depois do recorte da foto; quer se encaixar na composição antes de baixar.
- **Job principal:** posicionar a própria foto — principalmente para os lados — onde ela fica boa no card.
- **Fluxo desejado:** escolhe a foto → recorte → enquadramento automático S15 (inalterado) → arrasta ou usa setas/teclado → a foto vai a qualquer posição → baixa o PNG.
- **Anti-goals de produto:** não vira editor de imagem; não ganha controle nem texto novo; não libera os limites do zoom; não muda o enquadramento automático nem os outros modelos.

### Esboço de fluxo (C)

```text
[foto escolhida] → [recorte] → [enquadramento automático S15] → [prévia: arrastar/setas/teclado — posição livre] → [PNG]
```

### Design UI (C)

- Design UI (gate): `docs/plans/cards-time-ajuste-sem-limite-ui-design.html`

## Objetivo e aceite

- A foto pode ser movimentada livremente nos dois eixos: nenhum limite artificial — o arrasto, as setas e o teclado nunca são barrados pelo espaço transparente do recorte.
- A foto pode passar além da janela, sair do quadro e deixar a arte de trás aparecer — escolha do visitante; o retorno é arrastar de volta (a área de arrasto continua ativa).
- Arrastar, setas e teclado seguem iguais; os limites do zoom seguem iguais (a liberdade é da posição, não do zoom); o enquadramento automático S15 continua sendo o ponto de partida.
- Prévia e PNG baixado mostram a mesma posição — sem "voltar sozinho" ao soltar.
- Tudo no aparelho, sem telemetria de foto ou posição; os demais modelos (os 3 anteriores) ficam intocados.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhuma métrica de produto nesta tela.
- **Decisões desbloqueadas:** nenhuma — a posição é geometria efêmera no aparelho, não vira dado de campanha.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: nada de telemetria de foto/posição.

## Dados da decisão (literais)

- Modelos do time: `time-de-voce` e `time-do-estadual`.
- Decisão do humano no gate (2026-09-24): **liberar totalmente, sem limite** — o ajuste (arrasto, setas, teclado) não tem limite em nenhum eixo; sem âncora de silhueta e sem clamp do ajuste (o padding transparente do recorte deixa de importar).
- Enquadramento automático S15 `frameCardPhotoOnBbox` continua sendo o ponto de partida, aplicado uma vez ao carregar a foto.
- Zoom inalterado (faixa `[1,4]` de hoje): a liberação é da posição.
- Composer e renderizador: o ajuste do visitante não é re-limitado no desenho nem no PNG (sem snap-back); o limite de hoje deixa de valer para o ajuste.
- Sem controles, textos ou telemetria novos.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/cardPhotoTransform.ts` (o limite do ajuste/zoom), `src/components/cards/CardComposer.tsx` (os controles), `src/lib/cardRender.ts` (desenho do time — não re-limitar o ajuste do visitante), testes.
- **Precedente a olhar:** S20 — Issue #1216, commit e652f0ae e o revert 48e08bf7 (`docs/plans/cards-time-de-voce-ajuste-lateral.md` e `-impl.md`; `docs/changelog/2026-09-20-card-time-recorte-e-enquadramento.md`).
- **Risco de acoplamento:** o enquadramento inicial S15 e os 3 modelos anteriores (S13/S14) precisam ficar idênticos; `#1277` (S30-FOLLOWUP-DRY) mexe no mesmo arquivo — coordenar/rebase.

## Dependências

- Nenhuma dura. Suave: `#1277` (mesmo arquivo do composer).

## Fora de escopo

- Mudar os limites do zoom.
- Mudar o enquadramento automático (S15/S18 — decisão humana de 2026-09-20).
- Trazer o detector de rosto de volta, controles novos (slider lateral, "centralizar"/"re-enquadrar") e telemetria.
- Os 3 modelos anteriores.

## Rabbit holes de produto

- **"Proteger a composição com um limite novo".** Se alguém "só completar": reintroduz o atrito que o humano acabou de mandar remover. **Corte neste item:** sem limite, decisão do gate.
- **"Botão de voltar ao enquadramento".** Se alguém "só completar": novo controle e novo estado. **Corte neste item:** a área de arrasto continua ativa; voltar é arrastar.
- **"Re-detectar/rastrear a silhueta durante o arrasto".** Se alguém "só completar": custo por quadro e comportamento instável. **Corte neste item:** não há âncora.
- **"Reabrir o enquadramento".** Se alguém "só completar": rediscute a decisão humana de 2026-09-20. **Corte neste item:** S15 intocado.

## Questões em aberto (produto)

- **Até onde liberar o ajuste?** **Decidido no gate (2026-09-24): sem limite** — o ajuste é livre nos dois eixos.
- **Mudar o enquadramento inicial?** **Opções:** A) manter S15 (recomendado) | B) reabrir. **Recomendação:** A — decisão humana de 2026-09-20. _(assumido — validar com produto no gate)_
- **Mexer nos limites do zoom?** **Opções:** A) manter `[1,4]` (recomendado) | B) liberar também. **Recomendação:** A — o relato é de posição. _(assumido — validar com produto no gate)_

## Referências

- Issue #1216 (S20) + commit e652f0ae — mediu 248px de curso lateral total (≈±124); commit 48e08bf7 + `docs/changelog/2026-09-20-card-time-recorte-e-enquadramento.md` (o revert).
- `docs/plans/cards-time-de-voce-ajuste-lateral.md` e `-impl.md`; `docs/plans/cards-estadual-dobradinha.md`.
- Design UI (gate): `docs/plans/cards-time-ajuste-sem-limite-ui-design.html`; arquivos úteis: `src/lib/cardPhotoTransform.ts`, `src/components/cards/CardComposer.tsx`, `src/lib/cardRender.ts`, `tests/unit/cardPhotoTransform.unit.spec.ts`.

## Self-score (shaping)

**5/5.**

- Um outcome verificável — o ajuste da foto não tem limite — e nada além.
- Appetite declarado (~0,5 dia) e a intenção cabe: remover o limite do ajuste é menor do que a âncora que ele substitui.
- Persona, job e aceite em linguagem de produto, ancorados no relato humano no funil e na decisão do gate.
- Direção no codebase é hipótese, com precedente e risco de acoplamento nomeados; nenhuma decisão dura de engenharia (schema, migration, assinatura) no plano.
