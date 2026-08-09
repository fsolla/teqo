# Pessoas: lista unificada de pessoas da campanha

Status: rascunho
Atualizado em: 2026-08-09
Issue: #495
Priority: P1
Model: composer-2.5
Impeccable: C — fluxo novo: nova rota + tabela + omnibox + filtros salvos
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c100-ui-draft.canvas.tsx
Appetite: ~3–4 dias eng
Responsável: —

## Intenção

A mesa (coordenação e assessores) precisa ver todas as pessoas da campanha num lugar só — lideranças, dobradinhas e staff — sem saltar entre `/liderancas`, `/dobradinhas` e `/assessores`. A mesma pessoa com vários papéis aparece **uma vez**, com as capacidades expressas por território — não por uma coluna de "papel".

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor na mesa (staff).
- **Job principal:** encontrar a pessoa e ver, num relance, onde ela atua (assessora / liderança / dobradinha) e em quais municípios — e refinar o recorte.
- **Fluxo desejado:** abre `/campanha/pessoas` → vê as pessoas com as colunas territoriais → filtra na omnibox (capacidade, município) → salva o recorte como atalho (mesmo padrão de Municípios, B18).
- **Anti-goals de produto:** não vira spreadsheet mode; não é segundo cadastro de pessoa (a ficha continua sendo `Contact`); não substitui as listas especializadas.

## Decisões de produto (travadas com o humano em 2026-08-09)

- **Colunas:** **Nome** (com partido entre parênteses quando a pessoa é dobradinha com partido — ex. "Maria (PT)"), **Contato** (telefone em destaque + e-mail como segunda linha discreta; sem telefone, o e-mail vira a linha principal), **Assessora** (municípios da carteira), **Lidera** (municípios da liderança), **Aliada em** (municípios com dobradinha), **Assessorado** (assessores responsáveis — dobradinha e liderança), **Base** (cidade do `Contact` quando houver) e **Ações** (sem título: WhatsApp `wa.me` só para quem tem telefone + convite de cadastro na plataforma + apagar pessoa). Sem coluna de papel/kind; sem coluna de partido.
- **Sem apoiadores na lista (v1).** `/apoiadores` permanece e continua sendo a superfície deles.
- **Merge por `Contact`:** uma pessoa física = uma linha; capacidades = colunas preenchidas. Coordenador/candidato entram pela carteira real (`municipality.advisors`); coluna vazia = não assessora.
- **Facets da omnibox derivam das colunas:** "É assessora / É liderança / É dobradinha" + filtros de município (e os filtros já existentes por domínio, ex. status de apoio em lideranças).
- **Outras listas permanecem.** A lista de Municípios é a referência estrutural (omnibox, filtros salvos, colunas).

## Objetivo e aceite

- `/campanha/pessoas` lista e filtra pessoas com as 8 colunas; a mesma pessoa em 2+ papéis = 1 linha.
- Ações: WhatsApp (`wa.me`) apenas quando há telefone registrado no `Contact`; quem não tem telefone não tem ação.
- Ações: convite de cadastro na plataforma reusa o fluxo `autopreenchimento` das lideranças (`createCampaignInvite` + `LeadershipInviteRowAction`, consent fail-closed), disponível para quem tem engajamento de liderança; sempre 1:1 por linha (Res. TSE 23.610 art. 33 — sem disparo em massa).
- Ações: **Apagar pessoa** — cascata destrutiva transacional (ficha `Contact` + liderança + votos declarados + dobradinha + apoiadores + convites + conta de acesso vinculada), precedida de **confirmação explícita** que lista tudo o que será removido; contas de coordenação/candidato nunca apagáveis.
- Filtros salvos funcionam no padrão B18 (localStorage + submenu no sidebar), especializados para Pessoas — 2º call site do padrão, sem genericizar (FD2 vetou o sistema genérico).
- Escopo de acesso preservado: assessor vê só a carteira dele; leader não acessa (rota staff, lockdown).
- Nenhuma rota existente muda; `/apoiadores`, `/liderancas`, `/dobradinhas`, `/assessores` intactos.

## Dados (intenção)

- **Vou apresentar dados?** Não — as colunas expressam **vínculos** (território/partido), não métricas. Nenhum agregado de pessoa entra na superfície.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota nova `src/app/(campaign)/campanha/(app)/pessoas/`; shells do Pass 2 W1 (URL state, omnibox, tabela, paginação); utilitários por domínio existentes (leadership/stateDeputy/advisor); padrão B18 (`municipalitySavedFilters.ts`, `listQueryMatch.ts`); chips de relação (B159); entrada no sidebar.
- **Precedente a olhar:** lista de Municípios (referência), B91 (busca global multi-entidade como agregador), B18 (filtros salvos), B159 (colunas de relação), B17 (seletor de colunas para conter a largura), share kit `wa.me` de apoiadores (precedente do botão Ações).
- **Risco de acoplamento:** o merge por `Contact` no servidor deve aplicar o escopo de acesso **por capacidade** (cada query com o where existente do domínio) — nunca um escopo alargado; leader lockdown é o limite da rota.

