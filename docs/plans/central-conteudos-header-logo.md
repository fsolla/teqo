# S33 — Central de Conteúdos — logo do header no tamanho da marca

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1301
Priority: P2
Impeccable: B — encaixe no header existente da Central pública (sem rota nova)
Design UI: docs/plans/central-conteudos-header-logo-ui-design.html
Appetite: ~0,25–0,5 dia eng; correção de fidelidade visual no header
Responsável: —

## Intenção

No header da Central de Conteúdos pública (`/conteudos`), a marca lê muito menor do que no resto do site público — testado em staging pelo operador. O ativo oficial tem uma moldura transparente grande em volta do desenho, então a caixa do header mostra só uma fração dele: a marca fica com peso de detalhe, não de assinatura. A Central é a casa das peças de "Peça voto pra Solla 1313" e o header é a primeira coisa que o eleitor vê; a marca precisa ler no mesmo peso das outras páginas públicas, tirada do kit como fonte única (sem lockup novo, sem paleta inventada).

## Persona e fluxo

- **Persona / contexto:** eleitor/simpatizante no celular, com pressa, chegando de um link compartilhado no WhatsApp; a Central ainda não é familiar e a marca no topo é a âncora de confiança de que ele está no lugar certo.
- **Job principal:** reconhecer de imediato que está na Central oficial de Solla 1313 e seguir para a peça.
- **Fluxo desejado:** abre `/conteudos` → vê a marca no topo no mesmo peso das outras páginas públicas → filtra/escolhe a peça; na página da peça e no estado de não encontrado, a mesma marca com o caminho de volta.
- **Anti-goals de produto:** não vira redesign do header (nem da Central); não cria rota nem tela nova; não troca a marca por um lockup próprio nem inventa cor/tipografia; não mexe em copy, badge ou comportamento do "Voltar à Central"; não é passada de olho nas outras páginas públicas.

### Esboço de fluxo (B)

```text
[abre /conteudos (catálogo, peça, não encontrado)] → [header vermelho com a marca no peso das outras públicas]
→ [segue para a peça / volta à Central]
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-header-logo-ui-design.html` — o humano valida no gate que a marca lê no peso certo nos dois breakpoints, com a opção de ativo escolhida.

## Objetivo e aceite

- A marca no header da Central lê, nos dois breakpoints, no mesmo peso visual do header público de referência (`/jingles`) — aferido lado a lado em staging.
- Fonte única da marca é o kit 1313 (`public/campaign-kit/`); nenhum lockup recriado, nenhuma cor ou tipografia inventada.
- A correção vive no header da Central (escolha de ativo e/ou tamanho renderizado), sem redesenhar o header.
- Badge "Central de Conteúdos", link "Voltar à Central" e comportamento nos dois breakpoints permanecem.
- Nenhuma outra página pública muda (sem drive-by).

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — correção de fidelidade visual; nenhum ator decide com número.
- **Forma:** *adiada ao plano de implementação* — sem restrição de produto além da referência de peso visual acima.

## Dados da decisão (literais)

