# Biblioteca de cortes: apagar um corte e não acumular cortes falhados

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1105
Priority: P2
Impeccable: B — encaixe na biblioteca de cortes (lista + detalhe): ação de apagar e tratamento de corte falhado
Design UI: docs/plans/biblioteca-cortes-apagar-e-falhas-ui-design.html
Appetite: ~1 dia eng; um outcome verificável: a assessoria consegue apagar um corte que não serve, e a lista não acumula itens "Falhou" sem ação.
Responsável: —

## Intenção

A biblioteca de cortes (C168) resolveu o reencontro, mas deixou dois becos. Primeiro: um corte errado, duplicado ou que ninguém vai usar fica lá para sempre — só um admin do Payload consegue apagar. A assessoria, que é quem sabe que o item não presta, não tem como limpar a própria biblioteca. Segundo: um corte que falhou continua listado como um item "Falhou" morto, sem nenhuma ação; o único "Tentar novamente" que existe mora no diálogo da fala de origem, não onde a pessoa vê a falha. O pedido é direto: poder apagar um corte, e não acumular cortes falhados — ou eles somem sozinhos, ou aparecem com um "Tentar novamente" acionável.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) e coordenação/candidatura, em `/campanha/comunicacao/acervo/cortes`, na mesa ou no celular, sob prazo — quem não é da vertical (`advisor`, `leader`) segue negado.
- **Job principal:** "manter a biblioteca limpa e recuperar um corte que falhou sem ter de voltar à fala de origem".
- **Fluxo desejado:** abre a biblioteca → vê um corte que não serve (ou um "Falhou") → no item ou no detalhe decide apagar (com confirmação) ou tentar de novo → a lista reflete: o corte sumiu, ou o corte falhado voltou a processar.
- **Anti-goals de produto:** não virar lixeira/desfazer (soft delete), restauração de apagado, ações em lote, editor de vídeo, métricas ou segundo fluxo de corte.
- **Reabertura de anti-goal (produto):** o C168 (#1015, `docs/plans/c168-biblioteca-cortes.md`) declarou "deletar corte não existe na UI (admin pode)" como guardrail aceito. O pedido humano reabre esse anti-goal de propósito. Ao apagar, respeitar o contrato da página pública: um corte `published` tem link público `/corte/<id>`, então apagá-lo é ação explícita e avisada — nunca em silêncio.

### Esboço de fluxo (B)

```text
[biblioteca de cortes: lista] → abre item/corte
→ corte que não serve: [Apagar] → confirmação (avisa o link público se published) → some da lista
→ corte "Falhou": [Tentar novamente] (ou já não aparece como item morto)
→ [outcome: biblioteca limpa e corte falhado recuperável de onde se vê a falha]
```

### Design UI (B)

- Design UI (gate): `docs/plans/biblioteca-cortes-apagar-e-falhas-ui-design.html`

## Objetivo e aceite

- A biblioteca (lista e/ou detalhe) permite apagar um corte, com confirmação explícita do efeito no link público quando o corte está publicado.
- Corte falhado não fica como item morto: ou é descartado automaticamente, ou aparece com "Tentar novamente" acionável — nunca as duas coisas ausentes.
- Nenhuma leitura nova de métricas, comentários ou coleções.
- **Quem pode apagar:** a mesma audiência da vertical que hoje lê/edita o acervo (`communicator`, `coordinator`, `candidate`), alinhada ao kill-switch de publicar/despublicar; o admin do Payload segue podendo. `advisor` e `leader` negados (fail-closed).
- **Guardrail de produto preservado:** apagar um `failed` não quebra nada público (nunca houve página); apagar um `published` quebra o `/corte/<id>` já distribuído — por isso o aviso.

## Dados (intenção)

- **Vou apresentar dados?** Não — é uma decisão de estado do item (apagar/recuperar), não um painel.
- **Decisões desbloqueadas:** a assessoria decide o que sai da biblioteca e o que vale tentar de novo; nenhuma leitura agregada nova.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: sem contadores de biblioteca nem métricas de falha.

## Dados da decisão (literais)

- **Vocabulário de status:** `processing` | `published` | `unpublished` | `failed`; o rótulo visível de `failed` é "Falhou".
- **Contrato público:** `failed` **nunca** tem página pública (nada foi publicado); `published` tem link público `/corte/<id>` — apagar quebra esse link para quem já recebeu.
- **Rotas internas:** `/campanha/comunicacao/acervo/cortes` (lista) e `/campanha/comunicacao/acervo/cortes/[id]` (detalhe).
- **Retry existente:** é por request (`retryOf`) e só aceita `status === 'failed'` — reusa a row, não duplica.
- **Copy de confirmação (apagar publicado):** título "Apagar este corte?" · corpo "O link público /corte/<id> deixa de funcionar para quem já recebeu. Esta ação não pode ser desfeita." · botões "Cancelar" / "Apagar".
- **Copy de confirmação (apagar não publicado/falho):** mesma pergunta sem a linha do link público; botões "Cancelar" / "Apagar".
- Acesso: `communicator`, `coordinator`, `candidate` apagam e reprocessam; `advisor` e `leader` negados (fail-closed); admin mantém o delete do Payload.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/SpeechCut.ts` (access de delete hoje é só-admin), `src/utilities/speech/speechCutListUrl.ts` + `speechCutPageData.ts` (o `where` sem `q` volta `{}` e a lista inclui `failed`), `src/components/campaign/speech/SpeechCutLibraryCard.tsx` e o detalhe `.../cortes/[id]/page.tsx`, `SpeechCutDialog.tsx` + `actions/speech.ts` (retry reusável), e as rotas `cortes/[id]/...`.
- **Precedente a olhar:** o kill-switch de publicar/despublicar e a confirmação de "Despublicar este corte?" do C168; o retry por `retryOf` do C167.
- **Risco de acoplamento:** não criar fluxo paralelo ao retry do C167 (editar o dono); não misturar com o `where`/ordenação das falas; gate `speechCatalog` e leader lockdown intocados; `/corte/<id>` é do C167 (aqui só se decide o efeito de apagar).

## Dependências

- **C168** (#1015, entregue) — a biblioteca é a superfície; seu anti-goal de "não deletar pela UI" é reaberto aqui.
- **C169** (#1045, entregue) — falha honesta e retry por row; é o material do tratamento de corte falhado.
- Suave: **C167** (#1014) — o retry por request que se reusa.

## Fora de escopo

- Editor de vídeo (trocar início/fim, re-render) — destino: nenhum, não é pedido.
- Lixeira/desfazer e restauração de apagado (soft delete) — reversibilidade fica fora desta fatia.
- Ações em lote (apagar/tentar vários).
- Métricas, comentários, coleções/kits.
- Mudar a página pública além de a ação de apagar refletir nela.

## Rabbit holes de produto

- **"Já que apaga, deixa uma lixeira pra desfazer."** Se alguém "só completar": soft delete, retenção e restauração. **Corte neste item:** apagar é definitivo, com confirmação; sem lixeira.
- **"Corte falhado vira fila de reprocessamento automático."** Se alguém "só completar": worker/cron e retry em lote. **Corte neste item:** resolver no ponto da falha (diálogo de origem) com o retry que já existe; na biblioteca, no máximo um "Tentar novamente" manual.
- **"Aproveita e mostra estatística de falhas."** Se alguém "só completar": dashboard de vaidade. **Corte neste item:** sem métrica.

## Questões em aberto (produto)

- **Descartar corte falhado automaticamente ou manter com "Tentar novamente"?** **Opções:** A) a falha deixa de virar item de biblioteca e é resolvida onde nasceu (diálogo da fala, retry existente) | B) o falhado aparece na biblioteca com "Tentar novamente" acionável. **Recomendação: A, com B como piso** — falha não é acervo; se por algum motivo ela aparecer na biblioteca, aparece com retry, nunca como item morto. _(assumido — validar no gate)_
- **Apagar só o falhado/não publicado ou qualquer corte com aviso?** **Opções:** A) só falhado/não publicado | B) qualquer corte, com aviso explícito pelo link público. **Recomendação: B** — a assessoria precisa poder remover um corte errado/duplicado mesmo publicado; o aviso cobre o contrato do link. _(assumido)_
- **Onde fica a ação?** **Opções:** A) no detalhe | B) no item da lista e no detalhe. **Recomendação: B** — a lista é onde a limpeza acontece; a confirmação evita o clique errado. _(assumido)_
- **Publicado, apagar é definitivo ou só despublica?** **Opções:** A) apaga de vez com aviso | B) redireciona para "Despublicar". **Recomendação: A** — despublicar é reversível e já existe; quem quer apagar quer remover. _(assumido)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Design UI (gate): `docs/plans/biblioteca-cortes-apagar-e-falhas-ui-design.html`
- `docs/plans/c168-biblioteca-cortes.md` (anti-goal reaberto) · `docs/plans/c169-corte-vod-confiabilidade.md` · `docs/plans/c167-cortar-trecho-publicar.md`
- Arquivos-chave (pista, não contrato): `src/collections/SpeechCut.ts`, `src/lib/speechCut.ts`, `src/utilities/speech/speechCutListUrl.ts`, `src/utilities/speech/speechCutPageData.ts`, `src/components/campaign/speech/SpeechCutLibraryCard.tsx`, `src/components/campaign/speech/SpeechCutDialog.tsx`, `src/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/[id]/page.tsx`, `src/app/(campaign)/campanha/actions/speech.ts`
- Testes a tocar: `tests/unit/speechCutDialog.unit.spec.tsx`, `tests/unit/speechCutListUrl.unit.spec.ts`, `tests/int/speechCut.int.spec.ts`, `tests/e2e/campaignSpeechCut.e2e.spec.ts`
- `AGENTS.md` / `AGENTS-campaign.md` — vertical Comunicação, gate do acervo, naming/i18n

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (apagar um corte e não acumular falhados); (2) appetite ~1 dia declarado e o escopo cabe (encaixe na biblioteca, sem lixeira/fila/editor); (3) persona, job e aceite em linguagem de usuário, com a reabertura de anti-goal e o contrato do link público explicitados; (4) direção no codebase é hipótese com precedente nomeado, sem contrato; (5) zero decisão dura de engenharia (rota exata da ação e access ficam para o plano de implementação — aqui só se declara quem pode apagar, como decisão de produto).
