# Sollinha mobile: fechar o drawer ao navegar por link

Status: registrado
Atualizado em: 2026-08-11
Issue: #660
Priority: P2
Model: composer-2.5
Impeccable: B — comportamento do drawer existente, sem nova superfície
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-36/canvases/plan-b198-ui-draft.canvas.tsx
Appetite: ~0,5 dia eng; um encaixe no renderer de links do chat
Responsável: —

## Intenção

No celular, o Sollinha abre como drawer de 90% da tela. Quando o usuário toca num link entregue na resposta (ex.: "ver liderança", "ver município"), a navegação acontece — mas o drawer continua aberto cobrindo o destino. O usuário chega na página sem ver nada dela, tendo que fechar o drawer manualmente para só então olhar o conteúdo que o link prometia.

A conversa já é preservada (o layout fica montado na navegação interna e o contexto vive na sessão da janela) — o que falta é só o drawer sair do caminho no momento do toque.

## Persona e fluxo

- **Persona / contexto:** assessor/liderança no celular usando o Sollinha em campo; toca num link interno para ir ver o recurso citado.
- **Job principal:** navegar para o destino do link com o drawer fechado, sem perder a conversa.
- **Fluxo desejado:** Sollinha responde com um link interno → toque no link → drawer fecha e a navegação segue no mesmo tab → página de destino visível → abrir o Sollinha de novo (FAB/header) → conversa e estado exatamente onde estavam (comportamento atual de restauração, inalterado).
- **Anti-goals de produto:** fechar o drawer não pode descartar a conversa (o contexto deve continuar salvo); o desktop não muda; link externo (nova aba) não fecha nada na aba de origem.

### Esboço de fluxo (B)

```text
[chat aberto no drawer — resposta com link /campanha…] → [toque no link]
→ [drawer fecha + navegação no mesmo tab] → [destino visível]
→ [abrir Sollinha de novo] → [conversa restaurada no estado anterior]
```

## Objetivo e aceite

- Em mobile, tocar em um link interno (`/campanha…`) na resposta do Sollinha fecha o drawer enquanto navega — o usuário aterrissa no destino com a página visível.
- Reabrir o Sollinha na mesma janela restaura a conversa exatamente onde estava (comportamento atual preservado — nada de contexto perdido).
- Desktop inalterado: o painel lateral continua aberto ao navegar por link (comportamento atual).
- Link externo (http(s), abre em nova aba) não fecha o drawer da aba de origem.
- O estado persistido de "aberto/fechado" continua correto após o fechamento por navegação (reload não reabre o drawer sozinho).

## Dados (intenção)

Dados: N/A — sem superfície de dados; é comportamento de navegação de UI.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/ai/CampaignAIChat.tsx` — o renderer de markdown (`markdownComponents.a`) que hoje decide link interno (`next/link`) vs externo (`externalLinkTarget`); hoje é um módulo estático sem acesso ao contexto do chat. O drawer (`CampaignAIDrawer.tsx`) reage ao `open` do `CampaignAISidebarContext` — fechar é chamar `setOpen(false)` no toque (provavelmente só quando `isMobile`). A persistência (`src/lib/sollinhaChatSession.ts`) e a restauração (`CampaignAISidebarContext.tsx`) não devem precisar mudar.
- **Precedente a olhar:** planos `sollinha-links-como-links.md` (B187/B188 — decisão de link interno vs externo) e `sollinha-contexto-sessao-janela.md` (B188 — persistência da conversa).
- **Risco de acoplamento:** o contexto `open` é compartilhado entre drawer (mobile) e painel (desktop) — o fechamento precisa ser condicionado ao viewport mobile para não fechar o painel no desktop. A marcação de intenção de usuário (`userToggledOpenRef`) distingue abertura por gesto de abertura por settle — o fechamento por navegação não deve se passar por decisão do usuário de forma que reabra em reload (o restore só reabre se `open: true` persistido, então fechar programaticamente já é seguro — validar na implementação).

## Dependências

- Nenhuma.

## Fora de escopo

- Fechar o drawer ao navegar por chips/sugestões ou pela busca global — só os links das respostas do Sollinha.
- Alterar a persistência da conversa ou o comportamento do painel desktop.
- Animar/fazer transição do fechamento — o drawer já fecha com o mecanismo existente.

## Rabbit holes de produto

- **Fechar para tudo.** Se alguém "só completar" e fechar o drawer em qualquer link (inclusive externos, que abrem em nova aba), a aba de origem perde o lugar de retomada da conversa. **Corte:** só links internos (navegação no mesmo tab) fecham; externos deixam o chat montado.
- **Reescrever a restauração.** A conversa já persiste e restaura; mexer no mecanismo de sessão para "resolver" o fechamento seria reabrir a raça de restore (OPS22/B188). **Corte:** fechar é só `setOpen(false)` no toque; sessão intocada.

## Questões em aberto (produto)

- **Links externos também devem fechar o drawer?** **Decidido (gate 2026-08-11):** não — o destino abre em nova aba; a aba de origem fica com o chat aberto para retomar a conversa. Só links internos (`/campanha…`) fecham.
- **O fechamento deve acontecer no clique?** **Decidido (gate 2026-08-11):** sim — o drawer sai do caminho no toque, antes de a página carregar.

## Referências

- GitHub Issue #660
- Canvas UI (gate): [plan-b198-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-36/canvases/plan-b198-ui-draft.canvas.tsx)
- `src/components/campaign/shell/ai/CampaignAIChat.tsx` (markdownComponents.a), `CampaignAIDrawer.tsx`, `CampaignAISidebarContext.tsx`
- `src/lib/ai/markdownLinks.ts` (decisão link interno/externo), `src/lib/sollinhaChatSession.ts`
- `docs/plans/sollinha-links-como-links.md`, `docs/plans/sollinha-contexto-sessao-janela.md`
