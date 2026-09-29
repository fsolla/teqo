# C235 — Central de Conteúdos — importar qualquer janela de publicações do perfil

Status: rascunho
Atualizado em: 2026-09-29
Issue: #1386
Priority: P2
Impeccable: C — encaixe na tela/diálogo existente
Design UI: docs/plans/central-conteudos-importar-janela-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável
Responsável: —

## Intenção

A importação do perfil (@depjorgesolla) na Central de Conteúdos trouxe o gesto que faltava (C230), mas com janela fixa: só as publicações mais recentes. O dono pediu o contrário — "importar qualquer janela de publicações" — porque a campanha tem acervo para trás: posts que ficaram fora, períodos em que a importação não rodou, semanas de evento. Hoje o único jeito de trazer esse passado é colar link a link. O caminho oficial já pagina, o dedupe por identidade do post já impede gêmeas e a reexecução já é inofensiva; falta deixar o operador escolher o recorte. A operação diária não muda: "recentes" continua o default; a novidade é a janela.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`; `coordinator`/`candidate` também) na mesa, agora em mutirão de acervo — fechar a lacuna de um período —, não no ritmo do dia a dia.
- **Job principal:** trazer para a Central as publicações de um período escolhido do perfil oficial, sem colar link a link e sem duplicar o que já está.
- **Fluxo desejado:** abre a Central → "Importar do perfil" → escolhe a janela (default: recentes; ou um período desde [até]) → vê o tamanho antes de criar (novas · já estavam) → confirma → acompanha o progresso → lê o recibo honesto (novas / já estavam / falharam com motivo) → revisa na lista.
- **Anti-goals de produto:** não vira triagem peça a peça antes de importar; não vira sincronizador agendado; não publica nada; não cria segunda identidade nem segunda fila; não busca além do que a via oficial entrega.

### Esboço de fluxo (C)

```text
[Central de Conteúdos] → "Importar do perfil"
  → escolhe a janela: recentes (default) ou período desde [até opcional]
  → a busca varre o perfil próprio pela API oficial até cobrir a janela
  → o operador vê o tamanho (novas · já estavam) e confirma — obrigatório em janelas maiores
  → cada novidade vira Rascunho no pipeline existente, deduplicada pela identidade do post
  → fim: recibo honesto "novas · já estavam · falharam com motivo"
  → se a API/limite cortar, o recibo diz; reexecutar a mesma janela continua sem duplicar
[outcome: o acervo de qualquer período do perfil entra na Central como Rascunho, sem duplicar e sem publicar nada]
```

### Design UI (C)

- Design UI (gate): `docs/plans/central-conteudos-importar-janela-ui-design.html`

## Objetivo e aceite

- O operador escolhe a janela da importação; "recentes" segue o default e o recorte é gesto explícito.
- Janela maior pede confirmação com o tamanho (novas · já estavam) antes de criar; o recibo honesto "novas / já estavam / falharam com motivo" continua.
- A execução cobre a janela pedida pela via oficial, sem teto artificial; se a API/limite cortar (10K mais recentes, rate limit), o que foi feito é dito e reexecutar continua sem duplicar.
- Dedupe por identidade do post segue soberano: janelas sobrepostas, reexecuções e o que entrou por link não geram gêmeas.
- Guardrails: tudo Rascunho; sem credencial a ação fica indisponível (fail-closed, "Instagram ainda não configurado."); só perfil próprio pela API oficial — sem scraping, terceiro ou stories; token nunca em log; nada publicado automaticamente; board/feed da home intocados.

## Dados (intenção)

- **Vou apresentar dados?** Não — é operação/curadoria, não analytics: sem agregado, KPI ou superfície nova. O tamanho da janela e o recibo são recibo operacional, não métrica.
- **Decisões desbloqueadas:** N/A — a decisão é editorial ("quero o acervo de tal período"), não numérica. **Forma:** N/A — sem números de alcance/engajamento do Instagram nesta tela.

## Dados da decisão (literais)

- **Default preservado:** "recentes" (a janela atual da ação) continua o comportamento padrão; o recorte por período é escolha explícita do operador.
- **Janela:** período com **data inicial** (e **data final opcional**), contado pela **data de publicação** do post.
- **Curadoria:** todo post importado entra como **Rascunho**; **nenhuma publicação automática**.
- **Dedupe:** identidade do **post** (shortcode; variantes de URL), não a grafia do link; reexecutar e sobrepor janelas não duplica.
- **Fail-closed:** sem credencial, ação indisponível — **"Instagram ainda não configurado."**
- **Fonte:** só o **perfil próprio** (`@depjorgesolla`) pela **API oficial** — sem scraping, sem terceiro, sem stories.
- **Limites honestos:** só as **10K mídias mais recentes** da edge oficial; quando a API cortar, o recibo é honesto.
- **Recibo mantido:** **novas criadas / já estavam / falharam com motivo** (falha nunca em silêncio).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/socialFeed/instagramFeed.ts` (cliente Graph API — paginação por cursor, `maxResults`, early-stop; hoje sem `since`/`until`); `src/utilities/content/contentPieceProfileImport.ts` (dono da janela fixa `CONTENT_PIECE_PROFILE_IMPORT_INSTAGRAM_WINDOW` e da listagem/dedupe); `src/components/campaign/content/ImportContentPieceProfileDialog.tsx` (fases intro/running/done); actions `src/app/(campaign)/campanha/actions/contentPieces.ts` (`listContentPieceProfileImportCandidatesForActor`, `createContentPieceFromProfilePostForActor`, gate `canReadCommunicationCatalog`); request hoje vazio em `src/lib/schemas/contentPiece.ts`.
- **Precedente a olhar:** C230 (plano e impl D4 — janela 12, backfill cortado como rabbit hole), C220 (`contentPieceLink.ts` usa `maxResults: 500` + early-stop; job por peça), C212 §Q1/Q3/Q4 (10K, cursor como caminho de backfill, webhook como item irmão), C211 (tudo Rascunho).
- **Risco de acoplamento:** o dedupe tem dono único (`contentPiecePostIdentityUrls` / `contentPieceExistsForPostIdentity`) — não abrir segundo probe; `instagramFeed.ts` não pode importar `@payload-config` (gate de ciclos); não guardar estado/cursor da varredura no `SocialFeedSettings` (hook de save com lock transacional) nem reusar o caminho do board; nada de segunda fila/identidade; o job por peça e o N+1 de ~1 chamada de feed por post seguem aceitos.

