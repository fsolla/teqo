# Ações rápidas — grade 3×2 (Início + FAB) e polimento do overlay

Status: aprovado (gate 2026-08-02)
Atualizado em: 2026-08-02
Issue: #280
Priority: P1
Model: composer-2.5
Impeccable: B — chrome de ações no Início + overlay do FAB (`CampaignQuickActionsOverlay`)
Appetite: ~0,5–1 dia eng; um ritual visual + polimento do overlay; sem migration
Responsável: —

## Intenção

No Início mobile as ações rápidas ainda aparecem em **3 linhas × 2 colunas** (B122). Na prática isso alonga demais a região de launchers; o desejo agora é **2 linhas × 3 colunas** — todas as 6 ações staff visíveis de uma vez, mais baixas.

Fora do Início, o FAB (B126) abre um overlay que ainda monta a **strip horizontal com scroll** (`variant="strip"`). Queremos o **mesmo grid** do Início aí, e **deprecar** o scroller de ações nesse overlay.

Além disso o drawer do FAB parece com **altura fixa** (não acompanha o conteúdo); no modo busca (ações recolhidas) a barra cola no topo sem respiro; e ao navegar o texto da busca **persiste** — deveria limpar.

## Persona e fluxo

- **Persona / contexto:** CG/assessor (e liderança onde o catálogo já existe) no celular — Início e páginas internas; polegar na thumb zone.
- **Job principal:** ver/disparar as mesmas ações rápidas sem pan horizontal e sem um drawer “vazio” no meio da tela; buscar e sair limpo.
- **Fluxo desejado:**
  1. No Início mobile: grade **3 colunas × 2 linhas** (6 ações staff); liderança (poucas ações) cabe sem inventar layout paralelo.
  2. Em outra rota: toca FAB → overlay com **a mesma grade** + busca (ritual espelhado do Início); **sem** faixa horizontal scrollável de ações.
  3. Foca a busca → ações somem (já esperado); a busca sobe com **espaço mínimo** até o topo do drawer.
  4. Navega (ação, hit, ou muda de rota) → campo de busca do overlay **volta vazio**.
  5. Drawer/modal **encaixa na altura do conteúdo** (idle = grade+busca; busca focada = só busca+resultados), sem “caixa alta” vazia.
- **Anti-goals de produto:** redesenhar catálogo/labels; recriar snap/peek do drawer antigo; FAB no Início; spreadsheet; segundo inventário de ações.

### Esboço de fluxo (B)

```text
[Início mobile]
  → vê grade 3×2 (sem scroll H)
  → toca ação → wizard/lista

[página ≠ Início]
  → FAB → overlay
      idle: [grade 3×2] + [busca]
      busca focada: [espaço topo] + [busca…]  (ações ocultas)
  → navega / fecha → query limpa; altura = conteúdo
```

## Objetivo e aceite

- Início **&lt; md**: ações em grade **3 colunas × 2 linhas** (revisão explícita de B122, que fixou 2×3).
- Overlay do FAB (mobile drawer e desktop dialog): **mesma grade** de ações que o Início mobile; **strip scroller de ações deprecada** nessa superfície.
- Altura do drawer do FAB **responde ao conteúdo** (não parece uma folha de altura fixa ociosa). Hipótese de produto: se o kit `Drawer` foi esticado pelo drawer persistente antigo, voltar o suficiente ao comportamento default do shadcn/Base UI **sem** quebrar outros drawers.
- Com busca focada no overlay: **respiro** entre o topo do drawer e a barra de busca (hoje cola).
- Ao **navegar** (mudança de rota) **ou fechar** o overlay: o texto da busca **limpa**.
- Início **`md+`:** strip horizontal inalterada (decisão de gate).
- Catálogos, lockdown de liderança e busca em si **inalterados** em conteúdo/ranking.
- Sem migration / Consent / RBAC.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — chrome de launcher/navegação
- **Forma:** _adiada_ — N/A

Dados: N/A — atalho de intenção; hits e ações já existem.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `CampaignHomeActionStrip` / `CampaignHomeActionButton` (variante/grid), `CampaignHomeActions`, `CampaignQuickActionsOverlay` (+ FAB/host), talvez `src/components/ui/Drawer.tsx` se overrides de altura forem o culpado; estado de busca em `HomeSearchContext` / `useHomeSearchQuery` (já tem `clear`).
- **Precedente a olhar:** B122 (`inicio-acoes-grid-2x3-mobile` — decisão a **revisar**); B126 (`fab-acoes-rapidas-substituir-drawer` — overlay sob demanda); B115 (#198) fechada no gate (strip bleed obsoleta).
- **Risco de acoplamento:** não reabrir snap/peek; não mudar registry B80–B90; outros usos de `Drawer` (PWA, long-press, etc.) não podem regressar.

## Dependências

- Soft: B122 ✓ e B126 ✓ (já em prod) — este item polisce/revisa o resultado.
- Soft: B115 (#198) — **fechada no gate** como obsoleta (strip mobile/overlay depreciada).

## Fora de escopo

- Novas ações / novo catálogo / ordem thumb-zone.
- Redesign visual dos ícones/labels.
- Geo/ranking da busca.
- Bottom nav / sidebar.
- Polir o drawer **persistente** antigo (já saiu com B126).

## Rabbit holes de produto

- **Unificar Início no FAB.** **Corte:** Início continua inline; FAB só fora.
- **Recriar snap points “para a altura certa”.** **Corte:** altura = conteúdo / default do kit; aberto/fechado só.
- **Extrair tile genérico wizard+home+FAB.** **Corte:** reusar o dono da strip/grade; sem terceiro primitivo.

## Decisões do gate (2026-08-02)

- **Início `md+`:** mantém strip horizontal; grade **3×2** só em &lt; md e no overlay do FAB.
- **Limpar busca:** em mudança de rota **e** ao fechar o overlay.
- **B115** (#198): **fechar** no gate — obsoleta com a depreciação da strip no mobile/overlay; `md+` não justifica manter a Issue aberta.

## Questões em aberto (produto)

Nenhuma — gate fechado.

## Referências

- GitHub Issue #280
- B122 #249 · B126 #260 · B115 #198 (fechada no gate)
- `CampaignHomeActionStrip.tsx` · `CampaignQuickActionsOverlay.tsx` · `Drawer.tsx` · `useHomeSearchQuery.ts`
- `docs/plans/fab-acoes-rapidas-substituir-drawer.md` · plano B122 no histórico
