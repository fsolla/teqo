# C222 — Central de Conteúdos — apagar uma peça

Status: rascunho
Atualizado em: 2026-09-24
Issue: #1330
Priority: P2
Impeccable: B — encaixe na Central de Conteúdos (lista + detalhe): ação de apagar com confirmação
Design UI: docs/plans/central-conteudos-apagar-peca-ui-design.html
Appetite: ~1 dia eng; um outcome verificável
Responsável: —

## Intenção

A Central de Conteúdos (C211) resolveu o garimpo: a assessoria envia, cataloga e publica as peças de campanha em `/campanha/comunicacao/conteudos`. Mas deixou um beco declarado — não existe nenhuma superfície de apagar; o `delete` ficou restrito ao admin do Payload como anti-goal aceito ("campanha nunca perde um arquivo por acidente"). Consequência: uma peça errada, duplicada ou que ninguém vai usar fica na Central e na pública para sempre; só um admin do Payload consegue removê-la, e a assessoria, que é quem sabe que a peça não presta, não tem como limpar a própria mesa.

O pedido humano reabre esse anti-goal de propósito — exatamente como o C183 (#1105, `docs/plans/biblioteca-cortes-apagar-e-falhas.md`) reabriu o "deletar corte não existe na UI" dos cortes do acervo. O pedido é direto: poder apagar uma peça de conteúdo, com confirmação explícita.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) e coordenação/candidatura, em `/campanha/comunicacao/conteudos`, na mesa ou no celular, sob prazo — quem não é da vertical (`advisor`, `leader`) segue negado.
- **Job principal:** "tirar da Central uma peça que não serve mais — errada, duplicada ou vencida — sem depender do admin do Payload".
- **Fluxo desejado:** abre a Central → vê a peça que não serve na lista (ou no detalhe) → "Apagar" → a confirmação avisa o efeito (se publicada, o link público morre para quem já recebeu) → confirma → a peça some da lista interna, some da Central pública e o arquivo privado sai junto.
- **Anti-goals de produto:** não virar lixeira/desfazer (soft delete) nem restauração; sem lote; sem editor de peça; sem métricas/telemetria de exclusão; sem dashboard nova; não mexer no kill switch de publicação (despublicar continua o gesto reversível e existente).
- **Reabertura de anti-goal (produto):** o C211 (`docs/plans/central-conteudos-ingestao.md`) declarou "sem delete na Central; só admin do Payload" como guardrail aceito. O pedido humano reabre de propósito. Ao apagar, respeitar o contrato público: uma peça publicada tem link `/conteudos/<slug>` já distribuível, então apagar é ação explícita e avisada — nunca em silêncio.

### Esboço de fluxo (B)

```text
[Central de Conteúdos: lista] → peça que não serve (na lista ou no detalhe)
→ [Apagar] → confirmação: "Apagar esta peça?" (avisa o link público se publicada)
→ confirma → some da lista interna, some da Central pública, arquivo privado sai junto
[outcome: Central limpa, sem peça fantasma e sem arquivo órfão]
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-apagar-peca-ui-design.html` — encaixe na lista (ação por linha, junto de Abrir/Reprocessar) e no detalhe; a distribuição exata das cenas é do design.

## Objetivo e aceite

- A Central (lista e detalhe) permite apagar uma peça, com confirmação explícita; após apagar, a peça some da Central e não aparece na pública.
- Apagar peça publicada avisa, no diálogo, que o link `/conteudos/<slug>` deixa de funcionar para quem já recebeu; despublicar continua a alternativa reversível (não é pré-requisito).
- "Apagar" existe em qualquer estado — inclusive `processando` (saída de quem quer cancelar um processamento travado) e `falhou`. _(assumido — validar no gate)_
- O arquivo privado da peça sai junto (mídia exclusiva da peça, sem resíduo no storage); os contadores de circulação morrem com a peça — não há dashboard a limpar. _(assumido — validar no gate)_
- **Quem pode apagar:** a mesma audiência da vertical que hoje cria/edita/publica (`communicator`, `coordinator`, `candidate`) + admin do Payload; `advisor`/`leader` negados (fail-closed).
- Apagar é definitivo (hard delete, sem lixeira/desfazer) e por peça, sem lote na v1.

## Dados (intenção)

- **Vou apresentar dados?** Não — é uma decisão de estado do item (apagar), não um painel.
- **Decisões desbloqueadas:** a assessoria decide o que sai da Central; nenhuma leitura agregada nova.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: sem contador de exclusão, sem auditoria exposta, sem telemetria de "peças apagadas".

## Dados da decisão (literais)

- **Ação:** `Apagar` (na lista e no detalhe).
- **Diálogo:** título `Apagar esta peça?` · botões `Cancelar` / `Apagar`.
- **Corpo (peça publicada):** `O link público /conteudos/<slug> deixa de funcionar para quem já recebeu. Esta ação não pode ser desfeita.`
- **Corpo (rascunho/em processamento/falhou):** `Esta ação não pode ser desfeita.`
- **Estados:** processamento `processando` | `pronto` | `falhou`; publicação `rascunho` | `publicado` — apagar disponível em todos.
- **Rotas internas:** `/campanha/comunicacao/conteudos` (lista) e `/campanha/comunicacao/conteudos/[id]` (detalhe).
- **Contrato público:** peça publicada aparece em `/conteudos/<slug>` (S27) e serve a mídia em `/conteudos/<slug>/midia`; apagar quebra esses links para quem já recebeu — daí o aviso.
- **Acesso:** `communicator`, `coordinator`, `candidate` apagam; `advisor` e `leader` negados (fail-closed); admin do Payload mantém o delete.

## Direção no codebase (hipótese)

- **Áreas prováveis:** lista `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/page.tsx` (`src/components/campaign/content/ContentPieceTable.tsx`, `ContentPieceCardList.tsx`) e detalhe `.../conteudos/[id]/page.tsx`; access em `src/collections/ContentPiece.ts` (o `delete` a reabrir) e predicados em `src/utilities/access/contentPieces.ts`; leitura pública em `src/utilities/content/contentPieceReads.ts`; mídia privada `src/collections/ContentMedia.ts`.
- **Precedente a olhar:** C183 — `src/components/campaign/speech/SpeechCutDeleteDialog.tsx` (AlertDialog, aviso do link público, botão destructive) e `docs/plans/biblioteca-cortes-apagar-e-falhas.md`; cascata de mídia própria em `src/collections/Speech.ts` (`deleteSpeechAssets`).
- **Risco de acoplamento:** a lista pública é cacheada (tag `contentPieces`) e hoje só o `afterChange` a busta — apagar precisa refletir na pública sem peça fantasma; o job de processamento tolera a row sumida (cancelar em `processando` não pode derrubar o worker); eventos de circulação (`ContentEvent`, C213) referenciam a peça por `subjectId` texto, sem FK — órfãos inertes, não limpar.

## Dependências

- Nenhuma — o C211 está entregue; o S27 é o contrato público a respeitar.

## Fora de escopo

- Lote (apagar várias peças), lixeira/desfazer e restauração (soft delete).
- Limpar eventos órfãos de circulação (C213) — são inertes e não aparecem em lugar nenhum após a peça sumir.
- Métricas/telemetria de exclusão e dashboard nova.
- Apagar mídia compartilhada de outra peça (não existe) e qualquer mudança na página pública além de a peça sumir.
- Mexer no kill switch de publicação: despublicar continua o gesto reversível; editor de peça fica de fora.

## Rabbit holes de produto

- **"Já que apaga, deixa uma lixeira pra desfazer."** Se alguém "só completar": soft delete, retenção e restauração. **Corte neste item:** apagar é definitivo, com confirmação; sem lixeira.
- **"Já que apaga, apaga em lote."** Se alguém "só completar": seleção múltipla, confirmação em massa, progresso. **Corte neste item:** uma peça por vez (v1); lote é item próprio se o uso pedir.
- **"Já que apaga, limpa os eventos órfãos."** Se alguém "só completar": varredura/reconciliação de `ContentEvent`. **Corte neste item:** eventos órfãos são inertes; sem faxina de analytics.

## Questões em aberto (produto)

- **Apagar em qualquer estado ou bloquear `processando`?** **Opções:** A) qualquer estado, inclusive `processando` (cancelar job travado) | B) só depois de `pronto`/`falhou`. **Recomendação:** A — quem quer cancelar um processamento travado precisa da saída; o job tolera a row sumida. _(assumido — validar no gate)_
- **Ação na lista ou só no detalhe?** **Opções:** A) só no detalhe | B) na lista (junto de Abrir/Reprocessar) e no detalhe. **Recomendação:** B — a limpeza acontece na lista e a confirmação evita o clique errado. _(assumido — validar no gate)_
- **Arquivo privado sai junto ou fica órfão adiado?** **Opções:** A) sai junto com a peça | B) fica órfão, como no C183. **Recomendação:** A — aqui a mídia é exclusiva da peça (o público serve o mesmo objeto), então resíduo não faz sentido; o "como" fica para o plano de implementação. _(assumido — validar no gate)_
- **Publicada, apagar é definitivo ou redireciona para "Despublicar"?** **Opções:** A) apaga de vez com aviso | B) só despublica. **Recomendação:** A — despublicar é reversível e já existe; quem quer apagar quer remover de vez. _(assumido — validar no gate)_

