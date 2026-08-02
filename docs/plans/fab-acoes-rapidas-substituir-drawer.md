# FAB de ações rápidas (substituir bottom drawer persistente)

Status: aprovado (gate 2026-08-02)
Atualizado em: 2026-08-02
Issue: #260
Priority: P1
Model: composer-2.5
Impeccable: C — chrome novo em toda rota `(app)` exceto Início e wizards `/campanha/acoes/*`
Appetite: ~1–1,5 dia eng; um outcome: drawer persistente fora, FAB → overlay sob demanda
Responsável: —

## Intenção

O bottom drawer não-modal de ações rápidas (B79 → B91 → B100/B105/B109/B112…) cobre demais o conteúdo e virou um poço de polimento (snap, scroll, peek, fullscreen de busca) que agentes sozinhos não fecham a tempo. Em vez de mais uma rodada no drawer, **mudamos o ritual**: um botão flutuante discreto abre ações + busca só quando a pessoa pede — em qualquer proporção de tela — e some no Início, onde o mesmo ritual já está na página.

Isto **reverte** a decisão explícita de B79 que rejeitava FAB e drawer em `md+`: a evidência de uso/custo de refinamento mandou.

## Persona e fluxo

- **Persona / contexto:** staff (e liderança onde o catálogo já existe) fora do Início — lista, detalhe, mapa — quer disparar uma ação ou buscar sem perder o contexto da página e sem uma faixa permanente ocupando o viewport.
- **Job principal:** em um toque, chegar às ações rápidas do contexto + busca geral; em outro, fechar e voltar ao conteúdo intacto.
- **Fluxo desejado:**
  1. Em qualquer rota `(app)` que não seja o Início nem wizard (`/campanha/acoes/*`), vê um FAB de ações rápidas (todas as larguras); ações = catálogo contextual da rota.
  2. Toca o FAB → abre overlay:
     - **Desktop/tablet:** modal com busca no topo e grade/strip de ações abaixo (mesmo ritual do Início nessas larguras).
     - **Mobile:** drawer modal com grade de ações em cima e busca ancorada embaixo (mesmo ritual do Início mobile).
  3. Escolhe ação ou hit de busca → navega / abre wizard; ou fecha o overlay e continua na página.
- **Anti-goals de produto:** recriar snap/peek/dock/scroll-coupling; segunda bottom nav; FAB no Início; redesenhar o catálogo de ações ou a busca em si; spreadsheet / chrome paralelo ao sidebar.

### Esboço de fluxo (C)

```text
[página ≠ Início]
  → vê FAB (canto; não cobre o fluxo principal)
  → toca FAB
  → [md+] modal: [busca] / [ações]
     [mobile] drawer: [ações] / [busca embaixo]
  → toca ação ou resultado  →  outcome (lista/detalhe/wizard)
  → ou fecha overlay       →  página intacta, sem peek residual
```

## Objetivo e aceite

- O drawer persistente não-modal de ações rápidas **não aparece mais** em nenhuma rota (sem faixa inferior permanente, sem padding de peek acoplado ao scroll).
- Em rotas elegíveis (não-Início; ver questões), um **FAB** está disponível em **todas** as larguras de viewport.
- Abrir o FAB mostra **ações + busca** no layout espelhado do Início por breakpoint (busca em cima no desktop/tablet; busca embaixo no mobile).
- Fechar o overlay devolve a página sem chrome residual (sem snap state, sem peek).
- Complexidade só necessária ao drawer antigo (snap points, dock no scroll, `modal={false}` sempre aberto) **sai** desta superfície; se o `Drawer` compartilhado ficou inchado só por esse uso, o executor deve **simplificar de volta** ao suficiente do kit — sem quebrar outros usos (PWA install, notificações, etc.).
- Catálogos / registry / lockdown de liderança **continuam** a valer (não é um segundo inventário de ações).
- Sem migration, sem Consent, sem mudança de RBAC.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — chrome de ação/navegação
- **Forma:** _adiada_ — N/A

Dados: N/A — atalho de intenção; hits de busca e ações já existem.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/` (`CampaignQuickActionsHost`, `CampaignQuickActionsDrawer`, snap context), layout `(app)` / `CampaignAppScrollChrome`, mount gate em `src/lib/campaignQuickActionMount.ts`, primitivo `src/components/ui/Drawer.tsx` (só o que for exclusivo do uso antigo), `Dialog`/`dialog.tsx` para o overlay desktop/tablet; reuso da strip/busca do Início (`CampaignHomeActionStrip`, `CampaignGlobalSearch*`).
- **Precedente a olhar:** `docs/plans/chassis-bottom-drawer-acoes-rapidas.md` (B79 — decisão antiga a reverter); Início mobile grade 2×3 (B122); Issues abertas de crash/polimento do drawer (#133, #135) como candidatas a supersede.
- **Risco de acoplamento:** não mexer no conteúdo dos catálogos B80–B90 nem na busca em si; leader lockdown; wizards `/campanha/acoes/*` têm chrome próprio — FAB não deve competir com eles se o gate confirmar exclusão.

## Dependências

- Nenhuma dura. Soft: B125 (geo na busca) é independente; este item só muda _como_ a busca abre fora do Início.

## Fora de escopo

- Redesign do Início (já tem o ritual inline).
- Novas ações no catálogo / novos providers.
- Mudança de ranking/geo da busca (B125).
- Polimento fino “até ficar perfeito” do drawer antigo — ele sai.
- Bottom nav estrutural (já removida em B73).

## Rabbit holes de produto

- **Recriar o drawer com outros nomes.** Se alguém “só completar”: snap + peek + scroll de novo. **Corte neste item:** overlay sob demanda, aberto/fechado; sem estados intermediários de chrome.
- **Unificar Início no mesmo FAB.** **Corte:** Início permanece inline; FAB só fora.
- **Redesenhar o kit Drawer inteiro “no geral”.** **Corte:** só remover o que o uso antigo forçou e que nenhum outro consumidor precisa; não abrir refactor cosmética do design system.

## Questões em aberto (produto)

- **FAB também some em `/campanha/acoes/*` (wizards)?** **Decisão (gate):** sim — como o drawer atual; wizard já é o ritual de ação.
- **Conteúdo das ações: contextual ou cópia do Início?** **Decisão (gate):** contextual (registry por rota) — muda o chrome, não o catálogo.
- **#133 / #135 (miss do crash da busca no drawer):** fix já em prod via B102 (#129). **Decisão (gate):** fechar agora como obsoletas (superfície some / já resolvido). B79 (#15) permanece fora deste fechamento.

## Referências

- GitHub Issue #260
- `src/components/campaign/shell/CampaignQuickActionsDrawer.tsx`
- `src/components/campaign/shell/CampaignQuickActionsHost.tsx`
- `src/lib/campaignQuickActionMount.ts`
- `docs/plans/chassis-bottom-drawer-acoes-rapidas.md` (B79)
- Início: `src/app/(campaign)/campanha/(app)/page.tsx` + strip/busca do dashboard
- Misses fechadas no gate: #133, #135 (fix já em #129 / B102)