- Superfícies do header: `/conteudos` (catálogo, com e sem peças publicadas), `/conteudos/<slug>` e o não encontrado da peça — todas usam `ContentPiecePageHeader`.
- Header atual: `src/components/conteudos/ContentPiecePageHeader.tsx:12-22` — `<Image src="/campaign-kit/jorge-solla-negativo.png" ... className="h-7 w-auto object-contain sm:h-9" />`, dentro de um `div` `h-14 sm:h-16` sobre `bg-[#ae1603]`.
- Ativo atual: canvas 1037×595; recorte visível 790×285 (transparência topo 162, base 148, esquerda 123, direita 124) → marca visível ≈13,4 px em `h-7` e ≈17,2 px em `sm:h-9`.
- Referência de peso (`/jingles`): `src/components/CampaignPageHeader.tsx:20-27` com `marca-positiva-completa.png` (visível 552×415 no mesmo canvas 1037×595) em `h-[66px] sm:h-[74px]` → ≈46/52 px visíveis (≈3× a marca da Central).
- O ativo negativo `jorge-solla-negativo.png` só é usado em `ContentPiecePageHeader.tsx:16`; o S27 portou fielmente o `h-9` do artefato `docs/plans/central-conteudos-publica-ui-design.html:158-164,427-433` (cenas 01/04), mas artefato+ativo juntos renderizam pequeno.
- Dono da marca: `public/campaign-kit/README.md` (kit 1313). A pasta já tem, para fundo vermelho/escuro, a **marca completa** `marca-negativa-completa.png` (nome + 1313 + slogan; visível 552×415 no mesmo canvas, `README.md:35-37`) — ativo diferente do lockup de nome usado no header hoje; e não tem nenhuma variante **recortada** do lockup `jorge-solla-negativo.png`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/conteudos/ContentPiecePageHeader.tsx` (único componente do header da Central) e `public/campaign-kit/` (ativo/kit); rotas consumidoras em `src/app/(frontend)/conteudos/`.
- **Precedente a olhar:** `src/components/CampaignPageHeader.tsx` (header de `/jingles`, mesmo canvas, peso-alvo) e o S27 `docs/plans/central-conteudos-publica.md`.
- **Risco de acoplamento:** o header é page-local da Central (não é shell do site) — a correção não deve virar componente compartilhado nem alterar `CampaignPageHeader`.

## Dependências

- Nenhuma dura. Contexto: S27 (#1255) entregou a Central pública e o header.

## Fora de escopo

- Redesenho do header da Central ou da página (fica para novo item, se houver pedido).
- Outras páginas públicas e seus headers (`/jingles`, home, `/cards`) — sem mudanças de carona.
- Recriar lockup, paleta ou tipografia; qualquer coisa fora do kit 1313.
- Copy, badge, CTA e comportamento do "Voltar à Central".
- Qualquer mudança de dados, consentimento ou rotas.

## Rabbit holes de produto

- **"Já que estou no header, padronizo os outros."** Se alguém "só completar": vira refactor de todos os headers públicos e revisão de marca. **Corte neste item:** só o header da Central.
- **"Monto um lockup novo com o ativo recortado no Figma."** Se alguém "só completar": nasce uma marca paralela fora do kit. **Corte neste item:** kit como fonte única; no máximo preparo técnico do ativo oficial (recorte do PNG existente), não desenho novo.
- **"Ajusto o header inteiro para caber a marca."** Se alguém "só completar": muda altura, espaçamento e badge das telas. **Corte neste item:** a menor mudança que faça a marca ler no peso certo.

## Questões em aberto (produto)

- **Qual ativo/tamanho faz a marca ler no peso certo?** **Opções:** A) lockup `jorge-solla-negativo.png` com o recorte técnico da moldura transparente (preparo do ativo oficial no kit, sem redesenho); B) usar a marca completa `marca-negativa-completa.png` (nome + 1313 + slogan), que o kit destina a fundos vermelhos/escuros e tem proporção visível muito maior; C) compensar no header o tamanho renderizado do lockup atual, sem distorcer. **Recomendação:** decidir no gate com o design hi-fi mostrando A e B lado a lado (o lockup é o que o S27 desenhou; a marca completa é o ativo do kit para o fundo vermelho); C só se nenhuma das duas servir. _(assumido — validar no gate do design)_

## Referências

- Design UI (gate): `docs/plans/central-conteudos-header-logo-ui-design.html` (+ assets em `central-conteudos-header-logo-ui-design-assets/`).
- `docs/plans/central-conteudos-publica-ui-design.html` — artefato do S27 (cenas 01/04/06/07/08: header com `h-9`).
- `src/components/conteudos/ContentPiecePageHeader.tsx`, `src/components/CampaignPageHeader.tsx`, `public/campaign-kit/README.md`.
- S27: `docs/plans/central-conteudos-publica.md` (Issue #1255).

## Self-score (shaping)

1. Fatia = um outcome verificável? 5/5 — a marca no peso certo, aferida lado a lado em staging.
2. Appetite declarado e a intenção cabe nele? 5/5 — ~0,25–0,5 dia; uma escolha de ativo/tamanho.
3. Persona + job + aceite claros (sem jargão de stack)? 4/5 — aceite fala em peso visual; a aferição exige comparação em staging.
4. Direção no codebase é hipótese (não contrato técnico)? 5/5 — arquivos e classes são literais de estado atual/evidência, não prescrição.
5. Zero decisões duras de engenharia no plano? 4/5 — a questão em aberto recomenda decidir no gate; a escolha final (ativo vs compensação) fica para o gate/impl.
Média: 4,6/5 — ≥4/5.