## Dependências

- **C99** ([pessoas-identidade-contact.md](pessoas-identidade-contact.md)) — sem o vínculo `campaignUser → Contact` e o campo de assessores responsáveis da liderança, as colunas Assessorado e Ações não completam.

## Fora de escopo

- Apoiadores na lista — revisitar pós-eleição, junto da multi-tenancy.
- Remover as listas atuais; filtros salvos genéricos ou sincronizados no servidor; dedupe de `Contact` duplicados existentes (linhas duplicadas visíveis e aceitas no v1); rota para leader; entidade `campaign`.

## Rabbit holes de produto

- **Genericizar filtros salvos.** FD2 já vetou; o padrão B18 é o teto. **Corte:** especializar (2º call site do padrão).
- **Incluir apoiadores "para completar".** A lista perde o foco e o merge fica mais caro. **Corte:** v1 sem; revisitar com evidência de uso.
- **Coluna de partido própria.** O humano cortou — partido só como sufixo do nome.
- **Células com muitos municípios.** Chips truncados com "+N" (padrão B159) e colapso mobile (B172).
- **Cascata de apagar esquecer uma relação.** Cada relação com FK necessária (votos, convites, conta de acesso) precisa de passo explícito na transação — a coleção `campaignUser` já traz hooks de cascata (passkeys/notificações); o executor mapeia o resto com `migrate:status`/drizzle e testa o caminho completo em int.
- **"Mesclar pessoas" vira escopo.** Transferir engajamentos entre fichas (ex. reancorar dobradinha) é campo admin hoje (`stateDeputy.contact` system-level); ferramenta de merge real é pós-eleição. **Corte:** v1 só copia campos da ficha + Apagar.

## Questões em aberto (produto)

- **Pessoas sem nenhum papel (Contact puro, sem capacidade):** entram na lista? **Recomendação:** não no v1 — sem capacidade não há linha; continua sendo assunto do admin Payload. _(assumido — validar no gate)_
- **Partido no nome:** única fonte `stateDeputy.party` (quem não é dobradinha não tem sufixo). **Recomendação:** sim. _(assumido — validar no gate)_
- **Convite para dobradinhas/staff?** Hoje o convite de cadastro existe **só para lideranças** (`campaignInvite` ancorado em `leadership`); assessores entram por provisionamento direto, sem convite. **Recomendação:** na v1, convite só nas linhas com engajamento de liderança; generalizar o convite para pessoa (ancorar em `Contact`) é mudança de schema do `campaignInvite` — follow-up pós-eleição. _(assumido — validar no gate)_
- **Quem pode apagar pessoa?** **Recomendação:** coordenação/candidato (ação destrutiva transversal, maior que o escopo de carteira de assessor). _(assumido — validar no gate)_
- **Votos declarados na cascata:** apagar junto (lista explícita no diálogo) vs bloquear enquanto existirem? **Recomendação:** apagar junto, listado no diálogo de confirmação — o gesto de apagar é intenção explícita de remover a pessoa inteira. _(assumido — validar no gate)_
- **Carteira e conta de acesso do apagado:** remover automaticamente dos `municipality.advisors` / `activity.advisors` e apagar a conta `campaignUser` vinculada (cascata existente de passkeys/notificações)? **Recomendação:** sim, na mesma transação, declarado no diálogo. _(assumido — validar no gate)_

## Referências

- [pessoas-identidade-contact.md](pessoas-identidade-contact.md) (C99, pré-requisito)
- B18 (filtros salvos), B127/B128 (omnibox), B159 (colunas de relação), B91 (busca global), `docs/plans/sistema-listas-campanha.md` (shells Pass 2 W1)
- `docs/plans/convite-whatsapp-lista-liderancas.md` + `LeadershipInviteRowAction` (convite de cadastro por linha — fluxo a reusar)
- Precedente de cascata e LGPD: `removeSupporterData` (anônima Contact quando sem outros joins) e hooks `beforeDelete` de `campaignUser` (passkeys/notificações)
- Canvas UI (gate): `plan-c100-ui-draft.canvas.tsx`
- `AGENTS.md` — modelo Municípios, leader lockdown, naming pt-BR em labels
