# Sollinha: links com aparência de link nas respostas

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #528
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe no bubble do chat (estilo de links nas respostas do assistente)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-18/canvases/plan-b187-ui-draft.canvas.tsx
Appetite: ~0,5 dia eng; estilo de render de markdown + testes e2e de aparência; sem migration/schema

## Intenção

Quando o Sollinha oferece um link (ex.: "[Ilhéus](/campanha/municipios/ilheus)", via B162), ele não **parece** um link: sai igual a texto comum. O usuário quer que todo link nas respostas seja visualmente um link — no mínimo sublinhado e com cor de destaque, como um link normal em texto — e que continue clicável para navegar (ver B188).

## Persona e fluxo

- **Persona / contexto:** assessor/coordenador lendo a resposta do Sollinha no painel/drawer; precisa **perceber** que há um link sem passar o mouse.
- **Job principal:** identificar de relance onde a resposta tem atalhos clicáveis e usá-los com confiança.
- **Fluxo desejado:** a resposta chega com o link visivelmente destacado (sublinhado + cor) → o usuário reconhece → clica e navega (a navegação sem perder contexto é o item B188; aqui só a aparência).
- **Anti-goals de produto:** não redesenhar o bubble/chat; não trocar o sistema de markdown; não estilizar apenas links internos — qualquer link conta.

## Objetivo e aceite

- Todo link emitido pelo Sollinha numa resposta aparece **sublinhado e com cor de destaque** (primária do tema), distinguível do texto corrido, no tema claro **e** escuro.
- Estados de **hover e foco visíveis** (acessibilidade: foco por teclado deve aparecer).
- O resto da formatação de markdown (títulos, listas, tabelas) permanece como está.
- Links externos (se um dia existirem) abrem em nova aba; links internos `/campanha/...` continuam navegando no app.

## Dados (intenção)

- Dados: N/A — aparência apenas; nenhuma decisão de dado/agregação.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/ai/CampaignAIChat.tsx` — a renderização das mensagens do assistente usa `ReactMarkdown` com classes `prose` que **não têm efeito** (o plugin `@tailwindcss/typography` não está instalado no projeto — confirmado no CSS entry `src/app/(frontend)/styles.css`); os `<a>` do markdown ficam sem estilo. Ajustar o render de links (underline + cor primária + hover/focus, claro/escuro) mantendo o restante do markdown intacto.
- **Precedente a olhar:** `docs/plans/sollinha-tool-urls-navegacao.md` (B162 — como os links entram na resposta); `docs/plans/sollinha-contexto-sessao-janela.md` (B188 — o comportamento de clique/estado do chat é vizinho).
- **Risco de acoplamento:** mesma área de render tocada por B188 (navegação/clique) — pequeno, mas os dois itens devem ser feitos sem pisar um no outro (ou em sequência).

## Dependências

- Nenhuma dura. Nota: navegação preservando contexto é B188 (separado).

## Fora de escopo

- Mudar comportamento de navegação dos links (isso é B188).
- Estilo de mensagens do usuário (não há markdown nelas hoje).
- Instalar plugin de tipografia para o app inteiro — o escopo é o chat.

## Rabbit holes de produto

- **"Ficou bonito demais".** Se alguém "só completar", vira um polimento geral do bubble. **Corte:** só a aparência de links; nada de mudar padding/bubble/cores de fundo.
- **Alvo do link errado.** Abrir link interno em aba nova quebra a colaboração com o chat (contexto some). **Corte:** interno navega no app (comportamento atual), externo em aba nova; a navegação sem perder contexto é do B188.

## Questões em aberto (produto)

- **Cor do link:** cor primária do tema ou outra de destaque no bubble? **Recomendação:** primária do tema (é a "cor de link" padrão do app) com contraste garantido no claro e escuro. _(assumido — validar)_
- **Sublinhado em hover só ou sempre visível?** **Recomendação:** sublinhado **sempre** visível (o usuário pediu "pelo menos sublinhado"), com hover reforçando (muda cor/intensidade). _(assumido — validar)_

## Referências

- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-18/canvases/plan-b187-ui-draft.canvas.tsx`
- `src/components/campaign/shell/ai/CampaignAIChat.tsx` — render de markdown das respostas
- `src/app/(frontend)/styles.css` — entry CSS (prose sem plugin)
- `docs/plans/sollinha-tool-urls-navegacao.md` (B162) — origem dos links nas respostas
- `docs/plans/sollinha-contexto-sessao-janela.md` (B188) — irmão no mesmo render
