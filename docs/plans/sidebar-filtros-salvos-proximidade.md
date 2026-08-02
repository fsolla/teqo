# B124 — Sidebar Municípios: filtros salvos colados (sem disclosure)

Status: registrado
Atualizado em: 2026-08-02
Issue: #253
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe em `CampaignSidebar` / `MunicipalityNavSavedFilters` (hierarquia visual + proximidade; sem rota nova)
Appetite: ~0,5 dia eng; um outcome verificável (atalhos leem como filhos de Municípios, não como seção própria)
Responsável: —

## Intenção

Os atalhos de filtro salvo sob **Municípios** no sidebar de `/campanha` hoje parecem um bloco afastado — hierarquia fraca e distância vertical grande. Quem está na mesa só enxerga o que está na tela: os recortes precisam aparecer **sempre** (quando existem), **logo abaixo** de Municípios, com indentação clara de filho — sem chevron, sem abrir/fechar, sem hover.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor na mesa; scan da sidebar sob pressão
- **Job principal:** ver e clicar um recorte salvo como continuação natural de Municípios
- **Fluxo desejado:**
  1. Há filtros salvos → lista aparece sempre, imediatamente sob Municípios
  2. Indentação horizontal marca “isto é filho de Municípios”
  3. Gap vertical mínimo entre Municípios e o primeiro atalho (hoje está longe demais)
  4. Sem filtros → nada extra (só o item Municípios)
- **Anti-goals de produto:** disclosure/collapse/hover; redesign do shell; filtros salvos em outras listas; sync multi-device

### Esboço de fluxo (B)

```text
[Municípios]
  [filtro A]   ← sempre visível se existir; indentado; colado
  [filtro B]
[Territórios]
```

## Objetivo e aceite

- Com filtros salvos, os links ficam **sempre visíveis** (sem toggle, sem estado open/closed, sem persistência de disclosure)
- Visualmente são **filhos** de Municípios: um pouco mais para dentro na horizontal
- Ficam **logo abaixo** do item Municípios (proximidade vertical — deixam de ler como seção própria)
- Apagar + Desfazer e o restante do bookmark (B18) continuam intactos
- Teclado/leitor: lista nomeada; item ativo com `aria-current`; sem controles de expand órfãos

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** N/A — navegação, não métrica
- **Forma:** _adiada ao plano de implementação_

## Direção no codebase (hipótese)

- **Áreas prováveis:** `MunicipalityNavSavedFilters.tsx` (remover disclosure), `CampaignSidebar.tsx`, storage de open em `municipalitySavedFilters.ts` (chave/API de open provavelmente vira morta), e2e `campaignSavedFilters.e2e.spec.ts`
- **Precedente a olhar:** `docs/plans/filtros-salvos-municipios.md` (B18) — este item **desfaz** a decisão de chevron + open persistido
- **Risco de acoplamento:** sidebar no layout `(app)` — não puxar serializador de URL de município; manter `listQueryMatch` puro

## Dependências

- Nenhuma (B18 já entregue)

## Fora de escopo

- Salvar filtros em outras listas
- Preferências de nav no servidor
- Redesign amplo do sidebar (só proximidade + indentação deste submenu)
- Mudar teto de 12 ou ordem alfabética
- Collapse / hover / open contextual

## Rabbit holes de produto

- **Reintroduzir disclosure “só um pouquinho”.** Compete com “o que está na tela”. **Corte:** zero open/close neste item.
- **Lista longa (até 12) empurrando o resto da nav.** Aceito neste appetite: bookmarks são atalho de mesa. **Corte:** não inventar “mostrar só 4 + mais” sem evidência nova.

## Questões em aberto (produto)

- Nenhuma — gate 2026-08-02: **sem** rótulo “Filtros salvos” (ou semelhante); **sem** chevron; lista sempre visível com indentação + proximidade vertical.

## Referências

- GitHub Issue #253
- Critique Impeccable 2026-08-02 — pivô de produto: drop collapse; always-on + proximity
- `docs/plans/filtros-salvos-municipios.md` (B18)
- `src/components/campaign/shell/MunicipalityNavSavedFilters.tsx`
- `src/components/campaign/shell/CampaignSidebar.tsx`
