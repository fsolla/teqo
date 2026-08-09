# C98 — Link de import da agenda: habilitar sem filtros e garantir que a geração funciona

Status: aprovado (plano em `main`)
Atualizado em: 2026-08-09
Issue: #483
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — estado do botão "Link de import" (header desktop / FAB mobile) + copy do diálogo; sem rearranjo de layout
Canvas UI: reutiliza `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c94-ui-draft.canvas.tsx` (estado-alvo das superfícies; delta deste item = estado habilitado + copy neutra)
Appetite: ~0,5 dia eng; um outcome verificável — de qualquer recorte da agenda (inclusive zero filtros), gera-se o link e ele responde
Responsável: —

## Dependência rápida

- **Sucessor de [C93 (#437)](c93-gerar-link-import-sem-filtros.md), em `in-progress` (plano imutável):** o C93 destrava o botão sem filtros, mas o PR #473 está **desatualizado** — baseado no main pré-C94, modifica `CalendarFeedButton` (substituído pelo C94 por `AgendaFeedChrome`/header+FAB). Nunca foi mergeado; no main atual o gate `canGenerateFeed` (`src/app/(campaign)/campanha/(app)/agenda/page.tsx:56`) continua desabilitando o botão sem filtros. Este item re-aplica a intenção do C93 nas superfícies do C94.
- **Dura (soft): [C92 (#436)](c92-corrigir-criacao-link-import-agenda.md), `done/in-prod`:** a criação voltou a funcionar (raiz: campos `required` com `access.create` admin-only stripados → ValidationError engolido). Verificado em `main` (14/14 int em `tests/int/calendarFeed.int.spec.ts` verdes localmente). Ainda assim o usuário relata erro ao gerar — este item exige **verificação ponta a ponta** do fluxo real (ver "Questões em aberto").

## Intenção

O botão de sincronizar a agenda com Google Calendar (C16) segue **inutilizável no uso real**: desabilitado sem nenhum filtro ativo (quem quer assinar a agenda inteira não consegue), e o usuário relata que **tentar gerar o link dá erro mesmo com filtro**. A mesa quer um caminho único e confiável: de qualquer recorte da agenda (tudo, um município, uma tag, "deputado presente"), o staff gera o link, copia e assina no GCal — sem estados mortos e sem erro. "Sem filtro" significa **a agenda completa dentro do escopo de leitura do criador** (coordinator/candidate = tudo; advisor = municípios que administra), com a fail-closed de C16 intacta.

## Persona e fluxo

- **Persona / contexto:** coordenador ou assessor na mesa (desktop) e no campo (mobile), querendo o calendário da campanha no GCal do time — recorte específico ou a agenda inteira.
- **Job principal:** gerar o link de import do recorte atual da agenda — sempre, inclusive com zero filtros — e receber um link que funciona.
- **Fluxo desejado:** abre a agenda (com ou sem filtros) → "Link de import" habilitado (ícone no header / FAB) → nomeia o feed → "Gerar link" → link copiado → adiciona no GCal → feed atualiza sozinho; revogar continua disponível.
- **Anti-goals de produto:** "sem filtro" não é backdoor — o feed cobre só o escopo de leitura do criador (invariante C16, reforçado no read pelo C96); fail-closed mantida (criador perde acesso → feed para de servir; criador desativado → 404); sem sync bidirecional; sem PII/Consent novo.

## Objetivo e aceite

- Com **nenhum filtro ativo**, o botão "Link de import" (header desktop e FAB mobile) permite abrir o diálogo e gerar o link.
- **Gerar link funciona no fluxo real**: nomear → gerar → o app retorna o link `/campanha/agenda/ical/<secret>` sem mensagem de erro; o link responde (feed iCal) para o recorte pedido.
- O feed sem filtro cobre a agenda completa **dentro do escopo de leitura do criador** (coordinator/candidate = tudo; advisor = municípios administrados; nada fora do escopo vaza).
- Revogar/listar e o endpoint de leitura seguem com acesso fail-closed (invariante de C16/C96).
- Sem PII nova; sem Consent novo (mesma base de C16).

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** "posso assinar a agenda completa do meu escopo?" — sim. "Gerar link funciona de ponta a ponta?" — sim, verificado.
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/agenda/page.tsx` (gate `canGenerateFeed` → remover), `src/components/campaign/activity/AgendaFeedChrome.tsx` (prop `canGenerate` + `disabled` do ícone do header) e `src/components/campaign/activity/CalendarFeedDialog.tsx` (aviso "Aplique filtros…", copy "este recorte da agenda" e `disabled` do botão "Gerar link"). Servidor (`src/app/(campaign)/campanha/actions/calendarFeed.ts` + `src/utilities/calendarFeed.ts`) **não deve precisar de mudança**: vazio = escopo do criador já é o contrato (descrição do campo `filterMunicipality` na collection; `buildFeedWhere`/`resolveFeedCreatorAccess`; read-side C96 merged).
- **Precedente a olhar:** impl do C93 (PR #473) — a copy neutra ("sincronizar a agenda") e os 2 int de conteúdo sem filtro (coordinator = tudo; advisor = portfólio) permanecem válidos e são **reaproveitáveis**; o PR em si é superseded (superfícies mortas).
- **Risco de acoplamento:** C95 (#439, `in-progress`) toca o mesmo header do app (seletor de vista, slot compartilhado) — este item não mexe no slot, só no estado do botão de feed; C94 é o dono atual das superfícies tocadas.

## Dependências

- C92 (soft — verificação pós-fix da criação).
- C93 (sucessor; o executor supersede o PR #473 e reaproveita o que valer).

## Fora de escopo

- Layout/posição do botão ou do diálogo → já entregue pelo C94.
- Refino do diálogo (labels, instruções GCal, placeholder) além da copy que este item torna enganosa ("este recorte").
- Qualquer mudança de schema/collection/access do feed (C16/C92/C96 intactos).

## Rabbit holes de produto

- **Feed sem filtro virando "exportar tudo para sempre".** Se alguém "só completar": janela temporal ilimitada ou sem fail-closed. **Corte neste item:** janela deslizante e access por leitura (decisões de C16/C96 intactas).
- **Caçar um erro fantasma de geração.** A criação está provada no servidor (int 14/14); se o erro do usuário não reproduzir no fluxo real, **não** inventar mudança de servidor para "garantir" — registrar o que foi verificado e seguir (a verificação ponta a ponta é o aceite).

## Questões em aberto (produto)

- **O erro de geração relatado é residual ou observação pré-deploy do C92?** **Opções:** A) exigir verificação ponta a ponta do fluxo real (ação + diálogo) no executor e corrigir só se reproduzir; B) mexer no servidor proativamente sem reprodução. **Recomendação: A** — a raiz do C92 está corrigida e testada em `main`; mexer sem reprodução arrisca regressão. _(assumido — validar)_
- **O PR #473 (C93, stale) deve ser re-baseado ou superseded?** **Opções:** A) superseded — fechar o PR e re-aplicar a intenção nas superfícies do C94, reaproveitando a copy neutra e os int de conteúdo; B) re-baseado pelo executor do C97. **Recomendação: A** — o C93 está `in-progress` (claimado) e o PR foi construído sobre superfícies que o C94 removeu; a intenção continua a mesma e o C97 a carrega. _(assumido — validar)_
- **Copy do diálogo com filtros vazios:** explicitar que o feed será "a agenda completa do seu escopo" ou só neutralizar ("sincronizar a agenda")? **Opções:** A) copy neutra mínima (approach do C93); B) texto explicativo do escopo. **Recomendação: A** — sem UI nova; o aceite de conteúdo é coberto por teste, não por texto. _(assumido — validar)_

## Referências

- GitHub Issue #437 (C93, sucessor; plano imutável — `in-progress`), #436 (C92, `done/in-prod`), #392 (C16, intenção imutável)
- Canvas UI do C94 (referência visual das superfícies): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c94-ui-draft.canvas.tsx`
- Para abrir primeiro: `src/app/(campaign)/campanha/(app)/agenda/page.tsx`, `src/components/campaign/activity/AgendaFeedChrome.tsx`, `src/components/campaign/activity/CalendarFeedDialog.tsx`, `tests/int/calendarFeed.int.spec.ts`
