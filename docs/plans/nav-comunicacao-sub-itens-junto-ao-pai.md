# Navegação: os sub-itens de Comunicação ficam junto do pai

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1106
Priority: P3
Impeccable: B — encaixe na navegação da campanha (sidebar desktop + drawer overflow mobile)
Design UI: docs/plans/nav-comunicacao-sub-itens-junto-ao-pai-ui-design.html
Appetite: ~0,25–0,5 dia eng; um outcome verificável: numa olhada, "Acervo de falas" e "Biblioteca de cortes" se leem como filhos de "Comunicação", não como destinos distantes.
Responsável: —

## Intenção

O C174 aninhou os dois destinos da vertical de comunicação sob "Comunicação", mas a associação visual ficou fraca: "Acervo de falas" e "Biblioteca de cortes" aparecem como entradas soltas em vez de filhos do pai, e a assessoria perde a hierarquia que o aninhamento queria criar. O agravante é que os dois consumidores — sidebar desktop e drawer overflow mobile — desenham a sub-lista por caminhos diferentes (um usa os primitivos `SidebarMenuSub`, o outro uma indentação própria), então a leitura pode divergir entre telas sem ninguém notar. O pedido é estreito: fazer o par se ler como filho do pai, de forma igual nas duas superfícies, sem mexer em destinos, permissões ou no desenho geral da navegação.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`, coordenação/candidatura) navegando em `/campanha`, muitas vezes no celular, em dia de produção de peça.
- **Job principal:** reconhecer de imediato que "Acervo de falas" e "Biblioteca de cortes" pertencem a "Comunicação".
- **Fluxo desejado:** abre o menu → vê "Comunicação" com seus dois filhos logo abaixo, agrupados, como um bloco → escolhe o destino → o sub-item ativo é apenas o mais específico.
- **Anti-goals de produto:** não é redesenho do rail nem novo nível de menu; não vira organograma de destinos.

### Esboço de fluxo (B)

```text
[menu aberto] → "Comunicação" lê-se como pai com bloco de 2 filhos logo abaixo
→ desktop (sidebar) e mobile (drawer overflow) mostram a MESMA relação
→ toca "Biblioteca de cortes" → só esse sub-item fica ativo (acervo não acende junto)
```

### Design UI (B)

- Design UI (gate): `docs/plans/nav-comunicacao-sub-itens-junto-ao-pai-ui-design.html` — cenas: sidebar desktop (pai + par de filhos, estados ativo/inativo) e drawer overflow mobile (~390px), com a leitura de agrupamento alinhada entre as duas.

## Objetivo e aceite

- O par de sub-itens se lê como **filho do pai**: agrupamento visual claro, indentação e proximidade coerentes com "Comunicação".
- A **mesma leitura** vale no desktop e no drawer mobile.
- O estado ativo do sub-item continua destacando **só o mais específico** (`activeCampaignSubItemHref`).
- **Nenhum destino some, muda de href ou ganha ícone.**
- **Guardrails:** não renomear rotas/hrefs; não mudar permissões (`communicator`/staff); não introduzir segundo nível além do existente; não redesenhar a navegação inteira.

## Dados (intenção)

- **Vou apresentar dados?** Não — é navegação; nenhum número ou agregado é exibido.
- **Decisões desbloqueadas:** a assessoria decide rápido em qual destino da vertical entrar, sem procurar o que já está sob o pai.
- **Forma:** _adiada ao plano de implementação_ — restrição: sem badges/contadores novos.

## Dados da decisão (literais)

- Destinos e títulos exatos (inalterados): **"Acervo de falas"** → `CAMPAIGN_COMMUNICATION_ACERVO` (`/campanha/comunicacao/acervo`); **"Biblioteca de cortes"** → `CAMPAIGN_COMMUNICATION_CORTES` (`/campanha/comunicacao/acervo/cortes`).
- Pai: **"Comunicação"** → `CAMPAIGN_COMMUNICATION_HOME` (`/campanha/comunicacao`).
- O drawer mobile hoje usa indentação própria (`ml-5 border-l pl-3`); o desktop usa `SidebarMenuSub` (`mx-3.5 border-l px-2.5`). O item decide se os dois **convergem para uma leitura só**.
- Fonte única dos títulos/hrefs: `communicationSubItems` em `src/components/campaign/shell/nav.ts` — não duplicar a lista.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/nav.ts` (fonte única), `CampaignSidebar.tsx` (desktop), `CampaignBottomNav.tsx` (drawer), `src/components/ui/Sidebar.tsx` (classes base), `src/lib/campaignPaths.ts`.
- **Precedente a olhar:** C174 em [`acervo-encontrar-cortes.md`](acervo-encontrar-cortes.md) — foi quem introduziu o aninhamento e o comentário "mesma forma nas duas superfícies".
- **Risco de acoplamento:** não regredir o `activeCampaignSubItemHref` (irmãos com prefixo compartilhado); o "como" converge aqui.

