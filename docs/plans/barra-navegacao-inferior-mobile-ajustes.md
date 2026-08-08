# B171 — Barra inferior mobile: folga no topo + rótulos sem sobreposição

Status: ready
Atualizado em: 2026-08-08
Issue: #443
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: C — encaixe no chrome que todo staff vê no mobile (barra inferior)
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-b171-ui-draft.canvas.tsx`
Appetite: ~0,5 dia eng; um outcome verificável — a barra lê sem fricção no celular
Responsável: —

## Intenção

A barra inferior mobile de **B164** chegou funcional, mas com dois defeitos de leitura: os botões **encostam no limite superior da barra** (sem respiro antes da borda) e os **rótulos se sobrepõem** em telas estreitas — "Atualizações" é longo demais para a fonte atual. É polimento estético do chrome principal do staff no celular, nada funcional.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor no celular; barra fixa é o primeiro e último que ele toca.
- **Job principal:** ler os 5 destinos de relance, sem esforço, e tocar com o polegar.
- **Fluxo desejado:** a barra respira em relação à própria borda superior e cada rótulo é legível, sem colidir com o vizinho — em qualquer largura de viewport mobile.
- **Anti-goals de produto:** redesenhar a barra; mudar ordem/itens; mexer em desktop/tablet (sidebar segue igual); encolher a área de toque.

### Esboço de fluxo (C)

```text
[mobile staff, qualquer rota (app)]
  → barra: itens com folga no topo; rótulos menores e sem sobreposição
  → mesmo comportamento de toque/navegação de B164
```

## Objetivo e aceite

- Há um pequeno espaçamento entre o conteúdo dos itens e a borda superior da barra (sem o item "colado" no limite).
- Os rótulos dos 5 botões **não se sobrepõem** em viewport mobile; a fonte dos rótulos é menor que a atual.
- Área de toque e estado ativo continuam equivalentes (não ~encolher~ o alvo que o polega tenta acertar).
- Sem regressão: leader lockdown e desktop/tablet intactos (mudança restrita ao chrome da barra inferior).

## Dados (intenção)

- **Vou apresentar dados?** Não — polimento visual de chrome, sem número novo para exibir.
- **Forma:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** componente da barra inferior (shell `(app)`) — onde `getCampaignBottomNav` alimenta os itens; apenas ajuste de espaçamento/estilo dos itens e rótulos.
- **Precedente a olhar:** `barra-navegacao-inferior-mobile-impl.md` (B164); chrome de labels em outras barras mobile.
- **Risco de acoplamento:** FAB/thumb-zone acima da barra (folga não deve empurrar conteúdo); safe-area inferior; não mexer em desktop.

## Dependências

- **B164** (a barra é o entregável dele — sucessor direto; não editar o plano já entregue).

## Fora de escopo

- Redesign da barra, novos itens, ordem ou ícones.
- Mudanças de desktop/tablet/sidebar.
- Comportamento de navegação (inalterado).

## Rabbit holes de produto

- **"Já que tá aqui, redesenha a barra."** Dois jobs. **Corte:** só folga + legibilidade dos rótulos; resto é outro item.
- **"Menor é melhor em tudo."** Fonte menor demais quebra acessibilidade. **Corte:** legibilidade mínima em viewport estreito, sem encolher abaixo do padrão de UI.

## Questões em aberto (produto)

- Nenhuma pendente — o pedido é específico (folga no topo + fonte menor nos rótulos).

## Referências

- Sucessor do plano B164: [barra-navegacao-inferior-mobile.md](barra-navegacao-inferior-mobile.md)
- Canvas UI (gate): [`plan-b171-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-b171-ui-draft.canvas.tsx)
- `src/components/campaign/shell/nav.ts` · `CampaignBottomNav` (direção hipotética)
