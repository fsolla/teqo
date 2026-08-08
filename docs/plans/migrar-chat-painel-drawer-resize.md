# Migrar o chat Sollinha entre painel e drawer ao redimensionar

Status: rascunho
Atualizado em: 2026-08-07
Issue: #416
Priority: P2
Model: composer-2.5 / deepseek-v4-flash-high
Impeccable: B — correção de comportamento na abertura/fechamento existente do chat (desktop ↔ mobile)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b167-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; reação a viewport + estado de conversa; sem migration
Responsável: —

## Intenção

No vertical `/campanha`, o chat Sollinha tem duas superfícies: **painel lateral** (desktop) e **drawer full-screen** (mobile). Hoje, redimensionar a janela entre os dois tamanhos com o chat aberto deixa um estado quebrado — no mobile o painel continua "aberto" mas sem conteúdo. O esperado é uma **migração limpa**: se o chat está aberto ao cruzar a borda, ele continua aberto na superfície do novo tamanho (painel → drawer no desktop→mobile; drawer → painel no mobile→desktop). Se estava fechado, permanece fechado.

Além disso, a **conversa acompanha a sessão do site**: sobrevive à navegação interna, a abrir/fechar o chat e a redimensionar — só reinicia quando a sessão termina (nova aba).

## Persona e fluxo

- **Persona / contexto:** assessor/coordenador em `/campanha` conversando com a Sollinha; navega entre telas, redimensiona a janela (arrastou, trocou de monitor, dev tools) e espera que a conversa continue onde parou.
- **Job principal:** o chat acompanha a janela e a navegação — aberto continua aberto na superfície certa, fechado continua fechado, e a conversa não se perde a cada troca de superfície.
- **Fluxo desejado:**
  - Chat aberto no desktop (painel) → janela encolhe para mobile → painel fecha e o **drawer abre** com o chat **e a conversa atual**.
  - Chat aberto no mobile (drawer) → janela cresce para desktop → drawer fecha e o **painel abre** com o chat **e a conversa atual**.
  - Chat fechado → resize em qualquer direção → continua fechado.
  - Conversa iniciada → navegar entre páginas de `/campanha`, abrir/fechar o chat, redimensionar → a conversa continua.
  - Nova aba (nova sessão do site) → conversa reinicia vazia.
- **Anti-goals de produto:** não manter estados fantasma (aberto-sem-conteúdo, meio-aberto); não fechar um chat que estava aberto (migra, não descarta); não abrir o chat se ele estava fechado antes do resize; não afetar o fluxo normal de abrir/fechar em tela fixa; não persistir conversas além da sessão do site (sem histórico entre sessões).

## Objetivo e aceite

- **Desktop → mobile com painel aberto:** o painel fecha e o drawer mobile abre com o chat **e a conversa atual** — sem conteúdo perdido nem painel fantasma.
- **Mobile → desktop com drawer aberto:** o drawer fecha e o painel desktop abre com o chat **e a conversa atual**.
- **Chat fechado antes do resize (qualquer direção):** continua fechado depois.
- **Conversa persiste durante toda a sessão do site:** navegação interna entre páginas de `/campanha`, abrir/fechar o chat (FAB/botão/X) e redimensionar não a perdem.
- **Nova sessão (nova aba) reinicia a conversa:** começa vazia, como hoje.
- Reabrir/fechar depois (FAB no mobile, botão no desktop) funciona normalmente.
- Abrir/fechar em tamanho de tela fixo (só desktop ou só mobile) permanece como está hoje.

## Dados (intenção)

