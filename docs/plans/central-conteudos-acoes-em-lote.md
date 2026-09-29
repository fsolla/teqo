# C236 — Central de Conteúdos — publicar, despublicar e apagar em lote

Status: rascunho
Atualizado em: 2026-09-29
Issue: #1388
Priority: P2
Impeccable: B — encaixe na lista existente da Central de Conteúdos (`/campanha/comunicacao/conteudos`): seleção múltipla + barra de ações
Design UI: docs/plans/central-conteudos-acoes-em-lote-ui-design.html
Appetite: ~1–1,5 dia eng; um outcome verificável — o mesmo veredito editorial aplicado a várias peças num gesto
Responsável: —

## Intenção

A Central de Conteúdos resolveu o garimpo: a peça entra, é catalogada e publicada/despublicada por um gesto — mas o kill switch mora só na ficha, e apagar é uma confirmação por linha. O uso real chega em blocos: um evento despeja dezenas de peças, uma importação traz uma leva de posts, e a assessoria precisa dar o **mesmo veredito** a várias delas ("essas cinco vão para a pública", "essas três não servem"). Hoje são N decisões iguais custando N navegações.

O pedido humano é direto: "selecionar vários para publicar/despublicar/apagar". O C222 (`docs/plans/central-conteudos-apagar-peca.md`) declarou "sem lote" como anti-goal — mas o próprio Fora de escopo dizia "lote é item próprio se o uso pedir". **Este item é esse item próprio: a reabertura do anti-goal é de propósito**, do mesmo modo que o C222 reabriu o "sem delete" do C211. O lote não é semântica nova: é o gesto unitário existente repetido sobre a seleção, com recibo honesto.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`; `coordinator`/`candidate` também), na mesa ou no celular, logo depois de uma leva de peças entrar — quando decidir caso a caso atrapalha a triagem.
- **Job principal:** aplicar o mesmo veredito — publicar, despublicar ou apagar — a várias peças da tela num gesto, sem abrir ficha por ficha.
- **Fluxo desejado:** abre a lista → marca as peças da página (checkbox na tabela, card no celular) → a barra aparece com `N selecionadas` → `Publicar`/`Despublicar` agem na hora com recibo; `Apagar` pede confirmação (avisando os links públicos quando houver publicadas na seleção) → a lista atualiza e diz o que aconteceu.
- **Anti-goals de produto:** não vira planilha (sem edição de campos em lote); não é lote global (cross-page/"todos os filtrados"); não é pipeline (sem job assíncrono/progresso); não mexe na semântica do gesto unitário; não cria rota pública nenhuma.

### Esboço de fluxo (B)

```text
[/campanha/comunicacao/conteudos] → marcar peças da página (checkbox na tabela, card no celular)
→ barra "N selecionadas" · Publicar | Despublicar | Apagar
→ Publicar/Despublicar: age na hora, lista atualiza, recibo "N peças publicadas/despublicadas"
→ Apagar: confirmação (avisa links públicos das publicadas) → recibo "N peças apagadas"
[outcome: o mesmo veredito em várias peças num gesto, com recibo honesto e sem ficha por ficha]
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-acoes-em-lote-ui-design.html` — cenas na tabela (~1280) e no card list (~390), barra de seleção, confirmação em massa e recibos; a forma do affordance é do design.
- Design tier: DEGRADED (opencode-go/deepseek-v4.1-flash; frontier `openai/gpt-5.6-sol` sem quota) — sign-off humano obrigatório no PR.

## Objetivo e aceite

- Selecionar várias peças **da página visível** (as 25 do filtro/página atual), com a seleção visível e contada na barra; "selecionar todas" = todas as da página; a seleção morre ao trocar de página ou filtro.
- A barra de ações só existe com seleção ativa e oferece `Publicar`, `Despublicar` e `Apagar`; as ações por linha/ficha continuam exatamente como estão (o lote não cria publicar/despublicar por linha).
- `Publicar` e `Despublicar` em lote agem sem confirmação (são reversíveis) e dão recibo; `Apagar` em lote sempre confirma — o diálogo avisa que, havendo publicadas, seus links públicos deixam de funcionar, e sempre que a ação não pode ser desfeita.
- Nunca sucesso silencioso parcial: o recibo diz quantas peças foram afetadas e quantas falharam; a falha de uma peça não reverte as demais (é o mesmo gesto unitário, repetido) e a lista reflete o desfecho.
- O lote respeita a elegibilidade do gesto unitário, sem regra nova: peça `processando` ou `falhou` publica/despublica/apaga como no unitário (apagar `processando` continua sendo a saída para job travado).
- Existe no celular (card list) e no desktop (tabela) — a assessoria usa os dois.
- **Quem pode:** a mesma audiência da vertical (`communicator`, `coordinator`, `candidate`); `advisor`/`leader` negados (fail-closed). Nada de papel novo.

## Dados (intenção)

- **Vou apresentar dados?** Não — é o mesmo gesto de estado do item, repetido; nenhum painel, contador de vaidade ou telemetria.
- **Decisões desbloqueadas:** a assessoria decide o destino editorial de várias peças de uma vez (o que vai à pública, o que sai, o que morre); nenhuma leitura agregada nova.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: sem métrica de exclusão/ação em lote, sem dashboard, sem auditoria exposta.

## Dados da decisão (literais)

- **Barra de seleção:** contador `N selecionadas`; ações `Publicar` · `Despublicar` · `Apagar`.
- **Confirmação de apagar em massa:** título `Apagar N peças selecionadas?` (singular reusa o C222: `Apagar esta peça?`); botões `Cancelar` / `Apagar`.
- **Corpo (há publicadas na seleção):** `Os links públicos das peças publicadas da seleção deixam de funcionar para quem já recebeu. Esta ação não pode ser desfeita.`
- **Corpo (nenhuma publicada):** `Esta ação não pode ser desfeita.`
- **Recibos:** `3 peças publicadas` · `3 peças despublicadas` · `3 peças apagadas`; falha parcial: `2 de 3 peças apagadas. 1 falhou.`
- **Estados:** processamento `processando` | `pronto` | `falhou`; publicação `rascunho` | `publicado` — o lote vale em todos, como no unitário.
- **Rota interna:** `/campanha/comunicacao/conteudos` (lista). Nenhuma rota pública nova.
- **Nota de comportamento (herdada do unitário):** publicar peça sem arquivo nem link a deixa `publicado` mas fora da Central pública (é o `contentPieceIsPublic` de sempre); apagar publicada quebra o link `/conteudos/<slug>` já distribuído — daí o aviso.
- **Acesso:** `communicator`, `coordinator`, `candidate`; `advisor`/`leader` negados (fail-closed).

## Direção no codebase (hipótese)

- **Áreas prováveis:** página `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/page.tsx`; `src/components/campaign/content/ContentPieceTable.tsx` e `ContentPieceCardList.tsx` (a lista é renderizada 2×: card no mobile, tabela no desktop); actions `src/app/(campaign)/campanha/actions/contentPieces.ts` (`setContentPiecePublishedForActor`, `deleteContentPieceForActor`, hoje uma peça cada) e as rotas `.../conteudos/[id]/publicacao/route.ts` / `.../[id]/apagar/route.ts`; `src/components/campaign/shared/CampaignDeleteDialog.tsx`.
- **Precedente a olhar:** `src/components/campaign/tour/TourComposerForm.tsx` (checkbox + contador `N selecionadas`, único precedente real de seleção no `/campanha`); FD2 (`docs/plans/field-desk-ux-pos-critique.md` §Fase 1) desenhou checkbox por linha + barra com contador para a fila de prioridade e nunca implementou — referência de desenho, não de código; `CampaignTable` **não tem API de seleção** — o "como" fica para o plano de implementação.
- **Risco de acoplamento:** a lista tem dois corpos (card/tabela) exibidos por breakpoint — a seleção precisa existir nos dois; toda escrita via Local API já busta a tag `contentPieces` por hook (`afterChange`/`afterDelete`) e o lote herda se escrever pelo Local API; o job de processamento tolera a row sumida; `ContentEvent` de circulação nunca é limpo; não tocar nas rotas públicas (S27).

## Dependências

- Nenhuma dura — C211 (Central interna) e C222 (apagar uma peça) entregues; S27 é o contrato público a respeitar.
- Suave: C213 (contadores de circulação) segue intocado — o lote não limpa nem recalcula eventos.

## Fora de escopo

- Cross-page / "todos os resultados do filtro" — a seleção não sobrevive à navegação de página/filtro.
- Publicar/despublicar por linha na lista (o lote não muda a ação rotineira por linha).
- Lixeira/desfazer/restauração; agendamento; edição de campos em lote; seleção em outras listas (a fila FD2 segue item próprio).
- Progresso/job assíncrono, fila/retomada/cancelamento — o lote é uma ação curta de mesa.
- Mudar a semântica do gesto unitário: publicação (slug canônico, `publishedAt` e arquivo preservados) e exclusão (mídia privada exclusiva sai best-effort; `ContentEvent` nunca é limpo).
- Central pública (S27): nada muda além do efeito que publicar/despublicar/apagar já têm.

## Rabbit holes de produto

- **"Já que seleciona, seleciona todos os filtrados / entre páginas."** Se alguém "só completar": seleção persistente, dedupe, contagem global, confirmação sobre um conjunto que ninguém vê. **Corte neste item:** só a página visível; a seleção morre ao navegar.
- **"Já que apaga muito, faz um job com progresso."** Se alguém "só completar": fila, retomada, cancelamento, tela de acompanhamento. **Corte neste item:** ação curta com recibo honesto; falha parcial nomeada.
- **"Já que publica em lote, agenda por data."** Se alguém "só completar": agendamento e calendário editorial. **Corte neste item:** publicar é agora.
- **"Já que tem barra, edita campos em lote."** Vira spreadsheet mode. **Corte neste item:** só os três verbos.
- **"Já que publicar não confirma, apagar também não."** **Corte neste item:** o reversível age; o irreversível confirma.

## Questões em aberto (produto)

- **Escopo da seleção?** **Opções:** A) peças da página visível (as 25 do filtro atual); "selecionar todas" = a página | B) cross-page/"todos os resultados do filtro". **Recomendação:** A — B é rabbit hole (seleção invisível, dedupe, confirmação sobre conjunto que ninguém vê). _(assumido — validar no gate)_
- **Confirmação vale para qual ação?** **Opções:** A) só `Apagar` confirma (com aviso de links públicos), `Publicar`/`Despublicar` agem direto com recibo | B) todas confirmam | C) nenhuma confirma. **Recomendação:** A — publicar/despublicar são o kill switch reversível; apagar é a família irreversível do C222. _(assumido — validar no gate)_
- **Falha parcial: tudo-ou-nada ou honesta?** **Opções:** A) cada peça é o mesmo gesto unitário — falha de uma não reverte as outras, e o recibo nomeia (`2 de 3 peças apagadas. 1 falhou.`) | B) lote transacional (uma falha cancela tudo). **Recomendação:** A — espelha o "falha de um não derruba os outros" do C211 e evita esconder o que já aconteceu. _(assumido — validar no gate)_
- **Elegibilidade no lote?** **Opções:** A) a mesma do unitário, sem filtro novo (inclusive `processando`/`falhou`) | B) bloquear estados no lote. **Recomendação:** A — o lote é o gesto unitário repetido; regra nova criaria duas verdades. _(assumido — validar no gate)_
- **Onde mora o affordance da barra?** **Opções:** A) barra só quando há seleção, sem poluir a varredura rotineira | B) checkbox sempre visível com barra fixa. **Recomendação:** A — o "como" (posição, fixa vs. inline) é do design; o produto fixa só que a rotina não ganha ruído. _(assumido — validar no gate)_

## Referências

- GitHub Issue: #1388
- Design UI (gate): `docs/plans/central-conteudos-acoes-em-lote-ui-design.html`
- Anti-goal reaberto: `docs/plans/central-conteudos-apagar-peca.md` (C222, "sem lote"; Fora de escopo: "lote é item próprio se o uso pedir") · `docs/plans/central-conteudos-ingestao.md` (C211)
- Precedentes: `docs/plans/field-desk-ux-pos-critique.md` (FD2 §Fase 1) · `src/components/campaign/tour/TourComposerForm.tsx`
- Arquivos-pista: `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/page.tsx` · `src/components/campaign/content/ContentPieceTable.tsx` · `ContentPieceCardList.tsx` · `src/app/(campaign)/campanha/actions/contentPieces.ts` · `.../conteudos/[id]/publicacao/route.ts` e `.../[id]/apagar/route.ts` · `src/components/campaign/shared/CampaignDeleteDialog.tsx` · `CampaignTable.tsx` · `src/lib/campaignRoles.ts`
- Testes a tocar: `tests/int/contentPiece.int.spec.ts` · `tests/unit/contentPieceDeleteDialog.unit.spec.tsx` · `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`
- `AGENTS.md` — vertical Comunicação, fail-closed, mídia privada/S3, contrato de cache

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (o mesmo veredito em várias peças num gesto, com a lista e a pública refletindo); (2) appetite ~1–1,5 dia declarado e o escopo cabe (seleção da página visível; cross-page, job e agendamento cortados); (3) persona, job e aceite em linguagem de usuário, com reabertura do anti-goal e literais fixados, sem jargão de stack; (4) direção no codebase é hipótese com precedentes nomeados, sem contrato; (5) zero decisão dura de engenharia (forma da barra, mecanismo do lote e transporte ficam para o plano de implementação; aqui só se fixa produto).
