# Sidebar — entrada para Organizações

Status: registrado
Atualizado em: 2026-08-02
Issue: #313
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe no shell da sidebar (mesmo padrão dos demais destinos staff)
Appetite: ~0,25 dia eng; um item de navegação; sem migration
Responsável: —

## Intenção

A lista de organizações **já existe** em `/campanha/organizacoes` (lista, detalhe, nova, ações rápidas, omnibox). Agentes e docs falavam dela como se fosse descoberta pela sidebar — e não é: `staffNav` omite o destino. Staff que não cai na busca global / FAB / link cruzado simplesmente não acha a vertical. Pedido: se a lista existe, ela precisa de item na sidebar.

## Persona e fluxo

- **Persona / contexto:** coordenador / assessor / candidato na mesa, navegando o shell de `/campanha`
- **Job principal:** ir à lista de organizações pelo mesmo caminho que usa para Lideranças, Demandas, etc.
- **Fluxo desejado:** abre a sidebar (desktop ou Sheet mobile) → vê **Organizações** entre os destinos de trabalho → toca → chega em `/campanha/organizacoes`
- **Anti-goals de produto:** não redesenhar a sidebar; não inventar segunda lista; não expor o destino a liderança (lockdown)

### Esboço de fluxo (B)

```text
[sidebar staff] → toca "Organizações" → [/campanha/organizacoes] → lista que já existe
```

## Objetivo e aceite

- Item **Organizações** visível na navegação estrutural staff (sidebar desktop + Sheet mobile que consome o mesmo `getCampaignNav`)
- Href aponta para a lista existente `/campanha/organizacoes`
- Liderança **não** vê o item (mesma barreira de staff-only das outras verticais de trabalho)
- Destino ativo quando a pessoa está na lista, no detalhe ou em `/nova` (mesmo contrato `isCampaignNavActive` dos demais itens)

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — só descoberta de uma superfície que já existe
- **Forma:** *adiada* — N/A

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/nav.ts` (`staffNav` / `getCampaignNav`); consumidores já existentes (`CampaignSidebar`, Sheet mobile)
- **Precedente a olhar:** demais entradas de `staffNav`; path canônico já em `campaignQuickActionPaths` (`ORGANIZATIONS_LIST_PATH`); nota histórica em `docs/plans/acoes-rapidas-organizacoes.md` (“fora do staffNav… rota existe”)
- **Risco de acoplamento:** leader lockdown; não puxar lógica de acesso nova além do filtro staff já usado pelo nav

## Dependências

- Nenhuma (a rota e o access staff já existem)

## Fora de escopo

- Mudanças na lista / filtros / omnibox de organizações (B139 e afins)
- Ações rápidas, FAB, busca global
- Reordenar o resto da sidebar além do encaixe deste item
- Entrada em `staffSecondaryNav` (Conceitos) — isto é destino de trabalho, não material de referência

## Rabbit holes de produto

- **“Já que vamos mexer na nav…”.** Se alguém “só completar”: redesign de grupos, ícones de tudo, bottom-nav. **Corte neste item:** um item, um href, mesma máquina.
- **Escopo por assessor na nav.** Access de linha já filtra a lista; a nav não precisa de predicado especial (Lideranças também não tem).

## Questões em aberto (produto)

- **Onde na ordem da `staffNav`?** **Opções:** A) logo após Lideranças (afinidade de domínio — orgs ↔ lideranças) | B) após Dobradinhas | C) perto do fim, antes de Apoiadores. **Recomendação:** **A** — espelha o modelo mental “pessoas e estruturas de apoio”. _(assumido — validar)_

## Referências

- GitHub Issue #313
- `src/components/campaign/shell/nav.ts`
- `src/app/(campaign)/campanha/(app)/organizacoes/`
- `src/lib/campaignQuickActionPaths.ts` (`ORGANIZATIONS_LIST_PATH`)
- `docs/plans/acoes-rapidas-organizacoes.md` (B88 — já documentava a lacuna)