- **Vou apresentar dados?** **Não** — N/A: correção de estado de UI + ciclo de vida de conversa, sem número novo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/ai/CampaignAISidebarShell.tsx` (o `Panel` do chat é `hidden` no mobile — é ele que "esconde" o conteúdo), `src/components/campaign/shell/ai/CampaignAISidebar.tsx` (decide Drawer vs painel desktop via `useIsMobile`), o estado `open` em `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx` e o `useChat` em `src/components/campaign/shell/ai/CampaignAIChat.tsx` (hoje sem identificador estável — a conversa morre quando o componente desmonta).
- **Precedente a olhar:** `docs/plans/ai-chat-sollinha.md` (entrega original — `in-prod`, não editar; ela definiu "sessão nova a cada abertura" — **este item muda essa decisão de produto**); `docs/plans/largura-padrao-chat-sollinha.md` (B166, item irmão no mesmo painel — se B166 ainda estiver em `ready`, o executor pode olhar os dois juntos, mas são entregas separadas).
- **Risco de acoplamento:** o mesmo estado `open` controla o `Panel` (desktop) e o `Drawer` (mobile); a migração precisa coordenar as duas faces ao cruzar a borda; a conversa precisa de identidade estável com escopo de **sessão da aba** (não localStorage compartilhado entre abas, que vazaria entre sessões). `useIsMobile` já reage a resize — é o gatilho natural.

## Dependências

- Nenhuma dura. Soft: B166 (mesmo painel do chat — se B166 introduzir persistência de tamanho, a migração não deve conflitar; ordem de implementação livre, mas vale olhar os dois juntos).

## Fora de escopo

- Histórico de conversas entre sessões (persistir no servidor/DB, listar conversas antigas) — v2 não pedida.
- Abrir o chat automaticamente se ele estava fechado (resize não é convite).
- Redesenhar o Drawer mobile ou o painel desktop.
- O item irmão de largura padrão (B166) — teto de 360 px e resize livre.

## Rabbit holes de produto

- **"Fecho o chat no resize."** Versão anterior do pedido; migrar é o comportamento certo (o chat está em uso — descartar seria perda). **Corte:** migra aberto → aberto na outra superfície; só fecha se já estava fechado.
- **"Persisto conversas no servidor."** Se alguém "só completar": banco de conversas, histórico, limpeza — explodiria o escopo e toca LGPD (conteúdo de assessor). **Corte:** escopo = sessão da aba (memória com escopo de sessão), nada entre sessões.
- **"Abro o chat em qualquer resize."** Se alguém "só completar": abrir o chat quando a janela muda de tamanho, mesmo com ele fechado, seria intrusivo. **Corte:** só migra um estado já aberto.
- **"Vou criar flag nova de estado."** Uma terceira flag de estado paralela a `open` duplicaria o controle do painel e do drawer. **Corte:** reusar o estado `open` existente como fonte da verdade.

## Questões em aberto (produto)

- **A conversa em andamento sobrevive ao resize?** **Opções:** A) sim — o chat migra aberto com a conversa | B) não — cada troca de superfície reinicia. **Recomendação:** A — decidido pelo produto (2026-08-07): migrar aberto sem a conversa seria o bug atual de novo. _(resolvido)_
- **Recarregar a página na mesma aba mantém a conversa?** **Opções:** A) sim — mesma aba = mesma sessão do site | B) não — reload reinicia. **Recomendação:** A — coerente com "a conversa dura a sessão do site"; nova aba continua sendo o corte. _(assumido — validar com produto)_
- **Resize rápido/frequente (ex.: dev tools) pode abrir-fechar-abrir o drawer?** **Opções:** A) aceitar — é o comportamento natural de migrar estado | B) debounce para evitar piscar. **Recomendação:** A — decidido pelo produto (2026-08-07): aceitar. _(resolvido)_

## Referências

- GitHub Issue #B167 (após registro)
- Canvas UI (gate): [plan-b167-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b167-ui-draft.canvas.tsx)
- `src/components/campaign/shell/ai/CampaignAISidebarShell.tsx` (painel `hidden md:block`)
- `src/components/campaign/shell/ai/CampaignAISidebar.tsx` (Drawer mobile vs painel desktop)
- `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx` (estado `open`)
- `src/components/campaign/shell/ai/CampaignAIChat.tsx` (`useChat` sem identidade estável)
- `src/hooks/use-mobile.ts` (gatilho de viewport)
- Precedente (imutável): `docs/plans/ai-chat-sollinha.md`; irmão: `docs/plans/largura-padrao-chat-sollinha.md` (B166)
