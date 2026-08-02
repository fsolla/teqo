# Sidebar /campanha — sem logo nem chip de escopo no topo

Status: rascunho
Atualizado em: 2026-08-02
Issue: #271
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe no shell da sidebar (`CampaignSidebar`)
Appetite: ~0,5 dia eng; remoção de chrome + alinhamento visual
Responsável: —

## Intenção

No topo da sidebar de `/campanha`, o logo e o chip de escopo (ícone de olho + papel, ex. “Coordenador Geral”) não ajudam a navegar: o papel já está no perfil/avatar do rodapé, e o logo não informa onde o usuário está. Além disso, a faixa do logo desalinha verticalmente a sidebar em relação ao header da área de conteúdo. Remover os dois deixa a navegação começar limpa e alinhada.

**Direção de produto (mais longa):** o chip de escopo tende a sumir de `/campanha` por completo noutro dia — **não neste item**. Este issue é só o chrome da sidebar.

## Persona e fluxo

- **Persona / contexto:** staff (coordenador, candidato, assessor) e liderança usando a shell diária — mesa ou mobile Sheet; foco em achar a próxima rota, não em branding.
- **Job principal:** entrar na área certa sem chrome que empurra ou repete o papel no topo da nav.
- **Fluxo desejado:** abre `/campanha` (ou Sheet no mobile) → o primeiro bloco útil é a lista de itens de navegação (e filtros salvos de Municípios, quando houver) → sem logo acima nem badge de papel acima dos itens.
- **Anti-goals de produto:** não redesenhar a sidebar inteira; não tirar identidade da tela de login; não limpar chips de escopo das páginas de conteúdo neste item (intenção futura, issue à parte).

## Objetivo e aceite

- O topo da sidebar (desktop e Sheet mobile) **não** mostra o logo da campanha; o bloco de header some → a lista de itens começa no topo (**decisão A**).
- O topo da lista de itens da sidebar **não** mostra o badge de escopo/papel (olho + “Coordenador Geral” / variantes por role).
- A faixa superior da sidebar deixa de empurrar o conteúdo: o início da navegação alinha-se de forma coerente com o header da área principal (sem “degrau” causado pelo logo).
- Papel do usuário continua acessível onde já vive (rodapé / perfil) — não some a noção de quem está logado.
- Login e shells de autenticação **mantêm** o logo.
- Chips de escopo em headers de página (municípios, apoiadores, …) **permanecem** neste item.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — chrome de navegação, sem métrica
- **Forma:** _adiada ao plano de implementação_
- Dados: N/A — remoção de UI estrutural, sem KPI/mapa

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/CampaignSidebar.tsx` (header com logo + `CampaignScopeBadge` acima do menu); `campaign-logo` permanece para auth (`CampaignAuthPageShell`); o componente `CampaignScopeBadge` segue vivo para as páginas
- **Precedente a olhar:** B118 (listas mobile sem título/chip de escopo) — superfície **diferente** (página de lista, não sidebar)
- **Risco de acoplamento:** não tocar call sites de `CampaignScopeBadge` fora da sidebar; respeitar leader lockdown / nav por role já existentes

## Dependências

- Nenhuma

## Fora de escopo

- Remover chips de escopo no **conteúdo** das listas/detalhes (intenção futura app-wide — issue à parte quando produto pedir)
- Redesign do rodapé da sidebar, avatar, logout ou nav secundária
- Trocar branding / favicon / PWA icons
- Colapsar/expandir sidebar (já coberto por outros planos, ex. tablet)

## Rabbit holes de produto

- **“Já que o chip vai sumir de tudo…”.** Se alguém “só completar”: limpar municípios/apoiadores e apagar `CampaignScopeBadge`. **Corte neste item:** só logo + badge no topo da sidebar.
- **Substituir o logo por outro branding.** **Corte:** remoção do header, sem peça nova no topo.

## Questões em aberto (produto)

- _(resolvidas no gate)_ Header após logo: **A** — bloco some, nav cola no topo. Escopo deste issue: **só sidebar**; remoção app-wide do chip = intenção futura, não aceite deste item.

## Referências

- GitHub Issue #271
- `src/components/campaign/shell/CampaignSidebar.tsx`
- `src/components/campaign/shared/CampaignScopeBadge.tsx` (permanece — usado fora da sidebar)
- `src/components/campaign/auth/CampaignAuthPageShell.tsx` (logo permanece)
- B118 / listas mobile sem chip — não confundir superfície