## Dependências

- C174 (entregue — introduziu o aninhamento).

## Fora de escopo

- Mudar a ordem dos destinos; novo item de navegação; badges/contadores; redesenho do rail; qualquer mudança em rotas, permissões ou ícones.

## Rabbit holes de produto

- **"Já que vamos mexer, agrupa tudo por seções."** Se alguém "só completar": segundo nível novo, recolhimento por grupo, reordenação. **Corte neste item:** só a relação pai↔filhos existente fica legível.
- **"Faz o rail inteiro colapsável com animação."** Se alguém "só completar": redesenho do shell. **Corte neste item:** encaixe local no desenho atual.
- **"Alinha desktop e mobile reescrevendo o drawer com os primitivos."** Se alguém "só completar": troca estrutural do drawer. **Corte neste item:** a decisão é de leitura; o caminho técnico é da implementação.

## Questões em aberto (produto)

- **Como aproximar?** **Opções:** A) só espaçamento/indentação no desenho atual | B) usar os primitivos shadcn também no drawer. **Recomendação:** garantir a hierarquia legível **nos dois**; o "como" fica na implementação. _(assumido — validar com produto)_
- **O sub-item ativo ganha marcador extra?** **Opções:** A) manter o padrão atual | B) adicionar marcador. **Recomendação:** A — manter o padrão atual. _(assumido)_

## Referências

- GitHub Issue: — (a registrar)
- Design UI (gate): `docs/plans/nav-comunicacao-sub-itens-junto-ao-pai-ui-design.html`
- Planos irmãos: [`acervo-encontrar-cortes.md`](acervo-encontrar-cortes.md) (C174), [`remodelagem-municipios.md`](remodelagem-municipios.md) (nav), [`acervo-cortes-divida-pos-c174.md`](acervo-cortes-divida-pos-c174.md) (defer da sub-lista duplicada).
- Arquivos-chave (pista, não contrato): `src/components/campaign/shell/nav.ts`, `src/components/campaign/shell/CampaignSidebar.tsx`, `src/components/campaign/shell/CampaignBottomNav.tsx`, `src/components/ui/Sidebar.tsx`, `src/lib/campaignPaths.ts`
- Testes a olhar: `tests/unit/campaignNav.unit.spec.ts`, `tests/e2e/campaignBottomNav.e2e.spec.ts`
- `AGENTS.md` / `AGENTS-campaign.md` — shell da campanha e convenções de navegação.

## Self-score (shaping)

4/5 — (1) fatia = um outcome verificável (o par se lê como filho do pai, igual nas duas superfícies); (2) appetite de ~0,25–0,5 dia comporta um encaixe de navegação; (3) persona, job e aceite em linguagem de produto; (4) direção no codebase é hipótese revisável; (5) zero decisão dura de engenharia — o "como" (espaçamento vs primitivos) fica explicitamente para a implementação.
