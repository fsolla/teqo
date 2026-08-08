# C93 — Gerar link de import sem filtros (agenda completa do escopo)

Status: rascunho
Atualizado em: 2026-08-08
Issue: #437
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe no botão "Link de import" (ativa ação hoje desabilitada; sem rearranjo de layout)
Canvas UI: coberto pelo plan-c94-ui-draft.canvas.tsx (mesmo botão, estado-alvo do C94)
Appetite: ~0,5 dia eng; um outcome verificável — com zero filtros, gera-se o link da agenda completa do meu escopo
Responsável: —

## Dependência rápida

- **Sucessor de C16 (#392, _done/in-prod_):** a intenção de C16 condicionava o link a um filtro ativo; produto agora quer o caso "sem filtros". Plano de C16 imutável.
- **Dura (soft): [C92](c92-corrigir-criacao-link-import-agenda.md)** — sem a criação funcionando, esse fluxo não se valida.

## Intenção

Hoje o botão "Link de import" fica **desabilitado sem filtros**: quem quer simplesmente assinar **toda** a agenda da campanha no Google não consegue. Na mesa do coordenador, "agenda completa do meu escopo" é um desejo legítimo — o time inteiro acompanhando tudo que está em Teqo, sem montar filtro nenhum. Queremos destravar o feed **sem filtro**: o recorte passa a ser tudo que o criador tem permissão de ver (portfólio acessível), mantendo revogação e fail-closed iguais.

## Persona e fluxo

- **Persona / contexto:** coordenador quer o calendário completo da campanha (ou assessor, todo o portfólio dos municípios que administra) sempre atualizado no GCal da equipe.
- **Job principal:** gerar o link de import da agenda inteira — sem precisar inventar um filtro.
- **Fluxo desejado:** abre a agenda (sem filtros) → "Link de import" habilitado → nomeia → copia/revoga. **Hoje:** botão cinza, sem ação.
- **Anti-goals de produto:** feed "sem filtro" não é um backdoor — continua valendo o escopo do criador e a fail-closed (perdeu acesso a um município → feed para de incluir; criador desativado → feed para de servir).

## Objetivo e aceite

- Com **nenhum filtro ativo**, o botão "Link de import" permite gerar o link.
- O feed sem filtro cobre a agenda completa **dentro do escopo de leitura do criador** (coordinator/candidate = tudo; advisor = municípios administrados).
- Revogar/listar e o endpoint de leitura seguem com acesso fail-closed (invariante de C16).
- Sem PII nova; sem Consent novo (mesma base de C16).

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** "posso assinar a agenda completa do meu escopo?" — sim.
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/activity/ActivityAgendaFilters.tsx` (gate `hasFilters` → disabled do botão) e `src/utilities/calendarFeed.ts` / action `src/app/(campaign)/campanha/actions/calendarFeed.ts` (construir feed sem filtros = só o escopo do criador).
- **Precedente a olhar:** intenção e impl de C16 (`docs/plans/sync-teqo-google-calendar*`), que já previam `filterMunicipality` vazio = "todos os municípios do escopo do criador" (descrição do campo na collection).
- **Risco de acoplamento:** o layout do botão muda no C94 — este item só destrava o **estado permitido**; o executor deve reconciliar com o estado final do C94.

## Dependências

- C92 (soft — validação pós-fix).

## Fora de escopo

- Layout do botão / ícone no header / ação rápida → **C94**.
- Escolher "tudo" vs "recorte" por UX (pedido de confirmação) → não; o feed sem filtro é direto.

## Rabbit holes de produto

- **Feed sem filtro virando "exportar tudo para sempre".** Se alguém "só completar": janela temporal ilimitada ou sem fail-closed. **Corte neste item:** mantém janela deslizante e access por leitura (decisões de C16 intactas).

## Questões em aberto (produto)

- **Emparelhar com o estado-alvo do C94?** O botão do C94 vira ícone no header. **Recomendação:** C93 pode entrar antes (habilita o botão atual) e o C94 herda o estado habilitado; sem ordem obrigatória. _(assumido — validar)_

## Referências

- GitHub Issue #392 (C16, intenção imutável)
- Canvas UI do C94: `plan-c94-ui-draft.canvas.tsx`
- Campo `filterMunicipality` da collection `calendarFeed`: "Se vazio, inclui todos os municípios do escopo do criador" (base pronta para o sem-filtro)
