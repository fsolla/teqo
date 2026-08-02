# Sidebar /campanha — sem logo; chips de escopo fora de /campanha

Status: rascunho
Atualizado em: 2026-08-02
Issue: #271
Priority: P2
Model: composer-2.5
Impeccable: B — shell da sidebar + headers de páginas que ainda mostram chip de escopo
Appetite: ~0,5–1 dia eng; remoção de chrome + alinhamento visual
Responsável: —

## Intenção

No topo da sidebar de `/campanha`, o logo e o chip de escopo (ícone de olho + papel, ex. “Coordenador Geral”) não ajudam a navegar: o papel já está no perfil/avatar do rodapé, e o logo não informa onde o usuário está. A faixa do logo ainda desalinha a sidebar em relação ao header da área de conteúdo.

O mesmo chip de escopo (olho + papel/carteira) aparece também em headers de páginas (municípios, apoiadores, …) e repete informação sem desbloquear decisão. Produto decidiu: **sumir com esse chip em qualquer superfície de `/campanha`**, não só na sidebar.

## Persona e fluxo

- **Persona / contexto:** staff (coordenador, candidato, assessor) e liderança na shell diária — mesa ou mobile Sheet.
- **Job principal:** navegar e ler a página sem chrome de escopo/papel; entrar na rota certa sem degrau visual no topo da sidebar.
- **Fluxo desejado:**
  1. Abre `/campanha` (ou Sheet) → navegação começa no topo, sem logo e sem badge de papel.
  2. Abre qualquer lista/detalhe que hoje mostra o chip de escopo → o header da página **não** exibe olho + papel/carteira.
- **Anti-goals de produto:** não redesenhar a sidebar inteira; não tirar o logo da tela de login; não confundir este chip com outros badges (tipo de município, “Nossa campanha” na comparação, etc.).

## Objetivo e aceite

- O topo da sidebar (desktop e Sheet mobile) **não** mostra o logo; o bloco de header some → a lista de itens começa no topo (**decisão A**).
- Em **nenhuma** superfície de `/campanha` aparece o chip de escopo de papel/carteira (olho + “Coordenador Geral” / variantes por role ou “Importação · …”).
- Sem “degrau” vertical entre sidebar e header da área principal causado pelo logo.
- Papel do usuário continua acessível no rodapé / perfil.
- Login e shells de autenticação **mantêm** o logo.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — chrome estrutural, sem métrica
- **Forma:** *adiada ao plano de implementação*
- Dados: N/A — remoção de UI, sem KPI/mapa

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/CampaignSidebar.tsx` (remover `SidebarHeader` + logo + badge); call sites de `CampaignScopeBadge` em rotas `/campanha` (ex. municípios, apoiadores e subpáginas); limpeza do componente/helpers órfãos se sobrarem só para esse chip; `campaign-logo` permanece em `CampaignAuthPageShell`
- **Precedente a olhar:** B118 (listas mobile sem título/chip) — já escondeu parte no mobile; este item **completa** a remoção do chip de escopo em todo lugar
- **Risco de acoplamento:** não reestilizar badges que só reutilizam a variante visual `scope` para **outro** significado (kind do município, marcador “Nossa campanha” na comparação); leader lockdown / nav por role intactos

## Dependências

- Nenhuma

## Fora de escopo

- Redesign do rodapé da sidebar, avatar, logout ou nav secundária
- Trocar branding / favicon / PWA icons
- Colapsar/expandir sidebar (outros planos)
- Remover ou redesenhar badges que **não** são o chip de escopo/papel (ex. kind do município, “Nossa campanha” na tabela de comparação) — a menos que o executor veja que só existiam como twin visual do mesmo padrão e produto confirme

## Rabbit holes de produto

- **Apagar todo `Badge variant="scope"`.** Se alguém “só completar”: some marcadores de kind/referência que não são o chip de papel. **Corte neste item:** alvo = chip de escopo/papel (olho + role/carteira / copy de importação), tipicamente `CampaignScopeBadge`.
- **Substituir o logo por outro branding no topo.** **Corte:** remoção do header, sem peça nova.

## Questões em aberto (produto)

- _(resolvidas no gate)_ Header após logo: **A** — bloco some, nav cola no topo. Chips de escopo: **em lugar algum** em `/campanha`.

## Referências

- GitHub Issue #271
- `src/components/campaign/shell/CampaignSidebar.tsx`
- `src/components/campaign/shared/CampaignScopeBadge.tsx` e call sites em `src/app/(campaign)/campanha/(app)/…`
- `src/components/campaign/auth/CampaignAuthPageShell.tsx` (logo permanece)
- B118 — listas mobile; este item amplia a remoção do chip