## Referências

- GitHub Issue: #1330
- Design UI (gate): `docs/plans/central-conteudos-apagar-peca-ui-design.html`
- Precedente: `docs/plans/biblioteca-cortes-apagar-e-falhas.md` (C183, #1105) · `src/components/campaign/speech/SpeechCutDeleteDialog.tsx`
- Planos irmãos: `docs/plans/central-conteudos-ingestao.md` (C211, anti-goal reaberto) · `docs/plans/central-conteudos-publica.md` (S27, contrato do link) · `docs/plans/central-conteudos-analytics.md` (C213, eventos)
- Arquivos-pista: `src/collections/ContentPiece.ts` · `src/collections/ContentMedia.ts` · `src/utilities/access/contentPieces.ts` · `src/utilities/content/contentPieceReads.ts` · `src/components/campaign/content/ContentPieceTable.tsx` · `src/components/campaign/content/ContentPieceCardList.tsx` · `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/page.tsx` e `[id]/page.tsx`
- Testes a tocar: `tests/int/contentPiece.int.spec.ts` · `tests/e2e/campaignSpeechAcervo.e2e.spec.ts` (seção C211) · `tests/unit/speechCutDeleteDialog.unit.spec.tsx` (molde do diálogo)
- `AGENTS.md` — vertical Comunicação, fail-closed, mídia privada/S3

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (apagar uma peça e ela sumir da Central e da pública, sem resíduo de arquivo); (2) appetite ~1 dia declarado e o escopo cabe (encaixe na lista/detalhe, sem lote/lixeira/telemetria); (3) persona, job e aceite em linguagem de usuário, com a reabertura do anti-goal e o contrato do link público explícitos; (4) direção no codebase é hipótese com precedente nomeado, sem contrato; (5) zero decisão dura de engenharia (formato da ação, cascata de mídia e bust de cache ficam para o plano de implementação — aqui só se declara quem pode apagar e o efeito de produto).