## Dependências

- **Duras:** nenhuma.
- **Soft:** C230 (#1362, entregue — dono do gesto, do dedupe e do recibo) · C220/C211 (entregues) · credencial do Instagram configurada em produção (sem ela a janela não paga).

## Fora de escopo

- Triagem/seleção peça a peça antes de importar — a triagem é depois, na lista.
- Agendador/webhook/reconciliação automática — item irmão futuro (C212 §Q4).
- Retomada por cursor/estado próprio da varredura; segunda identidade ou fila; auto-publicação; analytics/engajamento do Instagram (C213); scraping/terceiro/stories; redesenho da tela da Central; outras redes (YouTube segue no link C220).

## Rabbit holes de produto

- **"Já que escolhe janela, seleciona antes."** Se alguém "só completar": checklist de mídias, preview peça a peça, edição em massa. **Corte neste item:** importa a janela como Rascunho; revisar/excluir é na lista, depois.
- **"Já que varre, sincroniza sozinho."** Se alguém "só completar": webhook, cron diário, painel de última varredura. **Corte:** sob demanda; o automático é o item irmão (C212 §Q4).
- **"Já que pagina, guarda cursor e retoma."** Se alguém "só completar": estado de varredura, retomada exata, contador de páginas. **Corte:** o recibo é honesto e reexecutar a mesma janela continua sem duplicar.
- **"Importa o perfil inteiro de uma vez."** Se alguém "só completar": backfill total das 10K, progresso persistente, retomada entre sessões. **Corte:** a janela é escolhida; o limite da edge (10K, sem stories) é dito.
- **"Importou, publica."** Se alguém "só completar": auto-publicar por período. **Corte:** tudo Rascunho; publicar é ato humano.

## Questões em aberto (produto)

- **O default muda?** **Opções:** A) recentes continua o default, período é opção explícita | B) sempre pedir a janela | C) default passa a ser período. **Recomendação:** A — a operação diária não muda; recorte é mutirão. _(assumido — validar com produto)_
- **Qual o modelo da janela?** **Opções:** A) período (desde; até opcional) | B) "últimas N" | C) ambos. **Recomendação:** A — é a linguagem do humano ("qualquer janela"), cobre lacunas por data, e sobreposição é inofensiva por dedupe; N pode virar preset de design sobre o período. B/C registradas como alternativas.
- **Confirma antes de criar?** **Opções:** A) sempre | B) só janelas maiores que a de hoje | C) nunca. **Recomendação:** B — o recente pequeno mantém o clique único de hoje; janela larga mostra o tamanho (novas · já estavam) e pede confirmação, evitando despejo acidental de rascunhos. _(assumido)_
- **Tem teto de janela?** **Opções:** A) sem teto artificial — pagina até cobrir e o recibo diz se cortou | B) teto fixo de quantidade | C) teto = limite da edge (10K). **Recomendação:** A — teto de produto só fabrica frustração; o corte real (10K, rate limit) já é limite honesto e a reexecução continua sem duplicar. A mecânica de páginas/lote é implementação.
- **Recorte por quê?** **Opções:** A) data de publicação do post (timestamp) | B) posição no feed. **Recomendação:** A — é o vocabulário do operador ("de tal dia a tal dia") e o timestamp já vem no feed; posição não é estável fora do topo.

## Referências

- GitHub Issue [#1386](https://github.com/fsolla/teqo/issues/1386)
- Design UI (gate): `docs/plans/central-conteudos-importar-janela-ui-design.html`
- Planos irmãos: `central-conteudos-importar-perfil.md` (C230) e `-impl.md` · `central-conteudos-link-instagram.md` (C220) · `central-conteudos-varredura-instagram.md` (C212 §Q1/Q3/Q4) · `central-conteudos-ingestao.md` (C211)
- Arquivos-pista: `src/utilities/content/contentPieceProfileImport.ts` · `src/utilities/socialFeed/instagramFeed.ts` · `src/components/campaign/content/ImportContentPieceProfileDialog.tsx` · `src/app/(campaign)/campanha/actions/contentPieces.ts` · `src/lib/schemas/contentPiece.ts` · `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/page.tsx` · `AGENTS.md` (sem scraping/terceiro; token nunca em log)

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — o acervo de qualquer período escolhido entra na Central como Rascunho, sem duplicar e sem publicar nada.
2. Appetite declarado e a intenção cabe? **Sim** (~1–2 dias; triagem prévia, agendador, retomada de cursor e analytics cortados).
3. Persona + job + aceite claros sem jargão de stack? **Sim**.
4. Direção no codebase é hipótese? **Sim** — áreas/pistas com os caminhos citados, sem schema/signature.
5. Zero decisões duras de engenharia no plano? **Sim** — cursor, lote, page cap, estado e persistência ficam na implementação.

**Score: 5/5.**
