# Sollinha começa fechado no desktop

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1107
Priority: P2
Impeccable: A — N/A sem nova superfície (muda o estado inicial de um painel que já existe; o estado fechado já é desenhado)
Design UI: N/A — sem UI nova
Appetite: ~0,25–0,5 dia eng; um outcome verificável: abrir `/campanha` no desktop em uma sessão nova mostra o conteúdo em largura cheia, com o Sollinha fechado; quem quiser abre pelo botão/FAB como hoje.
Responsável: —

## Intenção

Hoje, numa sessão nova no desktop, o painel do Sollinha abre sozinho ocupando ~25% da largura. Quem abre `/campanha` para trabalhar no conteúdo perde largura sem ter pedido: o chat se impõe antes de qualquer intenção de usá-lo. O pedido é inverter o padrão — começar fechado e abrir sob comando. O FAB e o botão no header continuam abrindo normalmente.

## Persona e fluxo

- **Persona / contexto:** staff (coordinator, candidate, advisor, communicator) no desktop em `/campanha`, em trabalho de mesa — leitura de dados, edição, navegação entre municípios.
- **Job principal:** ter a tela em largura cheia por padrão e chamar o Sollinha quando precisar.
- **Fluxo desejado:** entra em `/campanha` numa sessão nova → vê o conteúdo em largura cheia, com o Sollinha fechado e o botão/FAB visível → se quiser, abre pelo botão/FAB → a conversa aparece e o painel se comporta como hoje → se fechar, a escolha fica lembrada na sessão; só uma sessão nova volta ao padrão fechado.
- **Anti-goals de produto:** não virar redesenho do painel; não virar onboarding/hint obrigatório do chat; não alterar o comportamento mobile.

## Objetivo e aceite

- Sessão nova no desktop inicia com o Sollinha fechado e o conteúdo em largura cheia.
- Abrir pelo FAB/botão funciona como hoje e restaura a conversa.
- A escolha do usuário (aberto/fechado) segue lembrada dentro da sessão — não forçar fechado em cima da escolha de quem já abriu.
- Mobile intocado: drawer continua fechado por padrão e só abre sob comando.
- **Guardrail:** nenhum estado "meio aberto" — fechado é fechado, aberto é aberto, sem largura residual.
- **Guardrail:** o chat não perde conversa por começar fechado; o botão de abrir continua descobrível.
- **Guardrail:** a convenção de largura do painel aberto (B166/B167) e a persistência de sessão (B199) permanecem; a mudança é só o default de sessão nova, não o estado restaurado.

## Dados (intenção)

- **Vou apresentar dados?** Não — nenhum número novo na tela.
- **Decisões desbloqueadas:** N/A — o item muda estado inicial de um painel, não habilita leitura de dado.
- **Forma:** _adiada ao plano de implementação_.

## Dados da decisão (literais)

- Largura atual do painel: `CHAT_DEFAULT_PCT='25'`.
- Estado inicial de `open`: nasce `false`.
- O efeito de settle (`measured && !isMobile && !restoredSessionRef.current && !panel.isCollapsed()`) é o que força o aberto hoje.
- Sessão guarda `open` com `openBy: 'user'|'settle'`; ausência de sessão é o único sinal de sessão nova.
- O estado fechado é o que já existe quando o usuário fecha — esta entrega reusa esse estado, não cria um novo.
- A mudança é sobre o **default de sessão nova**, não sobre o estado restaurado.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `CampaignAISidebarContext.tsx` (efeito de settle), `CampaignAISidebarShell.tsx` (`CHAT_DEFAULT_PCT` / `chatVisible` / painel), `sollinhaChatSession.ts` (default de sessão nova), e os testes e2e que pinam o comportamento desktop-open.
- **Precedente a olhar:** `docs/plans/largura-padrao-chat-sollinha.md` (B166/B167), `docs/plans/sollinha-close-mid-stream-persist.md` (B199), `docs/plans/ai-chat-sollinha.md`.
- **Risco de acoplamento:** não quebrar o restore de sessão nem o caminho mobile; o frame de hidratação e o desenho de largura já existentes precisam continuar coerentes.

## Dependências

- B167/B188/B199 (entregues — sessão, largura, persistência).

## Fora de escopo

- Redesenhar o chat do Sollinha.
- Mudar a largura padrão quando aberto.
- Mexer no comportamento mobile.
- Trocar a skill/agente Sollinha.

## Rabbit holes de produto

- **Vira "redesenho do painel".** Se alguém "só completar": repensar layout, animação, trigger do FAB, botão do header. **Corte neste item:** a entrega é só o default inicial; nada de novo desenho.
- **Vira "hint de primeira vez".** Se alguém "só completar": tooltip, popover, checklist de descoberta do chat. **Corte neste item:** o FAB/header já é o convite (ver Questões em aberto).
- **Vira "estado meio aberto".** Se alguém "só completar": largura residual, painel colapsado visível, resize persistido no fechado. **Corte neste item:** fechado é fechado, sem resíduo.

## Questões em aberto (produto)

- **Manter o painel com largura 25% mas escondido (CSS) vs. nascer colapsado/0?** **Opções:** A) manter largura e esconder; B) nascer colapsado em 0. **Recomendação:** A — menor risco, preserva o restauro e o desenho de largura já entregue (B166/B167). _(assumido — validar com produto)_
- **Avisar o usuário que o chat existe?** **Opções:** A) não avisar; B) hint de primeira vez. **Recomendação:** A — o FAB e o botão do header já são o convite; um hint é escopo novo. _(assumido — validar com produto se querem hint de primeira vez.)_

## Referências

- Design UI (gate): N/A
- `docs/plans/ai-chat-sollinha.md`
- `docs/plans/sollinha-close-mid-stream-persist.md` (B199)
- `docs/plans/largura-padrao-chat-sollinha.md` (B166/B167)
- `AGENTS.md` / `AGENTS-campaign.md`
- Testes que pinam o default atual: `tests/e2e/campaignAiChatResize.e2e.spec.ts:97-124`, `tests/e2e/campaignSollinhaWidth.e2e.spec.ts:40-56`, `tests/e2e/campaignSollinhaContext.e2e.spec.ts:140-199,283-327`, `tests/unit/sollinhaChatSession.unit.spec.ts:61,82,92,100`, `tests/unit/sollinhaChatPanelWidth.unit.spec.ts`

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (sessão nova desktop abre com chat fechado e conteúdo em largura cheia); (2) appetite ~0,25–0,5 dia, mexe só no default inicial e no que pina o teste; (3) persona + job + aceite claros; (4) direção no codebase é hipótese, sem contrato/signature; (5) zero decisões duras de engenharia.
