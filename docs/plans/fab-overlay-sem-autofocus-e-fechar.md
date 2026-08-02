# FAB — overlay abre sem foco na busca; fechar não cobre o campo

Status: aprovado (gate 2026-08-02)
Atualizado em: 2026-08-02
Issue: #317
Priority: P1
Model: composer-2.5
Impeccable: B — polimento do chrome já existente (`CampaignQuickActionsOverlay` / dialog do FAB)
Appetite: ~0,5 dia eng; um outcome: abrir FAB mostra ações; fechar e busca não se sobrepõem
Responsável: —

## Intenção

Ao tocar o FAB de ações rápidas, o overlay abre **já com a busca focada**. Como o ritual atual esconde/recolhe as ações quando a busca tem foco, a pessoa **não vê as ações rápidas** — exatamente o que veio buscar no FAB. Além disso, no overlay em dialog (desktop/tablet), o botão de fechar fica **por cima da barra de busca**, atrapalhando leitura e toque.

Queremos: abrir = ações visíveis (idle); buscar só quando a pessoa foca/toca a busca; fechar sempre acessível e sem cobrir o campo.

## Persona e fluxo

- **Persona / contexto:** staff (e liderança onde o catálogo existe) fora do Início — lista/detalhe — polegar ou mouse; quer disparar uma ação rápida em um toque.
- **Job principal:** ao abrir o FAB, ver e usar as ações do contexto sem o overlay “pular” para modo busca.
- **Fluxo desejado:**
  1. Toca o FAB → overlay abre em estado **idle**: grade/ações visíveis + busca **sem foco**.
  2. Se quiser buscar, toca/foca a busca → aí sim o comportamento atual de recolhimento das ações (já esperado desde B132).
  3. **Desktop/tablet (dialog):** controle de **fechar (X)** visível e **sem sobrepor** a barra de busca.
  4. **Mobile (drawer):** **sem X**; handle de swipe no topo (padrão de drawer) + fechar por gesto/fora — o handle hoje não aparece no overlay do FAB (`showSwipeHandle` default off).
  5. Fecha → volta à página; busca limpa como já combinado.
- **Anti-goals de produto:** redesenhar catálogo/labels; recriar snap/peek do drawer antigo; mudar ranking da busca; FAB no Início; segundo inventário de ações.

### Esboço de fluxo (B)

```text
[página ≠ Início]
  → toca FAB
  → overlay IDLE: [ações visíveis] + [busca sem foco]
       md+: [X sem overlap na busca]
       mobile: [handle] (sem X)
  → (opcional) toca busca → ações recolhem (ritual atual)
  → ação / hit / fecha → outcome ou página intacta
```

## Objetivo e aceite

- Abrir o overlay do FAB **não** coloca foco automático na busca (nem teclado mobile “sobe” só por abrir) — **mobile e desktop**.
- No estado inicial após abrir, as **ações rápidas estão visíveis** (não recolhidas por foco implícito).
- **Desktop/tablet:** o **X** de fechar não sobrepõe a barra de busca; hit target utilizável.
- **Mobile:** **sem botão X**; o drawer do FAB mostra o **handle** de swipe (padrão do kit; hoje o overlay não liga `showSwipeHandle`).
- O recolhimento das ações ao **focar/interagir de propósito** com a busca permanece (comportamento de produto já aceito em B132).
- Catálogos, lockdown de liderança, limpeza de query ao fechar/navegar e grade de ações **inalterados** em conteúdo.
- Sem migration / Consent / RBAC.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — chrome de launcher
- **Forma:** _adiada_ — N/A

Dados: N/A — atalho de intenção; sem métricas novas.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/CampaignQuickActionsOverlay.tsx` (Dialog desktop + Drawer mobile), primitivo `src/components/ui/dialog.tsx` (close absoluto padrão), `src/components/ui/Drawer.tsx` (`showSwipeHandle` / `DrawerSwipeHandle` — hoje default off e o FAB não liga), superfície de busca reusada (`CampaignGlobalSearch*` / `HomeSearchContext` — foco → `uiFocused` → recolhe ações).
- **Precedente a olhar:** B126 (`fab-acoes-rapidas-substituir-drawer.md`), B132 (`acoes-rapidas-grade-3x2-fab-overlay.md` — foco na busca **recolhe** ações de propósito; este item corrige o foco **indesejado na abertura**).
- **Risco de acoplamento:** não alterar o ritual do Início (busca inline) nem o comportamento “foco = recolhe ações” quando o usuário **escolhe** buscar; não inventar um segundo padrão de close para todos os Dialogs do produto sem necessidade.

## Dependências

- Nenhuma. Soft: B136 (orientação da grade) é independente — este item não depende dela.

## Fora de escopo

- Redesign do Início ou da grade de ações.
- Mudança do conteúdo/ranking da busca global.
- Polimento amplo do kit `Dialog`/`Drawer` além do necessário para esta superfície (ou para um close não sobrepor).
- Novas ações no catálogo.

## Rabbit holes de produto

- **Desligar o recolhimento ao focar.** Se alguém “só completar”: remove o ritual B132. **Corte neste item:** só impedir foco automático na **abertura**; foco deliberado continua recolhendo.
- **Redesenhar o chrome de todos os dialogs.** **Corte:** resolver overlap nesta superfície (ou no mínimo no padrão de close que ela usa), sem campanha de UI kit.

## Questões em aberto (produto)

- *(Resolvidas no gate 2026-08-02.)*
- **Abrir sem foco na busca:** **ambos** (mobile drawer + desktop dialog).
- **Fechar:**
  - **Desktop/tablet:** X explícito **sem** cobrir a busca (offset/faixa — forma no impl).
  - **Mobile:** **sem X**; **com handle** de drawer (ligar o padrão já existente no kit se ainda estiver off neste overlay).

## Referências

- GitHub Issue #317
- `src/components/campaign/shell/CampaignQuickActionsOverlay.tsx`
- `src/components/ui/dialog.tsx` (close absoluto `right-3 top-3`)
- `src/components/ui/Drawer.tsx` (`showSwipeHandle`)
- `docs/plans/fab-acoes-rapidas-substituir-drawer.md` (B126)
- `docs/plans/acoes-rapidas-grade-3x2-fab-overlay.md` (B132)
